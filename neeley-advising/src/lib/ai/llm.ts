import type { ContentBlock, MessageParam, Tool } from "@anthropic-ai/sdk/resources/messages";
import { anthropic, MODEL } from "./client";

export interface LlmRequest {
  system: string;
  messages: MessageParam[];
  tools?: Tool[];
  maxTokens?: number;
  model?: string;
  onText?: (delta: string) => void;
}

export interface LlmResponse {
  content: ContentBlock[];
  stopReason: string | null;
}

export type Llm = (req: LlmRequest) => Promise<LlmResponse>;

/** Streams from the Anthropic API and returns the final message. The system prompt is cached. */
export const anthropicLlm: Llm = async (req) => {
  const stream = anthropic().messages.stream({
    model: req.model ?? MODEL(),
    max_tokens: req.maxTokens ?? 1800,
    system: [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }],
    messages: req.messages,
    tools: req.tools,
  });
  if (req.onText) stream.on("text", req.onText);
  const final = await stream.finalMessage();
  return { content: final.content, stopReason: final.stop_reason };
};
