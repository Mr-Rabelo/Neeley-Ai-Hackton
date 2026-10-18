import { z } from "zod";
import { json, llmOrNull, parseRecord, readJson } from "@/lib/api";
import { profileStudent } from "@/lib/ai/profile";
import { baselineAlternative } from "@/lib/engine/alternatives";

export const maxDuration = 60;

export async function POST(req: Request) {
  const r = await readJson(req, z.object({ record: z.unknown() }));
  if (!r.ok) return r.res;
  const record = parseRecord(r.data.record);
  if (!record) return json({ error: "That does not look like a parsed transcript." }, 400);
  const plan = baselineAlternative(record).plan;
  const profile = await profileStudent(record, llmOrNull(), plan);
  return json({ profile });
}
