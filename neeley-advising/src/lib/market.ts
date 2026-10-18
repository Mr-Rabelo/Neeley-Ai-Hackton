import fs from "node:fs";
import path from "node:path";
import { courseLevel, creditsFor, getCourse, getProgram, majors, neeley, normCode, prettyCode, titleOf } from "./catalog";
import { exprCodes, ruleFor } from "./prereq";
import type { SourceRecord } from "./types";

export interface Occupation {
  id: string;
  title: string;
  url: string;
  medianPay: number;
  payYear: number;
  jobs: number;
  growthPct: number;
  change: number;
  openingsPerYear: number;
}

interface MarketFile {
  _note: string;
  source: SourceRecord;
  projectionPeriod: string;
  projectionYears: number;
  occupations: Occupation[];
  majors: Record<string, {
    occupations: string[];
    routes: string[];
    routesSource: { sourceId: string; page: number };
    skills: string[];
    skillCourses: string[];
    caveat: string;
  }>;
}

let _m: MarketFile | null = null;
function data(): MarketFile {
  if (!_m) _m = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "market", "market.json"), "utf8")) as MarketFile;
  return _m;
}

/** BLS publishes a 10-year projection. A shorter horizon is an interpolation, labeled as an estimate. */
export function interpolateGrowth(pct10: number, years: number): number {
  return Math.round(((1 + pct10 / 100) ** (years / 10) - 1) * 1000) / 10;
}

export interface MarketView {
  majorId: string;
  majorName: string;
  period: string;
  occupations: (Occupation & { est3yrPct: number; est5yrPct: number })[];
  aggregate: { weightedGrowthPct10: number; est3yrPct: number; est5yrPct: number; openingsPerYear: number; medianPayLow: number; medianPayHigh: number; jobs: number };
  outlookLabel: "Stronger growth" | "Average growth" | "Slower growth";
  routes: string[];
  routesSource: { sourceId: string; page: number };
  skills: { skill: string }[];
  skillCourses: { code: string; title: string; credits: number }[];
  caveat: string;
  source: SourceRecord;
  disclaimer: string;
  retrieved: string;
}

export function marketForMajor(majorId: string): MarketView | null {
  const d = data();
  const m = d.majors[majorId];
  const prog = getProgram(majorId);
  if (!m || !prog) return null;
  const occ = m.occupations.map((id) => d.occupations.find((o) => o.id === id)).filter((o): o is Occupation => !!o);
  const jobs = occ.reduce((a, o) => a + o.jobs, 0);
  const change = occ.reduce((a, o) => a + o.change, 0);
  const g10 = jobs ? Math.round((change / jobs) * 1000) / 10 : 0;
  const pays = occ.map((o) => o.medianPay);
  return {
    majorId,
    majorName: prog.name,
    period: d.projectionPeriod,
    occupations: occ.map((o) => ({ ...o, est3yrPct: interpolateGrowth(o.growthPct, 3), est5yrPct: interpolateGrowth(o.growthPct, 5) })),
    aggregate: {
      weightedGrowthPct10: g10,
      est3yrPct: interpolateGrowth(g10, 3),
      est5yrPct: interpolateGrowth(g10, 5),
      openingsPerYear: occ.reduce((a, o) => a + o.openingsPerYear, 0),
      medianPayLow: Math.min(...pays),
      medianPayHigh: Math.max(...pays),
      jobs,
    },
    outlookLabel: g10 >= 9 ? "Stronger growth" : g10 >= 5 ? "Average growth" : "Slower growth",
    routes: m.routes,
    routesSource: m.routesSource,
    skills: m.skills.map((skill) => ({ skill })),
    skillCourses: m.skillCourses.map((c) => ({ code: normCode(c), title: titleOf(c), credits: creditsFor(c) })),
    caveat: m.caveat,
    source: d.source,
    disclaimer: "Possibilities, not guarantees. Figures are projections for the whole occupation nationally, not for TCU graduates, and not a promise of jobs or pay. The 3 and 5 year numbers are interpolated from BLS's 10-year projection and are estimates, not BLS figures.",
    retrieved: d.source.asOf,
  };
}

export function marketSummaryForAI(majorId: string) {
  const v = marketForMajor(majorId);
  if (!v) return null;
  return {
    major: v.majorName,
    projectionPeriod: v.period,
    occupations: v.occupations.map((o) => ({
      title: o.title, medianPayUSD: o.medianPay, payYear: o.payYear, projectedGrowthPct_10yr: o.growthPct,
      estimatedGrowthPct_3yr: o.est3yrPct, estimatedGrowthPct_5yr: o.est5yrPct, projectedNewJobs_10yr: o.change, openingsPerYear: o.openingsPerYear, source: o.url,
    })),
    combined: v.aggregate,
    outlook: v.outlookLabel,
    routesFromCatalog: v.routes,
    skillCoursesInMajor: v.skillCourses.map((c) => `${prettyCode(c.code)} ${c.title}`),
    caveat: v.caveat,
    rules: "Present as possibilities, not guarantees. 3 and 5 year figures are interpolated estimates. Cite BLS and the date.",
  };
}

// ---------- difficulty (structure-based estimate) ----------
export interface DifficultyView {
  majorId: string;
  label: "Lower" | "Medium" | "Higher";
  note: string;
  inputs: { requiredCourses: number; upperLevelCourses: number; longestPrerequisiteChain: number; quantitativeShare: number; writingEmphasisHours: number };
  method: string;
}

const QUANT_SUBJECTS = new Set(["ACCT", "FINA", "ECON", "MATH"]);
const QUANT_WORDS = /(analytic|statist|model|quantitative|data|derivative|investment|valuation|tax|audit|cost|machine|learning|forecast)/i;

function repCourses(programId: string): string[] {
  const p = getProgram(programId);
  if (!p) return [];
  const out = p.required.map((r) => normCode(r.code));
  for (const g of p.groups) {
    const n = Math.max(1, Math.round(g.hours / 3));
    out.push(...g.from.map(normCode).filter((c) => !!getCourse(c)).slice(0, n));
  }
  return [...new Set(out)];
}

function chainDepth(codes: Set<string>): number {
  const memo = new Map<string, number>();
  const up = (c: string, seen: Set<string>): number => {
    if (memo.has(c)) return memo.get(c)!;
    if (seen.has(c)) return 0;
    seen.add(c);
    const pre = exprCodes(ruleFor(c).prereq).filter((p) => !!getCourse(p));
    const d = pre.length ? 1 + Math.max(...pre.map((p) => up(p, seen))) : 0;
    seen.delete(c);
    memo.set(c, d);
    return d;
  };
  let best = 0;
  for (const c of codes) best = Math.max(best, up(c, new Set()));
  return best;
}

function rawScore(programId: string) {
  const courses = repCourses(programId);
  const set = new Set(courses);
  const upper = courses.filter((c) => courseLevel(c) >= 30000).length;
  const quant = courses.filter((c) => QUANT_SUBJECTS.has(c.replace(/\d+$/, "")) || QUANT_WORDS.test(titleOf(c))).length;
  const chain = chainDepth(set);
  const writing = getProgram(programId)?.writingEmphasisHours ?? 6;
  const share = courses.length ? quant / courses.length : 0;
  const score = 0.35 * (chain / 6) + 0.3 * share + 0.2 * (upper / Math.max(1, courses.length)) + 0.15 * (writing / 9);
  return { score, inputs: { requiredCourses: courses.length, upperLevelCourses: upper, longestPrerequisiteChain: chain, quantitativeShare: Math.round(share * 100) / 100, writingEmphasisHours: writing } };
}

export function difficultyFor(majorId: string): DifficultyView {
  const ids = majors().map((m) => m.id);
  const all = ids.map((id) => ({ id, ...rawScore(id) })).sort((a, b) => a.score - b.score);
  const idx = all.findIndex((x) => x.id === majorId);
  const t = all.length / 3;
  const label = idx < t ? "Lower" : idx < 2 * t ? "Medium" : "Higher";
  const mine = all[idx] ?? rawScore(majorId);
  return {
    majorId,
    label,
    note: `${label} relative to the other Neeley majors, based on course structure only.`,
    inputs: mine.inputs,
    method: "Estimated from the major's own required and typical elective courses: longest prerequisite chain, share of quantitative courses, upper-level share and writing-emphasis hours, ranked against the other Neeley majors. It is not a prediction of anyone's grades and uses no grade data.",
  };
}

export function allMarketMajors(): string[] {
  return majors().map((m) => m.id).filter((id) => !!data().majors[id]);
}

export function marketSource(): SourceRecord {
  return data().source;
}

export { neeley };
