import type { ContentBlock, MessageParam, ToolResultBlockParam, ToolUseBlock } from "@anthropic-ai/sdk/resources/messages";
import type { StudentRecord } from "../types";
import type { Llm } from "./llm";
import { systemPrompt } from "./prompts";
import { executeTool, newContext, toolsFor, type Mode, type ToolContext } from "./tools";
import { CAUTION, verifyReply } from "./verify";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatInput {
  llm: Llm;
  mode: Mode;
  messages: ChatTurn[];
  record?: StudentRecord;
  profile?: unknown;
  callerPhone?: string;
  onText?: (delta: string) => void;
  onTool?: (name: string) => void;
  maxRounds?: number;
}

export interface ChatOutput {
  text: string;
  correctedText?: string;
  options: { question: string; options: { id: string; label: string }[] }[];
  toolsUsed: string[];
  verified: boolean;
  issues: string[];
  packetId?: string;
}

const textOf = (blocks: ContentBlock[]) => blocks.filter((b): b is Extract<ContentBlock, { type: "text" }> => b.type === "text").map((b) => b.text).join("");

export async function runChat(input: ChatInput): Promise<ChatOutput> {
  const ctx: ToolContext = newContext(input.mode, input.record, input.callerPhone);
  const system = systemPrompt(input.mode, input.record, input.profile);
  const tools = toolsFor(input.mode);
  const messages: MessageParam[] = input.messages.map((m) => ({ role: m.role, content: m.content }));
  const userText = input.messages.filter((m) => m.role === "user").map((m) => m.content).join("\n");
  const toolsUsed: string[] = [];
  let finalText = "";

  for (let round = 0; round < (input.maxRounds ?? 7); round++) {
    const res = await input.llm({ system, messages, tools, onText: input.onText });
    messages.push({ role: "assistant", content: res.content });
    const uses = res.content.filter((b): b is ToolUseBlock => b.type === "tool_use");
    if (!uses.length) {
      finalText = textOf(res.content);
      break;
    }
    const results: ToolResultBlockParam[] = [];
    for (const u of uses) {
      input.onTool?.(u.name);
      toolsUsed.push(u.name);
      const out = await executeTool(u.name, (u.input ?? {}) as Record<string, unknown>, ctx);
      results.push({ type: "tool_result", tool_use_id: u.id, content: JSON.stringify(out).slice(0, 60000) });
    }
    messages.push({ role: "user", content: results });
    finalText = textOf(res.content);
  }

  // Verify the final reply against the tool results. One rewrite attempt, then a visible caution.
  let verdict = verifyReply(finalText, ctx, userText);
  let corrected: string | undefined;
  if (!verdict.ok && finalText.trim()) {
    messages.push({
      role: "user",
      content: `Your reply had problems: ${verdict.issues.join(" ")} Rewrite it using only what the tools returned. Remove anything you cannot support, hedge forecasts, and do not state outcomes as certain. Reply with the corrected answer only.`,
    });
    const retry = await input.llm({ system, messages, tools });
    const retryText = textOf(retry.content);
    const v2 = verifyReply(retryText, ctx, userText);
    corrected = v2.ok ? retryText : `${retryText}\n\n${CAUTION}`;
    verdict = v2;
  }
  return {
    text: finalText,
    correctedText: corrected,
    options: ctx.pendingOptions,
    toolsUsed,
    verified: verdict.ok,
    issues: verdict.issues,
    packetId: ctx.packetId,
  };
}
