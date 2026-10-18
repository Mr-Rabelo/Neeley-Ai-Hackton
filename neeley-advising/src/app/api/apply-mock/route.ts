import { z } from "zod";
import { json, readJson } from "@/lib/api";
import { saveRow } from "@/lib/store";

const schema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(160),
  term: z.string().max(40),
  program: z.string().max(80),
  note: z.string().max(500).optional(),
  consent: z.boolean(),
});

export async function POST(req: Request) {
  const r = await readJson(req, schema);
  if (!r.ok) return r.res;
  const d = r.data;
  // Demo form: only saved when the person agrees; it never submits a real application.
  const saved = d.consent ? await saveRow("applications_mock", { name: d.name, email: d.email, term: d.term, program: d.program, note: d.note ?? null, consent: true }) : null;
  return json({ demo: true, saved: !!saved, message: "This is a demo form. It does not submit an application to TCU." });
}
