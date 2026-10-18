import { z } from "zod";
import { json, parseRecord, readJson } from "@/lib/api";
import { saveRow } from "@/lib/store";
import { buildPacket } from "@/lib/packet";
import { baselineAlternative } from "@/lib/engine/alternatives";

const schema = z.object({
  type: z.enum(["meeting", "callback", "review"]),
  name: z.string().max(120).optional(),
  email: z.string().email().max(160).optional(),
  phone: z.string().max(30).optional(),
  preferredTime: z.string().max(120).optional(),
  topic: z.string().max(500).optional(),
  consent: z.boolean(),
  record: z.unknown().optional(),
  context: z
    .object({ goals: z.record(z.string(), z.unknown()).optional(), corrections: z.record(z.string(), z.unknown()).optional(), correctionNotes: z.array(z.string().max(300)).max(20).optional() })
    .optional(),
});

export async function POST(req: Request) {
  const r = await readJson(req, schema);
  if (!r.ok) return r.res;
  const d = r.data;
  if (!d.consent) return json({ error: "Please confirm you agree to be contacted so we can save this request." }, 400);
  if (d.type !== "review" && !d.email && !d.phone) return json({ error: "Add an email or a phone number so an advisor can reach you." }, 400);
  let packet = null;
  if (d.type === "review") {
    const record = parseRecord(d.record);
    if (!record) return json({ error: "A review request needs a loaded transcript." }, 400);
    packet = buildPacket(record, baselineAlternative(record).plan, d.topic ?? "Student requested advisor review");
    if (d.context && JSON.stringify(d.context).length < 6000) packet = { ...packet, context: d.context };
  }
  const saved = await saveRow("advisor_requests", {
    type: d.type, status: d.type === "review" ? "review_requested" : "requested", contact: { name: d.name ?? null, email: d.email ?? null, phone: d.phone ?? null },
    preferred_time: d.preferredTime ?? null, topic: d.topic ?? null, packet, channel: "web",
  });
  return json({ id: saved.id, stored: saved.stored, packet, message: "Request saved. A real advisor will follow up. Nothing has been approved or changed on your record." });
}
