import { z } from "zod";
import { AI_OFF, bad, json, llmOrNull, readJson } from "@/lib/api";
import { marketSummaryForAI } from "@/lib/market";
import { newContext } from "@/lib/ai/tools";
import { CAUTION, verifyReply } from "@/lib/ai/verify";
import { describeAiError } from "@/lib/ai/client";

export const maxDuration = 60;

export async function POST(req: Request) {
  const r = await readJson(req, z.object({ majorIds: z.array(z.string()).min(1).max(3), interests: z.string().max(400).optional() }));
  if (!r.ok) return r.res;
  const llm = llmOrNull();
  if (!llm) return json({ error: "ai_unavailable", message: AI_OFF }, 503);
  const data = r.data.majorIds.map((id) => marketSummaryForAI(id));
  if (data.some((d) => !d)) return bad("Unknown major.");
  const ctx = newContext("prospect");
  ctx.toolText = JSON.stringify(data);
  let res: Awaited<ReturnType<typeof llm>>;
  try {
    res = await llm({
    system:
      "You write a short, honest job-market analysis of Neeley majors for students, using ONLY the JSON provided. Cover for each major: demand and projected growth over 3 to 5 years (use the estimated 3 and 5 year figures and label them as estimates interpolated from BLS's 10-year projection), median pay with its year, typical routes (from the catalog), skills and the courses that build them. If two majors are given, end with a neutral comparison and what each trade-off means. Frame everything as possibilities, never guarantees. Cite BLS and the date. Do not add any number that is not in the JSON. About 220 words per major, plain paragraphs, no tables.",
    messages: [{ role: "user", content: `Student interests (optional): ${r.data.interests ?? "not given"}\n\nData:\n${JSON.stringify(data)}` }],
    maxTokens: 1800,
    });
  } catch (e) {
    return json({ error: "ai_unavailable", message: `Claude could not write the analysis (${describeAiError(e)}).` }, 502);
  }
  const text = res.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
  const v = verifyReply(text, ctx);
  return json({ analysis: v.ok ? text : `${text}\n\n${CAUTION}`, verified: v.ok, issues: v.issues });
}
