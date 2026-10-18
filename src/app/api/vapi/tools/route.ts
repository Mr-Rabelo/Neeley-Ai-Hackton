import { json, llmOrNull } from "@/lib/api";
import { handleVapiTools, MAX_BODY_BYTES, secretMatches } from "@/lib/vapi";

export const maxDuration = 60;

// Vapi calls this endpoint when the voice assistant uses the `neeley_advising_answer` function.
// Authentication: Vapi sends the shared secret in the x-vapi-secret header (a Custom Credential in the Vapi dashboard).
export async function POST(req: Request) {
  const secret = process.env.VAPI_SERVER_SECRET;
  if (!secret) return json({ error: "Voice tools are not configured (VAPI_SERVER_SECRET is missing)." }, 503);
  if (!secretMatches(req.headers.get("x-vapi-secret"), secret)) return json({ error: "Unauthorized." }, 401);
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return json({ error: "Request too large." }, 413);
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return json({ error: "Request too large." }, 413);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "Body must be JSON." }, 400);
  }
  const res = await handleVapiTools(body, llmOrNull());
  return json(res.json, res.status);
}
