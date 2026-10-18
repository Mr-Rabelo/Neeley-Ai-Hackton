import { json } from "@/lib/api";
import { anthropic, describeAiError, FAST_MODEL, hasAnthropicKey, MODEL } from "@/lib/ai/client";
import { storageMode } from "@/lib/store";
import { vapiBrowserConfigured, vapiToolsConfigured } from "@/lib/vapi";

export const maxDuration = 30;

export async function GET(req: Request) {
  const base = { ok: true, ai: hasAnthropicKey() ? "configured" : "missing ANTHROPIC_API_KEY", storage: storageMode(), voice: vapiBrowserConfigured() && vapiToolsConfigured() ? "configured" : "not configured" };
  if (new URL(req.url).searchParams.get("deep") !== "1" || !hasAnthropicKey()) return json(base);
  // Deep check: one tiny call per configured model, reporting only non-secret status text.
  const checks: Record<string, string> = {};
  for (const model of [...new Set([MODEL(), FAST_MODEL()])]) {
    try {
      await anthropic().messages.create({ model, max_tokens: 8, messages: [{ role: "user", content: "Reply with OK." }] });
      checks[model] = "ok";
    } catch (e) {
      checks[model] = describeAiError(e);
    }
  }
  return json({ ...base, models: checks });
}
