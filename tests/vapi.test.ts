import { beforeAll, describe, expect, it } from "vitest";
import type { ContentBlock } from "@anthropic-ai/sdk/resources/messages";
import type { Llm, LlmRequest } from "@/lib/ai/llm";
import { POST } from "@/app/api/vapi/tools/route";
import { extractToolCalls, FUNCTION_NAME, handleVapiTools, secretMatches } from "@/lib/vapi";
import { getState } from "@/lib/store";
import { plainSpeech } from "@/lib/voice";
import { GET as health } from "@/app/api/health/route";

const SECRET = "shared_secret_for_tests_123456";
const text = (t: string): ContentBlock[] => [{ type: "text", text: t, citations: null } as ContentBlock];

const msg = (over: Record<string, unknown> = {}) => ({
  message: { type: "tool-calls", call: { id: "call_abc" }, toolCallList: [{ id: "tc1", name: FUNCTION_NAME, arguments: { question: "What is finance like?" } }], ...over },
});

function req(body: unknown, headers: Record<string, string> = { "x-vapi-secret": SECRET }, raw?: string): Request {
  return new Request("http://localhost/api/vapi/tools", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: raw ?? JSON.stringify(body) });
}

beforeAll(() => {
  process.env.VAPI_SERVER_SECRET = SECRET;
  delete process.env.ANTHROPIC_API_KEY;
});

describe("/api/vapi/tools authentication and validation", () => {
  it("rejects a missing or wrong secret", async () => {
    expect((await POST(req(msg(), {}))).status).toBe(401);
    expect((await POST(req(msg(), { "x-vapi-secret": "wrong" }))).status).toBe(401);
  });
  it("is unavailable until a server secret is configured", async () => {
    delete process.env.VAPI_SERVER_SECRET;
    expect((await POST(req(msg()))).status).toBe(503);
    process.env.VAPI_SERVER_SECRET = SECRET;
  });
  it("rejects malformed and oversized requests", async () => {
    expect((await POST(req(null, { "x-vapi-secret": SECRET }, "not json"))).status).toBe(400);
    expect((await POST(req({ hello: "world" }))).status).toBe(400);
    expect((await POST(req({ message: { type: "status-update" } }))).status).toBe(400);
    expect((await POST(req(null, { "x-vapi-secret": SECRET }, JSON.stringify({ pad: "x".repeat(25_000) })))).status).toBe(413);
  });
  it("answers with a Vapi tool result and a calm fallback when the AI is unavailable", async () => {
    const res = await POST(req(msg()));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.results).toHaveLength(1);
    expect(data.results[0].toolCallId).toBe("tc1");
    expect(data.results[0].result).toMatch(/can't look that up right now/);
    expect(data.results[0].result).not.toMatch(/\n/);
  });
  it("compares secrets in constant time and rejects length mismatches", () => {
    expect(secretMatches(SECRET, SECRET)).toBe(true);
    expect(secretMatches(SECRET + "x", SECRET)).toBe(false);
    expect(secretMatches(null, SECRET)).toBe(false);
  });
});

describe("tool call parsing", () => {
  it("reads the current and the older Vapi shapes, and string arguments", () => {
    expect(extractToolCalls(msg())!.calls[0].name).toBe(FUNCTION_NAME);
    const older = extractToolCalls({ message: { type: "tool-calls", call: { id: "c2" }, toolCalls: [{ id: "t9", type: "function", function: { name: FUNCTION_NAME, arguments: '{"question":"hi"}' } }] } })!;
    expect(older.callId).toBe("c2");
    expect(older.calls[0].args).toEqual({ question: "hi" });
  });
  it("caps the number of calls and ignores entries without an id or name", () => {
    const many = { message: { type: "tool-calls", toolCallList: Array.from({ length: 12 }, (_, i) => ({ id: `t${i}`, name: FUNCTION_NAME, arguments: { question: "q" } })).concat([{ id: "", name: "x", arguments: {} } as never]) } };
    expect(extractToolCalls(many)!.calls).toHaveLength(4);
  });
});

describe("handler with the voice-mode AI", () => {
  const scripted = (...replies: string[]): { llm: Llm; calls: LlmRequest[] } => {
    const calls: LlmRequest[] = [];
    let i = 0;
    return { calls, llm: async (r) => { calls.push(r); return { content: text(replies[Math.min(i++, replies.length - 1)]), stopReason: "end_turn" }; } };
  };
  it("runs the question through voice mode and returns plain single-line speech", async () => {
    const { llm, calls } = scripted("**Finance** is a strong path.\n\nIt studies money and risk [S1 p.596].");
    const r = await handleVapiTools(msg(), llm);
    const result = (r.json as { results: { result: string }[] }).results[0].result;
    expect(r.status).toBe(200);
    expect(result).toBe("Finance is a strong path. It studies money and risk .");
    expect(calls[0].system).toMatch(/VOICE CONVERSATION IN THE BROWSER/);
    expect(calls[0].tools!.map((t) => t.name)).not.toContain("get_plan");
  });
  it("keeps the conversation per call id", async () => {
    const { llm, calls } = scripted("First answer.", "Second answer.");
    await handleVapiTools(msg({ call: { id: "call_memory" } }), llm);
    await handleVapiTools(msg({ call: { id: "call_memory" }, toolCallList: [{ id: "tc2", name: FUNCTION_NAME, arguments: { question: "And accounting?" } }] }), llm);
    expect(calls[1].messages.slice(0, 3).map((m) => (typeof m.content === "string" ? m.content : ""))).toEqual(["What is finance like?", "First answer.", "And accounting?"]);
    const saved = await getState("conversations", "vapi:call_memory");
    expect((saved!.messages as unknown[]).length).toBe(4);
  });
  it("only accepts the question argument and answers unknown functions safely", async () => {
    const { llm } = scripted("ok");
    const bad = await handleVapiTools(msg({ toolCallList: [{ id: "a", name: FUNCTION_NAME, arguments: { question: "" } }, { id: "b", name: "other_fn", arguments: {} }, { id: "c", name: FUNCTION_NAME, arguments: { question: "x".repeat(700) } }] }), llm);
    const results = (bad.json as { results: { toolCallId: string; result: string }[] }).results;
    expect(results[0].result).toMatch(/need the caller's question/);
    expect(results[1].result).toMatch(/Unknown function/);
    expect(results[2].result).toMatch(/need the caller's question/);
  });
  it("falls back instead of failing when the AI throws", async () => {
    const boom: Llm = async () => { throw new Error("billing"); };
    const r = await handleVapiTools(msg(), boom);
    expect((r.json as { results: { result: string }[] }).results[0].result).toMatch(/can't look that up/);
  });
});

describe("speech text and health", () => {
  it("strips markup, citations and stays short", () => {
    const s = plainSpeech("**Finance** is strong [S5]. " + "More text here. ".repeat(80));
    expect(s).not.toMatch(/\*|\[S5\]/);
    expect(s.length).toBeLessThanOrEqual(900);
  });
  it("reports Vapi configuration and no longer reports Twilio voice", async () => {
    process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY = "pk_test";
    delete process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;
    const d = await (await health(new Request("http://localhost/api/health"))).json();
    expect(d.vapi).toMatchObject({ publicKey: true, assistantId: false, serverSecret: true, ready: false });
    expect(d).not.toHaveProperty("voice");
    expect(d.sms).toBe("not configured");
  });
});
