import { z } from "zod";
import { AI_OFF, json, llmOrNull, parseRecord, readJson } from "@/lib/api";
import { runChat } from "@/lib/ai/chat";

export const maxDuration = 120;

const schema = z.object({
  mode: z.enum(["student", "prospect"]),
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) })).min(1).max(40),
  record: z.unknown().optional(),
  profile: z.unknown().optional(),
});

export async function POST(req: Request) {
  const r = await readJson(req, schema);
  if (!r.ok) return r.res;
  const llm = llmOrNull();
  if (!llm) return json({ error: "ai_unavailable", message: AI_OFF }, 503);
  const record = r.data.record ? parseRecord(r.data.record) ?? undefined : undefined;
  if (r.data.mode === "student" && !record) return json({ error: "Load a transcript first, or use the sample student." }, 400);
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      try {
        const out = await runChat({
          llm,
          mode: r.data.mode,
          messages: r.data.messages,
          record,
          profile: r.data.profile,
          onText: (d) => send("text", d),
          onTool: (name) => send("tool", name),
        });
        if (out.correctedText) send("replace", out.correctedText);
        for (const o of out.options) send("options", o);
        send("done", { verified: out.verified, issues: out.issues, tools: out.toolsUsed, packetId: out.packetId });
      } catch (e) {
        send("error", e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
}
