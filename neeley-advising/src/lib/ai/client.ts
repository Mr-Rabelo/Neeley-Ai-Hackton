import Anthropic from "@anthropic-ai/sdk";

export const MODEL = () => process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
export const FAST_MODEL = () => process.env.ANTHROPIC_FAST_MODEL || "claude-haiku-5-5";

export function hasAnthropicKey(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

/**
 * Keys that are not scoped to a workspace must say which workspace to use. Set ANTHROPIC_WORKSPACE_ID
 * (the wrkspc_... ID from the Anthropic Console) to send the anthropic-workspace-id header on every request.
 * Not needed when the key was created inside a workspace.
 */
export function anthropicHeaders(): Record<string, string> {
  const id = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
  return id ? { "anthropic-workspace-id": id } : {};
}

let _client: Anthropic | null = null;
export function anthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new AiUnavailableError();
  _client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, defaultHeaders: anthropicHeaders() });
  return _client;
}

export class AiUnavailableError extends Error {
  constructor() {
    super("The AI assistant is not configured: ANTHROPIC_API_KEY is missing.");
    this.name = "AiUnavailableError";
  }
}

/** A short, non-secret description of an Anthropic API failure for logs, notes and the health check. */
export function describeAiError(e: unknown): string {
  const x = e as { status?: number; error?: { error?: { type?: string; message?: string }; type?: string; message?: string }; message?: string; name?: string };
  const type = x?.error?.error?.type ?? x?.error?.type;
  const msg = x?.error?.error?.message ?? x?.error?.message ?? x?.message ?? String(e);
  return `${x?.status ? `HTTP ${x.status} ` : ""}${type ? `${type}: ` : ""}${String(msg).replace(/sk-[A-Za-z0-9_-]+/g, "[key]").slice(0, 220)}`;
}
