import { toolsFor } from "./ai/tools";

export function vapiBrowserConfigured(): boolean {
  return !!((process.env.NEXT_PUBLIC_VAPI_PUBLIC_CONFIG || process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY) && (process.env.NEXT_PUBLIC_VAPI_ASSISTANT_CONFIG || process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID));
}

export function vapiToolsConfigured(): boolean {
  return !!process.env.VAPI_SERVER_SECRET;
}

/** The open-ended tool: runs the full Claude tool loop with the reply verifier. Slower, for questions the data tools do not cover. */
export const VAPI_ANSWER_TOOL = "neeley_advising_answer";

export interface VapiFunction {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/**
 * Function tools the Vapi assistant can call at /api/vapi/tools. The data tools are the same voice-mode tools the
 * in-app assistant uses, so the schemas stay in one place; vapi/assistant.json is checked against this in tests.
 */
export function vapiFunctions(): VapiFunction[] {
  return [
    ...toolsFor("voice").map((t) => ({ name: t.name, description: t.description ?? "", parameters: t.input_schema as Record<string, unknown> })),
    {
      name: VAPI_ANSWER_TOOL,
      description:
        "Ask the Neeley advising engine an open-ended question that the other tools do not answer directly, such as a policy, a requirement rule or a multi-part question. Slower than the other tools. Returns a checked, spoken-style answer.",
      parameters: {
        type: "object",
        properties: {
          question: { type: "string", description: "The caller's full Neeley advising question, including context from the current voice conversation." },
        },
        required: ["question"],
      },
    },
  ];
}

export function vapiDirectToolNames(): Set<string> {
  return new Set(toolsFor("voice").map((t) => t.name));
}

export interface NormalizedToolCall {
  id: string;
  function: { name: string; arguments: unknown };
}

const MAX_TOOL_CALLS = 5;

/**
 * Vapi describes the same tool calls in several shapes depending on the event version:
 *   toolCallList:        [{ id, name, arguments }]                       (documented simplified shape)
 *   toolCalls:           [{ id, type: "function", function: { name, arguments } }]  (OpenAI style)
 *   toolWithToolCallList:[{ ..., toolCall: { id, type: "function", function: { name, arguments } } }]
 * toolCallList entries may also use the OpenAI style. Accept all of them so a tool call is never rejected for its shape.
 */
export function normalizeToolCalls(body: unknown): { callId: string; toolCallList: NormalizedToolCall[] } | null {
  const msg = (body as { message?: Record<string, unknown> } | null)?.message;
  if (!msg || typeof msg !== "object" || msg.type !== "tool-calls") return null;
  const out: NormalizedToolCall[] = [];
  const seen = new Set<string>();
  const add = (raw: unknown) => {
    const t = raw as { id?: unknown; name?: unknown; arguments?: unknown; function?: { name?: unknown; arguments?: unknown }; toolCall?: unknown } | null;
    if (!t || typeof t !== "object") return;
    if (t.toolCall) return add(t.toolCall);
    const id = typeof t.id === "string" ? t.id : "";
    const name = typeof t.function?.name === "string" ? t.function.name : typeof t.name === "string" ? t.name : "";
    if (!id || !name || id.length > 200 || name.length > 100 || seen.has(id)) return;
    seen.add(id);
    out.push({ id, function: { name, arguments: t.function ? t.function.arguments : t.arguments } });
  };
  for (const key of ["toolCallList", "toolCalls", "toolWithToolCallList"]) {
    const list = msg[key];
    if (Array.isArray(list)) list.forEach(add);
  }
  if (!out.length) return null;
  const rawId = (msg.call as { id?: unknown } | undefined)?.id;
  const callId = typeof rawId === "string" && rawId ? rawId.slice(0, 200) : `unknown-${out[0].id}`.slice(0, 200);
  return { callId, toolCallList: out.slice(0, MAX_TOOL_CALLS) };
}
