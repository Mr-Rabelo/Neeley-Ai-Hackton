import { twilioConfigured, twiml, validTwilioRequest, VOICE } from "@/lib/twilio";
import { putState } from "@/lib/store";

export async function POST(req: Request) {
  if (!twilioConfigured()) return new Response("Voice is not configured.", { status: 503 });
  const params = Object.fromEntries((await req.formData()).entries()) as Record<string, string>;
  if (!validTwilioRequest(req, "/api/voice/incoming", params)) return new Response("Forbidden", { status: 403 });
  await putState("conversations", params.CallSid, { channel: "voice", messages: [] });
  return twiml((r) => {
    const g = r.gather({ input: ["speech"], action: "/api/voice/turn", method: "POST", speechTimeout: "auto", language: "en-US" });
    g.say({ voice: VOICE }, "Hi, this is the Neeley advising assistant, an AI. I can talk about majors, courses and where each path can lead. I can't see anyone's record on a call. What would you like to know?");
    r.say({ voice: VOICE }, "I didn't catch that. Please call back any time. Goodbye.");
  });
}
