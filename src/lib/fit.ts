import { getProgram, majors } from "./catalog";

/**
 * Transparent fit scoring for prospective students (spec section 10).
 * Program profiles below are DRAFT values written from the catalog's own descriptions.
 * They have NOT been reviewed by Neeley advisors or faculty, and the weights are starting points to tune.
 * This ranks possibilities to explore. It never decides anything.
 */
export const PROFILE_STATUS = "Draft profiles built from catalog descriptions. Not reviewed by advisors.";

export const INTEREST_TAGS = ["technology", "people", "money", "creativity", "building", "helping", "business", "data"] as const;
export const STRENGTH_TAGS = ["math", "writing", "speaking", "science", "art", "leading"] as const;
export const CAREER_TAGS = ["data", "banking", "consulting", "startups", "brand", "operations", "sales", "real-estate", "technology"] as const;
export const VALUE_TAGS = ["income", "stability", "impact", "flexibility", "growth"] as const;

export interface SurveyAnswers {
  interests?: string[];
  strengths?: string[];
  quant?: number; // 1-5 comfort with math and data
  communication?: number; // 1-5
  people?: number; // 1 = analysis, 5 = people
  creative?: number; // 1 = structured, 5 = creative
  leadership?: number; // 1-5
  careers?: string[];
  values?: string[]; // top choices
  worries?: string[];
}

interface ProgramProfile {
  interests: string[];
  strengths: string[];
  careers: string[];
  values: string[];
  quant: number;
  communication: number;
  people: number;
  creative: number;
  leadership: number;
}

const PROFILES: Record<string, ProgramProfile> = {
  accounting: { interests: ["money", "business", "data"], strengths: ["math", "writing"], careers: ["banking", "consulting"], values: ["stability", "income"], quant: 4, communication: 3, people: 2, creative: 1, leadership: 2 },
  bis: { interests: ["technology", "data", "building"], strengths: ["math", "science"], careers: ["data", "technology", "consulting"], values: ["growth", "income"], quant: 4, communication: 3, people: 2, creative: 3, leadership: 3 },
  entrepreneurship: { interests: ["creativity", "building", "business", "people"], strengths: ["speaking", "leading", "art"], careers: ["startups", "consulting"], values: ["flexibility", "growth"], quant: 3, communication: 4, people: 4, creative: 5, leadership: 5 },
  finance: { interests: ["money", "business", "data"], strengths: ["math", "writing"], careers: ["banking", "real-estate", "consulting"], values: ["income", "growth"], quant: 5, communication: 3, people: 2, creative: 2, leadership: 3 },
  "finance-re": { interests: ["money", "building", "business"], strengths: ["math", "speaking"], careers: ["real-estate", "banking"], values: ["income", "growth"], quant: 4, communication: 3, people: 3, creative: 2, leadership: 3 },
  management: { interests: ["people", "business", "helping"], strengths: ["speaking", "leading", "writing"], careers: ["consulting", "operations"], values: ["growth", "stability", "impact"], quant: 3, communication: 5, people: 5, creative: 3, leadership: 5 },
  marketing: { interests: ["creativity", "people", "business", "data"], strengths: ["writing", "art", "speaking"], careers: ["brand", "sales", "data"], values: ["growth", "flexibility"], quant: 3, communication: 5, people: 4, creative: 5, leadership: 3 },
  scm: { interests: ["building", "data", "business"], strengths: ["math", "science"], careers: ["operations"], values: ["stability", "growth"], quant: 4, communication: 3, people: 3, creative: 2, leadership: 3 },
};

const WEIGHTS = { interests: 0.2, strengths: 0.15, careers: 0.2, quant: 0.1, communication: 0.05, people: 0.05, creative: 0.05, leadership: 0.05, values: 0.1 } as const;
type Dim = keyof typeof WEIGHTS;

function overlap(a: string[], b: string[]): number {
  if (!a.length) return 0;
  const hits = a.filter((x) => b.includes(x)).length;
  return hits / Math.min(a.length, Math.max(1, Math.min(b.length, 3)));
}
function closeness(a: number, b: number): number {
  return 1 - Math.abs(a - b) / 4;
}

const LABEL: Record<Dim, string> = {
  interests: "your interests", strengths: "your strengths", careers: "the work you can picture", quant: "your comfort with math and data",
  communication: "your comfort with writing and presenting", people: "your preference for people versus analysis", creative: "your preference for creative versus structured work",
  leadership: "your pull toward leading", values: "what you said matters most",
};

export interface FitResult {
  programId: string;
  name: string;
  score: number; // 0-100
  confidence: number; // share of weight answered, 0-1
  lowConfidence: boolean;
  reasons: string[];
  draftProfile: true;
}

export function answeredDims(a: SurveyAnswers): Dim[] {
  const d: Dim[] = [];
  if (a.interests?.length) d.push("interests");
  if (a.strengths?.length) d.push("strengths");
  if (a.careers?.length) d.push("careers");
  if (typeof a.quant === "number") d.push("quant");
  if (typeof a.communication === "number") d.push("communication");
  if (typeof a.people === "number") d.push("people");
  if (typeof a.creative === "number") d.push("creative");
  if (typeof a.leadership === "number") d.push("leadership");
  if (a.values?.length) d.push("values");
  return d;
}

export function fitPrograms(a: SurveyAnswers, top = 3): { results: FitResult[]; confidence: number; needMore: boolean; note: string; skipped: string[] } {
  const dims = answeredDims(a);
  const totalW = Object.values(WEIGHTS).reduce((x, y) => x + y, 0);
  const answeredW = dims.reduce((s, d) => s + WEIGHTS[d], 0);
  const confidence = Math.round((answeredW / totalW) * 100) / 100;
  const skipped = (Object.keys(WEIGHTS) as Dim[]).filter((d) => !dims.includes(d)).map((d) => LABEL[d]);
  if (!dims.length) return { results: [], confidence: 0, needMore: true, note: "No answers yet, so there is nothing to rank.", skipped };
  const results = majors()
    .filter((m) => PROFILES[m.id])
    .map((m) => {
      const p = PROFILES[m.id];
      const parts: { d: Dim; m: number }[] = dims.map((d) => {
        let mt = 0;
        if (d === "interests") mt = overlap(a.interests ?? [], p.interests);
        else if (d === "strengths") mt = overlap(a.strengths ?? [], p.strengths);
        else if (d === "careers") mt = overlap(a.careers ?? [], p.careers);
        else if (d === "values") mt = overlap(a.values ?? [], p.values);
        else mt = closeness((a as Record<string, number>)[d], p[d as "quant"]);
        return { d, m: Math.min(1, mt) };
      });
      const score = parts.reduce((s, x) => s + WEIGHTS[x.d] * x.m, 0) / answeredW;
      const reasons = [...parts]
        .sort((x, y) => WEIGHTS[y.d] * y.m - WEIGHTS[x.d] * x.m)
        .filter((x) => x.m >= 0.5)
        .slice(0, 3)
        .map((x) => `It lines up with ${LABEL[x.d]}.`);
      return { programId: m.id, name: getProgram(m.id)!.name, score: Math.round(score * 100), confidence, lowConfidence: confidence < 0.5, reasons, draftProfile: true as const };
    })
    .sort((x, y) => y.score - x.score);
  const needMore = confidence < 0.5;
  return {
    results: needMore ? results.slice(0, top) : results.slice(0, top),
    confidence,
    needMore,
    note: needMore
      ? "Most questions were skipped, so this is a low-confidence guess. Answering a few more questions would sharpen it."
      : "These are possibilities to explore, not a recommendation or a decision. Profiles are drafts that advisors have not reviewed.",
    skipped,
  };
}

export function programProfile(id: string): ProgramProfile | undefined {
  return PROFILES[id];
}
