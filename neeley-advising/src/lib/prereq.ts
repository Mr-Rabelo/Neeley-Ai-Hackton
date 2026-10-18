import type { CourseRule, PrereqExpr } from "./types";
import { getCourse, normCode } from "./catalog";

const CODE = /\b([A-Z]{2,5})\s?(\d{5})\b/g;
const GRADE = /(?:grade of|minimum grade of|at least|with an?|earn(?:ed)? an?)\s+(?:an?\s+)?(?:grade\s+of\s+)?(?:at least\s+)?['"]?([ABCD][+-]?)(?![A-Za-z])/i;

const RESTRICTION_WORDS = /(major|minor|standing|permission|admission|admitted|must be|enrol|enroll|score|placement|GPA|honors|program|approval|consent|certification|exam|test)/i;
const OTHER_PATH_WORDS = /(score|placement|equivalent|permission of|exempt|instructor)/i;

function splitStatement(text: string): { prereq: string; coreq: string } {
  const coreqIdx = text.search(/Co-?requisites?\s*:/i);
  if (coreqIdx === -1) return { prereq: text, coreq: "" };
  return { prereq: text.slice(0, coreqIdx), coreq: text.slice(coreqIdx) };
}

/** Extract course mentions with the connector text that precedes each one. */
function mentions(text: string) {
  const out: { code: string; start: number; end: number; gap: string }[] = [];
  let last = 0;
  let lastSubject = "";
  const re = new RegExp(CODE.source, "g");
  const bare = /\b(\d{5})\b/g;
  // first pass: full codes
  const spans: { code: string; start: number; end: number; subject: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) spans.push({ code: `${m[1]}${m[2]}`, start: m.index, end: m.index + m[0].length, subject: m[1] });
  // second pass: bare numbers that follow a subject ("MATH 20123 and 20524")
  while ((m = bare.exec(text))) {
    if (spans.some((s) => m!.index >= s.start && m!.index < s.end)) continue;
    const before = spans.filter((s) => s.end <= m!.index).pop();
    if (before && /^[\s,;]*(?:and|or|,|;|&)?[\s]*$/i.test(text.slice(before.end, m.index).replace(/with[^,;]*?(?=,|;|$)/i, ""))) {
      spans.push({ code: `${before.subject}${m[1]}`, start: m.index, end: m.index + m[0].length, subject: before.subject });
    }
  }
  spans.sort((a, b) => a.start - b.start);
  for (const s of spans) {
    out.push({ code: s.code, start: s.start, end: s.end, gap: text.slice(last, s.start) });
    last = s.end;
    lastSubject = s.subject;
  }
  void lastSubject;
  return out;
}

function connectorBefore(gap: string): "or" | "and" {
  // The connector is whatever sits directly before the next code, ignoring "with a grade of C-" clauses.
  const cleaned = gap.replace(/with (?:an? )?(?:minimum )?grade[^,;]*/gi, " ").replace(/grade of[^,;]*/gi, " ");
  if (/\bor\b/i.test(cleaned)) return "or";
  return "and";
}

const CONCURRENT = /(?:credit for,?\s*(?:or\s*)?)?concurrent(?:ly)?(?:\s+(?:enrollment|registration))?(?:\s+(?:in|with))?\s+([A-Z]{2,8})\s?(\d{5})/gi;
const SENTENCE_SPLIT = /(?<=[a-z\)\-'"0-9])\.\s+(?=[A-Z])/;
const NOT_A_PREREQ = /^\s*(students may not|this course|may not|credit will not|the course may not)/i;

export function parsePrereq(statement: string): Omit<CourseRule, "code"> {
  const text = statement.replace(/\s+/g, " ").trim();
  const { prereq: prereqAll, coreq } = splitStatement(text);
  const coreqCodes = mentions(coreq).map((m) => m.code);
  const withoutConcurrent = prereqAll.replace(CONCURRENT, (_m, s: string, n: string) => {
    coreqCodes.push(`${s}${n}`);
    return " ";
  });
  // A catalog entry often lists a different path for each kind of student, one sentence each.
  // The first sentence that states a requirement is treated as the primary (business major) path.
  let primary = "";
  let otherPaths = false;
  for (const s of withoutConcurrent.split(SENTENCE_SPLIT)) {
    if (NOT_A_PREREQ.test(s)) continue;
    const hasCode = new RegExp(CODE.source).test(s);
    const states = hasCode || RESTRICTION_WORDS.test(s);
    if (!primary) { if (states) primary = s; continue; }
    if (hasCode) otherPaths = true;
  }
  const prereq = primary || "";
  const ms = mentions(prereq);
  const restrictions: string[] = [];
  for (const clause of prereq.split(/[.;]|,\s*(?:and|or)\s+|\band\b(?=\s+must)/i)) {
    const c = clause.trim();
    if (!c) continue;
    const hasCode = new RegExp(CODE.source).test(c);
    if (RESTRICTION_WORDS.test(c) && (!hasCode || /must be|standing|major|permission|admission/i.test(c))) {
      const clean = c.replace(/^Prerequisites?\s*:?\s*/i, "").replace(/\s+/g, " ");
      if (clean && !/^\W*$/.test(clean) && !/^[A-Z]{2,5}\s?\d{5}\b[^a-z]*$/.test(clean)) restrictions.push(clean.slice(0, 160));
    }
  }
  otherPaths = otherPaths || (OTHER_PATH_WORDS.test(prereq) && ms.length > 0);
  if (ms.length === 0) {
    return { coreq: dedupe(coreqCodes), restrictions: dedupe(restrictions), ambiguous: false, otherPaths: false, prereqText: text };
  }

  const gradeMatch = prereq.match(GRADE);
  const defaultGrade = gradeMatch ? gradeMatch[1].toUpperCase() : undefined;
  const leaf = (code: string): PrereqExpr => ({ kind: "course", code, minGrade: defaultGrade });

  // Consecutive "or" joins items; "and" starts a new group. Mixed connectors are flagged ambiguous.
  const connectors = ms.slice(1).map((m) => connectorBefore(m.gap));
  const hasOr = connectors.includes("or");
  const hasAnd = connectors.includes("and");
  const ambiguous = hasOr && hasAnd;
  const groups: PrereqExpr[][] = [[leaf(ms[0].code)]];
  connectors.forEach((c, i) => {
    if (c === "or") groups[groups.length - 1].push(leaf(ms[i + 1].code));
    else groups.push([leaf(ms[i + 1].code)]);
  });
  const items: PrereqExpr[] = groups.map((g) => (g.length === 1 ? g[0] : { kind: "any", items: g }));
  const expr: PrereqExpr = items.length === 1 ? items[0] : { kind: "all", items };
  return { prereq: expr, coreq: dedupe(coreqCodes), restrictions: dedupe(restrictions), ambiguous, otherPaths, prereqText: text };
}

function dedupe(a: string[]): string[] {
  return [...new Set(a)];
}

const RULE_CACHE = new Map<string, CourseRule>();

export function ruleFor(code: string): CourseRule {
  const k = normCode(code);
  const hit = RULE_CACHE.get(k);
  if (hit) return hit;
  const c = getCourse(k);
  const base = parsePrereq(c?.prerequisiteText ?? "");
  const rule: CourseRule = { code: k, ...base };
  RULE_CACHE.set(k, rule);
  return rule;
}

export function exprCodes(e: PrereqExpr | undefined): string[] {
  if (!e) return [];
  if (e.kind === "course") return [normCode(e.code)];
  return e.items.flatMap(exprCodes);
}

export function describeExpr(e: PrereqExpr | undefined): string {
  if (!e) return "none listed";
  if (e.kind === "course") return e.code;
  const sep = e.kind === "all" ? " and " : " or ";
  return e.items.map((i) => (i.kind === "course" ? i.code : `(${describeExpr(i)})`)).join(sep);
}

/** Is the expression satisfied given a predicate for "course is done"? */
export function evalExpr(e: PrereqExpr | undefined, done: (code: string, minGrade?: string) => boolean): boolean {
  if (!e) return true;
  if (e.kind === "course") return done(normCode(e.code), e.minGrade);
  if (e.kind === "all") return e.items.every((i) => evalExpr(i, done));
  return e.items.some((i) => evalExpr(i, done));
}
