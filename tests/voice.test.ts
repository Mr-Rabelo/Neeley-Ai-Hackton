import { beforeAll, describe, expect, it } from "vitest";
import twilio from "twilio";
import { POST as incoming } from "@/app/api/voice/incoming/route";
import { POST as turn } from "@/app/api/voice/turn/route";
import { speakable } from "@/lib/twilio";

const TOKEN = "test_auth_token_123";
const BASE = "https://neeley.example.test";

function signed(path: string, params: Record<string, string>, signature?: string): Request {
  const sig = signature ?? twilio.getExpectedTwilioSignature(TOKEN, `${BASE}${path}`, params);
  const body = new URLSearchParams(params);
  return new Request(`http://localhost${path}`, { method: "POST", headers: { "x-twilio-signature": sig, "content-type": "application/x-www-form-urlencoded" }, body });
}

beforeAll(() => {
  process.env.TWILIO_AUTH_TOKEN = TOKEN;
  process.env.APP_BASE_URL = BASE;
  delete process.env.ANTHROPIC_API_KEY;
});

describe("voice webhooks", () => {
  it("rejects requests that were not signed by Twilio", async () => {
    const res = await incoming(signed("/api/voice/incoming", { CallSid: "CA1" }, "forged"));
    expect(res.status).toBe(403);
  });
  it("greets with an AI disclosure and listens for speech", async () => {
    const res = await incoming(signed("/api/voice/incoming", { CallSid: "CA2", From: "+15551230000" }));
    const xml = await res.text();
    expect(res.status).toBe(200);
    expect(xml).toMatch(/<Gather[^>]*input="speech"/);
    expect(xml).toMatch(/an AI/);
    expect(xml).toMatch(/can't see anyone's record/);
  });
  it("hangs up politely on goodbye", async () => {
    const xml = await (await turn(signed("/api/voice/turn", { CallSid: "CA3", SpeechResult: "no thanks, goodbye" }))).text();
    expect(xml).toMatch(/<Hangup/);
  });
  it("transfers to an advisor only when a number is configured", async () => {
    process.env.ADVISOR_PHONE_NUMBER = "+15559998888";
    const withNumber = await (await turn(signed("/api/voice/turn", { CallSid: "CA4", SpeechResult: "can I talk to a real person" }))).text();
    expect(withNumber).toMatch(/<Dial>\+15559998888<\/Dial>/);
    delete process.env.ADVISOR_PHONE_NUMBER;
    const without = await (await turn(signed("/api/voice/turn", { CallSid: "CA5", SpeechResult: "connect me to an advisor" }))).text();
    expect(without).not.toMatch(/<Dial>/);
    expect(without).toMatch(/call-back/);
  });
  it("says so plainly when the AI is not configured", async () => {
    const xml = await (await turn(signed("/api/voice/turn", { CallSid: "CA6", SpeechResult: "what is finance like" }))).text();
    expect(xml).toMatch(/isn't available/);
  });
  it("re-prompts when nothing was heard", async () => {
    const xml = await (await turn(signed("/api/voice/turn", { CallSid: "CA7" }))).text();
    expect(xml).toMatch(/didn't hear/);
  });
});

describe("spoken text", () => {
  it("strips markup and citations and stays short", () => {
    const s = speakable("**Finance** is strong [S5]. " + "More text here. ".repeat(80));
    expect(s).not.toMatch(/\*|\[S5\]/);
    expect(s.length).toBeLessThanOrEqual(700);
  });
});
