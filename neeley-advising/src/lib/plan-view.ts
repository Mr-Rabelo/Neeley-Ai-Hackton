import type { PlanResult, PlannedTerm, StudentRecord } from "./types";

/** Pure display helpers for the plan page. They only regroup data the engine already produced. */

export const YEAR_NAMES = ["Freshman", "Sophomore", "Junior", "Senior"] as const;

export function academicYearOf(termId: string): number {
  const [y, n] = termId.split("-");
  return n === "Fall" ? Number(y) : Number(y) - 1;
}

export const yearRange = (ay: number) => `${ay}–${String(ay + 1).slice(2)}`;

export function termLabel(termId: string): string {
  const [y, n] = termId.split("-");
  return `${n} ${y}`;
}

const termOrder = (termId: string) => {
  const [y, n] = termId.split("-");
  return Number(y) * 3 + ({ Spring: 0, Summer: 1, Fall: 2 } as Record<string, number>)[n];
};

export interface CompletedCourse { code: string; title: string; hours: number; grade: string; transfer: boolean }
export interface CompletedTerm { termId: string; label: string; courses: CompletedCourse[]; hours: number }

export interface YearGroup {
  ay: number;
  name: string; // Freshman, Sophomore... or Year 1
  range: string; // 2026–27
  status: "completed" | "current" | "upcoming";
  completed: CompletedTerm[];
  inProgress: { termId: string; label: string; courses: CompletedCourse[]; hours: number } | null;
  planned: PlannedTerm[];
  earnedHours: number;
  transferHours: number;
  plannedHours: number;
}

export function completedTerms(record: StudentRecord | null | undefined): CompletedTerm[] {
  if (!record) return [];
  const by = new Map<string, CompletedTerm>();
  for (const c of record.courses) {
    if (c.status !== "completed") continue;
    const t = by.get(c.termId) ?? { termId: c.termId, label: termLabel(c.termId), courses: [], hours: 0 };
    t.courses.push({ code: c.code, title: c.title, hours: c.earned, grade: c.grade, transfer: c.transfer });
    t.hours += c.earned;
    by.set(c.termId, t);
  }
  return [...by.values()].sort((a, b) => termOrder(a.termId) - termOrder(b.termId));
}

export function buildYearGroups(plan: PlanResult, record?: StudentRecord | null): YearGroup[] {
  const hasHistory = !!record && record.courses.length > 0;
  const done = completedTerms(record);
  const inProg = hasHistory ? record!.courses.filter((c) => c.status === "in_progress") : [];
  const currentTermId = inProg.length ? record!.currentTermId : null;

  const ays = new Set<number>();
  done.forEach((t) => ays.add(academicYearOf(t.termId)));
  plan.terms.forEach((t) => ays.add(academicYearOf(t.termId)));
  if (currentTermId) ays.add(academicYearOf(currentTermId));
  if (!ays.size) return [];
  const catalogAy = hasHistory && record!.catalogTermId ? academicYearOf(record!.catalogTermId) : Infinity;
  const startAy = Math.min(...ays, catalogAy);
  const lo = startAy;
  const hi = Math.max(...ays);

  const groups: YearGroup[] = [];
  for (let ay = lo; ay <= hi; ay++) {
    const idx = ay - startAy;
    const completed = done.filter((t) => academicYearOf(t.termId) === ay);
    const planned = plan.terms.filter((t) => academicYearOf(t.termId) === ay);
    const ip = currentTermId && academicYearOf(currentTermId) === ay
      ? { termId: currentTermId, label: termLabel(currentTermId), courses: inProg.map((c) => ({ code: c.code, title: c.title, hours: c.attempted, grade: "", transfer: c.transfer })), hours: inProg.reduce((a, c) => a + c.attempted, 0) }
      : null;
    const name = hasHistory ? (YEAR_NAMES[idx] ?? `Year ${idx + 1}`) : `Year ${idx + 1}`;
    groups.push({
      ay, name, range: yearRange(ay),
      status: ip ? "current" : planned.length ? "upcoming" : "completed",
      completed, inProgress: ip, planned,
      earnedHours: completed.reduce((a, t) => a + t.hours, 0),
      transferHours: completed.reduce((a, t) => a + t.courses.filter((c) => c.transfer).reduce((x, c) => x + c.hours, 0), 0),
      plannedHours: planned.reduce((a, t) => a + t.credits, 0),
    });
  }
  // A year with only completed terms and nothing ahead is "completed"; a year before the current one is too.
  const curIdx = groups.findIndex((g) => g.status === "current");
  return groups.map((g, i) => (curIdx >= 0 && i < curIdx ? { ...g, status: "completed" as const } : g));
}

/** Year tab to open first: the current year, else the first year that has planned terms. */
export function defaultYearIndex(groups: YearGroup[]): number {
  const cur = groups.findIndex((g) => g.status === "current");
  if (cur >= 0) return cur;
  const up = groups.findIndex((g) => g.planned.length > 0);
  return up >= 0 ? up : 0;
}

export function findingSummary(plan: PlanResult) {
  const n = (s: string) => plan.findings.filter((f) => f.severity === s).length;
  return { blocker: n("blocker"), warning: n("warning"), info: n("info"), total: plan.findings.length };
}
