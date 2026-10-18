import type { Program, ReqGroup, RequirementStatus, StudentRecord, TranscriptCourse } from "../types";
import { creditsFor, getCourse, getProgram, isAdvanced, neeley, normCode, subjectOf, titleOf } from "../catalog";
import { meetsGrade } from "../transcript";

export type CourseState = "done" | "in_progress";

export interface StudentState {
  record: StudentRecord;
  /** best record per code: completed TCU courses and passed transfer courses */
  done: Map<string, TranscriptCourse>;
  inProgress: Map<string, TranscriptCourse>;
}

export function studentState(record: StudentRecord): StudentState {
  const done = new Map<string, TranscriptCourse>();
  const inProgress = new Map<string, TranscriptCourse>();
  for (const c of record.courses) {
    if (c.status === "completed" && meetsGrade(c.grade, "D-")) done.set(c.code, c);
    else if (c.status === "in_progress") inProgress.set(c.code, c);
  }
  return { record, done, inProgress };
}

/** Transfer courses are posted on the TCU record but are not mapped to BBA requirements until evaluated. */
export function countsForRequirement(c: TranscriptCourse): boolean {
  return !c.transfer;
}

// ---------- TCU Core Curriculum mapping ----------
const ATTRIBUTE_MAP: [RegExp, string][] = [
  [/^fine arts/i, "fine-arts"],
  [/^humanities/i, "humanities"],
  [/^social science/i, "social-sciences"],
  [/^historical traditions/i, "historical"],
  [/^literary traditions/i, "literary"],
  [/^religious traditions/i, "religious"],
  [/^mathematical reasoning/i, "mathematics"],
  [/^natural science/i, "natural-sciences"],
  [/^oral communication/i, "oral"],
  [/^cultural awareness/i, "cultural"],
  [/^global awareness/i, "global"],
  [/^citizenship/i, "citizenship"],
];

export const KNOWN_NON_CORE_ATTRIBUTES = [/honors/i, /neeley fellows/i, /web folder/i, /energy technology/i, /comparative race/i];

export function coreCategoriesOf(c: TranscriptCourse): string[] {
  const out = new Set<string>();
  for (const a of c.attributes) {
    for (const [re, id] of ATTRIBUTE_MAP) if (re.test(a)) out.add(id);
    if (/^written communication/i.test(a)) {
      // Use the catalog description to tell WCO 1 from WCO 2.
      const desc = getCourse(c.code)?.description ?? "";
      if (/Written Communication 2/i.test(desc)) out.add("wco2");
      else if (/Written Communication 1/i.test(desc)) out.add("wco1");
      else out.add(c.code.endsWith("10803") ? "wco1" : "wco2");
    }
  }
  return [...out];
}

export function unmappedAttributes(record: StudentRecord): { attribute: string; courses: string[] }[] {
  const map = new Map<string, string[]>();
  for (const c of record.courses) {
    for (const a of c.attributes) {
      const known = ATTRIBUTE_MAP.some(([re]) => re.test(a)) || /^written communication/i.test(a) || KNOWN_NON_CORE_ATTRIBUTES.some((re) => re.test(a));
      if (!known) map.set(a, [...(map.get(a) ?? []), c.code]);
    }
  }
  return [...map.entries()].map(([attribute, courses]) => ({ attribute, courses }));
}

// ---------- requirement groups ----------
export interface GroupFill {
  groupId: string;
  chosen: string[]; // codes that satisfy (done or in progress) or were selected
  done: string[];
  inProgress: string[];
  hoursDone: number;
  hoursInProgress: number;
  hoursNeeded: number;
}

/** Choose which courses fill a group: finished first, then in progress, then the caller's preferred list. */
export function fillGroup(
  g: ReqGroup,
  st: StudentState,
  used: Set<string>,
  prefer: string[] = [],
): GroupFill {
  const from = g.from.map(normCode);
  const done: string[] = [];
  const inProg: string[] = [];
  let hDone = 0;
  let hProg = 0;
  const outsideCount = (subj: string) => [...done, ...inProg].filter((c) => subjectOf(c) !== subj).length;
  const take = (code: string, list: string[], isDone: boolean) => {
    if (used.has(code)) return false;
    const credits = isDone ? (st.done.get(code)?.earned ?? creditsFor(code)) : (st.inProgress.get(code)?.attempted ?? creditsFor(code));
    if (g.maxOutsideSubject) {
      for (const [subj, max] of Object.entries(g.maxOutsideSubject)) {
        if (subjectOf(code) !== subj && (outsideCount(subj) + 1) * 3 > max) return false;
      }
    }
    list.push(code);
    used.add(code);
    if (isDone) hDone += credits; else hProg += credits;
    return true;
  };
  for (const code of from) {
    const d = st.done.get(code);
    if (d && countsForRequirement(d) && hDone + hProg < g.hours) take(code, done, true);
  }
  for (const code of from) {
    if (st.inProgress.has(code) && hDone + hProg < g.hours) take(code, inProg, false);
  }
  void prefer;
  return { groupId: g.id, chosen: [...done, ...inProg], done, inProgress: inProg, hoursDone: hDone, hoursInProgress: hProg, hoursNeeded: g.hours };
}

export function programRequirements(p: Program, st: StudentState, used: Set<string>, category: "major" | "minor"): RequirementStatus[] {
  const out: RequirementStatus[] = [];
  const reqCodes = p.required.map((r) => ({ code: normCode(r.code), credits: r.credits ?? creditsFor(r.code), associated: !!r.associated }));
  const mk = (suffix: string, label: string, list: typeof reqCodes, assoc: boolean) => {
    if (!list.length) return;
    const satisfiedBy: string[] = [];
    const inProgress: string[] = [];
    const remaining: string[] = [];
    let hDone = 0;
    let hProg = 0;
    for (const r of list) {
      const sub = (p.substitutions ?? []).find((s) => normCode(s.replace) === r.code);
      const d = st.done.get(r.code);
      const dSub = sub ? st.done.get(normCode(sub.with)) : undefined;
      if (d && countsForRequirement(d)) { satisfiedBy.push(r.code); hDone += r.credits; }
      else if (dSub && countsForRequirement(dSub)) { satisfiedBy.push(normCode(sub!.with)); hDone += r.credits; }
      else if (st.inProgress.has(r.code)) { inProgress.push(r.code); hProg += r.credits; }
      else remaining.push(r.code);
    }
    const needed = list.reduce((a, r) => a + r.credits, 0);
    out.push({
      id: `${p.id}:${suffix}`,
      label,
      category: assoc ? "associated" : category,
      programId: p.id,
      hoursNeeded: needed,
      hoursDone: hDone,
      hoursInProgress: hProg,
      status: remaining.length === 0 ? (inProgress.length ? "in_progress" : "complete") : "remaining",
      satisfiedBy: [...satisfiedBy, ...inProgress],
      remainingCourses: remaining,
      sourceId: p.sourceId,
      page: p.page,
      note: sub_note(p, remaining),
    });
    for (const c of [...satisfiedBy, ...inProgress]) used.add(c);
  };
  mk("required", `${p.name}: required courses`, reqCodes.filter((r) => !r.associated), false);
  mk("associated", `${p.name}: associated requirements`, reqCodes.filter((r) => r.associated), true);
  for (const g of p.groups) {
    const fill = fillGroup(g, st, used);
    const filled = fill.hoursDone + fill.hoursInProgress;
    out.push({
      id: `${p.id}:${g.id}`,
      label: `${p.name}: ${g.label}`,
      category: g.id.includes("global") || g.id.startsWith("assoc") ? "associated" : category,
      programId: p.id,
      hoursNeeded: g.hours,
      hoursDone: fill.hoursDone,
      hoursInProgress: fill.hoursInProgress,
      status: filled >= g.hours ? (fill.hoursInProgress ? "in_progress" : "complete") : "remaining",
      satisfiedBy: fill.chosen,
      remainingCourses: [],
      chooseFrom: g.from.map(normCode),
      chooseFromTitles: Object.fromEntries(g.from.map((c) => [normCode(c), titleOf(c)])),
      sourceId: p.sourceId,
      page: p.page,
      note: [g.note, g.advisorNote, g.followUp].filter(Boolean).join(" "),
    });
  }
  return out;
}

function sub_note(p: Program, remaining: string[]): string | undefined {
  const notes = (p.substitutions ?? []).filter((s) => remaining.includes(normCode(s.replace))).map((s) => s.note);
  return notes.length ? notes.join(" ") : undefined;
}

export function lowerDivisionRequirements(st: StudentState, used: Set<string>): RequirementStatus[] {
  const n = neeley();
  const ld = n.lowerDivision;
  const items: { code: string; credits: number; options?: string[] }[] = [
    ...ld.required.map((c) => ({ code: c, credits: creditsFor(c) })),
    ...ld.oneOf.map((opts) => ({ code: opts[0], credits: 3, options: opts })),
    ...ld.beforeDeclaringMajor.map((c) => ({ code: c, credits: creditsFor(c) })),
  ];
  const satisfied: string[] = [];
  const inProg: string[] = [];
  const remaining: string[] = [];
  let hDone = 0;
  let hProg = 0;
  for (const it of items) {
    const opts = (it.options ?? [it.code]).map(normCode);
    const d = opts.find((o) => st.done.has(o) && countsForRequirement(st.done.get(o)!));
    const p = opts.find((o) => st.inProgress.has(o));
    if (d) { satisfied.push(d); hDone += it.credits; }
    else if (p) { inProg.push(p); hProg += it.credits; }
    else remaining.push(it.options ? opts.join(" or ") : it.code);
  }
  for (const c of [...satisfied, ...inProg]) used.add(c);
  const needed = items.reduce((a, i) => a + i.credits, 0);
  return [
    {
      id: "lower-division",
      label: "Lower-division business requirements",
      category: "lower-division",
      hoursNeeded: needed,
      hoursDone: hDone,
      hoursInProgress: hProg,
      status: remaining.length === 0 ? (inProg.length ? "in_progress" : "complete") : "remaining",
      satisfiedBy: [...satisfied, ...inProg],
      remainingCourses: remaining.map((r) => r.split(" or ")[0]),
      sourceId: ld.sourceId,
      page: ld.page,
      note: ld.notes.join(" "),
    },
  ];
}

export function businessCoreRequirements(st: StudentState, used: Set<string>): RequirementStatus[] {
  const bc = neeley().businessCore;
  const satisfied: string[] = [];
  const inProg: string[] = [];
  const remaining: string[] = [];
  let hDone = 0;
  let hProg = 0;
  for (const c of bc.courses) {
    const code = normCode(c.code);
    const d = st.done.get(code);
    if (d && countsForRequirement(d)) { satisfied.push(code); hDone += c.credits; }
    else if (st.inProgress.has(code)) { inProg.push(code); hProg += c.credits; }
    else remaining.push(code);
  }
  for (const c of [...satisfied, ...inProg]) used.add(c);
  const needed = bc.courses.reduce((a, c) => a + c.credits, 0);
  return [
    {
      id: "business-core",
      label: "Upper-division business core",
      category: "business-core",
      hoursNeeded: needed,
      hoursDone: hDone,
      hoursInProgress: hProg,
      status: remaining.length === 0 ? (inProg.length ? "in_progress" : "complete") : "remaining",
      satisfiedBy: [...satisfied, ...inProg],
      remainingCourses: remaining,
      sourceId: bc.sourceId,
      page: bc.page,
    },
  ];
}

export function coreCurriculumRequirements(st: StudentState): RequirementStatus[] {
  const n = neeley();
  const byCat = new Map<string, { done: string[]; prog: string[]; hDone: number; hProg: number }>();
  for (const cat of n.core) byCat.set(cat.id, { done: [], prog: [], hDone: 0, hProg: 0 });
  for (const c of st.record.courses) {
    if (c.transfer) continue; // unevaluated for BBA
    if (c.status !== "completed" && c.status !== "in_progress") continue;
    for (const id of coreCategoriesOf(c)) {
      const b = byCat.get(id);
      if (!b) continue;
      if (c.status === "completed") { b.done.push(c.code); b.hDone += c.earned; }
      else { b.prog.push(c.code); b.hProg += c.attempted; }
    }
  }
  return n.core
    .filter((cat) => cat.id !== "writing-emphasis")
    .map((cat) => {
      const b = byCat.get(cat.id)!;
      const total = b.hDone + b.hProg;
      return {
        id: `core:${cat.id}`,
        label: `Core Curriculum: ${cat.name}`,
        category: "core-curriculum" as const,
        hoursNeeded: cat.hours,
        hoursDone: Math.min(b.hDone, cat.hours),
        hoursInProgress: Math.min(b.hProg, Math.max(0, cat.hours - b.hDone)),
        status: total >= cat.hours ? (b.hDone >= cat.hours ? ("complete" as const) : ("in_progress" as const)) : ("remaining" as const),
        satisfiedBy: [...b.done, ...b.prog],
        remainingCourses: [],
        sourceId: n.coreSource.sourceId,
        page: n.coreSource.page,
      };
    });
}

export function writingEmphasisRequirement(majorIds: string[], st: StudentState): RequirementStatus {
  const needed = Math.max(6, ...majorIds.map((id) => getProgram(id)?.writingEmphasisHours ?? 6));
  const known = new Set(majorIds.flatMap((id) => getProgram(id)?.writingEmphasisCourses ?? []).map(normCode));
  let hDone = 0;
  let hProg = 0;
  const by: string[] = [];
  for (const code of known) {
    if (st.done.has(code)) { hDone += 3; by.push(code); }
    else if (st.inProgress.has(code)) { hProg += 3; by.push(code); }
  }
  return {
    id: "core:writing-emphasis",
    label: "Core Curriculum: Writing Emphasis (in the major)",
    category: "core-curriculum",
    hoursNeeded: needed,
    hoursDone: hDone,
    hoursInProgress: hProg,
    status: hDone + hProg >= needed ? "in_progress" : "remaining",
    satisfiedBy: by,
    remainingCourses: [],
    sourceId: "S1",
    page: 587,
    note: "Writing-emphasis courses are designated in each major's section. The supplied catalog pages designate them for Finance only; other majors' designations were not found.",
  };
}

export function totalsFor(st: StudentState) {
  let earned = 0;
  let inProg = 0;
  let advancedTcu = 0;
  let pnc = 0;
  for (const c of st.record.courses) {
    if (c.status === "completed") {
      earned += c.earned;
      if (!c.transfer && isAdvanced(c.code)) advancedTcu += c.earned;
      if (c.grade === "P") pnc += c.earned;
    } else if (c.status === "in_progress") {
      inProg += c.attempted;
      if (isAdvanced(c.code)) advancedTcu += 0;
    }
  }
  return { earned, inProgress: inProg, advancedTcu, pnc };
}
