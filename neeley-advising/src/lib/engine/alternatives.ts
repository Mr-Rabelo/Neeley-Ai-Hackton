import type { ComparisonRow, PlanOptions, PlanResult, StudentRecord } from "../types";
import { creditsFor, getProgram, majors, minors, normCode, prettyCode } from "../catalog";
import { careerCourses, careerTagList, buildPlan, defaultTarget } from "./plan";
import { plansToMajorIds } from "../transcript";
import { labelOf } from "../terms";

export type AlternativeKind = "baseline" | "add_minor" | "change_major" | "career_focus" | "summer";

export interface Alternative {
  kind: AlternativeKind;
  title: string;
  plan: PlanResult;
  gains: string[];
  costs: string[];
  stays: string[];
  unverified: string[];
  advisorDecisions: string[];
  creditMap?: { applies: string[]; freeElective: string[]; note: string };
}

export function baseOptions(record: StudentRecord, over: Partial<PlanOptions> = {}): PlanOptions {
  const { majors: m } = plansToMajorIds(record.plans);
  return {
    majors: over.majors ?? m,
    minors: over.minors ?? [],
    maxCreditsPerTerm: over.maxCreditsPerTerm ?? 15,
    allowSummer: over.allowSummer ?? false,
    targetTermId: over.targetTermId ?? defaultTarget(record),
    careerTags: over.careerTags,
    electivePrefs: over.electivePrefs,
    avoid: over.avoid,
  };
}

function codesOf(plan: PlanResult): Set<string> {
  return new Set(plan.terms.flatMap((t) => t.courses.filter((c) => !c.placeholder).map((c) => c.code)));
}

function termDelta(a: PlanResult, b: PlanResult): number {
  const ia = a.earliestGraduation.termId;
  const ib = b.earliestGraduation.termId;
  if (!ia || !ib) return 0;
  const idx = (id: string) => Number(id.split("-")[0]) * 3 + ({ Spring: 0, Summer: 1, Fall: 2 } as Record<string, number>)[id.split("-")[1]];
  const span = idx(ib) - idx(ia);
  return Math.round(span / 1.5);
}

export function baselineAlternative(record: StudentRecord, over: Partial<PlanOptions> = {}): Alternative {
  const opts = baseOptions(record, over);
  const plan = buildPlan(record, opts, "Baseline plan");
  return {
    kind: "baseline",
    title: "Baseline: your current majors",
    plan,
    gains: ["Finishes every requirement for the majors on your record."],
    costs: [],
    stays: [],
    unverified: plan.unverified,
    advisorDecisions: plan.advisorQuestions,
  };
}

export function addMinorAlternative(record: StudentRecord, baseline: Alternative, minorId: string, over: Partial<PlanOptions> = {}): Alternative {
  const minor = getProgram(minorId);
  if (!minor) throw new Error(`Unknown minor ${minorId}`);
  const opts = baseOptions(record, { ...over, minors: [minorId] });
  const plan = buildPlan(record, opts, `Add ${minor.name}`);
  const base = codesOf(baseline.plan);
  const mine = codesOf(plan);
  const added = [...mine].filter((c) => !base.has(c));
  const overlapWithPlan = minor.required.map((r) => normCode(r.code)).filter((c) => base.has(c));
  const doneAlready = minor.required.map((r) => normCode(r.code)).filter((c) => record.courses.some((x) => x.code === c && x.status !== "withdrawn" && !x.transfer));
  const extraCredits = plan.totalCredits - baseline.plan.totalCredits;
  const delta = termDelta(baseline.plan, plan);
  // Would a heavier load in the terms that have room avoid the delay? The supplied catalog states no maximum load, so this is only an option to ask about.
  let heavier: PlanResult | null = null;
  if (delta > 0) {
    const h = buildPlan(record, { ...opts, maxCreditsPerTerm: 18 }, `Add ${minor.name} (18-hour terms)`);
    if (termDelta(baseline.plan, h) <= 0) heavier = h;
  }
  return {
    kind: "add_minor",
    title: `Add the ${minor.name}`,
    plan,
    gains: [
      `${minor.name} on your transcript (${minor.totalHours} hours in the catalog).`,
      overlapWithPlan.length || doneAlready.length
        ? `${new Set([...overlapWithPlan, ...doneAlready]).size} of its required courses are already finished, in progress or already in your plan.`
        : "A second area of expertise.",
    ],
    costs: [
      added.length ? `${added.length} added course${added.length > 1 ? "s" : ""} (${added.map(prettyCode).join(", ")}), about ${Math.max(0, extraCredits)} extra credit hours.` : "No extra courses are needed.",
      delta > 0
        ? `At ${opts.maxCreditsPerTerm} hours a term, the expected finish moves back about ${delta} term${delta > 1 ? "s" : ""} (${plan.earliestGraduation.label ?? "beyond the window"}).${heavier ? ` It would not move if one or two terms carried up to 18 hours (finish ${heavier.earliestGraduation.label}); the supplied catalog states no maximum load, so ask an advisor whether that is allowed.` : ""}`
        : delta < 0 ? "Finishes earlier." : "The expected finish date does not change in this plan.",
      ...(minor.minGpa ? [`Requires at least a ${minor.minGpa} GPA in minor courses.`] : []),
    ],
    stays: [`Expected finish: ${baseline.plan.earliestGraduation.label ?? "n/a"} in the baseline.`],
    unverified: [
      "Whether courses may count toward both a major and a minor is not stated in the supplied catalog.",
      ...(minor.notes ?? []),
      ...plan.unverified.filter((u) => /offering|Double/.test(u)).slice(0, 2),
    ],
    advisorDecisions: [
      "Confirm how shared courses are counted between your majors and the minor.",
      ...(minor.advisorRequired ? ["Confirm the non-course parts of this minor (language, study abroad, international coursework)."] : []),
    ],
  };
}

export function changeMajorAlternative(
  record: StudentRecord,
  baseline: Alternative,
  fromMajorId: string,
  toMajorId: string,
  over: Partial<PlanOptions> = {},
): Alternative {
  const to = getProgram(toMajorId);
  if (!to) throw new Error(`Unknown major ${toMajorId}`);
  const baseMajors = baseline.plan.generatedFor.majors;
  const newMajors = [...baseMajors.filter((m) => m !== fromMajorId), toMajorId].filter((m, i, a) => a.indexOf(m) === i);
  const opts = baseOptions(record, { ...over, majors: newMajors });
  const plan = buildPlan(record, opts, `Switch ${getProgram(fromMajorId)?.name ?? fromMajorId} to ${to.name}`);
  // Credit map: completed TCU courses that appear in any requirement of the new set vs ones that become free electives.
  const needed = new Set<string>();
  const addProgram = (id: string) => {
    const p = getProgram(id);
    if (!p) return;
    p.required.forEach((r) => needed.add(normCode(r.code)));
    p.groups.forEach((g) => g.from.forEach((c) => needed.add(normCode(c))));
  };
  newMajors.forEach(addProgram);
  const businessCommon = ["ENGL10803", "ECON10223", "MATH10283", "MATH10524", "ACCT20353", "INSC20153", "INSC20263", "ENTR20263", "MARK30153", "FINA30153", "INSC30313", "INSC30801", "MANA30250", "MANA40250"];
  businessCommon.forEach((c) => needed.add(c));
  const completed = record.courses.filter((c) => c.status === "completed" && !c.transfer);
  const applies = completed.filter((c) => needed.has(c.code) || c.attributes.some((a) => /TCU CC|Traditions|Awareness|Reasoning|Citizenship|Written|Natural Science|Fine Arts|Humanities/i.test(a)));
  const free = completed.filter((c) => !applies.includes(c));
  const delta = termDelta(baseline.plan, plan);
  const removed = [...codesOf(baseline.plan)].filter((c) => !codesOf(plan).has(c));
  const added = [...codesOf(plan)].filter((c) => !codesOf(baseline.plan).has(c));
  return {
    kind: "change_major",
    title: `Switch ${getProgram(fromMajorId)?.name ?? "a major"} to ${to.name}`,
    plan,
    gains: [
      `Replaces ${removed.length} planned course${removed.length === 1 ? "" : "s"} with ${added.length} for ${to.name}.`,
      `${applies.reduce((a, c) => a + c.earned, 0)} completed TCU hours still apply to the Core or business requirements.`,
    ],
    costs: [
      delta > 0 ? `Expected finish moves back about ${delta} term${delta > 1 ? "s" : ""} (${plan.earliestGraduation.label ?? "beyond the window"}).` : delta < 0 ? `Expected finish moves earlier (${plan.earliestGraduation.label}).` : "The expected finish does not change in this plan.",
      free.length ? `${free.reduce((a, c) => a + c.earned, 0)} completed hours (${free.map((c) => prettyCode(c.code)).join(", ")}) match no requirement and would count only as free electives.` : "No completed hours are stranded.",
      ...(added.length ? [`New prerequisite chains: ${added.slice(0, 6).map(prettyCode).join(", ")}${added.length > 6 ? ", ..." : ""}.`] : []),
    ],
    stays: [`Business core and lower-division requirements stay the same.`, `Remaining majors on your record: ${newMajors.filter((m) => m !== toMajorId).map((m) => getProgram(m)?.name).join(", ") || "none"}.`],
    unverified: ["Admission or GPA rules for changing majors inside Neeley were not stated beyond the advancement GPA rules.", "Whether a completed course counts toward the new major is the advisor's decision, not the engine's."],
    advisorDecisions: [`Change-of-major approval for ${to.name}.`, "Which completed courses apply, and the last practical term to switch."],
    creditMap: {
      applies: applies.map((c) => c.code),
      freeElective: free.map((c) => c.code),
      note: "Transfer and AP/dual credit are excluded: they were not evaluated for the BBA.",
    },
  };
}

export function careerAlternative(record: StudentRecord, baseline: Alternative, tags: string[], over: Partial<PlanOptions> = {}): Alternative {
  const prefs = tags.flatMap(careerCourses);
  const opts = baseOptions(record, { ...over, careerTags: tags, electivePrefs: prefs });
  const plan = buildPlan(record, opts, `Career focus: ${tags.join(", ")}`);
  const base = codesOf(baseline.plan);
  const mine = codesOf(plan);
  const moved = [...mine].filter((c) => !base.has(c));
  const dropped = [...base].filter((c) => !mine.has(c));
  const delta = termDelta(baseline.plan, plan);
  return {
    kind: "career_focus",
    title: `Prioritize a career interest: ${tags.join(", ")}`,
    plan,
    gains: [moved.length ? `Electives shifted toward ${tags.join(", ")}: ${moved.map(prettyCode).join(", ")}.` : "Your elective choices already lean this way; nothing changes.", "Every required course stays."],
    costs: [dropped.length ? `Replaces ${dropped.map(prettyCode).join(", ")}.` : "No courses are dropped.", delta === 0 ? "The expected finish does not change in this plan." : `Expected finish shifts by about ${delta} term${Math.abs(delta) > 1 ? "s" : ""}.`],
    stays: ["All required courses", `Expected finish: ${plan.earliestGraduation.label ?? "n/a"}`],
    unverified: ["The mapping from career interests to courses is a draft built from course titles. It has not been reviewed by an advisor.", "Job outcomes, pay and hiring are not guaranteed."],
    advisorDecisions: ["Ask an advisor to review the career-to-course mapping and suggest experiences (internship, study abroad)."],
  };
}

export function summerAlternative(record: StudentRecord, baseline: Alternative, over: Partial<PlanOptions> = {}): Alternative {
  const opts = baseOptions(record, { ...over, allowSummer: true });
  const plan = buildPlan(record, opts, "Use summer terms");
  const delta = termDelta(baseline.plan, plan);
  return {
    kind: "summer",
    title: "Use summer terms",
    plan,
    gains: [delta < 0 ? `Could finish about ${-delta} term${delta < -1 ? "s" : ""} sooner (${plan.earliestGraduation.label}).` : "No faster finish appears even with summers."],
    costs: ["Summer tuition and living costs are not estimated: no sourced rates were supplied.", "Few courses list summer in their typical offering."],
    stays: ["Same majors and requirements."],
    unverified: ["Summer offerings are only as reliable as the catalog's typical pattern."],
    advisorDecisions: [],
  };
}

/** Switch each current major to every other Neeley major, for the "all majors at a glance" view. */
export function allMajorSwitches(record: StudentRecord, baseline: Alternative, fromMajorId: string): Alternative[] {
  return majors()
    .filter((m) => !baseline.plan.generatedFor.majors.includes(m.id))
    .map((m) => changeMajorAlternative(record, baseline, fromMajorId, m.id));
}

export function allMinorOptions(record: StudentRecord, baseline: Alternative): Alternative[] {
  const have = baseline.plan.generatedFor.majors;
  // A minor in the same field as a current major adds nothing, so it is not offered.
  const duplicates = (id: string) =>
    (id === "accounting-minor" && have.includes("accounting")) || (id === "finance-minor" && (have.includes("finance") || have.includes("finance-re")));
  return minors().filter((m) => m.forMajors === "business" && !duplicates(m.id)).map((m) => addMinorAlternative(record, baseline, m.id));
}

export function career_tags(): string[] {
  return careerTagList();
}

// ---------- comparison ----------
export function compare(base: Alternative, alts: Alternative[]): ComparisonRow[] {
  const all = [base, ...alts];
  const col = (a: Alternative) => a.title;
  const row = (key: string, label: string, f: (a: Alternative) => string): ComparisonRow => {
    const values: Record<string, string> = {};
    all.forEach((a) => (values[col(a)] = f(a)));
    return { key, label, values, differs: new Set(Object.values(values)).size > 1 };
  };
  const slipAdds = (p: PlanResult) => p.slips.filter((s) => s.slipTerms > 0).length;
  const by = (p: PlanResult, sev: string) => p.findings.filter((f) => f.severity === sev).length;
  return [
    row("grad", "Expected graduation (based on current information)", (a) => a.plan.earliestGraduation.label ?? "Not within the planning window"),
    row("credits", "Total credit hours", (a) => `${a.plan.totalCredits} (${a.plan.totalCredits - base.plan.totalCredits >= 0 ? "+" : ""}${a.plan.totalCredits - base.plan.totalCredits} vs baseline)`),
    row("terms", "Terms vs baseline", (a) => {
      const d = termDelta(base.plan, a.plan);
      return d === 0 ? "same" : d > 0 ? `+${d} term${d > 1 ? "s" : ""}` : `${d} term${d < -1 ? "s" : ""}`;
    }),
    row("peak", "Peak load per term", (a) => `${a.plan.peakCredits} hours`),
    row("summer", "Summer needed?", (a) => (a.plan.summerUsed ? "Yes" : "No")),
    row("bottleneck", "Sharpest bottleneck", (a) => (a.plan.bottleneck ? `${prettyCode(a.plan.bottleneck.code)} (${a.plan.bottleneck.descendants} dependents)` : "none")),
    row("slip", "Delay risk: single misses that add a term", (a) => `${slipAdds(a.plan)} of ${a.plan.slips.length}`),
    row("findings", "Findings (blockers / warnings)", (a) => `${by(a.plan, "blocker")} / ${by(a.plan, "warning")}`),
    row("unverified", "Unverified items", (a) => String(a.plan.unverified.length)),
    row("risk", "Credits at risk (may not count)", (a) => {
      const m = a.creditMap;
      const transfer = a.plan.findings.find((f) => /transfer hours/.test(f.message));
      const t = transfer ? Number((transfer.message.match(/^(\d+) transfer hours/) ?? [])[1] ?? 0) : 0;
      return `${(m?.freeElective ?? []).reduce((s, c) => s + creditsFor(c), 0) + t} hours`;
    }),
    row("room", "Room for experiences (open hours in plan)", (a) => `${a.plan.openCredits} hours`),
    row("advisor", "Decisions that need an advisor", (a) => String(a.advisorDecisions.length || a.plan.advisorQuestions.length)),
    row("cost", "Cost note", () => "Not estimated: no sourced tuition rate supplied"),
  ];
}

export { labelOf };
