import type { PlanResult, StudentRecord } from "./types";
import { getCourse, normCode, prettyCode } from "./catalog";
import { evalExpr, ruleFor } from "./prereq";
import { scheduleCheck } from "./sections";

/**
 * Independent re-check of a finished plan against the case brief's validation list (section 5).
 * It reads the plan and the record only. It does not reuse the engine's placement logic, so a bug there
 * can show up here as a failure. Passing does not mean an advisor has reviewed the plan.
 */
export type CheckStatus = "pass" | "fail" | "labelled";
export interface Check { id: string; label: string; status: CheckStatus; detail: string }

const MIN_TOTAL = 120;

export function validatePlan(record: StudentRecord, plan: PlanResult, maxLoad = 15): Check[] {
  const checks: Check[] = [];
  const placed = new Set(plan.terms.flatMap((t) => t.courses.filter((c) => !c.placeholder).map((c) => normCode(c.code))));
  const placedAll = plan.terms.flatMap((t) => t.courses.map((c) => normCode(c.code)));

  // 1. Every required course is accounted for.
  const missing: string[] = [];
  for (const r of plan.requirements) {
    if (r.status === "complete") continue;
    for (const c of r.remainingCourses) {
      const code = normCode(c);
      if (getCourse(code) && !placed.has(code) && !r.chooseFrom?.length) missing.push(code);
    }
  }
  const unplaced = plan.findings.some((f) => f.type === "delay" && /could not place/i.test(f.message));
  checks.push({
    id: "required", label: "Every required course is in the plan or flagged",
    status: missing.length && !unplaced ? "fail" : "pass",
    detail: missing.length ? `Not placed and not flagged: ${[...new Set(missing)].slice(0, 6).map(prettyCode).join(", ")}.` : unplaced ? "Some courses could not be placed; the plan says so." : "All remaining required courses appear in a planned term.",
  });

  // 2. Completed courses are applied to real, completed or in-progress records.
  const have = new Map(record.courses.filter((c) => c.status === "completed" || c.status === "in_progress").map((c) => [c.code, c]));
  const bad: string[] = [];
  for (const r of plan.requirements) for (const c of r.satisfiedBy) if (!have.has(normCode(c))) bad.push(`${prettyCode(c)} for ${r.label}`);
  checks.push({ id: "applied", label: "Completed courses are applied to the right requirements", status: bad.length ? "fail" : "pass", detail: bad.length ? `Credited without a matching record: ${bad.slice(0, 4).join("; ")}.` : "Every course credited to a requirement is on the transcript as completed or in progress." });

  // 3. Prerequisites in sequence (grades are not rechecked).
  const done = new Set<string>([...have.keys()]);
  const seq: string[] = [];
  for (const t of plan.terms) {
    const thisTerm = new Set(t.courses.filter((c) => !c.placeholder).map((c) => normCode(c.code)));
    for (const c of t.courses) {
      if (c.placeholder) continue;
      const code = normCode(c.code);
      if (have.get(code)?.status === "in_progress") continue; // already in progress
      const rule = ruleFor(code);
      const ok = evalExpr(rule.prereq, (p) => !getCourse(p) || done.has(p));
      const coreqOk = rule.coreq.every((q) => !getCourse(q) || done.has(normCode(q)) || thisTerm.has(normCode(q)));
      if (!ok || !coreqOk) seq.push(`${prettyCode(code)} in ${t.label}`);
    }
    for (const c of thisTerm) done.add(c);
  }
  checks.push({ id: "prereq", label: "Prerequisites and corequisites come in the right order", status: seq.length ? "fail" : "pass", detail: seq.length ? `Out of order: ${seq.slice(0, 4).join("; ")}.` : "Every planned course has its prerequisites finished in an earlier term (corequisites may share a term). Minimum grades are not rechecked here." });

  // 4. Meeting times.
  const sched = scheduleCheck(plan);
  checks.push({ id: "times", label: "Meeting times do not conflict", status: "labelled", detail: `${sched.totalConflicts} conflicts in the sample schedule across ${sched.termsWithConflicts} terms. The schedule is assumed, not TCU's, so this is a demonstration, not a result.` });

  // 5. Availability labels.
  const unlabeled = plan.terms.flatMap((t) => t.courses.filter((c) => !c.placeholder && !c.availability?.confidence));
  checks.push({ id: "availability", label: "Availability is verified or labelled as an assumption", status: unlabeled.length ? "fail" : "labelled", detail: unlabeled.length ? `${unlabeled.length} planned courses have no availability label.` : "Every planned course carries a label. None is confirmed because no published schedule was supplied." });

  // 6. Policies.
  const peak = Math.max(0, ...plan.terms.map((t) => t.credits));
  const credits = plan.totalCredits;
  checks.push({ id: "policy", label: "Credit load and total hours respect the stated rules", status: peak > maxLoad || credits < MIN_TOTAL ? "fail" : "labelled", detail: `Peak load ${peak} h (assumed limit ${maxLoad}; the real limit is not in the supplied documents). Total ${credits} h against a ${MIN_TOTAL} h minimum.` });

  // 7. Graduation date support.
  checks.push({ id: "date", label: "The graduation date is supported and labelled", status: plan.earliestGraduation.label ? "labelled" : "fail", detail: plan.earliestGraduation.label ? `${plan.earliestGraduation.label}, confidence "${plan.earliestGraduation.confidence.replace("_", " ")}". It rests on historical offering patterns, not a published schedule.` : "No graduation term was produced." });

  // 8. Uncertainty communicated and no clearance claimed.
  const ok = plan.status === "draft" && plan.notReviewed === true && (plan.unverified.length > 0 || plan.advisorQuestions.length > 0);
  checks.push({ id: "uncertainty", label: "Uncertainty is stated and the plan is not presented as cleared", status: ok ? "pass" : "fail", detail: ok ? `Marked draft, not reviewed. ${plan.unverified.length} unverified items and ${plan.advisorQuestions.length} advisor questions listed.` : "The plan is missing its draft label or lists nothing as unverified." });

  void placedAll;
  return checks;
}
