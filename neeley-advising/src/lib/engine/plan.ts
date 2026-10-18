import type {
  Availability, Bottleneck, Finding, PlanOptions, PlanResult, PlannedCourse, PlannedTerm, PrereqExpr, RequirementStatus, StudentRecord,
} from "../types";
import {
  creditsFor, getCourse, getProgram, isAdvanced, neeley, normCode, policy, prettyCode, sourcesFor, subjectOf, titleOf,
} from "../catalog";
import { availabilityFromCatalog, describeAvailability, isOfferedIn } from "../availability";
import { describeExpr, evalExpr, exprCodes, ruleFor } from "../prereq";
import { academicYearOf, labelOf, parseTermId, termFromIndex, termsAfter } from "../terms";
import { meetsGrade, plansToMajorIds } from "../transcript";
import {
  businessCoreRequirements, coreCurriculumRequirements, lowerDivisionRequirements, programRequirements, studentState, totalsFor,
  unmappedAttributes, writingEmphasisRequirement, type StudentState,
} from "./audit";

const MAX_TERMS = 14;

interface Item {
  code: string;
  title: string;
  credits: number;
  placeholder: boolean;
  satisfies: Set<string>;
  reason: string;
  availability: Availability;
}

export interface ScheduleOutput {
  terms: PlannedTerm[];
  placement: Map<string, string>; // code -> termId
  unplaced: string[];
  notes: string[];
}

// ---------- helpers ----------
function mkItem(code: string, satisfies: string, reason: string): Item {
  const c = normCode(code);
  return {
    code: c,
    title: titleOf(c),
    credits: creditsFor(c),
    placeholder: false,
    satisfies: new Set([satisfies]),
    reason,
    availability: availabilityFromCatalog(getCourse(c)?.offered),
  };
}

function placeholder(id: string, title: string, credits: number, satisfies: string, reason: string): Item {
  return {
    code: id,
    title,
    credits,
    placeholder: true,
    satisfies: new Set([satisfies]),
    reason,
    availability: {
      terms: ["Fall", "Spring", "Summer"], rare: false, unknown: false, alternating: false, raw: "", confidence: "assumption", sourceId: "S1",
      note: "Placeholder: any approved course. No specific course is recommended here.",
    },
  };
}

function addItem(items: Map<string, Item>, code: string, satisfies: string, reason: string) {
  const c = normCode(code);
  const ex = items.get(c);
  if (ex) { ex.satisfies.add(satisfies); return; }
  items.set(c, mkItem(c, satisfies, reason));
}

const CAREER_CLUSTERS: Record<string, string[]> = {
  data: ["INSC40843", "INSC30273", "INSC30283", "INSC40303", "MARK30233", "GEOG30323", "FINA30223", "INSC40383"],
  banking: ["FINA30203", "FINA40313", "FINA30223", "FINA40533", "FINA40623"],
  consulting: ["MANA40633", "MANA40203", "INSC30723", "FINA30223", "MARK30113", "ECON30223"],
  startups: ["ENTR30543", "ENTR30123", "ENTR40123", "ENTR40243", "MARK30303", "ENTR40313"],
  brand: ["MARK40243", "MARK40103", "MARK40233", "MARK30223", "MARK40143"],
  operations: ["INSC40313", "INSC40323", "INSC30723", "INSC40303", "INSC30513"],
  sales: ["MARK40263", "MARK40273", "MANA40633"],
  "real-estate": ["FINA30313", "FINA30623", "FINA40613", "FINA40603"],
  technology: ["INSC30833", "INSC30853", "INSC40383", "ENTR30123", "INSC30283"],
};

export const careerTagList = () => Object.keys(CAREER_CLUSTERS);
export const careerCourses = (tag: string) => CAREER_CLUSTERS[tag] ?? [];

function pickForGroup(
  g: RequirementStatus & { _group?: import("../types").ReqGroup },
  groupDef: import("../types").ReqGroup,
  need: number,
  st: StudentState,
  taken: Set<string>,
  items: Map<string, Item>,
  opts: PlanOptions,
): string[] {
  const prefs = new Set((opts.electivePrefs ?? []).map(normCode));
  const careerSet = new Set((opts.careerTags ?? []).flatMap((t) => (CAREER_CLUSTERS[t] ?? []).map(normCode)));
  const avoid = new Set((opts.avoid ?? []).map(normCode));
  const cands = groupDef.from
    .map(normCode)
    .filter((c) => !taken.has(c) && !st.done.has(c) && !st.inProgress.has(c) && !avoid.has(c) && !!getCourse(c));
  const score = (c: string) => {
    const a = availabilityFromCatalog(getCourse(c)?.offered);
    let s = 0;
    if (items.has(c)) s += 100; // already required elsewhere: shared course (double-count rule unverified)
    if (prefs.has(c)) s += 60;
    if (careerSet.has(c)) s += 30;
    if (!a.unknown && !a.rare) s += 20;
    if (a.rare) s -= 40;
    if (a.unknown) s -= 10;
    // fewer prerequisites first
    s -= exprCodes(ruleFor(c).prereq).length;
    return s;
  };
  cands.sort((a, b) => score(b) - score(a) || a.localeCompare(b));
  const chosen: string[] = [];
  let hours = 0;
  const pushIf = (c: string) => {
    if (hours >= need || chosen.includes(c)) return false;
    if (groupDef.maxOutsideSubject) {
      for (const [subj, max] of Object.entries(groupDef.maxOutsideSubject)) {
        const outside = chosen.filter((x) => subjectOf(x) !== subj).length * 3;
        if (subjectOf(c) !== subj && outside + 3 > max) return false;
      }
    }
    chosen.push(c);
    hours += creditsFor(c);
    return true;
  };
  if (groupDef.minFromSubject) {
    for (const [subj, min] of Object.entries(groupDef.minFromSubject)) {
      for (const c of cands.filter((x) => subjectOf(x) === subj)) {
        if (chosen.filter((x) => subjectOf(x) === subj).length * 3 >= min) break;
        pushIf(c);
      }
    }
  }
  for (const c of cands) pushIf(c);
  void g;
  return chosen;
}

// ---------- build the list of things the student still needs ----------
export interface Needs {
  items: Map<string, Item>;
  requirements: RequirementStatus[];
  notes: string[];
}

export function collectNeeds(record: StudentRecord, opts: PlanOptions): Needs {
  const st = studentState(record);
  const used = new Set<string>();
  const requirements: RequirementStatus[] = [];
  requirements.push(...lowerDivisionRequirements(st, used));
  requirements.push(...businessCoreRequirements(st, used));
  const programs = [...opts.majors, ...opts.minors].map((id) => getProgram(id)).filter((p): p is NonNullable<typeof p> => !!p);
  for (const p of programs) {
    const cat = opts.minors.includes(p.id) ? "minor" : "major";
    // Each program shares the `used` set only for groups, so a course finished for one major still counts toward the next.
    requirements.push(...programRequirements(p, st, new Set(used), cat));
  }
  requirements.push(...coreCurriculumRequirements(st));
  requirements.push(writingEmphasisRequirement(opts.majors, st));

  const items = new Map<string, Item>();
  const notes: string[] = [];
  for (const r of requirements) {
    if (r.category === "core-curriculum") continue;
    for (const code of r.remainingCourses) addItem(items, code, r.label, "Required and not yet taken");
  }
  // elective groups
  for (const p of programs) {
    for (const g of p.groups) {
      const req = requirements.find((r) => r.id === `${p.id}:${g.id}`);
      if (!req) continue;
      const filled = req.hoursDone + req.hoursInProgress;
      const need = g.hours - filled;
      if (need <= 0) continue;
      const taken = new Set([...items.keys(), ...req.satisfiedBy]);
      // courses already required elsewhere in the plan may count here too
      const shared = g.from.map(normCode).filter((c) => items.has(c));
      let picks: string[] = [];
      if (shared.length && g.id.includes("global")) picks = [shared[0]];
      else picks = pickForGroup(req, g, need, st, new Set(req.satisfiedBy), items, opts);
      void taken;
      for (const c of picks) addItem(items, c, req.label, g.hours >= 6 ? "Chosen to fit your interests and the catalog's offering pattern" : "Satisfies a choice requirement");
      req.chooseFrom = g.from.map(normCode);
      req.chooseFromTitles = Object.fromEntries(g.from.map((c) => [normCode(c), titleOf(c)]));
      if (g.followUp && picks.includes("FINA40623") && !items.has("BUSI30383")) {
        addItem(items, "ACCT30450", req.label, "Needed because International Finance is taken instead of Global Business (catalog note)");
      }
    }
  }
  // prerequisites that are not satisfied by what the student has or plans
  for (let pass = 0; pass < 3; pass++) {
    let added = false;
    for (const it of [...items.values()]) {
      if (it.placeholder) continue;
      const r = ruleFor(it.code);
      if (!r.prereq) continue;
      const have = (c: string) => !getCourse(c) || st.done.has(c) || st.inProgress.has(c) || items.has(c);
      if (evalExpr(r.prereq, have)) continue;
      const missing = firstMissing(r.prereq, have);
      if (missing && getCourse(missing)) {
        addItem(items, missing, `Prerequisite for ${prettyCode(it.code)}`, `Prerequisite for ${prettyCode(it.code)}`);
        added = true;
      }
    }
    if (!added) break;
  }

  // Core Curriculum placeholders
  for (const r of requirements.filter((x) => x.id.startsWith("core:") && x.id !== "core:writing-emphasis")) {
    const left = r.hoursNeeded - r.hoursDone - r.hoursInProgress;
    if (left <= 0) continue;
    const n = Math.ceil(left / 3);
    for (let i = 0; i < n; i++) {
      const id = `CORE-${r.id.slice(5)}-${i + 1}`;
      items.set(id, placeholder(id, `Core Curriculum: ${r.label.replace("Core Curriculum: ", "")}`, 3, r.label, "Core Curriculum requirement still open. Pick any approved course with this attribute."));
    }
  }
  // Free electives to reach 120 hours (counted after the real courses are known)
  const totals = totalsFor(st);
  const planned = [...items.values()].reduce((a, i) => a + i.credits, 0);
  const have = totals.earned + totals.inProgress;
  const need = (policy("total-hours")?.value ?? 120) - have - planned;
  if (need > 0) {
    const n = Math.ceil(need / 3);
    for (let i = 0; i < n; i++) {
      const id = `FREE-${i + 1}`;
      items.set(id, placeholder(id, "Free elective", 3, "120-hour total requirement", "Free elective hours needed to reach 120 total hours"));
    }
  }
  return { items, requirements, notes };
}

function firstMissing(e: PrereqExpr, have: (c: string) => boolean): string | undefined {
  if (e.kind === "course") return have(normCode(e.code)) ? undefined : normCode(e.code);
  if (e.kind === "all") for (const i of e.items) { const m = firstMissing(i, have); if (m) return m; return undefined; }
  if (e.kind === "all") return undefined;
  // any-of: prefer an option that has a known catalog entry and offering
  const opts = e.items.flatMap((i) => (i.kind === "course" ? [normCode(i.code)] : []));
  return opts.find((o) => getCourse(o)) ?? opts[0];
}

// ---------- scheduling ----------
function depthMap(items: Map<string, Item>): { depth: Map<string, number>; descendants: Map<string, number>; children: Map<string, string[]> } {
  const children = new Map<string, string[]>();
  for (const it of items.values()) {
    if (it.placeholder) continue;
    for (const p of exprCodes(ruleFor(it.code).prereq)) {
      if (items.has(p)) children.set(p, [...(children.get(p) ?? []), it.code]);
    }
  }
  const depth = new Map<string, number>();
  const visit = (c: string, stack: Set<string>): number => {
    if (depth.has(c)) return depth.get(c)!;
    if (stack.has(c)) return 0;
    stack.add(c);
    const d = (children.get(c) ?? []).reduce((m, k) => Math.max(m, 1 + visit(k, stack)), 0);
    stack.delete(c);
    depth.set(c, d);
    return d;
  };
  for (const c of items.keys()) visit(c, new Set());
  const descendants = new Map<string, number>();
  for (const c of items.keys()) {
    const seen = new Set<string>();
    const walk = (x: string) => { for (const k of children.get(x) ?? []) if (!seen.has(k)) { seen.add(k); walk(k); } };
    walk(c);
    descendants.set(c, seen.size);
  }
  return { depth, descendants, children };
}

export function schedule(record: StudentRecord, items: Map<string, Item>, opts: PlanOptions): ScheduleOutput {
  const st = studentState(record);
  const cap = opts.maxCreditsPerTerm;
  const { depth } = depthMap(items);
  const terms = termsAfter(record.currentTermId, MAX_TERMS, opts.allowSummer);
  const doneBefore = new Set<string>([...st.done.keys(), ...st.inProgress.keys()]);
  const placement = new Map<string, string>();
  const remaining = new Set(items.keys());
  const out: PlannedTerm[] = [];
  const blocked = new Map<string, Set<string>>();
  for (const s of opts.excludeSlots ?? []) blocked.set(s.termId, new Set([...(blocked.get(s.termId) ?? []), normCode(s.code)]));
  const done = (code: string, minGrade?: string) => {
    if (!getCourse(code)) return true; // cited but not in the catalog: ignored here and flagged in the findings
    if (!doneBefore.has(code)) return false;
    const c = st.done.get(code);
    return c ? meetsGrade(c.grade, minGrade ?? "C-") : true; // in progress: assume it completes; flagged elsewhere
  };

  for (const term of terms) {
    if (remaining.size === 0) break;
    const planned: PlannedCourse[] = [];
    let credits = 0;
    const eligible = [...remaining]
      .map((c) => items.get(c)!)
      .filter((it) => {
        if (it.placeholder) return false;
        if (blocked.get(term.id)?.has(it.code)) return false;
        if (!isOfferedIn(it.availability, term.name)) return false;
        const r = ruleFor(it.code);
        const coreqOk = r.coreq.every((c) => !items.has(c) || placement.has(c) || c === it.code);
        return evalExpr(r.prereq, done) && coreqOk;
      })
      .sort((a, b) => (depth.get(b.code) ?? 0) - (depth.get(a.code) ?? 0) || offerRank(a) - offerRank(b) || a.code.localeCompare(b.code));
    const place = (it: Item) => {
      planned.push({
        code: it.code, title: it.title, credits: it.credits, placeholder: it.placeholder || undefined,
        satisfies: [...it.satisfies], availability: it.availability, reason: it.reason,
      });
      credits += it.credits;
      placement.set(it.code, term.id);
      remaining.delete(it.code);
    };
    for (const it of eligible) if (credits + it.credits <= cap) place(it);
    const fillers = [...remaining].map((c) => items.get(c)!).filter((it) => it.placeholder).sort((a, b) => a.code.localeCompare(b.code));
    for (const it of fillers) if (credits + it.credits <= cap) place(it);
    for (const p of planned) doneBefore.add(p.code); // available to later terms
    if (planned.length) out.push({ termId: term.id, label: term.label, courses: planned, credits });
    else out.push({ termId: term.id, label: term.label, courses: [], credits: 0 });
  }
  while (out.length && out[out.length - 1].courses.length === 0) out.pop();
  return { terms: out, placement, unplaced: [...remaining], notes: [] };
}

function offerRank(it: Item): number {
  if (it.availability.unknown) return 5;
  if (it.availability.rare) return 0;
  return it.availability.terms.filter((t) => t !== "Summer").length;
}

// ---------- findings ----------
let fid = 0;
const F = (f: Omit<Finding, "id">): Finding => ({ id: `f${++fid}`, ...f });

function gradLabel(termId: string | null) {
  return termId ? labelOf(termId) : "not within the planning window";
}

export function buildPlan(record: StudentRecord, opts: PlanOptions, label = "Baseline plan"): PlanResult {
  fid = 0;
  const st = studentState(record);
  const needs = collectNeeds(record, opts);
  const sched = schedule(record, needs.items, opts);
  const findings: Finding[] = [];
  const unverified: string[] = [];
  const itemList = [...needs.items.values()];
  const placedReal = itemList.filter((i) => !i.placeholder && sched.placement.has(i.code));
  const termIndexOf = (code: string) => (sched.placement.has(code) ? parseTermId(sched.placement.get(code)!).index : undefined);
  const currentIdx = parseTermId(record.currentTermId).index;

  // 1. prerequisites for what is in progress right now
  for (const c of st.inProgress.values()) {
    const r = ruleFor(c.code);
    if (!r.prereq) continue;
    const beforeNow = (code: string) => {
      const d = st.done.get(code);
      return !!d && meetsGrade(d.grade, "C-");
    };
    if (!evalExpr(r.prereq, beforeNow)) {
      const sameTerm = exprCodes(r.prereq).filter((p) => st.inProgress.has(p));
      const missing = exprCodes(r.prereq).filter((p) => !st.done.has(p) && !st.inProgress.has(p));
      if (sameTerm.length && !missing.length) {
        findings.push(F({
          type: "prereq", severity: "warning", courseIds: [c.code, ...sameTerm], termId: c.termId,
          message: `${prettyCode(c.code)} is in progress this term, but its prerequisite ${sameTerm.map(prettyCode).join(", ")} is also in progress in the same term.`,
          fix: "Ask the Neeley Academic Advising Center whether an override or a corequisite arrangement applies (for example a cohort or honors section).",
          confidence: "confirmed", sourceIds: ["S1", "S3"], needsAdvisor: true,
        }));
      } else if (missing.length) {
        findings.push(F({
          type: "prereq", severity: "blocker", courseIds: [c.code, ...missing], termId: c.termId,
          message: `${prettyCode(c.code)} is in progress, but prerequisite ${missing.map(prettyCode).join(", ")} does not appear on the transcript.`,
          fix: "Confirm with an advisor how this registration was approved.", confidence: "confirmed", sourceIds: ["S1", "S3"], needsAdvisor: true,
        }));
      }
    }
  }

  // 2. prerequisites for planned courses (same-term, in-progress min grades, ambiguity, other paths)
  const ambiguous = new Set<string>();
  const hasRestrictions = new Map<string, string[]>();
  const inProgressRisk = new Set<string>();
  for (const it of placedReal) {
    const r = ruleFor(it.code);
    const idx = termIndexOf(it.code)!;
    if (r.ambiguous) ambiguous.add(it.code);
    if (r.restrictions.length) hasRestrictions.set(it.code, r.restrictions);
    for (const p of exprCodes(r.prereq)) {
      const pIdx = termIndexOf(p);
      if (pIdx !== undefined && pIdx >= idx && !r.coreq.includes(p)) {
        findings.push(F({
          type: "prereq", severity: "blocker", courseIds: [it.code, p], termId: sched.placement.get(it.code),
          message: `${prettyCode(it.code)} is planned in ${labelOf(sched.placement.get(it.code)!)}, but its prerequisite ${prettyCode(p)} is not finished before then.`,
          fix: "Move the course to a later term.", confidence: "confirmed", sourceIds: ["S1"], needsAdvisor: false,
        }));
      }
      if (st.inProgress.has(p) && r.prereq) {
        const mg = findMinGrade(r.prereq, p);
        if (mg) inProgressRisk.add(`${it.code}|${p}|${mg}`);
      }
    }
    if (r.otherPaths && !evalExpr(r.prereq, (c) => st.done.has(c) || st.inProgress.has(c) || needs.items.has(c))) {
      findings.push(F({
        type: "missing_info", severity: "info", courseIds: [it.code], message: `${prettyCode(it.code)} can also be entered through a placement score, equivalent or permission. That path was not evaluated.`,
        confidence: "assumption", sourceIds: ["S1"], needsAdvisor: false,
      }));
    }
  }
  for (const key of inProgressRisk) {
    const [course, pre, grade] = key.split("|");
    findings.push(F({
      type: "prereq", severity: "warning", courseIds: [course, pre], termId: sched.placement.get(course),
      message: `${prettyCode(course)} needs a ${grade} or better in ${prettyCode(pre)}, which is still in progress. The plan assumes it will be earned.`,
      fix: "Recheck after final grades post.", confidence: "assumption", sourceIds: ["S1", "S3"], needsAdvisor: false,
    }));
  }
  if (ambiguous.size) {
    findings.push(F({
      type: "missing_info", severity: "warning", courseIds: [...ambiguous],
      message: `The prerequisite wording for ${[...ambiguous].map(prettyCode).join(", ")} mixes "and" and "or", so the engine could not be sure how to read it. It used the most likely reading.`,
      fix: "Have an advisor read the catalog wording for these courses.", confidence: "assumption", sourceIds: ["S1"], needsAdvisor: true,
    }));
    unverified.push(`Prerequisite wording needs human reading: ${[...ambiguous].map(prettyCode).join(", ")}.`);
  }
  const phantom = new Map<string, string[]>();
  for (const it of placedReal) {
    for (const p of [...exprCodes(ruleFor(it.code).prereq), ...ruleFor(it.code).coreq]) {
      if (!getCourse(p)) phantom.set(p, [...(phantom.get(p) ?? []), it.code]);
    }
  }
  for (const [p, users] of phantom) {
    findings.push(F({
      type: "missing_info", severity: "warning", courseIds: [p, ...users],
      message: `The catalog cites ${prettyCode(p)} as a prerequisite or corequisite for ${users.map(prettyCode).join(", ")}, but ${prettyCode(p)} is not a course in the supplied catalog. The engine ignored it.`,
      fix: "Ask an advisor what the intended requirement is (it may be a catalog typo).", confidence: "assumption", sourceIds: ["S1"], needsAdvisor: true,
    }));
    unverified.push(`${prettyCode(p)} is cited in the catalog but does not exist in it (affects ${users.map(prettyCode).join(", ")}).`);
  }
  if (hasRestrictions.size) {
    findings.push(F({
      type: "missing_info", severity: "info", courseIds: [...hasRestrictions.keys()],
      message: `${hasRestrictions.size} planned courses also carry non-course conditions (for example "declared business major", class standing, permission). The engine does not verify these.`,
      fix: "Review the conditions on the course page before registering.", confidence: "assumption", sourceIds: ["S1"], needsAdvisor: false,
    }));
  }

  const missingCoreq = placedReal
    .map((it) => ({ it, missing: ruleFor(it.code).coreq.filter((c) => !!getCourse(c) && !needs.items.has(c) && !st.done.has(c) && !st.inProgress.has(c)) }))
    .filter((x) => x.missing.length);
  for (const { it, missing } of missingCoreq) {
    const known = missing.some((c) => !!getCourse(c));
    findings.push(F({
      type: "missing_info", severity: "info", courseIds: [it.code, ...missing],
      message: `${prettyCode(it.code)} lists a corequisite (${missing.map(prettyCode).join(", ")}) ${known ? "that is not on the plan" : "that does not appear in the supplied catalog"}.`,
      fix: "Ask an advisor how the corequisite is handled.", confidence: "assumption", sourceIds: ["S1"], needsAdvisor: true,
    }));
  }

  // 3. offerings
  const patternCourses: string[] = [];
  for (const it of placedReal) {
    const a = it.availability;
    if (a.unknown) {
      findings.push(F({
        type: "unverified", severity: "warning", courseIds: [it.code], termId: sched.placement.get(it.code),
        message: `${prettyCode(it.code)}: ${a.note || "offering unknown"} The plan assumes it will run in ${labelOf(sched.placement.get(it.code)!)}.`,
        fix: "Confirm with the department before relying on this term.", confidence: "assumption", sourceIds: [a.sourceId], needsAdvisor: false,
      }));
      unverified.push(`${prettyCode(it.code)} offering unknown (planned ${labelOf(sched.placement.get(it.code)!)}).`);
    } else if (a.rare) {
      findings.push(F({
        type: "unverified", severity: "blocker", courseIds: [it.code], termId: sched.placement.get(it.code),
        message: `${prettyCode(it.code)} is listed as rarely offered, but the plan needs it.`,
        fix: "Ask the department whether it runs, or look for an approved alternative.", confidence: "historical_pattern", sourceIds: [a.sourceId], needsAdvisor: true,
      }));
    } else if (a.alternating) {
      findings.push(F({
        type: "unverified", severity: "warning", courseIds: [it.code], message: `${prettyCode(it.code)} is offered every other ${a.terms[0]}; which year is not stated.`,
        fix: "Confirm which years it runs.", confidence: "historical_pattern", sourceIds: [a.sourceId], needsAdvisor: false,
      }));
    } else patternCourses.push(it.code);
  }
  if (patternCourses.length) {
    findings.push(F({
      type: "unverified", severity: "info", courseIds: patternCourses,
      message: `${patternCourses.length} planned courses rely on the catalog's "typically offered" pattern. That is a usual pattern, not a published schedule, and not a promise.`,
      fix: "Check the official schedule when registration opens.", confidence: "historical_pattern", sourceIds: ["S1"], needsAdvisor: false,
    }));
    unverified.push("Future offerings come from the catalog's typical pattern; the schedule for upcoming terms is not published in the supplied data.");
  }

  // 4. conflicts: only possible with section data
  findings.push(F({
    type: "missing_info", severity: "info", courseIds: [], message: "Meeting times were not checked: no section schedule was supplied. Time conflicts and seat availability cannot be evaluated.",
    fix: "Confirm sections in the official schedule.", confidence: "assumption", sourceIds: ["S1"], needsAdvisor: false,
  }));
  unverified.push("Section meeting times and seat counts are not available.");

  // 5. missing info and policy
  const catYear = academicYearOf(parseTermId(record.catalogTermId || record.currentTermId));
  const supplied = neeley().sources[0].catalogYear.replace("-20", "-");
  if (catYear !== supplied) {
    findings.push(F({
      type: "missing_info", severity: "warning", courseIds: [],
      message: `The record's requirement term is ${labelOf(record.catalogTermId)} (catalog ${catYear}), but the supplied catalog is ${neeley().sources[0].catalogYear}. Requirements may differ for your catalog year.`,
      fix: "Ask an advisor to confirm which catalog year governs your degree.", confidence: "confirmed", sourceIds: ["S1", "S3"], needsAdvisor: true,
    }));
    unverified.push(`Catalog year mismatch: record ${catYear} vs supplied ${supplied}.`);
  }
  const transfers = record.courses.filter((c) => c.transfer && c.status === "completed");
  if (transfers.length) {
    const hours = transfers.reduce((a, c) => a + c.earned, 0);
    findings.push(F({
      type: "missing_info", severity: "warning", courseIds: transfers.map((c) => c.code),
      message: `${hours} transfer hours (${transfers.map((c) => prettyCode(c.code)).join(", ")}) are counted toward total hours only. Whether they satisfy BBA Core or business requirements was not evaluated, so they are counted as zero toward those requirements.`,
      fix: "Ask the Neeley Academic Advising Center to evaluate them for the BBA. If they count, some Core requirements may already be met.", confidence: "assumption", sourceIds: ["S2", "S3"], needsAdvisor: true,
    }));
    unverified.push(`Transfer credit (${hours} hours) not evaluated for the BBA.`);
  }
  const unm = unmappedAttributes(record);
  if (unm.length) {
    const listed = unm.filter((u) => !/honors|neeley fellows|web folder|energy tech|comparative race/i.test(u.attribute));
    if (listed.length) {
      findings.push(F({
        type: "missing_info", severity: "info", courseIds: listed.flatMap((u) => u.courses),
        message: `Course attribute${listed.length > 1 ? "s" : ""} ${listed.map((u) => `"${u.attribute}"`).join(", ")} on the transcript is not in the Core Curriculum table of the supplied catalog, so it was not applied to any requirement.`,
        fix: "Ask an advisor which Core requirement this satisfies.", confidence: "assumption", sourceIds: ["S1", "S3"], needsAdvisor: true,
      }));
      unverified.push(`Attribute not mapped to a requirement: ${listed.map((u) => u.attribute).join(", ")}.`);
    }
  }
  const totals = totalsFor(st);
  const pnc = policy("pnc");
  if (pnc?.maxHours && totals.pnc >= pnc.maxHours) {
    findings.push(F({
      type: "policy", severity: "warning", courseIds: record.courses.filter((c) => c.grade === "P").map((c) => c.code),
      message: `${totals.pnc} of the ${pnc.maxHours} pass/no-credit hours business students may use are already spent. Any future P/NC course would exceed the limit.`,
      fix: "Take remaining courses for a letter grade.", confidence: "confirmed", sourceIds: ["S2", "S3"], needsAdvisor: false,
    }));
  }
  if (opts.majors.length > 1) {
    findings.push(F({
      type: "policy", severity: "warning", courseIds: [], message: `You are planning ${opts.majors.length} majors (${opts.majors.map((m) => getProgram(m)?.name).join(" and ")}). The catalog says to confirm the hours for a double major with an advisor, and it does not state which courses may count toward both.`,
      fix: "Ask the Neeley Academic Advising Center how shared courses (for example BUSI 30383 or ACCT courses) are counted.", confidence: "assumption", sourceIds: ["S1"], needsAdvisor: true,
    }));
    unverified.push("Double-major overlap and hour rules are not stated in the supplied catalog.");
  }
  if (!policy("course-load")?.value) {
    unverified.push(`Maximum credit load per term was not found; the plan uses ${opts.maxCreditsPerTerm} hours per term as an assumption.`);
  }
  const ld = neeley().lowerDivision.beforeDeclaringMajor.map(normCode).filter((c) => !st.done.has(c) && !st.inProgress.has(c));
  if (ld.length) {
    findings.push(F({
      type: "policy", severity: "warning", courseIds: ld,
      message: `${ld.map(prettyCode).join(", ")} must be completed in the semester you acknowledge a business major. The record already lists the major, but ${ld.map(prettyCode).join(", ")} is not complete or in progress.`,
      fix: "Take it next term and ask an advisor how this affects advancement into the major.", confidence: "confirmed", sourceIds: ["S1", "S3"], needsAdvisor: true,
    }));
  }
  findings.push(F({
    type: "unverified", severity: "info", courseIds: [], message: "Excel and PowerPoint certification (needed to continue as a business student and to enroll in INSC 20153) cannot be seen on a transcript.",
    fix: "Confirm your certification status with the Neeley Academic Advising Center.", confidence: "assumption", sourceIds: ["S2"], needsAdvisor: false,
  }));
  if (opts.majors.includes("finance")) {
    const feeling = needs.requirements.find((r) => r.id === "core:writing-emphasis");
    if (feeling && feeling.status === "remaining") {
      findings.push(F({
        type: "missing_info", severity: "info", courseIds: [], message: "Finance majors need 9 hours of writing-emphasis courses. The catalog designates FINA 30203 and FINA 30213 (6 hours); the third course was not identified in the supplied pages.",
        fix: "Ask which finance course carries the third writing-emphasis designation.", confidence: "assumption", sourceIds: ["S1"], needsAdvisor: true,
      }));
    }
  }

  // 6. delays
  const { depth, descendants } = depthMap(needs.items);
  const lastTermId = sched.terms.length ? sched.terms[sched.terms.length - 1].termId : record.currentTermId;
  const graduating = sched.unplaced.length === 0 ? lastTermId : null;
  const targetId = opts.targetTermId ?? defaultTarget(record);
  const confidence = confidenceOfPlan(placedReal);
  if (sched.unplaced.length) {
    findings.push(F({
      type: "delay", severity: "blocker", courseIds: sched.unplaced.filter((c) => !needs.items.get(c)?.placeholder),
      message: `The plan could not place ${sched.unplaced.length} course(s) within ${MAX_TERMS} terms: ${sched.unplaced.slice(0, 6).map(prettyCode).join(", ")}${sched.unplaced.length > 6 ? ", ..." : ""}. Their prerequisites or offering pattern leave no workable term.`,
      fix: "Ask the department about alternatives or substitutions.", confidence: "assumption", sourceIds: ["S1"], needsAdvisor: true,
    }));
  }
  if (graduating && targetId) {
    const gap = parseTermId(graduating).index - parseTermId(targetId).index;
    const terms = Math.round(gap / 1.5);
    if (gap > 0) {
      findings.push(F({
        type: "delay", severity: "warning", courseIds: [], message: `Based on current information, the earliest finish is ${labelOf(graduating)}, later than the target of ${labelOf(targetId)}${terms ? ` by about ${terms} term${terms > 1 ? "s" : ""}` : ""}.`,
        fix: "Compare the alternatives below, or consider a summer term.", confidence, sourceIds: ["S1", "S3"], needsAdvisor: false,
      }));
    } else {
      findings.push(F({
        type: "opportunity", severity: "info", courseIds: [], message: `Based on current information, the earliest finish is ${labelOf(graduating)}, on or before the target of ${labelOf(targetId)}. This is not a guarantee of graduation eligibility.`,
        confidence, sourceIds: ["S1", "S3"], needsAdvisor: false,
      }));
    }
  }

  // 7. bottleneck and slip test
  const planned = placedReal.filter((i) => sched.placement.has(i.code));
  const graduationIdx = graduating ? parseTermId(graduating).index : null;
  const candidates = planned
    .filter((i) => (descendants.get(i.code) ?? 0) > 0 || (depth.get(i.code) ?? 0) > 0 || i.availability.terms.filter((t) => t !== "Summer").length <= 1)
    .sort((a, b) => (descendants.get(b.code) ?? 0) - (descendants.get(a.code) ?? 0) || offerRank(a) - offerRank(b))
    .slice(0, 24);
  const slips: { code: string; slip: number }[] = [];
  if (graduationIdx !== null) {
    for (const cnd of candidates) {
      const alt = schedule(record, needs.items, { ...opts, excludeSlots: [...(opts.excludeSlots ?? []), { code: cnd.code, termId: sched.placement.get(cnd.code)! }] });
      const altEnd = alt.unplaced.length ? graduationIdx + 6 : alt.terms.length ? parseTermId(alt.terms[alt.terms.length - 1].termId).index : graduationIdx;
      const slipTerms = countAcademicTerms(graduationIdx, altEnd, opts.allowSummer);
      slips.push({ code: cnd.code, slip: Math.max(0, slipTerms) });
    }
  }
  const worst = [...slips].sort((a, b) => b.slip - a.slip || (descendants.get(b.code) ?? 0) - (descendants.get(a.code) ?? 0))[0];
  let bottleneck: Bottleneck | null = null;
  const pick = worst && worst.slip > 0 ? worst.code : candidates[0]?.code;
  if (pick) {
    const it = needs.items.get(pick)!;
    const desc = descendants.get(pick) ?? 0;
    const slip = slips.find((s) => s.code === pick)?.slip ?? 0;
    const offered = it.availability.terms.filter((t) => t !== "Summer").length;
    bottleneck = {
      code: pick, title: it.title, descendants: desc, offeredTerms: offered, slipTerms: slip,
      why: `${prettyCode(pick)} unlocks ${desc} other planned course${desc === 1 ? "" : "s"} and is ${describeAvailability(it.availability).toLowerCase()} (${it.availability.confidence.replace("_", " ")}). ${slip > 0 ? `Missing it once pushes the finish back about ${slip} term${slip > 1 ? "s" : ""}.` : "Missing it once does not move the finish in this plan, but it limits flexibility."}`,
    };
    if (slip > 0 || desc >= 3) {
      findings.push(F({
        type: "delay", severity: slip > 0 ? "warning" : "info", courseIds: [pick], termId: sched.placement.get(pick),
        message: `Sharpest bottleneck: ${bottleneck.why}`,
        fix: "Register for it in the planned term; have a backup term in mind.", confidence: it.availability.confidence, sourceIds: [it.availability.sourceId], needsAdvisor: false,
      }));
    }
  }
  for (const s of slips.filter((x) => x.slip > 0 && x.code !== pick).slice(0, 4)) {
    const it = needs.items.get(s.code)!;
    findings.push(F({
      type: "delay", severity: "info", courseIds: [s.code], termId: sched.placement.get(s.code),
      message: `Slip test: if ${prettyCode(s.code)} (${describeAvailability(it.availability).toLowerCase()}) is missed in ${labelOf(sched.placement.get(s.code)!)}, the finish moves back about ${s.slip} term${s.slip > 1 ? "s" : ""}.`,
      confidence: it.availability.confidence, sourceIds: [it.availability.sourceId], needsAdvisor: false,
    }));
  }

  // 8. opportunities
  const spareCreditTerms = sched.terms.filter((t) => t.credits < opts.maxCreditsPerTerm);
  if (spareCreditTerms.length && !(opts.careerTags ?? []).length) {
    findings.push(F({
      type: "opportunity", severity: "info", courseIds: [], message: `There is room for electives in ${spareCreditTerms.length} term${spareCreditTerms.length > 1 ? "s" : ""}. A minor or career-focused electives could fit without changing the finish date.`,
      fix: "Open the 'What if' view to compare options.", confidence: "assumption", sourceIds: ["S1"], needsAdvisor: false,
    }));
  }

  // 9. summary numbers and completeness
  const totalCredits = totals.earned + totals.inProgress + sched.terms.reduce((a, t) => a + t.credits, 0);
  const placedAll = sched.terms.flatMap((t) => t.courses);
  const realPlaced = placedAll.filter((c) => !c.placeholder);
  const offeringsKnown = realPlaced.length ? realPlaced.filter((c) => !c.availability.unknown).length / realPlaced.length : 1;
  const machineReadable = realPlaced.length ? 1 - realPlaced.filter((c) => ruleFor(c.code).ambiguous).length / realPlaced.length : 1;
  const completeness = Math.round(
    100 * (0.2 * (catYear === supplied ? 1 : 0) + 0.15 * (transfers.length ? 0 : 1) + 0.25 * offeringsKnown + 0.2 * machineReadable + 0.1 * (policy("course-load")?.value ? 1 : 0) + 0.0 * 0),
  ) / 100;
  // section and seat data would make up the last 10 points; they are unavailable so completeness caps at 0.9
  const advisorQuestions = [...new Set(findings.filter((f) => f.needsAdvisor).map((f) => adviseQuestion(f)))];
  const requirements = needs.requirements;
  const sourceIds = new Set<string>(["S1", "S2", ...(record.isSample ? ["S3"] : [])]);
  for (const f of findings) f.sourceIds.forEach((s) => sourceIds.add(s));
  return {
    planId: `${opts.majors.join("+")}${opts.minors.length ? "+" + opts.minors.join("+") : ""}-${label.toLowerCase().replace(/\W+/g, "-")}`,
    label,
    generatedFor: { majors: opts.majors, minors: opts.minors },
    catalogYear: neeley().sources[0].catalogYear,
    terms: sched.terms.map((t) => ({ ...t, current: false })),
    earliestGraduation: { termId: graduating, label: graduating ? labelOf(graduating) : null, confidence },
    totalCredits,
    remainingCredits: Math.max(0, (policy("total-hours")?.value ?? 120) - totals.earned - totals.inProgress),
    peakCredits: sched.terms.reduce((m, t) => Math.max(m, t.credits), 0),
    summerUsed: sched.terms.some((t) => t.label.startsWith("Summer")),
    bottleneck,
    slips: slips.map((s) => ({ code: s.code, title: needs.items.get(s.code)?.title ?? s.code, slipTerms: s.slip })),
    openCredits: sched.terms.reduce((a, t) => a + Math.max(0, opts.maxCreditsPerTerm - t.credits), 0),
    findings: sortFindings(findings),
    unverified: [...new Set(unverified)],
    requirements,
    sources: sourcesFor(sourceIds),
    completeness,
    advisorQuestions,
    status: "draft",
    notReviewed: true,
  };
}

function findMinGrade(e: PrereqExpr, code: string): string | undefined {
  if (e.kind === "course") return normCode(e.code) === code ? e.minGrade ?? "C-" : undefined;
  for (const i of e.items) { const g = findMinGrade(i, code); if (g) return g; }
  return undefined;
}

function countAcademicTerms(fromIdx: number, toIdx: number, allowSummer: boolean): number {
  let n = 0;
  for (let i = fromIdx + 1; i <= toIdx; i++) if (allowSummer || termFromIndex(i).name !== "Summer") n++;
  return n;
}

function confidenceOfPlan(items: Item[]): Finding["confidence"] {
  if (items.some((i) => i.availability.confidence === "assumption")) return "assumption";
  return "historical_pattern";
}

function sortFindings(fs: Finding[]): Finding[] {
  const order = { blocker: 0, warning: 1, info: 2 } as const;
  return [...fs].sort((a, b) => order[a.severity] - order[b.severity]);
}

function adviseQuestion(f: Finding): string {
  const first = f.message.split(/(?<=[.!?])\s/)[0];
  return f.fix ? `${first.replace(/\.$/, "")}. ${f.fix}` : first;
}

export function defaultTarget(record: StudentRecord): string | undefined {
  if (!record.catalogTermId) return undefined;
  const t = parseTermId(record.catalogTermId);
  // A four-year plan starting in Fall ends in Spring four years later.
  return t.name === "Fall" ? `${t.year + 4}-Spring` : `${t.year + 4}-${t.name}`;
}

export function planFor(record: StudentRecord, overrides: Partial<PlanOptions> = {}, label?: string): PlanResult {
  const { majors } = plansToMajorIds(record.plans);
  const opts: PlanOptions = {
    majors: overrides.majors ?? majors,
    minors: overrides.minors ?? [],
    maxCreditsPerTerm: overrides.maxCreditsPerTerm ?? 15,
    allowSummer: overrides.allowSummer ?? false,
    targetTermId: overrides.targetTermId ?? defaultTarget(record),
    careerTags: overrides.careerTags,
    electivePrefs: overrides.electivePrefs,
    avoid: overrides.avoid,
  };
  return buildPlan(record, opts, label);
}

export { isAdvanced };
