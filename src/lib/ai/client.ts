import Anthropic from "@anthropic-ai/sdk";

export const MODEL = () => process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
export const FAST_MODEL = () => process.env.ANTHROPIC_FAST_MODEL || "claude-haiku-5-5";

export function hasAnthropicKey(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

let _client: Anthropic | null = null;
export function anthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new AiUnavailableError();
  _client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

export class AiUnavailableError extends Error {
  constructor() {
    super("The AI assistant is not configured: ANTHROPIC_API_KEY is missing.");
    this.name = "AiUnavailableError";
  }
}
