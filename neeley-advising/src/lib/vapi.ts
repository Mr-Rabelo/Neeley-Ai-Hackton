import { toolsFor } from "./ai/tools";

export function vapiBrowserConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY && process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID);
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
