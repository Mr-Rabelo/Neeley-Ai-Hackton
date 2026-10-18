import twilio from "twilio";

export function twilioConfigured(): boolean {
  return !!process.env.TWILIO_AUTH_TOKEN;
}

/** Validate that a webhook really came from Twilio. Uses APP_BASE_URL so proxies do not break the URL. */
export function validTwilioRequest(req: Request, path: string, params: Record<string, string>): boolean {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) return false;
  const sig = req.headers.get("x-twilio-signature") ?? "";
  const base = (process.env.APP_BASE_URL || new URL(req.url).origin).replace(/\/$/, "");
  return twilio.validateRequest(token, sig, `${base}${path}`, params);
}

export function twiml(build: (r: InstanceType<typeof twilio.twiml.VoiceResponse>) => void): Response {
  const r = new twilio.twiml.VoiceResponse();
  build(r);
  return new Response(r.toString(), { headers: { "Content-Type": "text/xml" } });
}

export const VOICE = "Polly.Joanna";

export async function sendSms(to: string, body: string): Promise<{ sent: boolean; reason?: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!sid || !token || !from) return { sent: false, reason: "SMS is not configured." };
  try {
    await twilio(sid, token).messages.create({ to, from, body });
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: e instanceof Error ? e.message : "SMS failed" };
  }
}

/** Keep spoken replies short and free of markup. */
export function speakable(text: string, max = 700): string {
  const t = text
    .replace(/\[S\d[^\]]*\]/g, "")
    .replace(/[*_`#>]/g, "")
    .replace(/\s*\n\s*/g, ". ")
    .replace(/\s+/g, " ")
    .trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
  return (end > 200 ? cut.slice(0, end + 1) : cut) + "";
}
