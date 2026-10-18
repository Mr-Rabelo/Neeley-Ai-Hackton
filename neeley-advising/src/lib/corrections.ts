import type { PlanOptions, StudentRecord, TranscriptCourse } from "@/lib/types";

/** What the student changed on top of the record we read. The original is never modified. */
export interface CourseFix {
  grade?: string;
  termId?: string;
  removed?: boolean;
}

export interface Corrections {
  courses: Record<string, CourseFix>;
  /** What-if: treat posted transfer credit as already evaluated for BBA requirements. */
  transferEvaluated: boolean;
  note?: string;
}

export const EMPTY_CORRECTIONS: Corrections = { courses: {}, transferEvaluated: false };

/** Student-stated preferences. They build a separate plan; the default plan is untouched. */
export interface Goals {
  targetTermId?: string;
  maxCreditsPerTerm?: number;
  allowSummer?: boolean;
  careers: string[];
  gradSchool?: boolean;
  internship?: boolean;
  studyAbroad?: boolean;
  classTimes?: "none" | "morning" | "afternoon";
  want: string[]; // course codes
  avoid: string[];
  notes?: string;
}

export const EMPTY_GOALS: Goals = { careers: [], want: [], avoid: [] };

export function hasCorrections(c: Corrections): boolean {
  return c.transferEvaluated || Object.keys(c.courses).length > 0;
}

export function hasGoals(g: Goals): boolean {
  return Boolean(
    g.targetTermId || g.maxCreditsPerTerm || g.allowSummer || g.careers.length || g.gradSchool || g.internship ||
      g.studyAbroad || (g.classTimes && g.classTimes !== "none") || g.want.length || g.avoid.length,
  );
}

const TRANSFER_TOKENS: [RegExp, string][] = [
  [/\bHUM\b/, "Humanities"],
  [/\bLT\b/, "Literary Traditions"],
  [/\bSS\b/, "Social Sciences"],
  [/\bNS\b/, "Natural Sciences"],
  [/\bFA\b/, "Fine Arts"],
  [/\bMR\b/, "Mathematical Reasoning"],
  [/\bOCO\b/, "Oral Communication"],
];

/** Core categories a general transfer title claims, e.g. "General Transfer Credit-HUM, LT". */
export function inferTransferAttributes(title: string): string[] {
  return TRANSFER_TOKENS.filter(([re]) => re.test(title)).map(([, a]) => a);
}

function withFix(course: TranscriptCourse, fix: CourseFix): TranscriptCourse {
  let next: TranscriptCourse = { ...course, ...(fix.termId ? { termId: fix.termId } : {}) };
  if (fix.grade !== undefined) {
    next = { ...next, grade: fix.grade };
    if (fix.grade === "") next = { ...next, status: "in_progress", earned: 0 };
    else if (/^F/i.test(fix.grade)) next = { ...next, status: "failed", earned: 0 };
    else next = { ...next, status: "completed", earned: course.attempted || course.earned };
  }
  return next;
}

/** The record the app should use: original plus the student's overrides (original stays in `originalRecord`). */
export function applyCorrections(record: StudentRecord, c: Corrections): StudentRecord {
  if (!hasCorrections(c)) return record;
  const courses: TranscriptCourse[] = [];
  for (const course of record.courses) {
    const fix = c.courses[course.code];
    if (fix?.removed) continue;
    let next = fix ? withFix(course, fix) : course;
    if (c.transferEvaluated && next.transfer) {
      const inferred = inferTransferAttributes(next.title);
      next = { ...next, transfer: false, attributes: [...new Set([...next.attributes, ...inferred])] };
    }
    courses.push(next);
  }
  return { ...record, courses };
}

export function describeCorrections(record: StudentRecord, c: Corrections): string[] {
  const out: string[] = [];
  for (const [code, fix] of Object.entries(c.courses)) {
    const orig = record.courses.find((x) => x.code === code);
    const name = orig ? `${orig.code.replace(/(\D+)(\d+)/, "$1 $2")} ${orig.title}` : code;
    if (fix.removed) out.push(`${name}: removed (originally ${orig?.grade || "in progress"})`);
    else {
      const parts: string[] = [];
      if (fix.grade !== undefined) parts.push(`grade ${orig?.grade || "in progress"} → ${fix.grade || "in progress"}`);
      if (fix.termId) parts.push(`term ${orig?.termId} → ${fix.termId}`);
      out.push(`${name}: ${parts.join(", ")}`);
    }
  }
  if (c.transferEvaluated) out.push("Transfer credit treated as evaluated for BBA requirements (what-if; an advisor decides)");
  return out;
}

export function goalsToOptions(g: Goals): Partial<PlanOptions> {
  return {
    ...(g.maxCreditsPerTerm ? { maxCreditsPerTerm: g.maxCreditsPerTerm } : {}),
    ...(g.allowSummer ? { allowSummer: true } : {}),
    ...(g.targetTermId ? { targetTermId: g.targetTermId } : {}),
    ...(g.careers.length ? { careerTags: g.careers } : {}),
    ...(g.want.length ? { electivePrefs: g.want } : {}),
    ...(g.avoid.length ? { avoid: g.avoid } : {}),
  };
}
