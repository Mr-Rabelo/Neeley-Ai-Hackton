import { z } from "zod";
import { json, readJson } from "@/lib/api";
import { advisorDenied } from "@/lib/advisor-auth";
import { saveRow } from "@/lib/store";

const row = z.object({
  course: z.string().regex(/^[A-Z]{2,8}\s?\d{5}$/),
  term: z.string().regex(/^\d{4}-(Fall|Spring|Summer)$/),
  section: z.string().max(10).default("01"),
  days: z.string().regex(/^[MTWRF]{1,5}$/),
  start: z.string().regex(/^\d{1,2}:\d{2}$/),
  end: z.string().regex(/^\d{1,2}:\d{2}$/),
  seats: z.number().int().min(0).max(1000).optional(),
  enrolled: z.number().int().min(0).max(1000).optional(),
});
const schema = z.object({ kind: z.literal("sections"), source: z.string().min(2).max(200), rows: z.array(row).min(1).max(5000) });

/** Advisors or registrar staff upload section data. It is stored for review; plans do not use it until it is wired in. */
export async function POST(req: Request) {
  const denied = advisorDenied(req);
  if (denied) return denied;
  const r = await readJson(req, schema);
  if (!r.ok) return r.res;
  const saved = await saveRow("data_uploads", { kind: r.data.kind, source: r.data.source, row_count: r.data.rows.length, rows: r.data.rows, status: "stored_unverified" });
  return json({ id: saved.id, stored: saved.stored, warning: saved.warning, rows: r.data.rows.length, message: "Stored for review. Plans do not use this data yet." });
}
