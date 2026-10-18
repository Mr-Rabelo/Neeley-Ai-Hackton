import { z } from "zod";
import { json, readJson } from "@/lib/api";
import { scheduleCheck } from "@/lib/sections";
import type { PlanResult } from "@/lib/types";

export const maxDuration = 30;

// Reads only the plan's terms. It never needs a student record and never changes the plan.
const course = z.object({
  code: z.string().max(24), title: z.string().max(160), credits: z.number().min(0).max(12), placeholder: z.boolean().optional(),
});
const term = z.object({
  termId: z.string().regex(/^\d{4}-(Spring|Summer|Fall)$/), label: z.string().max(40), credits: z.number().min(0).max(30), courses: z.array(course).max(14),
});
const schema = z.object({
  terms: z.array(term).max(16),
  hints: z.object({ preferMorning: z.boolean().optional(), preferAfternoon: z.boolean().optional() }).optional(),
});

export async function POST(req: Request) {
  const r = await readJson(req, schema);
  if (!r.ok) return r.res;
  const plan = { terms: r.data.terms.map((t) => ({ ...t, courses: t.courses.map((c) => ({ ...c, satisfies: [], availability: undefined, reason: "" })) })) } as unknown as PlanResult;
  return json(scheduleCheck(plan, r.data.hints ?? {}));
}
