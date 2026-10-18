import fs from "node:fs";
import path from "node:path";
import type { CatalogCourse, Program, ReqGroup, SourceRecord } from "./types";

interface NeeleyData {
  sources: SourceRecord[];
  policies: Policy[];
  core: { id: string; name: string; hours: number; group: string; note?: string }[];
  coreSource: { sourceId: string; page: number; note: string };
  lowerDivision: {
    sourceId: string;
    page: number;
    required: string[];
    oneOf: string[][];
    beforeDeclaringMajor: string[];
    notes: string[];
  };
  businessCore: { sourceId: string; page: number; courses: { code: string; credits: number }[] };
  suggestedSequence: Record<string, unknown>;
  majors: Program[];
  minors: Program[];
}

export interface Policy {
  id: string;
  text: string;
  sourceId: string | null;
  page?: number | null;
  value?: number;
  maxHours?: number;
  unverified?: boolean;
  needsReview?: boolean;
  advisorRequired?: boolean;
  [k: string]: unknown;
}

let _courses: CatalogCourse[] | null = null;
let _byCode: Map<string, CatalogCourse> | null = null;
let _neeley: NeeleyData | null = null;

const dataPath = (...p: string[]) => path.join(process.cwd(), "data", ...p);

export function normCode(code: string): string {
  return code.replace(/\s+/g, "").toUpperCase();
}

export function prettyCode(code: string): string {
  const c = normCode(code);
  const m = c.match(/^([A-Z]+)(\d+)$/);
  return m ? `${m[1]} ${m[2]}` : code;
}

export function allCourses(): CatalogCourse[] {
  if (!_courses) {
    _courses = JSON.parse(fs.readFileSync(dataPath("catalog", "courses.json"), "utf8")).courses as CatalogCourse[];
  }
  return _courses;
}

function byCode(): Map<string, CatalogCourse> {
  if (!_byCode) {
    _byCode = new Map();
    for (const c of allCourses()) {
      const k = normCode(c.code);
      // keep the first entry that has a description if a code appears twice
      const prev = _byCode.get(k);
      if (!prev || (!prev.description && c.description)) _byCode.set(k, c);
    }
  }
  return _byCode;
}

export function getCourse(code: string): CatalogCourse | undefined {
  return byCode().get(normCode(code));
}

export function neeley(): NeeleyData {
  if (!_neeley) _neeley = JSON.parse(fs.readFileSync(dataPath("catalog", "neeley.json"), "utf8")) as NeeleyData;
  return _neeley;
}

export function getSource(id: string): SourceRecord | undefined {
  return neeley().sources.find((s) => s.id === id);
}

export function sourcesFor(ids: Iterable<string>): SourceRecord[] {
  const seen = new Set<string>();
  const out: SourceRecord[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const s = getSource(id);
    if (s) out.push(s);
  }
  return out;
}

export function getProgram(id: string): Program | undefined {
  return [...neeley().majors, ...neeley().minors].find((p) => p.id === id);
}

export function majors(): Program[] {
  return neeley().majors;
}
export function minors(): Program[] {
  return neeley().minors;
}

export function policy(id: string): Policy | undefined {
  return neeley().policies.find((p) => p.id === id);
}

const CREDIT_OVERRIDES = new Map<string, number>();
function creditOverrides() {
  if (CREDIT_OVERRIDES.size === 0) {
    const n = neeley();
    for (const c of n.businessCore.courses) CREDIT_OVERRIDES.set(c.code, c.credits);
    for (const p of [...n.majors, ...n.minors]) for (const r of p.required) if (r.credits) CREDIT_OVERRIDES.set(normCode(r.code), r.credits);
    CREDIT_OVERRIDES.set("MATH10524", 4);
  }
  return CREDIT_OVERRIDES;
}

/** Credit hours for a catalog course. Uses curated overrides, then the description, then the last digit of the number. */
export function creditsFor(code: string): number {
  const k = normCode(code);
  const o = creditOverrides().get(k);
  if (o) return o;
  const c = getCourse(k);
  if (c?.description) {
    const m = c.description.match(/^\(?(\d+(?:\.\d+)?)(?:-\d+)? (?:semester |credit )?hours?/i);
    if (m) return Number(m[1]);
  }
  const d = Number(k.slice(-1));
  return d >= 1 ? d : 3;
}

export function courseLevel(code: string): number {
  const m = normCode(code).match(/(\d)\d{4}$/);
  return m ? Number(m[1]) * 10000 : 0;
}

export function isAdvanced(code: string): boolean {
  return courseLevel(code) >= 30000;
}

export function subjectOf(code: string): string {
  return normCode(code).replace(/\d+$/, "");
}

export function titleOf(code: string): string {
  return getCourse(code)?.title || prettyCode(code);
}

export function searchCourses(query: string, limit = 25): CatalogCourse[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const qc = normCode(q);
  const out: CatalogCourse[] = [];
  for (const c of allCourses()) {
    if (normCode(c.code).startsWith(qc) || c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)) {
      out.push(c);
      if (out.length >= limit) break;
    }
  }
  return out;
}

export function groupHours(g: ReqGroup): number {
  return g.hours;
}
