import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { json, llmOrNull } from "@/lib/api";
import { runChat, type ChatTurn } from "@/lib/ai/chat";
import { executeTool, newContext } from "@/lib/ai/tools";
import { getState, putState } from "@/lib/store";
import { VAPI_ANSWER_TOOL, vapiDirectToolNames } from "@/lib/vapi";

export const maxDuration = 120;
export const runtime = "nodejs";

const messageSchema = z.object({
  type: z.literal("tool-calls"),
  call: z.object({ id: z.string().min(1).max(200) }),
  toolCallList: z.array(z.object({
    id: z.string().min(1).max(200),
    type: z.literal("function"),
    function: z.object({
      name: z.string().min(1).max(100),
      arguments: z.unknown(),
    }),
  })).min(1).max(5),
});

const bodySchema = z.object({ message: messageSchema });
const questionSchema = z.object({ question: z.string().trim().min(1).max(4000) }).strict();
const turnSchema = z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) });
const directArgsSchema = z.record(z.string(), z.unknown());

function validCredential(received: string | null, expected: string): boolean {
  if (!received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function parseArguments(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const secret = process.env.VAPI_SERVER_SECRET;
  if (!secret) return json({ error: "Vapi server tool is not configured." }, 503);
  if (!validCredential(req.headers.get("x-vapi-secret"), secret)) return json({ error: "Unauthorized." }, 401);

  const raw = await req.text();
  if (raw.length > 64_000) return json({ error: "Request is too large." }, 413);

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "Request body must be JSON." }, 400);
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return json({ error: "Invalid Vapi tool request." }, 400);

  const llm = llmOrNull();
  const callId = `vapi:${parsed.data.message.call.id}`;
  const direct = vapiDirectToolNames();
  const needsHistory = parsed.data.message.toolCallList.some((t) => t.function.name === VAPI_ANSWER_TOOL);
  const saved = needsHistory ? await getState("conversations", callId) : null;
  const history = z.array(turnSchema).safeParse(saved?.messages);
  let messages: ChatTurn[] = history.success ? history.data.slice(-12) : [];

  const results = [];
  for (const toolCall of parsed.data.message.toolCallList) {
    let result: string;
    if (direct.has(toolCall.function.name)) {
      // Deterministic catalog, market and fit tools: no Claude call, so the voice turn stays fast.
      const args = directArgsSchema.safeParse(parseArguments(toolCall.function.arguments ?? {}));
      if (!args.success) {
        result = "I couldn't read the tool arguments. Please try the request again.";
      } else {
        const out = await executeTool(toolCall.function.name, args.data, newContext("voice"));
        result = JSON.stringify(out);
      }
    } else if (toolCall.function.name !== VAPI_ANSWER_TOOL) {
      result = "This Neeley advising tool is not available. Please ask the assistant to answer the question another way.";
    } else {
      const args = questionSchema.safeParse(parseArguments(toolCall.function.arguments));
      if (!args.success) {
        result = "I couldn't understand that question. Please ask it again briefly.";
      } else if (!llm) {
        result = "The Neeley AI advising service is unavailable right now. Please try again later or contact the Neeley Academic Advising Center.";
      } else {
        messages = [...messages, { role: "user", content: args.data.question }];
        try {
          const answer = await runChat({ llm, mode: "voice", messages });
          result = answer.correctedText ?? answer.text;
          const assistantTurn: ChatTurn = { role: "assistant", content: result };
          messages = [...messages, assistantTurn].slice(-14);
          await putState("conversations", callId, { channel: "vapi", messages });
        } catch {
          result = "I'm having trouble accessing Neeley advising information right now. Please try again.";
          messages = messages.slice(0, -1);
        }
      }
    }
    results.push({ toolCallId: toolCall.id, result: result.slice(0, 16_000) });
  }

  return json({ results });
}
