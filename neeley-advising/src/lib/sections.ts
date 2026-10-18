import type { PlanResult } from "./types";

/**
 * SAMPLE class schedule. TCU's real section schedule was not supplied, so this module invents a deterministic,
 * clearly labeled one so conflicts, load and seats can be shown and tested. Nothing here is TCU data and
 * nothing here changes the plan: it only reads the engine's finished plan.
 *
 * Assumed rules (documented in the README):
 *  - 3+ credit courses meet MWF for 50 minutes or TR for 75 minutes, in standard blocks.
 *  - Courses of 1 to 1.5 credits meet once a week for 75 minutes.
 *  - Half of courses have a single section, the rest 2 or 3; popular mid-morning slots are chosen more often.
 *  - Capacity 20 to 45; 50% to 102% of seats requested, so a few sections are full with a waitlist.
 *  - The same course, term and seed always give the same sections.
 */
export const SAMPLE_SEED = "neeley-sample-schedule-v1";
export const SAMPLE_LABEL = "Sample schedule (assumed). Not TCU's real schedule.";

export type Day = "M" | "T" | "W" | "R" | "F";
export const DAYS: Day[] = ["M", "T", "W", "R", "F"];
export const DAY_NAME: Record<Day, string> = { M: "Mon", T: "Tue", W: "Wed", R: "Thu", F: "Fri" };

// Prime-time blocks come up more often than early-morning and late-afternoon ones.
const MWF_W = [1, 3, 4, 4, 3, 2, 2, 1];
const TR_W = [1, 4, 4, 3, 2, 1];
function pick<T>(items: T[], weights: number[], x: number): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let acc = 0;
  for (let i = 0; i < items.length; i++) { acc += weights[i]; if (x * total < acc) return items[i]; }
  return items[items.length - 1];
}

const MWF: [number, number][] = [8, 9, 10, 11, 12, 13, 14, 15].map((h) => [h * 60, h * 60 + 50]);
const TR: [number, number][] = [[8 * 60, 9 * 60 + 15], [9 * 60 + 30, 10 * 60 + 45], [11 * 60, 12 * 60 + 15], [12 * 60 + 30, 13 * 60 + 45], [14 * 60, 15 * 60 + 15], [15 * 60 + 30, 16 * 60 + 45]];

export interface SampleSection {
  courseCode: string;
  termId: string;
  section: string; // "01"
  days: Day[];
  start: number; // minutes after midnight
  end: number;
  delivery: "In person" | "Hybrid";
  capacity: number;
  seatsOpen: number;
  waitlist: number;
  sample: true;
}

export const fmtTime = (m: number) => {
  const h = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, "0");
  return `${((h + 11) % 12) + 1}:${mm} ${h >= 12 ? "pm" : "am"}`;
};
export const fmtDays = (d: Day[]) => d.join("");

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Sections of one course in one term. Deterministic. */
export function sectionsFor(code: string, termId: string, credits: number): SampleSection[] {
  const r = rng(hash(`${SAMPLE_SEED}|${code}|${termId}`));
  const roll = r();
  const n = roll < 0.5 ? 1 : roll < 0.85 ? 2 : 3;
  const level = Number((code.match(/(\d)\d{4}$/) ?? [])[1] ?? 1);
  const out: SampleSection[] = [];
  const used = new Set<string>();
  for (let i = 0; i < n; i++) {
    const weekly = credits < 3;
    const mwf = !weekly && r() < 0.5;
    let days: Day[];
    let block: [number, number];
    let key = "";
    for (let tries = 0; tries < 8; tries++) {
      if (weekly) { days = [r() < 0.5 ? "T" : "R"]; block = pick(TR, TR_W, r()); }
      else if (mwf) { days = ["M", "W", "F"]; block = pick(MWF, MWF_W, r()); }
      else { days = ["T", "R"]; block = pick(TR, TR_W, r()); }
      key = `${days.join("")}${block[0]}`;
      if (!used.has(key)) break;
    }
    used.add(key);
    const capacity = 20 + Math.floor(r() * 6) * 5 - (level >= 3 ? 0 : -5); // 20-45, larger at lower levels
    const filled = Math.min(capacity, Math.round(capacity * (0.5 + r() * 0.52)));
    const seatsOpen = Math.max(0, capacity - filled);
    out.push({
      courseCode: code, termId, section: String(i + 1).padStart(2, "0"),
      days: days!, start: block![0], end: block![1],
      delivery: level >= 3 && r() < 0.2 ? "Hybrid" : "In person",
      capacity, seatsOpen, waitlist: seatsOpen === 0 ? 1 + Math.floor(r() * 6) : 0, sample: true,
    });
  }
  return out;
}

export const overlaps = (a: SampleSection, b: SampleSection) =>
  a.days.some((d) => b.days.includes(d)) && a.start < b.end && b.start < a.end;

export type SeatStatus = "open" | "few" | "waitlist";
export const seatStatus = (s: SampleSection): SeatStatus => (s.seatsOpen === 0 ? "waitlist" : s.seatsOpen <= 3 ? "few" : "open");

export interface ChosenSection { code: string; title: string; credits: number; section: SampleSection; alternatives: number; status: SeatStatus }
export interface Conflict { a: string; b: string; days: Day[]; message: string }
export interface TermSchedule {
  termId: string;
  label: string;
  credits: number;
  chosen: ChosenSection[];
  placeholders: string[]; // slots with no specific course, so no section
  conflicts: Conflict[];
  conflictFree: boolean;
  waitlisted: string[];
  note: string;
}

export interface PreferenceHints { preferMorning?: boolean; preferAfternoon?: boolean }

function score(s: SampleSection, hints: PreferenceHints): number {
  let v = 0;
  if (seatStatus(s) === "open") v += 3; else if (seatStatus(s) === "few") v += 2;
  if (hints.preferMorning && s.start < 12 * 60) v += 1;
  if (hints.preferAfternoon && s.start >= 12 * 60) v += 1;
  return v;
}

/**
 * Pick one section per course so that nothing overlaps, if that is possible; otherwise the pick with the fewest
 * overlaps. Exhaustive search is fine here: at most ~7 courses with at most 3 sections each.
 */
export function chooseSections(courses: { code: string; title: string; credits: number; sections: SampleSection[] }[], hints: PreferenceHints = {}) {
  type Best = { picks: number[]; conflicts: number; pref: number };
  const state: { best: Best | null } = { best: null };
  const picks: number[] = [];
  const countConflicts = (upTo: number, idx: number) => {
    let c = 0;
    for (let j = 0; j < upTo; j++) if (overlaps(courses[j].sections[picks[j]], courses[idx].sections[picks[idx]])) c++;
    return c;
  };
  const dfs = (i: number, conflicts: number, pref: number) => {
    const best = state.best;
    if (best && conflicts > best.conflicts) return;
    if (i === courses.length) {
      if (!best || conflicts < best.conflicts || (conflicts === best.conflicts && pref > best.pref)) state.best = { picks: [...picks], conflicts, pref };
      return;
    }
    for (let k = 0; k < courses[i].sections.length; k++) {
      picks[i] = k;
      dfs(i + 1, conflicts + countConflicts(i, i), pref + score(courses[i].sections[k], hints));
    }
    picks.length = i;
  };
  if (courses.length) dfs(0, 0, 0);
  return state.best?.picks ?? [];
}

export function scheduleTerm(term: PlanResult["terms"][number], hints: PreferenceHints = {}): TermSchedule {
  const real = term.courses.filter((c) => !c.placeholder);
  const withSections = real.map((c) => ({ code: c.code, title: c.title, credits: c.credits, sections: sectionsFor(c.code, term.termId, c.credits) }));
  const picks = chooseSections(withSections, hints);
  const chosen: ChosenSection[] = withSections.map((c, i) => {
    const section = c.sections[picks[i] ?? 0];
    return { code: c.code, title: c.title, credits: c.credits, section, alternatives: c.sections.length - 1, status: seatStatus(section) };
  });
  const conflicts: Conflict[] = [];
  for (let i = 0; i < chosen.length; i++) {
    for (let j = i + 1; j < chosen.length; j++) {
      const a = chosen[i].section, b = chosen[j].section;
      if (overlaps(a, b)) {
        const days = a.days.filter((d) => b.days.includes(d));
        conflicts.push({ a: chosen[i].code, b: chosen[j].code, days, message: `${chosen[i].code} (${fmtDays(a.days)} ${fmtTime(a.start)}-${fmtTime(a.end)}) overlaps ${chosen[j].code} (${fmtDays(b.days)} ${fmtTime(b.start)}-${fmtTime(b.end)}) on ${days.map((d) => DAY_NAME[d]).join(", ")}.` });
      }
    }
  }
  const waitlisted = chosen.filter((c) => c.status === "waitlist").map((c) => c.code);
  return {
    termId: term.termId, label: term.label, credits: term.credits, chosen,
    placeholders: term.courses.filter((c) => c.placeholder).map((c) => c.title),
    conflicts, conflictFree: conflicts.length === 0, waitlisted,
    note: conflicts.length
      ? "No combination of the sample sections avoids every overlap. With real sections this might be solved by another section or term; ask an advisor."
      : "A conflict-free combination exists in the sample schedule.",
  };
}

export function scheduleCheck(plan: PlanResult, hints: PreferenceHints = {}) {
  const terms = plan.terms.map((t) => scheduleTerm(t, hints));
  return {
    label: SAMPLE_LABEL,
    assumptions: [
      "Times are generated, not published by TCU. 3-credit courses meet MWF (50 minutes) or TR (75 minutes) in standard blocks.",
      "Each course has 1 to 3 sections per term, with sample capacities and seats open.",
      "The check only reads the finished plan. It never moves a course or changes the earliest finish.",
    ],
    terms,
    totalConflicts: terms.reduce((a, t) => a + t.conflicts.length, 0),
    termsWithConflicts: terms.filter((t) => !t.conflictFree).length,
    waitlistedCourses: terms.reduce((a, t) => a + t.waitlisted.length, 0),
  };
}
