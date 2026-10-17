import { z } from "zod";
import { json, parseRecord, readJson } from "@/lib/api";
import { baselineAlternative, baseOptions } from "@/lib/engine/alternatives";
import { buildPlan } from "@/lib/engine/plan";
import { majors, minors } from "@/lib/catalog";

export const maxDuration = 30;

const schema = z.object({
  record: z.unknown(),
  options: z
    .object({
      majors: z.array(z.string()).max(3).optional(),
      minors: z.array(z.string()).max(2).optional(),
      maxCreditsPerTerm: z.number().min(9).max(21).optional(),
      allowSummer: z.boolean().optional(),
    })
    .optional(),
});

export async function POST(req: Request) {
  const r = await readJson(req, schema);
  if (!r.ok) return r.res;
  const record = parseRecord(r.data.record);
  if (!record) return json({ error: "That does not look like a parsed transcript." }, 400);
  const o = r.data.options;
  const ids = new Set([...majors(), ...minors()].map((p) => p.id));
  if ([...(o?.majors ?? []), ...(o?.minors ?? [])].some((id) => !ids.has(id))) return json({ error: "Unknown program id." }, 400);
  if (!o) return json({ plan: baselineAlternative(record).plan });
  return json({ plan: buildPlan(record, baseOptions(record, o), "What-if plan") });
}
