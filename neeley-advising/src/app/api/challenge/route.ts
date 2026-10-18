import { z } from "zod";
import { json, readJson } from "@/lib/api";
import { saveRow } from "@/lib/store";

const schema = z.object({
  findingId: z.string().max(80),
  finding: z.string().max(600),
  note: z.string().min(3).max(800),
  name: z.string().max(120).optional(),
  email: z.string().email().max(160).optional(),
  consent: z.boolean(),
});

/** A student disagrees with a finding. It goes to an advisor as a review request; nothing on the record changes. */
export async function POST(req: Request) {
  const r = await readJson(req, schema);
  if (!r.ok) return r.res;
  const d = r.data;
  if (!d.consent) return json({ error: "Please confirm you agree to share this with an advisor." }, 400);
  const saved = await saveRow("advisor_requests", {
    type: "review",
    status: "review_requested",
    contact: { name: d.name ?? null, email: d.email ?? null, phone: null },
    preferred_time: null,
    topic: `Student challenges a finding: ${d.finding.slice(0, 160)}`,
    packet: { challenge: { findingId: d.findingId, finding: d.finding, note: d.note } },
    channel: "web",
  });
  return json({ id: saved.id, stored: saved.stored, message: "Sent to an advisor. The finding stays as it is until an advisor reviews it." });
}
