import { z } from "zod";
import { json, readJson } from "@/lib/api";
import { getRow } from "@/lib/store";
import type { LogEntry } from "@/lib/lifecycle";

const schema = z.object({ ids: z.array(z.string().uuid()).max(20) });

/** A student looks up only the request ids their own browser saved. Private advisor notes are never returned. */
export async function POST(req: Request) {
  const r = await readJson(req, schema);
  if (!r.ok) return r.res;
  const out = [];
  for (const id of r.data.ids) {
    const row = await getRow("advisor_requests", id);
    if (!row) continue;
    const log = ((row.packet as { advisorLog?: LogEntry[] } | null)?.advisorLog ?? []).filter((e) => e.visible);
    out.push({ id, type: row.type, status: row.status, topic: row.topic ?? null, created_at: row.created_at, messages: log.map((e) => ({ at: e.at, by: e.by, note: e.note, action: e.action })) });
  }
  return json({ requests: out });
}
