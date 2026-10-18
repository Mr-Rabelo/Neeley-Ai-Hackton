import { z } from "zod";
import { json, readJson } from "@/lib/api";
import { getRow, updateRow } from "@/lib/store";
import { appendLog } from "@/lib/lifecycle";

const schema = z.object({ id: z.string().uuid(), message: z.string().min(2).max(1000) });

/** The student answers an advisor's question. Only allowed while the request is waiting on the student. */
export async function POST(req: Request) {
  const r = await readJson(req, schema);
  if (!r.ok) return r.res;
  const row = await getRow("advisor_requests", r.data.id);
  if (!row) return json({ error: "Request not found." }, 404);
  if (row.status !== "needs_info") return json({ error: "This request is not waiting for more information." }, 409);
  const packet = appendLog(row.packet as Record<string, unknown> | null, { at: new Date().toISOString(), by: "student", action: "reply", note: r.data.message.trim(), visible: true });
  await updateRow("advisor_requests", r.data.id, { packet, status: "review_requested" });
  return json({ id: r.data.id, status: "review_requested" });
}
