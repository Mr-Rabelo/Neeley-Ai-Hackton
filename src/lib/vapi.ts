import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { runChat, type ChatTurn } from "./ai/chat";
import type { Llm } from "./ai/llm";
import { getState, putState } from "./store";
import { plainSpeech } from "./voice";

/** The one function the Vapi assistant calls. Its schema is documented in the README. */
export const FUNCTION_NAME = "neeley_advising_answer";
export const MAX_BODY_BYTES = 20_000;
const MAX_CALLS_PER_REQUEST = 4;

const FALLBACK = "I can't look that up right now. A Neeley advisor can answer it, and I can take a name and number for a call-back if you'd like.";

// Only `question` is accepted. Anything else the model sends is dropped.
const argsSchema = z.object({ question: z.string().trim().min(1).max(600) });

export interface VapiToolCall { id: string; name: string; args: unknown }

export function vapiConfig() {
  return {
    publicKey: !!process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY,
    assistantId: !!process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID,
    serverSecret: !!process.env.VAPI_SERVER_SECRET,
  };
}

/** Constant-time comparison of the shared secret Vapi sends in the x-vapi-secret header. */
export function secretMatches(given: string | null, expected: string): boolean {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function parseArgs(raw: unknown): unknown {
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  return raw ?? {};
}

/** Read the tool calls out of a Vapi "tool-calls" server message (current and older shapes). */
export function extractToolCalls(body: unknown): { callId: string; calls: VapiToolCall[] } | null {
  const msg = (body as { message?: Record<string, unknown> } | null)?.message;
  if (!msg || typeof msg !== "object" || msg.type !== "tool-calls") return null;
  const callId = String((msg.call as { id?: unknown } | undefined)?.id ?? "unknown").slice(0, 80);
  const out: VapiToolCall[] = [];
  const list = msg.toolCallList ?? msg.toolCalls ?? [];
  if (Array.isArray(list)) {
    for (const item of list) {
      const t = item as { id?: unknown; name?: unknown; arguments?: unknown; function?: { name?: unknown; arguments?: unknown } };
      const id = typeof t.id === "string" ? t.id : null;
      const name = typeof t.name === "string" ? t.name : typeof t.function?.name === "string" ? t.function.name : null;
      if (!id || !name) continue;
      out.push({ id: id.slice(0, 120), name, args: parseArgs(t.arguments ?? t.function?.arguments) });
    }
  }
  if (!out.length) return null;
  return { callId, calls: out.slice(0, MAX_CALLS_PER_REQUEST) };
}

export interface VapiResponse { status: number; json: unknown }

/**
 * Answer Vapi tool calls with the app's existing voice-mode AI and advising tools.
 * Vapi expects HTTP 200 with { results: [{ toolCallId, result }] }, where result is a single-line string.
 */
export async function handleVapiTools(body: unknown, llm: Llm | null): Promise<VapiResponse> {
  const parsed = extractToolCalls(body);
  if (!parsed) return { status: 400, json: { error: "Expected a Vapi tool-calls message." } };
  const key = `vapi:${parsed.callId}`;
  const results: { toolCallId: string; result: string }[] = [];
  for (const call of parsed.calls) {
    if (call.name !== FUNCTION_NAME) {
      results.push({ toolCallId: call.id, result: `Unknown function ${call.name.slice(0, 40)}.` });
      continue;
    }
    const args = argsSchema.safeParse(call.args);
    if (!args.success) {
      results.push({ toolCallId: call.id, result: "I need the caller's question to look that up." });
      continue;
    }
    if (!llm) {
      results.push({ toolCallId: call.id, result: FALLBACK });
      continue;
    }
    try {
      const state = await getState("conversations", key);
      const history = ((state?.messages as ChatTurn[] | undefined) ?? []).slice(-10);
      const messages: ChatTurn[] = [...history, { role: "user", content: args.data.question }];
      const out = await runChat({ llm, mode: "voice", messages });
      const answer = out.correctedText ?? out.text;
      await putState("conversations", key, { channel: "vapi", messages: [...messages, { role: "assistant", content: answer }].slice(-12) });
      results.push({ toolCallId: call.id, result: plainSpeech(answer) || FALLBACK });
    } catch {
      results.push({ toolCallId: call.id, result: FALLBACK });
    }
  }
  return { status: 200, json: { results } };
}
