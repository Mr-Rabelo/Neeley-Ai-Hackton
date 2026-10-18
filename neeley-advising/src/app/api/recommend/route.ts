import { z } from "zod";
import { AI_OFF, json, llmOrNull, parseRecord, readJson } from "@/lib/api";
import { engineRecommendations, recommend } from "@/lib/ai/recommend";
import { baselineAlternative } from "@/lib/engine/alternatives";

export const maxDuration = 120;

export async function POST(req: Request) {
  const r = await readJson(req, z.object({ record: z.unknown(), profile: z.unknown().optional() }));
  if (!r.ok) return r.res;
  const record = parseRecord(r.data.record);
  if (!record) return json({ error: "That does not look like a parsed transcript." }, 400);
  const llm = llmOrNull();
  if (!llm) return json({ recommendations: engineRecommendations(record, baselineAlternative(record).plan), notice: AI_OFF });
  try {
    return json({ recommendations: await recommend(record, llm, r.data.profile as never) });
  } catch (e) {
    return json({ recommendations: engineRecommendations(record, baselineAlternative(record).plan), notice: `Claude could not finish (${e instanceof Error ? e.message : "error"}); showing the engine's facts only.` });
  }
}
