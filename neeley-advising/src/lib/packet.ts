import type { PlanResult, StudentRecord } from "./types";

export interface AdvisorPacket {
  status: "review_requested";
  createdAt: string;
  student: { name: string; id: string; sample: boolean; plans: string[]; catalogTerm: string; cumGpa: number; earnedHours: number };
  plan: { id: string; label: string; earliestGraduation: string | null; completeness: number; notReviewed: true };
  findings: { blockers: string[]; warnings: string[]; info: string[] };
  questions: string[];
  unverified: string[];
  sources: string[];
  reason: string;
  /** Student-supplied overlays, shown to the advisor next to the original record. */
  context?: { goals?: Record<string, unknown>; corrections?: Record<string, unknown>; correctionNotes?: string[] };
  challenge?: { findingId: string; finding: string; note: string };
}

export function buildPacket(record: StudentRecord, plan: PlanResult, reason: string): AdvisorPacket {
  const by = (sev: string) => plan.findings.filter((f) => f.severity === sev).map((f) => f.message);
  return {
    status: "review_requested",
    createdAt: new Date().toISOString(),
    student: {
      name: record.name,
      id: record.idMasked,
      sample: record.isSample,
      plans: record.plans,
      catalogTerm: record.catalogTermId,
      cumGpa: record.cumGpa,
      earnedHours: record.earnedHours,
    },
    plan: { id: plan.planId, label: plan.label, earliestGraduation: plan.earliestGraduation.label, completeness: plan.completeness, notReviewed: true },
    findings: { blockers: by("blocker"), warnings: by("warning"), info: by("info").slice(0, 6) },
    questions: plan.advisorQuestions,
    unverified: plan.unverified,
    sources: plan.sources.map((s) => `${s.id}: ${s.title} (${s.owner}, ${s.catalogYear})`),
    reason,
  };
}
