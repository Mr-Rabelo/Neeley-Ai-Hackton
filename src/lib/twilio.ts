import twilio from "twilio";

/** Twilio is used only for optional, consent-based SMS (the "text me the sign-in link" feature). Voice runs on Vapi. */
export function smsConfigured(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);
}

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
