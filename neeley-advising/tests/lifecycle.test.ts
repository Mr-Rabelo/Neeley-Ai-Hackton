import { describe, expect, it } from "vitest";
import { POST as request } from "@/app/api/challenge/route";
import { POST as action } from "@/app/api/advisor-action/route";
import { POST as mine } from "@/app/api/my-requests/route";
import { POST as reply } from "@/app/api/request-reply/route";

const post = (body: unknown) => new Request("http://x/api", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("advisor request lifecycle", () => {
  it("moves review_requested -> needs_info -> review_requested -> reviewed, hiding private notes", async () => {
    const made = await (await request(post({ findingId: "f1", finding: "Something", note: "I disagree", consent: true }))).json();
    const id = made.id as string;
    const ask = await action(post({ id, action: "request_info", note: "Which term did you take it?" }));
    expect((await ask.json()).status).toBe("needs_info");
    await action(post({ id, action: "note", note: "private thought", visibleToStudent: false }));
    let v = await (await mine(post({ ids: [id] }))).json();
    expect(v.requests[0].status).toBe("needs_info");
    expect(JSON.stringify(v)).not.toContain("private thought");
    expect(JSON.stringify(v)).toContain("Which term");
    expect((await reply(post({ id, message: "Fall 2025" }))).status).toBe(200);
    expect((await reply(post({ id, message: "again" }))).status).toBe(409);
    const done = await action(post({ id, action: "mark_reviewed", note: "Looks right", visibleToStudent: true }));
    expect((await done.json()).status).toBe("reviewed");
    v = await (await mine(post({ ids: [id] }))).json();
    expect(v.requests[0].status).toBe("reviewed");
  });

  it("requires a message when asking for info", async () => {
    const made = await (await request(post({ findingId: "f2", finding: "x", note: "no", consent: true }))).json();
    expect((await action(post({ id: made.id, action: "request_info", note: "" }))).status).toBe(400);
  });
});
