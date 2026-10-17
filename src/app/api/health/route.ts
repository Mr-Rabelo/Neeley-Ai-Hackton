import { json } from "@/lib/api";
import { hasAnthropicKey } from "@/lib/ai/client";
import { storageMode } from "@/lib/store";
import { twilioConfigured } from "@/lib/twilio";

export async function GET() {
  return json({ ok: true, ai: hasAnthropicKey() ? "configured" : "missing ANTHROPIC_API_KEY", storage: storageMode(), voice: twilioConfigured() ? "configured" : "not configured" });
}
