import type { Tool, ToolUseBlock } from "@anthropic-ai/sdk/resources/messages";
import type { PlanResult, StudentRecord, TranscriptCourse } from "../types";
import type { Llm } from "./llm";
import { FAST_MODEL, describeAiError } from "./client";
import { gpaBySubject, parseTranscriptText } from "../transcript";
import { termIdFromTranscript } from "../terms";
import { getCourse, prettyCode } from "../catalog";

// =====================================================================
// 1. Transcript extraction: Claude reads the raw text, the deterministic parser checks it.
// =====================================================================

const SUBMIT_TRANSCRIPT: Tool = {
  name: "submit_transcript",
  description: "Submit the structured contents of the transcript exactly as printed. Do not guess: omit anything you cannot read.",
  input_schema: {
    type: "object",
    properties: {
      plans: { type: "array", items: { type: "string" }, description: "Current plan descriptions, e.g. 'Finance'." },
      requirementTerm: { type: "string", description: "Program requirement term as printed, e.g. '2025 Fall Term'." },
      courses: {
        type: "array",
        items: {
          type: "object",
          properties: {
            code: { type: "string", description: "Subject and number, e.g. 'ECON 10223'." },
            title: { type: "string" },
            term: { type: "string", description: "e.g. '2025 Fall Term'." },
            attempted: { type: "number" },
            earned: { type: "number" },
            grade: { type: "string", description: "Letter grade, P, T, W, or empty string if in progress." },
            transfer: { type: "boolean" },
            attributes: { type: "array", items: { type: "string" } },
          },
          required: ["code", "title", "term", "attempted", "earned", "grade", "transfer"],
        },
      },
      cumGpa: { type: "number" },
      earnedHours: { type: "number" },
    },
    required: ["courses"],
  } as Tool["input_schema"],
};

export interface ExtractionReport {
  record: StudentRecord;
  method: "ai+deterministic" | "deterministic";
  agreed: boolean;
  discrepancies: string[];
  notes: string[];
}

export async function extractTranscript(text: string, llm: Llm | null, opts: { isSample?: boolean } = {}): Promise<ExtractionReport> {
  const det = parseTranscriptText(text, opts);
  const notes: string[] = [];
  if (!llm) {
    notes.push("AI extraction was not run (no API key); the rule-based parser was used.");
    return { record: det, method: "deterministic", agreed: true, discrepancies: [], notes };
  }
  let res: Awaited<ReturnType<Llm>>;
  try {
    res = await llm({
    model: FAST_MODEL(),
    maxTokens: 6000,
    system:
      "You read university transcripts. Extract the courses and plans exactly as printed. Include transfer credit lines (grade T) with transfer=true. Course attribute lines belong to the course above them. A course with attempted hours but zero earned and no grade is in progress (grade ''). Never invent a course. Call submit_transcript once.",
    messages: [{ role: "user", content: `Transcript text:\n\n${text.slice(0, 30000)}` }],
    tools: [SUBMIT_TRANSCRIPT],
    });
  } catch (e) {
    notes.push(`AI extraction failed (${describeAiError(e)}); the rule-based parser was used instead.`);
    return { record: det, method: "deterministic", agreed: true, discrepancies: [], notes };
  }
  const use = res.content.find((b): b is ToolUseBlock => b.type === "tool_use");
  if (!use) {
    notes.push("The AI did not return a structured transcript; the rule-based parser was used.");
    return { record: det, method: "deterministic", agreed: false, discrepancies: ["AI returned no structured output"], notes };
  }
  const ai = use.input as { courses?: { code: string; term: string; attempted: number; earned: number; grade: string; transfer: boolean }[] };
  const key = (c: { code: string; termId?: string; term?: string }) => `${c.code.replace(/\s+/g, "").toUpperCase()}|${c.termId ?? termIdFromTranscript(c.term ?? "") ?? ""}`;
  const detMap = new Map(det.courses.map((c) => [key(c), c]));
  const aiMap = new Map((ai.courses ?? []).map((c) => [key(c), c]));
  const discrepancies: string[] = [];
  for (const [k, c] of detMap) {
    const a = aiMap.get(k);
    if (!a) discrepancies.push(`${k.split("|")[0]}: found by the parser but not by the AI.`);
    else {
      if ((a.grade || "") !== (c.grade || "")) discrepancies.push(`${k.split("|")[0]}: grade differs (parser "${c.grade}", AI "${a.grade}").`);
      if (Math.abs((a.earned ?? 0) - c.earned) > 0.01) discrepancies.push(`${k.split("|")[0]}: earned hours differ (parser ${c.earned}, AI ${a.earned}).`);
    }
  }
  for (const k of aiMap.keys()) if (!detMap.has(k)) discrepancies.push(`${k.split("|")[0]}: reported by the AI but not found by the parser.`);
  const agreed = discrepancies.length === 0;
  if (agreed) notes.push(`Two independent readings agree on all ${det.courses.length} courses.`);
  else notes.push("The AI and the rule-based parser disagree. The rule-based reading was used; please confirm the items below against your transcript.");
  return { record: det, method: "ai+deterministic", agreed, discrepancies, notes };
}

// =====================================================================
// 2. Student profile
// =====================================================================

export interface Claim {
  claim: string;
  evidence: string[]; // course codes from the transcript
  confidence: "high" | "medium" | "low";
}

export interface StudentProfile {
  headline: string;
  strengths: Claim[];
  interests: Claim[];
  risks: Claim[];
  gaps: Claim[];
  careerPossibilities: { field: string; why: string; evidence: string[] }[];
  questionsToConfirm: string[];
  limits: string;
  generatedBy: "claude" | "rules";
  removedUnsupported: number;
}

const SUBMIT_PROFILE: Tool = {
  name: "submit_profile",
  description: "Submit the student profile inferred from the transcript. Every claim needs evidence: the course codes it is based on.",
  input_schema: {
    type: "object",
    properties: {
      headline: { type: "string", description: "One plain sentence describing the academic picture." },
      strengths: { type: "array", items: claimSchema() },
      interests: { type: "array", items: claimSchema() },
      risks: { type: "array", items: claimSchema() },
      gaps: { type: "array", items: claimSchema() },
      careerPossibilities: {
        type: "array",
        items: { type: "object", properties: { field: { type: "string" }, why: { type: "string" }, evidence: { type: "array", items: { type: "string" } } }, required: ["field", "why", "evidence"] },
      },
      questionsToConfirm: { type: "array", items: { type: "string" }, description: "Questions to ask the student to confirm or correct the inferences." },
    },
    required: ["headline", "strengths", "interests", "risks", "gaps", "careerPossibilities", "questionsToConfirm"],
  } as Tool["input_schema"],
};

function claimSchema() {
  return {
    type: "object",
    properties: {
      claim: { type: "string" },
      evidence: { type: "array", items: { type: "string" }, description: "Course codes from the transcript, e.g. 'ECON 10223'." },
      confidence: { type: "string", enum: ["high", "medium", "low"] },
    },
    required: ["claim", "evidence", "confidence"],
  };
}

const LIMITS =
  "Inferred from the transcript only. It is a starting point for a conversation, not a diagnosis. Please confirm or correct it. Nothing here uses demographic traits.";

function features(record: StudentRecord, plan?: PlanResult) {
  return {
    plans: record.plans,
    catalogTermOnRecord: record.catalogTermId,
    currentTerm: record.currentTermId,
    cumulativeGpa: record.cumGpa,
    earnedHours: record.earnedHours,
    courses: record.courses.map((c) => ({
      code: prettyCode(c.code), title: c.title, term: c.termId, credits: c.status === "in_progress" ? c.attempted : c.earned, grade: c.grade || "in progress",
      transfer: c.transfer, status: c.status, attributes: c.attributes, topic: c.topic,
    })),
    gpaBySubject: gpaBySubject(record).map((s) => ({ subject: s.subject, gpa: s.gpa, hours: s.hours })),
    engine: plan
      ? {
          earliestGraduation: plan.earliestGraduation.label,
          bottleneck: plan.bottleneck?.why,
          topFindings: plan.findings.filter((f) => f.severity !== "info").slice(0, 6).map((f) => f.message),
        }
      : undefined,
  };
}

const codeKey = (c: string) => c.replace(/\s+/g, "").toUpperCase();

function validate(raw: Omit<StudentProfile, "generatedBy" | "removedUnsupported" | "limits">, record: StudentRecord) {
  const onRecord = new Set(record.courses.map((c) => codeKey(c.code)));
  let removed = 0;
  const cleanClaims = (cs: Claim[] = []): Claim[] =>
    cs
      .map((c) => ({ ...c, evidence: (c.evidence ?? []).map(codeKey).filter((e) => onRecord.has(e)).map(prettyCode) }))
      .filter((c) => {
        if (!c.evidence.length) { removed++; return false; }
        return true;
      });
  const careerPossibilities = (raw.careerPossibilities ?? [])
    .map((c) => ({ ...c, evidence: (c.evidence ?? []).map(codeKey).filter((e) => onRecord.has(e)).map(prettyCode) }))
    .filter((c) => { if (!c.evidence.length) { removed++; return false; } return true; });
  return {
    headline: raw.headline,
    strengths: cleanClaims(raw.strengths),
    interests: cleanClaims(raw.interests),
    risks: cleanClaims(raw.risks),
    gaps: cleanClaims(raw.gaps),
    careerPossibilities,
    questionsToConfirm: raw.questionsToConfirm ?? [],
    removed,
  };
}

export async function profileStudent(record: StudentRecord, llm: Llm | null, plan?: PlanResult): Promise<StudentProfile> {
  if (!llm) return rulesProfile(record, plan);
  let res: Awaited<ReturnType<Llm>>;
  try {
    res = await llm({
    maxTokens: 3000,
    system:
      "You build an academic profile of a student from their transcript, for an advising tool. Use ONLY the transcript data given. Every claim must cite the course codes it rests on. Label inferences as inferences (confidence high only when several courses and grades agree). Strengths come from grades (A and B+ work, subject GPAs). Interests come from electives chosen beyond requirements, honors topics and course attributes. Risks come from in-progress prerequisites, low grades, heavy chains, P/NC use, unevaluated transfer credit. Gaps are things a student at this stage commonly still lacks for their stated plans. Career possibilities are fields to EXPLORE, never predictions or guarantees. Do not infer or mention race, religion, health, immigration, family or income. Do not mention the student's name. Keep each claim to one sentence. Then call submit_profile once.",
    messages: [{ role: "user", content: `Transcript features (JSON):\n${JSON.stringify(features(record, plan))}` }],
    tools: [SUBMIT_PROFILE],
    });
  } catch (e) {
    const p = rulesProfile(record, plan);
    return { ...p, limits: `${p.limits} Claude was unavailable (${describeAiError(e)}).` };
  }
  const use = res.content.find((b): b is ToolUseBlock => b.type === "tool_use");
  if (!use) return rulesProfile(record, plan);
  const v = validate(use.input as never, record);
  return { ...v, limits: LIMITS, generatedBy: "claude", removedUnsupported: v.removed };
}

/** Rule-based profile used when Claude is unavailable, and as a sanity baseline. */
export function rulesProfile(record: StudentRecord, plan?: PlanResult): StudentProfile {
  const subj = gpaBySubject(record);
  const strengths: Claim[] = subj
    .filter((s) => s.gpa >= 3.5 && s.hours >= 3)
    .map((s) => ({ claim: `Strong grades in ${s.subject} (${s.gpa.toFixed(2)} over ${s.hours} hours).`, evidence: s.courses.map(prettyCode), confidence: (s.hours >= 6 ? "high" : "medium") as Claim["confidence"] }));
  const electives = record.courses.filter((c) => !c.transfer && c.status !== "withdrawn" && /Fine Arts|Humanities|Natural Science|Religious|Historical/i.test(c.attributes.join(" ")));
  const interests: Claim[] = electives.slice(0, 3).map((c) => ({ claim: `Chose ${c.title} to meet a Core requirement; one data point on what draws them.`, evidence: [prettyCode(c.code)], confidence: "low" }));
  const risks: Claim[] = [];
  const inProg = record.courses.filter((c) => c.status === "in_progress");
  if (inProg.length) risks.push({ claim: `${inProg.length} courses are in progress this term, so several next-term courses depend on final grades.`, evidence: inProg.map((c) => prettyCode(c.code)), confidence: "high" });
  const pnc = record.courses.filter((c) => c.grade === "P");
  if (pnc.length) risks.push({ claim: `${pnc.reduce((a, c) => a + c.earned, 0)} pass/no-credit hours are used; the business limit is 6.`, evidence: pnc.map((c) => prettyCode(c.code)), confidence: "high" });
  const gaps: Claim[] = [];
  if (plan?.bottleneck) gaps.push({ claim: plan.bottleneck.why, evidence: record.courses.slice(0, 1).map((c) => prettyCode(c.code)), confidence: "medium" });
  return {
    headline: `${record.plans.join(" and ")} student with a ${record.cumGpa.toFixed(2)} GPA and ${record.earnedHours} earned hours.`,
    strengths, interests, risks, gaps: gaps.filter((g) => g.evidence.length), careerPossibilities: [],
    questionsToConfirm: ["Is the list of courses and grades right?", "Which of your classes did you enjoy most, and which would you avoid if you could?", "What kind of work can you picture after graduation?"],
    limits: LIMITS + " (Rule-based fallback: the AI was not available.)",
    generatedBy: "rules",
    removedUnsupported: 0,
  };
}

export function knownCourse(code: string): boolean {
  return !!getCourse(code);
}
export type { TranscriptCourse };
