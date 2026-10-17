import { z } from "zod";
import { json, readJson } from "@/lib/api";
import { saveRow } from "@/lib/store";

const schema = z.object({
  rating: z.number().min(1).max(5),
  missing: z.string().max(1000).optional(),
  recommend: z.boolean().optional(),
  followUp: z.boolean().optional(),
  contact: z.string().max(160).optional(),
});

export async function POST(req: Request) {
  const r = await readJson(req, schema);
  if (!r.ok) return r.res;
  const d = r.data;
  const saved = await saveRow("feedback", { rating: d.rating, comments: d.missing ?? null, would_recommend: d.recommend ?? null, follow_up: d.followUp ?? false, contact: d.followUp ? (d.contact ?? null) : null });
  return json({ ok: true, stored: saved.stored });
}
