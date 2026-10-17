import { getCourse } from "../catalog";
import type { ToolContext } from "./tools";

export interface VerifyResult {
  ok: boolean;
  issues: string[];
}

const CODE = /\b([A-Z]{2,5})\s?(\d{5})\b/g;
const NEGATION = /(\bnot\b|\bno\b|n't|\bnever\b|\bwithout\b|\bcannot\b)/i;

/** Check a reply against what the tools actually returned. Cheap, deterministic, and run on every reply. */
export function verifyReply(text: string, ctx: ToolContext, userText = ""): VerifyResult {
  const issues: string[] = [];
  const allowedFromUser = new Set([...userText.matchAll(CODE)].map((m) => `${m[1]}${m[2]}`));
  const seen = new Set<string>();
  for (const m of text.matchAll(CODE)) {
    const code = `${m[1]}${m[2]}`;
    if (seen.has(code)) continue;
    seen.add(code);
    if (!getCourse(code)) issues.push(`${m[1]} ${m[2]} is not a course in the supplied catalog.`);
    else if (!ctx.toolCourseCodes.has(code) && !allowedFromUser.has(code)) issues.push(`${m[1]} ${m[2]} was not in any tool result this turn.`);
  }
  const phrases: [RegExp, string][] = [
    [/\byou will (?:definitely |certainly )?(?:graduate|finish|be done)\b/i, 'States a definite graduation outcome ("you will graduate").'],
    [/\b(?:is|are|has been|have been|was|were) (?:officially )?(?:approved|cleared)\b/i, "Says something is approved or cleared."],
    [/\byou(?:'re| are) (?:cleared|eligible) to graduate\b/i, "Declares graduation eligibility."],
    [/\bwill (?:definitely |certainly )?be offered\b/i, "Promises a future course offering."],
  ];
  for (const [re, msg] of phrases) if (re.test(text)) issues.push(msg);
  for (const m of text.matchAll(/guarantee[sd]?/gi)) {
    const before = text.slice(Math.max(0, (m.index ?? 0) - 30), m.index);
    if (!NEGATION.test(before)) issues.push('Uses "guarantee" without a negation.');
  }
  // Quoted money and percentages must come from a tool result.
  const toolText = ctx.toolText.replace(/,/g, "");
  for (const m of text.matchAll(/\$\s?(\d[\d,]*(?:\.\d+)?)/g)) {
    const n = m[1].replace(/,/g, "");
    if (!toolText.includes(n)) issues.push(`The figure $${m[1]} is not in any tool result.`);
  }
  for (const m of text.matchAll(/(\d+(?:\.\d+)?)\s?%/g)) {
    if (!toolText.includes(m[1])) issues.push(`The figure ${m[1]}% is not in any tool result.`);
  }
  return { ok: issues.length === 0, issues: [...new Set(issues)].slice(0, 8) };
}

export const CAUTION =
  "Note: some details in this answer could not be checked against the planning engine's results. Please confirm them with a Neeley advisor before relying on them.";
