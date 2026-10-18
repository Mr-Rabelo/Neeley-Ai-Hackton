"use client";
import { Bullets } from "./Bullets";
import { useEffect, useRef, useState } from "react";
import type { StudentRecord } from "@/lib/types";

interface Option { id: string; label: string }
interface Msg {
  role: "user" | "assistant";
  content: string;
  tools?: string[];
  options?: { question: string; options: Option[] }[];
  verified?: boolean;
}

const TOOL_LABEL: Record<string, string> = {
  get_plan: "Checking the planning engine",
  get_requirements_status: "Checking requirements",
  compare_alternatives: "Comparing paths",
  get_course: "Looking up a course",
  search_courses: "Searching the catalog",
  get_market_info: "Reading BLS job market data",
  fit_programs: "Matching majors",
  sample_plan: "Building a sample plan",
  create_advisor_packet: "Preparing the advisor packet",
  offer_options: "Preparing options",
  request_advisor_callback: "Saving your request",
  list_programs: "Listing programs",
};

export function Chat({ mode, record, profile, intro, starters, initial }: { mode: "student" | "prospect"; record?: StudentRecord | null; profile?: unknown; intro: string; starters?: string[]; initial?: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([{ role: "assistant", content: intro }]);
  const [input, setInput] = useState(initial ?? "");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [off, setOff] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }); }, [msgs, status]);

  async function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    const next: Msg[] = [...msgs.map((m) => ({ ...m, options: undefined })), { role: "user", content: t }];
    setMsgs([...next, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    setStatus("Thinking");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, messages: next.slice(-30).map((m) => ({ role: m.role, content: m.content })), record: record ?? undefined, profile }),
      });
      if (!res.ok || !res.body) {
        const d = await res.json().catch(() => ({}));
        if (d.error === "ai_unavailable") setOff(d.message);
        setMsgs((m) => m.slice(0, -1).concat({ role: "assistant", content: d.message || d.error || "Something went wrong. Please try again." }));
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const p of parts) {
          const ev = /^event: (.+)$/m.exec(p)?.[1];
          const data = /^data: (.+)$/m.exec(p)?.[1];
          if (!ev || data === undefined) continue;
          const payload = JSON.parse(data);
          if (ev === "text") setMsgs((m) => { const c = [...m]; const l = c[c.length - 1]; c[c.length - 1] = { ...l, content: l.content + payload }; return c; });
          else if (ev === "tool") setStatus(TOOL_LABEL[payload] ?? "Working");
          else if (ev === "replace") setMsgs((m) => { const c = [...m]; c[c.length - 1] = { ...c[c.length - 1], content: payload }; return c; });
          else if (ev === "options") setMsgs((m) => { const c = [...m]; const l = c[c.length - 1]; c[c.length - 1] = { ...l, options: [...(l.options ?? []), payload] }; return c; });
          else if (ev === "done") setMsgs((m) => { const c = [...m]; c[c.length - 1] = { ...c[c.length - 1], verified: payload.verified }; return c; });
          else if (ev === "error") setMsgs((m) => { const c = [...m]; c[c.length - 1] = { ...c[c.length - 1], content: c[c.length - 1].content || String(payload) }; return c; });
        }
      }
    } catch {
      setMsgs((m) => m.slice(0, -1).concat({ role: "assistant", content: "I lost the connection. Please try again." }));
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  return (
    <div className="chat">
      {off && <div className="banner" role="status"><span>{off}</span></div>}
      <div className="msgs" ref={box} aria-live="polite" aria-label="Conversation">
        {msgs.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            {m.content ? (m.role === "assistant" ? <Bullets text={m.content} /> : m.content) : (busy && i === msgs.length - 1 ? <span><span className="spin" aria-hidden /> {status}…</span> : "")}
            {m.role === "assistant" && m.verified === false && <div className="small" style={{ marginTop: 8 }}>This answer could not be fully checked against the planning engine.</div>}
            {m.options?.map((o, k) => (
              <div key={k} className="stack" style={{ marginTop: 10, gap: 8 }}>
                <div className="small"><b>{o.question}</b></div>
                <div className="row" style={{ gap: 8 }}>
                  {o.options.map((opt) => (
                    <button key={opt.id} className="chip" disabled={busy} onClick={() => send(opt.label)}>{opt.label}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      {msgs.length === 1 && starters && (
        <div className="row" style={{ gap: 8 }}>
          <span className="small">Try asking</span>
          {starters.map((s) => <button key={s} className="chip" disabled={busy} onClick={() => send(s)}>{s}</button>)}
        </div>
      )}
      <form className="chat-form" onSubmit={(e) => { e.preventDefault(); void send(input); }}>
        <label className="sr" htmlFor="chat-input">Message</label>
        <input id="chat-input" type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about courses, your plan, or careers" disabled={busy} maxLength={1000} autoComplete="off" />
        <button className="btn" type="submit" disabled={busy || !input.trim()}>Send</button>
      </form>
      <p className="kbd-hint">AI can make mistakes. Answers come from the planning engine and the 2026-27 catalog. An advisor makes every official decision.</p>
    </div>
  );
}
