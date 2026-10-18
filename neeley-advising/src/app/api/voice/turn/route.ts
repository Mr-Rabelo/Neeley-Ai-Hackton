import { llmOrNull } from "@/lib/api";
import { runChat, type ChatTurn } from "@/lib/ai/chat";
import { speakable, twilioConfigured, twiml, validTwilioRequest, VOICE } from "@/lib/twilio";
import { getState, putState } from "@/lib/store";

export const maxDuration = 60;

const WANTS_HUMAN = /\b(talk|speak|connect|transfer)\b.*\b(person|human|advisor|adviser|someone)\b|\b(real|live) (person|advisor)\b/i;
const GOODBYE = /\b(goodbye|bye|that's all|that is all|no thanks|hang up)\b/i;

export async function POST(req: Request) {
  if (!twilioConfigured()) return new Response("Voice is not configured.", { status: 503 });
  const params = Object.fromEntries((await req.formData()).entries()) as Record<string, string>;
  if (!validTwilioRequest(req, "/api/voice/turn", params)) return new Response("Forbidden", { status: 403 });
  const callSid = params.CallSid;
  const said = (params.SpeechResult ?? "").trim();
  const state = (await getState("conversations", callSid)) ?? { messages: [] };
  const history = ((state.messages as ChatTurn[]) ?? []).slice(-12);

  const ask = (say: string) =>
    twiml((r) => {
      const g = r.gather({ input: ["speech"], action: "/api/voice/turn", method: "POST", speechTimeout: "auto", language: "en-US" });
      g.say({ voice: VOICE }, say);
      r.say({ voice: VOICE }, "Thanks for calling the Neeley advising assistant. Goodbye.");
    });

  if (!said) return ask("Sorry, I didn't hear anything. What would you like to know about Neeley?");
  if (GOODBYE.test(said)) return twiml((r) => { r.say({ voice: VOICE }, "Thanks for calling. Good luck, and goodbye."); r.hangup(); });
  if (WANTS_HUMAN.test(said)) {
    const advisor = process.env.ADVISOR_PHONE_NUMBER;
    if (advisor) return twiml((r) => { r.say({ voice: VOICE }, "Sure, connecting you to a Neeley advisor now."); r.dial(advisor); });
    return ask("An advisor line is not set up on this demo, but I can take your name and number for a call-back. Would you like that?");
  }
  const llm = llmOrNull();
  if (!llm) return twiml((r) => { r.say({ voice: VOICE }, "The AI assistant isn't available right now. Please visit the Neeley advising website or contact the Neeley Academic Advising Center. Goodbye."); r.hangup(); });

  try {
    const messages: ChatTurn[] = [...history, { role: "user", content: said }];
    const out = await runChat({ llm, mode: "voice", messages, callerPhone: params.From });
    const reply = speakable(out.correctedText ?? out.text);
    await putState("conversations", callSid, { channel: "voice", messages: [...messages, { role: "assistant", content: out.correctedText ?? out.text }].slice(-14) });
    return ask(reply || "Could you say that again?");
  } catch {
    return ask("Sorry, I had trouble with that. Could you say it again?");
  }
}
