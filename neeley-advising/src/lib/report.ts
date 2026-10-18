import type { Finding, PlanResult, RequirementStatus } from "./types";

/**
 * Findings table for the case brief: one row per finding with Finding, Evidence, Student impact (with the
 * assumptions shown), Affected students and Confidence. It restates what the engine already found in plainer terms.
 * Impact text is rule-based (no AI) and uses numbers from the plan itself. Costs are never estimated: no sourced
 * tuition or living-expense rates were supplied.
 */
export interface ReportRow {
  id: string;
  severity: Finding["severity"];
  type: Finding["type"];
  finding: string;
  fix?: string;
  evidence: string[];
  impact: string;
  assumptions: string[];
  affected: string;
  confidence: string;
  needsAdvisor: boolean;
  courses: string[];
}

const CONF: Record<string, string> = { confirmed: "High", historical_pattern: "Medium", forecast: "Low", assumption: "Low" };
const CONF_WORD: Record<string, string> = { confirmed: "High (confirmed)", historical_pattern: "Medium (usual pattern)", forecast: "Low (forecast)", assumption: "Low (assumption)" };
const A_LOAD = "Assumes 15 credit hours per term; the supplied documents do not state a maximum load.";
const A_PATTERN = "Assumes the catalog's typical offering pattern holds; no published schedule was supplied.";
const A_GRADE = "Assumes in-progress courses finish with at least the minimum grade.";
const pretty = (c: string) => c.replace(/^([A-Z]+)(\d+)$/, "$1 $2");

export function sourceLabel(plan: PlanResult, id: string): string {
  const s = plan.sources.find((x) => x.id === id);
  return s ? `${s.id}: ${s.title}${s.catalogYear !== "n/a" ? ` (${s.catalogYear})` : ""}` : id;
}

function terms(n: number) { return `${n} term${n === 1 ? "" : "s"}`; }

export function buildFindingsReport(plan: PlanResult): ReportRow[] {
  const slip = (code?: string) => plan.slips.find((s) => s.code === code)?.slipTerms;
  const extraHours = Math.max(0, plan.totalCredits - 120);
  return plan.findings.map((f): ReportRow => {
    const m = f.message;
    const first = f.courseIds[0];
    let impact = "";
    let affected = "";
    const assumptions: string[] = [];

    if (f.type === "prereq" && /prerequisite .* is also in progress in the same term/.test(m)) {
      impact = "The course may not be allowed this term without an override. If it has to move, it and every course that depends on it shift by about one term.";
      affected = `Students taking ${pretty(first ?? "the course")} in the same term as its prerequisite.`;
    } else if (f.type === "prereq" && /still in progress/.test(m)) {
      impact = `The plan only holds if the final grade meets the minimum. Otherwise ${pretty(first ?? "the course")} and what depends on it slip by at least one term.`;
      affected = "Students whose prerequisite course is in progress.";
      assumptions.push(A_GRADE);
    } else if (f.type === "prereq") {
      impact = f.severity === "blocker" ? "The course cannot be taken in that term and must move to a later one." : "Registration for the course could be blocked until this is resolved.";
      affected = `Students planning ${pretty(first ?? "this course")} before its prerequisites are done.`;
    } else if (f.type === "delay" && /^Sharpest bottleneck/.test(m)) {
      const n = plan.bottleneck?.slipTerms ?? slip(plan.bottleneck?.code) ?? 0;
      impact = n > 0 ? `Missing this course once moves the finish back about ${terms(n)} (engine slip test). It also holds up ${plan.bottleneck?.descendants ?? 0} other planned courses.` : `Missing it once does not move the finish in this plan, but it holds up ${plan.bottleneck?.descendants ?? 0} other courses.`;
      affected = "Students who still need this course and have not yet taken it, especially anyone adding a major or minor that depends on it.";
      assumptions.push(A_PATTERN, A_LOAD);
    } else if (f.type === "delay" && /^Slip test/.test(m)) {
      const n = slip(first) ?? Number((m.match(/about (\d+) term/) ?? [])[1] ?? 1);
      impact = `If this course is missed in its planned term, the finish moves back about ${terms(n)}.`;
      affected = "Students who need this course and can only take it in one term a year.";
      assumptions.push(A_PATTERN, A_LOAD);
    } else if (f.type === "delay" && /could not place/.test(m)) {
      impact = "These courses cannot be scheduled within the planning window, so a graduation date cannot be confirmed.";
      affected = "Students whose remaining requirements depend on rarely offered or sequence-limited courses.";
      assumptions.push(A_PATTERN);
    } else if (f.type === "delay") {
      impact = "The finish is later than a four-year path. Extra tuition and living costs are not estimated because no sourced rates were supplied.";
      affected = "Students whose plan runs past their target term.";
      assumptions.push(A_LOAD);
    } else if (f.type === "opportunity") {
      impact = "There is room in the plan to add electives, a minor or experiences without moving the finish date.";
      affected = "Students with open hours in their remaining terms.";
      assumptions.push(A_LOAD);
    } else if (f.type === "policy" && /pass\/no-credit/.test(m)) {
      impact = "Any further pass/no-credit course would exceed the business limit and would not count as intended.";
      affected = "Business students who used pass/no-credit hours in non-business courses.";
    } else if (f.type === "policy" && /majors/.test(m)) {
      impact = `The plan totals ${plan.totalCredits} credit hours against the 120 required, about ${extraHours} extra hours (roughly ${terms(Math.round((extraHours / 15) * 10) / 10 || 0)} of load). Cost is not estimated.`;
      affected = "Double majors, and students pairing a major with a minor.";
      assumptions.push(A_LOAD, "Whether courses may count toward both majors is not stated in the supplied catalog.");
    } else if (f.type === "policy") {
      impact = "A policy requirement may not be met as the record stands, which could affect advancement or graduation until an advisor confirms.";
      affected = "Students who declared a major before completing its lower-division requirements.";
    } else if (f.type === "unverified" && /Offering must be confirmed|offering unknown|Offering unknown/.test(m)) {
      impact = "If the course is not offered in the assumed term, it moves to the next possible term, which can delay everything that depends on it.";
      affected = "Students who need this required course.";
      assumptions.push(A_PATTERN);
    } else if (f.type === "unverified" && /rarely offered/.test(m)) {
      impact = "The finish may depend on a department decision about whether the course runs.";
      affected = "Students who need a rarely offered course.";
    } else if (f.type === "unverified" && /rely on the catalog/.test(m)) {
      impact = "A typical pattern is not a schedule. Any of these courses could move a term if it is not offered when expected.";
      affected = "Every student whose plan uses these courses.";
      assumptions.push(A_PATTERN);
    } else if (f.type === "unverified") {
      impact = "A requirement tied to this item cannot be confirmed from a transcript, so progress toward it is unknown.";
      affected = "Students who must meet requirements the transcript cannot show.";
    } else if (f.type === "missing_info" && /requirement term/.test(m)) {
      impact = "The degree requirements that apply to the student could differ from the catalog used, so required courses or hours could change.";
      affected = "Students admitted before the current catalog year.";
    } else if (f.type === "missing_info" && /transfer hours/.test(m)) {
      impact = "Transfer hours count toward the 120 total only. If an advisor applies them to Core or business requirements, some planned courses could drop off and the finish could move earlier.";
      affected = "Students with transfer, AP, IB or dual credit.";
    } else if (f.type === "missing_info" && /Meeting times were not checked/.test(m)) {
      impact = "Time conflicts, full sections and seat limits cannot be ruled out from catalog data alone. See the sample weekly schedule for an illustration.";
      affected = "Every student planning courses for a real term.";
    } else if (f.type === "missing_info") {
      impact = "Plan accuracy is lower until this is resolved; the plan completeness score reflects it.";
      affected = "Students whose records or catalog entries are incomplete or inconsistent.";
    } else {
      impact = "Context for the plan; it does not move a date by itself.";
      affected = "Students in a similar situation.";
    }
    const evidence = [...f.sourceIds.map((id) => sourceLabel(plan, id)), ...(f.courseIds.length ? [`Courses: ${[...new Set(f.courseIds)].map(pretty).join(", ")}`] : []), ...(f.type === "delay" || f.type === "prereq" ? ["Engine calculation"] : [])];
    return {
      id: f.id, severity: f.severity, type: f.type, finding: m, fix: f.fix, evidence, impact, assumptions: [...new Set(assumptions)],
      affected, confidence: CONF_WORD[f.confidence] ?? CONF[f.confidence] ?? "Low", needsAdvisor: f.needsAdvisor, courses: f.courseIds,
    };
  });
}

export function reportToCsv(rows: ReportRow[]): string {
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const head = ["Severity", "Finding", "Evidence", "Student impact", "Assumptions", "Affected students", "Confidence", "Needs advisor", "Suggested fix"];
  const body = rows.map((r) => [r.severity, r.finding, r.evidence.join(" | "), r.impact, r.assumptions.join(" | "), r.affected, r.confidence, r.needsAdvisor ? "Yes" : "No", r.fix ?? ""].map(q).join(","));
  return [head.map(q).join(","), ...body].join("\n");
}

/** Which planned courses satisfy a requirement group: matches the label the engine attached to each course. */
export function chosenFor(plan: PlanResult, r: RequirementStatus): string[] {
  return plan.terms.flatMap((t) => t.courses.filter((c) => !c.placeholder && c.satisfies.includes(r.label)).map((c) => c.code));
}
