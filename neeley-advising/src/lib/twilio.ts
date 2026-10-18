import twilio from "twilio";

/** Optional SMS-only helper. Voice calls now use Vapi in the browser. */
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
