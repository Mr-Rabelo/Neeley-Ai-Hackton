import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import type { PlanResult, StudentRecord } from "../types";
import { creditsFor, getCourse, getProgram, majors, minors, neeley, normCode, prettyCode, searchCourses, titleOf } from "../catalog";
import { availabilityFromCatalog, describeAvailability } from "../availability";
import { describeExpr, exprCodes, ruleFor } from "../prereq";
import { addMinorAlternative, baselineAlternative, careerAlternative, changeMajorAlternative, compare, summerAlternative, type Alternative } from "../engine/alternatives";
import { buildPlan } from "../engine/plan";
import { fitPrograms, type SurveyAnswers } from "../fit";
import { marketSummaryForAI, difficultyFor } from "../market";
import { buildPacket } from "../packet";
import { saveRow } from "../store";
import { plansToMajorIds } from "../transcript";
import { sendSms } from "../twilio";

export type Mode = "student" | "prospect" | "voice";

export interface ToolContext {
  mode: Mode;
  record?: StudentRecord;
  callerPhone?: string; // from Twilio, voice only
  pendingOptions: { question: string; options: { id: string; label: string }[] }[];
  toolSources: Set<string>; // source ids seen in tool results
  toolCourseCodes: Set<string>; // course codes that appeared in tool results
  toolText: string; // concatenated tool output, used to check quoted numbers
  baselineCache?: Alternative;
  packetId?: string;
}

export function newContext(mode: Mode, record?: StudentRecord, callerPhone?: string): ToolContext {
  return { mode, record, callerPhone, pendingOptions: [], toolSources: new Set(["S1"]), toolCourseCodes: new Set(), toolText: "" };
}

// ---------- compact summaries so tool results stay small ----------
export function summarizePlan(plan: PlanResult, maxFindings = 16) {
  return {
    label: plan.label,
    status: "Draft. Not reviewed by an advisor. Based on current information.",
    catalogYear: plan.catalogYear,
    earliestGraduation: { term: plan.earliestGraduation.label, confidence: plan.earliestGraduation.confidence },
    totalCredits: plan.totalCredits,
    remainingCreditsTo120: plan.remainingCredits,
    peakCreditsInATerm: plan.peakCredits,
    completenessScore: plan.completeness,
    terms: plan.terms.map((t) => ({
      term: t.label,
      credits: t.credits,
      courses: t.courses.map((c) => ({
        code: c.placeholder ? c.code : prettyCode(c.code),
        title: c.title,
        credits: c.credits,
        placeholder: !!c.placeholder,
        satisfies: c.satisfies.slice(0, 2),
        availability: c.placeholder ? "any approved course" : `${describeAvailability(c.availability)} (${c.availability.confidence.replace("_", " ")})`,
        why: c.reason,
      })),
    })),
    bottleneck: plan.bottleneck,
    findings: plan.findings.slice(0, maxFindings).map((f) => ({
      severity: f.severity, type: f.type, message: f.message, fix: f.fix, confidence: f.confidence, needsAdvisor: f.needsAdvisor, sources: f.sourceIds,
    })),
    unverified: plan.unverified,
    advisorQuestions: plan.advisorQuestions,
    sources: plan.sources.map((s) => ({ id: s.id, title: s.title, owner: s.owner, catalogYear: s.catalogYear })),
  };
}

function summarizeAlt(a: Alternative) {
  return {
    title: a.title,
    gains: a.gains,
    costs: a.costs,
    whatStays: a.stays,
    unverified: a.unverified,
    needsAdvisorDecision: a.advisorDecisions,
    plan: summarizePlan(a.plan, 8),
  };
}

function noteCodes(ctx: ToolContext, value: unknown) {
  const text = JSON.stringify(value);
  ctx.toolText += text + "\n";
  for (const m of text.matchAll(/\b([A-Z]{2,5}) ?(\d{5})\b/g)) ctx.toolCourseCodes.add(`${m[1]}${m[2]}`);
  for (const m of text.matchAll(/\bS(\d)\b/g)) ctx.toolSources.add(`S${m[1]}`);
}

let _unlocks: Map<string, string[]> | null = null;
function unlocksMap(): Map<string, string[]> {
  if (_unlocks) return _unlocks;
  const n = neeley();
  const codes = new Set<string>();
  for (const p of [...n.majors, ...n.minors]) {
    p.required.forEach((r) => codes.add(normCode(r.code)));
    p.groups.forEach((g) => g.from.forEach((c) => codes.add(normCode(c))));
  }
  n.businessCore.courses.forEach((c) => codes.add(normCode(c.code)));
  n.lowerDivision.beforeDeclaringMajor.forEach((c) => codes.add(normCode(c)));
  const map = new Map<string, string[]>();
  for (const c of codes) {
    for (const pre of exprCodes(ruleFor(c).prereq)) map.set(pre, [...(map.get(pre) ?? []), c]);
  }
  _unlocks = map;
  return map;
}

export function courseDetail(code: string, record?: StudentRecord) {
  const c = getCourse(code);
  if (!c) return { error: `${prettyCode(code)} is not in the supplied 2026-2027 catalog.` };
  const r = ruleFor(code);
  const a = availabilityFromCatalog(c.offered);
  const k = normCode(code);
  const requiredBy = [...neeley().majors, ...neeley().minors]
    .filter((p) => p.required.some((x) => normCode(x.code) === k) || p.groups.some((g) => g.from.map(normCode).includes(k)))
    .map((p) => p.name);
  const mine = record?.courses.find((x) => x.code === k);
  return {
    code: prettyCode(k),
    title: c.title,
    credits: creditsFor(k),
    department: c.department,
    description: c.description.slice(0, 600),
    prerequisitesAsWritten: r.prereqText || "none listed",
    prerequisitesParsed: describeExpr(r.prereq),
    corequisites: r.coreq.map(prettyCode),
    otherConditions: r.restrictions,
    wordingNeedsHumanReading: r.ambiguous,
    otherEntryPaths: r.otherPaths,
    typicallyOffered: { pattern: describeAvailability(a), confidence: a.confidence, note: a.note || "A usual pattern from the catalog, not a published schedule and not a promise." },
    unlocks: (unlocksMap().get(k) ?? []).map((x) => `${prettyCode(x)} ${titleOf(x)}`),
    prereqCodes: exprCodes(r.prereq).filter((x) => !!getCourse(x)),
    unlockCodes: unlocksMap().get(k) ?? [],
    offeredTerms: a.terms,
    offeredUnknown: a.unknown,
    offeredRare: a.rare,
    offeredAlternating: a.alternating,
    countsTowardPrograms: requiredBy,
    yourStatus: mine ? { status: mine.status, grade: mine.grade || "in progress", term: mine.termId } : undefined,
    seats: "Seat counts and meeting times are not available in the supplied data.",
    source: { id: "S1", page: c.catalogPage, title: "TCU Undergraduate 2026-2027 Catalog" },
  };
}

export function prospectRecord(startTermId = "2027-Fall", majorName = ""): StudentRecord {
  const [y, n] = startTermId.split("-");
  const idx = Number(y) * 3 + ({ Spring: 0, Summer: 1, Fall: 2 } as Record<string, number>)[n] - 1;
  const year = Math.floor(idx / 3);
  const name = (["Spring", "Summer", "Fall"] as const)[idx - year * 3];
  return {
    name: "Prospective student (sample plan)",
    idMasked: "",
    printDate: "",
    catalogTermId: startTermId,
    plans: majorName ? [majorName] : [],
    courses: [],
    cumGpa: 0,
    earnedHours: 0,
    attemptedHours: 0,
    currentTermId: `${year}-${name}`,
    isSample: true,
  };
}

// ---------- tool definitions ----------
const T = (name: string, description: string, properties: Record<string, unknown>, required: string[] = []): Tool => ({
  name,
  description,
  input_schema: { type: "object", properties, required } as Tool["input_schema"],
});

const majorIds = majors().map((m) => m.id);
const minorIds = minors().map((m) => m.id);

const GET_PLAN = T(
  "get_plan",
  "Run the deterministic planning engine for the signed-in student. Returns the semester-by-semester plan, findings (prerequisite problems, delays, missing information, policy issues), sharpest bottleneck, unverified items, advisor questions and sources. Always call this before saying anything about requirements, timing or graduation. Optionally override majors/minors, load or summer use for a what-if.",
  {
    majors: { type: "array", items: { type: "string", enum: majorIds }, description: "Override the majors on the record (what-if only)." },
    minors: { type: "array", items: { type: "string", enum: minorIds } },
    maxCreditsPerTerm: { type: "number" },
    allowSummer: { type: "boolean" },
  },
);
const GET_REQS = T("get_requirements_status", "Return remaining-requirements analysis: each requirement group with hours done, in progress, remaining and the courses that satisfy it.", {});
const COMPARE = T(
  "compare_alternatives",
  "Build an alternative plan with the same engine and compare it to the baseline. kind=add_minor needs minorId; change_major needs fromMajorId and toMajorId; career_focus needs careerTags; summer allows summer terms. Returns gains, costs, what stays the same, unverified items, advisor decisions and a fixed-row comparison table.",
  {
    kind: { type: "string", enum: ["add_minor", "change_major", "career_focus", "summer"] },
    minorId: { type: "string", enum: minorIds },
    fromMajorId: { type: "string", enum: majorIds },
    toMajorId: { type: "string", enum: majorIds },
    careerTags: { type: "array", items: { type: "string", enum: ["data", "banking", "consulting", "startups", "brand", "operations", "sales", "real-estate", "technology"] } },
  },
  ["kind"],
);
const GET_COURSE = T("get_course", "Look up one catalog course: description, prerequisites (as written and parsed), typical offering with its confidence label, what it unlocks, which programs count it, and the student's own status.", { code: { type: "string", description: "e.g. FINA 30153" } }, ["code"]);
const SEARCH = T("search_courses", "Search the 2026-2027 undergraduate catalog by code prefix, title or description. Returns up to 8 matches.", { query: { type: "string" } }, ["query"]);
const MARKET = T(
  "get_market_info",
  "Job market information for a Neeley major from the U.S. Bureau of Labor Statistics: median pay, projected growth (10-year, with interpolated 3 and 5 year estimates), openings, routes from the catalog, skills, a structure-based difficulty estimate. Present as possibilities, never guarantees.",
  { majorId: { type: "string", enum: majorIds } },
  ["majorId"],
);
const LIST = T("list_programs", "List Neeley majors and minors with ids and catalog pages.", {});
const OPTIONS = T(
  "offer_options",
  "Show the user clickable option chips for your next question (4 to 6 options). Use this for every question you ask a prospective student, then stop and wait for their pick.",
  { question: { type: "string" }, options: { type: "array", items: { type: "object", properties: { id: { type: "string" }, label: { type: "string" } }, required: ["id", "label"] }, minItems: 2, maxItems: 8 } },
  ["question", "options"],
);
const FIT = T(
  "fit_programs",
  "Rank Neeley majors against what the prospective student has said so far. Pass every answer collected. Returns the top 3 with plain reasons and a confidence score; low confidence means ask more questions instead of recommending.",
  {
    interests: { type: "array", items: { type: "string", enum: ["technology", "people", "money", "creativity", "building", "helping", "business", "data"] } },
    strengths: { type: "array", items: { type: "string", enum: ["math", "writing", "speaking", "science", "art", "leading"] } },
    quant: { type: "number", minimum: 1, maximum: 5 },
    communication: { type: "number", minimum: 1, maximum: 5 },
    people: { type: "number", minimum: 1, maximum: 5, description: "1 = analysis, 5 = people" },
    creative: { type: "number", minimum: 1, maximum: 5, description: "1 = structured, 5 = creative" },
    leadership: { type: "number", minimum: 1, maximum: 5 },
    careers: { type: "array", items: { type: "string", enum: ["data", "banking", "consulting", "startups", "brand", "operations", "sales", "real-estate", "technology"] } },
    values: { type: "array", items: { type: "string", enum: ["income", "stability", "impact", "flexibility", "growth"] } },
  },
);
const SAMPLE = T("sample_plan", "Build a sample four-year plan for a major as if the student starts from zero (default start Fall 2027). Labeled as a sample.", { majorId: { type: "string", enum: majorIds }, startTermId: { type: "string", description: "e.g. 2027-Fall" } }, ["majorId"]);
const PACKET = T(
  "create_advisor_packet",
  "Create an advisor review packet from the student's plan and save the review request. Only call after the student has said yes to sending it. Never say the plan is approved.",
  { reason: { type: "string" }, studentConfirmed: { type: "boolean", description: "Must be true: the student agreed to send this to an advisor." } },
  ["reason", "studentConfirmed"],
);
const CALLBACK = T(
  "request_advisor_callback",
  "Save a request for an advisor to call or meet the person. Only after they gave a name, a phone number and said yes to being contacted.",
  { name: { type: "string" }, phone: { type: "string" }, preferredTime: { type: "string" }, topic: { type: "string" }, consent: { type: "boolean" } },
  ["name", "topic", "consent"],
);

const TEXT_LINK = T(
  "send_text_link",
  "Text the caller a link to the Neeley advising website so they can sign in and see their own plan. Only after they say yes. Uses the number they are calling from unless they give another.",
  { phone: { type: "string" }, consent: { type: "boolean" } },
  ["consent"],
);

export function toolsFor(mode: Mode): Tool[] {
  if (mode === "student") return [GET_PLAN, GET_REQS, COMPARE, GET_COURSE, SEARCH, MARKET, LIST, PACKET, OPTIONS];
  if (mode === "voice") return [FIT, MARKET, GET_COURSE, SEARCH, LIST, SAMPLE, CALLBACK, TEXT_LINK];
  return [FIT, MARKET, GET_COURSE, SEARCH, LIST, SAMPLE, OPTIONS, CALLBACK];
}

function baseline(ctx: ToolContext): Alternative {
  if (!ctx.record) throw new Error("No student record is loaded.");
  ctx.baselineCache ??= baselineAlternative(ctx.record);
  return ctx.baselineCache;
}

// ---------- executor ----------
export async function executeTool(name: string, input: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
  try {
    const out = await run(name, input, ctx);
    noteCodes(ctx, out);
    return out;
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

async function run(name: string, input: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
  switch (name) {
    case "get_plan": {
      if (!ctx.record) return { error: "No transcript is loaded. Ask the student to load their transcript or use the sample student." };
      const hasOverride = input.majors || input.minors || input.maxCreditsPerTerm || input.allowSummer;
      if (!hasOverride) return summarizePlan(baseline(ctx).plan);
      const { majors: mm } = plansToMajorIds(ctx.record.plans);
      const plan = buildPlan(
        ctx.record,
        {
          majors: (input.majors as string[]) ?? mm,
          minors: (input.minors as string[]) ?? [],
          maxCreditsPerTerm: (input.maxCreditsPerTerm as number) ?? 15,
          allowSummer: !!input.allowSummer,
          targetTermId: baseline(ctx).plan.earliestGraduation.termId ?? undefined,
        },
        "What-if plan",
      );
      return summarizePlan(plan);
    }
    case "get_requirements_status": {
      if (!ctx.record) return { error: "No transcript is loaded." };
      return baseline(ctx).plan.requirements.map((r) => ({
        requirement: r.label, status: r.status, hoursDone: r.hoursDone, hoursInProgress: r.hoursInProgress, hoursNeeded: r.hoursNeeded,
        satisfiedBy: r.satisfiedBy.map(prettyCode), stillNeeded: r.remainingCourses.map(prettyCode), chooseFrom: r.chooseFrom?.slice(0, 12).map(prettyCode), note: r.note, source: `${r.sourceId}${r.page ? ` p.${r.page}` : ""}`,
      }));
    }
    case "compare_alternatives": {
      if (!ctx.record) return { error: "No transcript is loaded." };
      const base = baseline(ctx);
      let alt: Alternative;
      const kind = input.kind as string;
      if (kind === "add_minor") {
        if (!input.minorId) return { error: "minorId is required" };
        alt = addMinorAlternative(ctx.record, base, input.minorId as string);
      } else if (kind === "change_major") {
        const from = (input.fromMajorId as string) ?? base.plan.generatedFor.majors[base.plan.generatedFor.majors.length - 1];
        if (!input.toMajorId) return { error: "toMajorId is required" };
        alt = changeMajorAlternative(ctx.record, base, from, input.toMajorId as string);
      } else if (kind === "career_focus") {
        alt = careerAlternative(ctx.record, base, (input.careerTags as string[]) ?? []);
      } else alt = summerAlternative(ctx.record, base);
      return { baseline: { title: base.title, earliestGraduation: base.plan.earliestGraduation.label }, alternative: summarizeAlt(alt), comparison: compare(base, [alt]).map((r) => ({ row: r.label, values: r.values, differs: r.differs })), neutral: "Do not rank these paths. Present trade-offs and questions for the advisor." };
    }
    case "get_course":
      return courseDetail(String(input.code ?? ""), ctx.record);
    case "search_courses":
      return searchCourses(String(input.query ?? ""), 8).map((c) => ({ code: c.code, title: c.title, typicallyOffered: c.offered || "not stated", prerequisites: c.prerequisiteText || "none listed" }));
    case "get_market_info": {
      const id = String(input.majorId);
      const m = marketSummaryForAI(id);
      if (!m) return { error: `No market data for ${id}.` };
      const d = difficultyFor(id);
      return { ...m, difficulty: { label: d.label, inputs: d.inputs, method: d.method }, source: { id: "S5", title: "BLS Occupational Outlook Handbook, 2025-35 projections", owner: "U.S. Bureau of Labor Statistics" } };
    }
    case "list_programs":
      return { majors: majors().map((m) => ({ id: m.id, name: m.name, catalogPage: m.page })), minors: minors().map((m) => ({ id: m.id, name: m.name, catalogPage: m.page })) };
    case "offer_options": {
      const options = (input.options as { id: string; label: string }[]) ?? [];
      ctx.pendingOptions.push({ question: String(input.question ?? ""), options });
      return { shown: true, note: "The options are on the user's screen. End your turn with a one-sentence lead-in and wait for their pick." };
    }
    case "fit_programs": {
      const a = input as SurveyAnswers;
      const r = fitPrograms(a);
      return {
        topPrograms: r.results.map((x) => ({ programId: x.programId, name: x.name, score: x.score, reasons: x.reasons })),
        confidence: r.confidence, needMoreAnswers: r.needMore, skippedAreas: r.skipped, note: r.note,
        caution: "Profiles are drafts built from catalog descriptions and not reviewed by advisors. Offer these as possibilities to explore.",
      };
    }
    case "sample_plan": {
      const id = String(input.majorId);
      const prog = getProgram(id);
      if (!prog) return { error: `Unknown major ${id}` };
      const rec = prospectRecord((input.startTermId as string) || "2027-Fall", prog.name);
      const plan = buildPlan(rec, { majors: [id], minors: [], maxCreditsPerTerm: 15, allowSummer: false }, `Sample plan: ${prog.name}`);
      return { ...summarizePlan(plan, 8), sampleNote: "This is a sample from zero credits, not a prediction for any person." };
    }
    case "create_advisor_packet": {
      if (!ctx.record) return { error: "No transcript is loaded." };
      if (!input.studentConfirmed) return { error: "Ask the student first. Only create the packet after they say yes." };
      const packet = buildPacket(ctx.record, baseline(ctx).plan, String(input.reason ?? ""));
      const saved = await saveRow("advisor_requests", { type: "review", status: "review_requested", packet, contact: null, channel: "chat" });
      ctx.packetId = saved.id;
      return { requestId: saved.id, stored: saved.stored, status: "review_requested", questionsForAdvisor: packet.questions, note: "The plan stays a draft until an advisor reviews it. Never say it is approved." };
    }
    case "request_advisor_callback": {
      if (!input.consent) return { error: "Ask for consent to be contacted first." };
      const saved = await saveRow("advisor_requests", {
        type: "callback", status: "requested", contact: { name: input.name, phone: input.phone || ctx.callerPhone || null }, preferred_time: input.preferredTime || null,
        topic: input.topic, channel: ctx.mode === "voice" ? "voice" : "chat",
      });
      return { requestId: saved.id, stored: saved.stored, status: "requested" };
    }
    case "send_text_link": {
      if (!input.consent) return { error: "Ask for a clear yes first." };
      const to = String(input.phone || ctx.callerPhone || "");
      if (!to) return { error: "No phone number is available." };
      const base = process.env.APP_BASE_URL || "the Neeley advising website";
      const res = await sendSms(to, `Neeley Advising: sign in to see your own plan at ${base}. This is a demo; nothing here changes your official record.`);
      return res.sent ? { sent: true } : { sent: false, reason: res.reason, note: "Tell the caller the text could not be sent and offer an advisor call-back instead." };
    }
    default:
      return { error: `Unknown tool ${name}` };
  }
}
