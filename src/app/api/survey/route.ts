import { z } from "zod";
import { json, readJson } from "@/lib/api";
import { fitPrograms, PROFILE_STATUS } from "@/lib/fit";
import { saveRow } from "@/lib/store";

const schema = z.object({
  answers: z.object({
    interests: z.array(z.string()).max(8).optional(),
    strengths: z.array(z.string()).max(6).optional(),
    quant: z.number().min(1).max(5).optional(),
    communication: z.number().min(1).max(5).optional(),
    people: z.number().min(1).max(5).optional(),
    creative: z.number().min(1).max(5).optional(),
    leadership: z.number().min(1).max(5).optional(),
    careers: z.array(z.string()).max(4).optional(),
    values: z.array(z.string()).max(3).optional(),
    worries: z.array(z.string()).max(5).optional(),
  }),
  knows: z.enum(["courses", "little", "nothing"]).optional(),
  consentToSave: z.boolean().optional(),
});

export async function POST(req: Request) {
  const r = await readJson(req, schema);
  if (!r.ok) return r.res;
  const fit = fitPrograms(r.data.answers);
  let saved: { id: string } | null = null;
  if (r.data.consentToSave) saved = await saveRow("survey_responses", { answers: r.data.answers, knows: r.data.knows ?? null, consent: true });
  return json({ fit, route: r.data.knows === "nothing" ? "chat" : "plan", profileStatus: PROFILE_STATUS, saved: !!saved });
}
