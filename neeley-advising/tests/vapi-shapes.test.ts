import { beforeAll, describe, expect, it } from "vitest";
import { POST } from "@/app/api/vapi/tools/route";
import { normalizeToolCalls } from "@/lib/vapi";

const SECRET = "shape_test_secret_123456";
const req = (message: Record<string, unknown>) =>
  new Request("http://localhost/api/vapi/tools", { method: "POST", headers: { "content-type": "application/json", "x-vapi-secret": SECRET }, body: JSON.stringify({ message: { type: "tool-calls", ...message } }) });

beforeAll(() => {
  process.env.VAPI_SERVER_SECRET = SECRET;
  delete process.env.ANTHROPIC_API_KEY;
});

const SHAPES: Record<string, Record<string, unknown>> = {
  "toolCallList { id, name, arguments } (Vapi's documented shape)": { call: { id: "c1" }, toolCallList: [{ id: "t1", name: "get_program_details", arguments: { programId: "finance" } }] },
  "toolCallList in OpenAI style": { call: { id: "c1" }, toolCallList: [{ id: "t1", type: "function", function: { name: "get_program_details", arguments: { programId: "finance" } } }] },
  "toolCalls in OpenAI style with string arguments": { call: { id: "c1" }, toolCalls: [{ id: "t1", type: "function", function: { name: "get_program_details", arguments: '{"programId":"finance"}' } }] },
  "toolWithToolCallList": { call: { id: "c1" }, toolWithToolCallList: [{ type: "function", name: "get_program_details", toolCall: { id: "t1", type: "function", function: { name: "get_program_details", arguments: { programId: "finance" } } } }] },
  "a missing call id": { toolCallList: [{ id: "t1", name: "get_program_details", arguments: { programId: "finance" } }] },
};

describe("every Vapi tool-call shape reaches the data tools", () => {
  for (const [name, message] of Object.entries(SHAPES)) {
    it(`answers with real Finance data for ${name}`, async () => {
      const res = await POST(req(message));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.results).toHaveLength(1);
      expect(data.results[0].toolCallId).toBe("t1");
      expect(data.results[0].result).toMatch(/"name":"Finance"/);
      expect(data.results[0].result).not.toMatch(/\n/);
    });
  }
  it("returns one result per call, in order, and dedupes repeated ids", async () => {
    const res = await POST(req({ call: { id: "c2" }, toolCallList: [{ id: "a", name: "list_education_options", arguments: {} }, { id: "b", name: "get_market_info", arguments: { majorId: "finance" } }, { id: "a", name: "list_education_options", arguments: {} }] }));
    const data = await res.json();
    expect(data.results.map((r: { toolCallId: string }) => r.toolCallId)).toEqual(["a", "b"]);
    expect(data.results[1].result).toMatch(/Financial Analysts/);
  });
  it("still rejects anything that is not a tool-calls message", async () => {
    expect(normalizeToolCalls({ message: { type: "status-update" } })).toBeNull();
    expect(normalizeToolCalls({ message: { type: "tool-calls", toolCallList: [{ name: "x" }] } })).toBeNull();
    expect(normalizeToolCalls({})).toBeNull();
    const res = await POST(req({ toolCallList: "nope" }));
    expect(res.status).toBe(400);
  });
});
