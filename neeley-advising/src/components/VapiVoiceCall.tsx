"use client";

import { useEffect, useRef, useState } from "react";
import Vapi from "@vapi-ai/web";

type CallStatus = "idle" | "connecting" | "active";

// The _CONFIG names avoid Vercel's "key in a NEXT_PUBLIC_ name" warning; the old names still work.
const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_CONFIG || process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;
const assistantId = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_CONFIG || process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;

export function VapiVoiceCall() {
  const clientRef = useRef<Vapi | null>(null);
  const [status, setStatus] = useState<CallStatus>("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!publicKey) return;

    const client = new Vapi(publicKey);
    clientRef.current = client;
    const onCallStart = () => {
      setError("");
      setStatus("active");
    };
    const onCallEnd = () => setStatus("idle");
    const onCallStartFailed = () => {
      setStatus("idle");
      setError("The voice call could not connect. Check your microphone permission and try again.");
    };
    const onError = () => setError("A voice connection issue occurred. If you can still hear the assistant, you may continue or end the call.");

    client.on("call-start", onCallStart);
    client.on("call-end", onCallEnd);
    client.on("call-start-failed", onCallStartFailed);
    client.on("error", onError);

    return () => {
      client.removeListener("call-start", onCallStart);
      client.removeListener("call-end", onCallEnd);
      client.removeListener("call-start-failed", onCallStartFailed);
      client.removeListener("error", onError);
      if (clientRef.current === client) clientRef.current = null;
      void client.stop().catch(() => undefined);
    };
  }, []);

  async function toggleCall() {
    const client = clientRef.current;
    if (!client || !assistantId) return;
    setError("");

    if (status === "active") {
      await client.stop();
      setStatus("idle");
      return;
    }

    setStatus("connecting");
    try {
      await client.start(assistantId);
    } catch {
      setStatus("idle");
      setError("The voice call could not start. Check the Vapi assistant configuration and try again.");
    }
  }

  if (!publicKey || !assistantId) {
    return (
      <p className="small" role="status">
        Voice calling is not configured yet. Add the Vapi public key and assistant ID to the app environment.
      </p>
    );
  }

  return (
    <div className="stack" style={{ alignItems: "flex-start", gap: 10 }}>
      <button className="btn" type="button" onClick={toggleCall} disabled={status === "connecting"} aria-pressed={status === "active"}>
        {status === "active" ? "End voice call" : status === "connecting" ? "Connecting…" : "Start voice call"}
      </button>
      <p className="small" role="status" aria-live="polite">
        {error || (status === "active" ? "Connected. Speak naturally, or end the call when you are done." : status === "connecting" ? "Connecting to the Neeley AI assistant…" : "Your browser will ask for microphone access.")}
      </p>
    </div>
  );
}
