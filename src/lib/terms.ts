import type { Term, TermName } from "./types";

const ORDER: Record<TermName, number> = { Spring: 0, Summer: 1, Fall: 2 };
const NAMES: TermName[] = ["Spring", "Summer", "Fall"];

export function termIndex(year: number, name: TermName): number {
  return year * 3 + ORDER[name];
}

export function termFromIndex(index: number): Term {
  const year = Math.floor(index / 3);
  const name = NAMES[index - year * 3];
  return { id: `${year}-${name}`, year, name, index, label: `${name} ${year}` };
}

export function parseTermId(id: string): Term {
  const [y, n] = id.split("-");
  return termFromIndex(termIndex(Number(y), n as TermName));
}

/** "2026 Fall Term" -> "2026-Fall" */
export function termIdFromTranscript(s: string): string | null {
  const m = s.match(/(\d{4}) (Fall|Spring|Summer)/);
  return m ? `${m[1]}-${m[2]}` : null;
}

export function labelOf(termId: string): string {
  return parseTermId(termId).label;
}

/** Terms strictly after `fromId`, skipping Summer unless allowed, up to `count` terms. */
export function termsAfter(fromId: string, count: number, allowSummer: boolean): Term[] {
  const out: Term[] = [];
  let i = parseTermId(fromId).index + 1;
  while (out.length < count) {
    const t = termFromIndex(i++);
    if (t.name === "Summer" && !allowSummer) continue;
    out.push(t);
  }
  return out;
}

export function academicYearOf(term: Term): string {
  // Fall 2025 -> 2025-26; Spring/Summer 2026 -> 2025-26
  const start = term.name === "Fall" ? term.year : term.year - 1;
  return `${start}-${String(start + 1).slice(2)}`;
}
