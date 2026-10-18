"use client";
import { useEffect, useRef, useState } from "react";

type State = "idle" | "connecting" | "live" | "ended" | "error";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;
const ASSISTANT_ID = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;

type VapiLike = { start: (id: string) => Promise<unknown>; stop: () => Promise<void> | void; on: (e: string, f: (...a: never[]) => void) => unknown; removeAllListeners?: () => unknown };

function friendly(err: unknown): string {
  const text = typeof err === "string" ? err : JSON.stringify(err ?? "");
  if (/permission|notallowed|denied|microphone|getusermedia/i.test(text)) {
    return "The browser blocked the microphone. Click the lock icon next to the address, allow the microphone for this site, then try again.";
  }
  if (/network|offline|failed to fetch/i.test(text)) return "The connection dropped. Check your internet and try again.";
  return "The voice call could not start. Please try again in a moment, or use the chat instead.";
}

export function VapiCall() {
  const [state, setState] = useState<State>("idle");
  const [speaking, setSpeaking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const vapi = useRef<VapiLike | null>(null);
  const configured = !!PUBLIC_KEY && !!ASSISTANT_ID;

  useEffect(() => () => { try { void vapi.current?.stop(); } catch { /* already stopped */ } }, []);

  async function start() {
    if (!PUBLIC_KEY || !ASSISTANT_ID) return;
    setMessage(null);
    setState("connecting");
    try {
      const { default: Vapi } = await import("@vapi-ai/web");
      const v = new Vapi(PUBLIC_KEY) as unknown as VapiLike;
      vapi.current = v;
      v.on("call-start", () => setState("live"));
      v.on("call-end", () => { setState("ended"); setSpeaking(false); });
      v.on("speech-start", () => setSpeaking(true));
      v.on("speech-end", () => setSpeaking(false));
      v.on("error", ((e: unknown) => { setState("error"); setSpeaking(false); setMessage(friendly(e)); }) as never);
      await v.start(ASSISTANT_ID);
    } catch (e) {
      setState("error");
      setMessage(friendly(e));
    }
  }

  async function end() {
    try { await vapi.current?.stop(); } catch { /* ignore */ }
    setState("ended");
    setSpeaking(false);
  }

  if (!configured) {
    return (
      <div className="stack">
        <p className="small">Voice isn&apos;t set up on this site yet. The assistant is still available in the chat button at the bottom right.</p>
        <button className="btn btn-ghost" disabled>Talk to the assistant</button>
      </div>
    );
  }

  return (
    <div className="stack">
      <p className="small">Talk to the Neeley AI assistant from your browser. It is an AI, it cannot see anyone&apos;s record, and it will not promise outcomes. Your browser will ask to use your microphone.</p>
      <div className="row">
        {(state === "idle" || state === "ended" || state === "error") && <button className="btn" onClick={() => void start()}>{state === "ended" ? "Start another call" : "Talk to the assistant"}</button>}
        {state === "connecting" && <button className="btn" disabled><span className="spin" aria-hidden /> Connecting…</button>}
        {state === "live" && <button className="btn btn-ghost" onClick={() => void end()}>End call</button>}
      </div>
      <div role="status" aria-live="polite" className="small">
        {state === "connecting" && "Connecting. Please allow the microphone if asked."}
        {state === "live" && (speaking ? "The assistant is speaking." : "Listening. Go ahead and ask a question.")}
        {state === "ended" && "The call has ended."}
        {state === "error" && message}
      </div>
    </div>
  );
}
