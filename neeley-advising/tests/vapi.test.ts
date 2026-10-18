import { beforeAll, describe, expect, it } from "vitest";
import { POST } from "@/app/api/vapi/tools/route";

const SECRET = "vapi_test_shared_secret";

function request(body: unknown, secret = SECRET) {
  return new Request("http://localhost/api/vapi/tools", {
    method: "POST",
    headers: { "content-type": "application/json", "x-vapi-secret": secret },
    body: JSON.stringify(body),
  });
}

beforeAll(() => {
  process.env.VAPI_SERVER_SECRET = SECRET;
  delete process.env.ANTHROPIC_API_KEY;
});

describe("Vapi custom tool endpoint", () => {
  it("rejects requests without the configured Vapi credential", async () => {
    const body = { message: { type: "tool-calls", call: { id: "call-test" }, toolCallList: [] } };
    const res = await POST(request(body, "wrong-secret"));
    expect(res.status).toBe(401);
  });

  it("rejects malformed tool requests", async () => {
    const res = await POST(request({ message: { type: "transcript", call: { id: "call-test" } } }));
    expect(res.status).toBe(400);
  });

  it("returns a Vapi-compatible tool result when the AI service is unavailable", async () => {
    const res = await POST(request({
      message: {
        type: "tool-calls",
        call: { id: "call-test" },
        toolCallList: [{
          id: "tool-test",
          type: "function",
          function: { name: "neeley_advising_answer", arguments: { question: "What majors are available?" } },
        }],
      },
    }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.results).toHaveLength(1);
    expect(body.results[0].toolCallId).toBe("tool-test");
    expect(body.results[0].result).toMatch(/unavailable/i);
  });
});
