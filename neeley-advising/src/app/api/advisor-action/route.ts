import { z } from "zod";
import { json, readJson } from "@/lib/api";
import { advisorDenied } from "@/lib/advisor-auth";
import { getRow, updateRow } from "@/lib/store";
import { ACTION_RESULT, appendLog } from "@/lib/lifecycle";

const schema = z.object({
  id: z.string().uuid(),
  action: z.enum(["request_info", "mark_reviewed", "supersede", "reopen", "note"]),
  note: z.string().max(1000).default(""),
  visibleToStudent: z.boolean().default(false),
});

export async function POST(req: Request) {
  const denied = advisorDenied(req);
  if (denied) return denied;
  const r = await readJson(req, schema);
  if (!r.ok) return r.res;
  const { id, action, note, visibleToStudent } = r.data;
  if (action === "request_info" && note.trim().length < 3) return json({ error: "Say what you need from the student." }, 400);
  const row = await getRow("advisor_requests", id);
  if (!row) return json({ error: "Request not found." }, 404);
  const next = ACTION_RESULT[action];
  const packet = appendLog(row.packet as Record<string, unknown> | null, {
    at: new Date().toISOString(), by: "advisor", action, note: note.trim(),
    visible: action === "request_info" || (action !== "note" && visibleToStudent) || (action === "note" && visibleToStudent),
  });
  const ok = await updateRow("advisor_requests", id, { packet, ...(next ? { status: next } : {}) });
  if (!ok) return json({ error: "Could not update that request." }, 500);
  return json({ id, status: next ?? row.status, packet });
}
