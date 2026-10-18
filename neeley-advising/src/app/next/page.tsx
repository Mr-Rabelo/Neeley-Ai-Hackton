"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useStudent } from "@/components/StudentContext";
import { Card } from "@/components/Bits";
import { ApiError, postJson } from "@/lib/client";
import { rememberRequest } from "@/lib/my-requests";
import { describeCorrections, hasCorrections, hasGoals } from "@/lib/corrections";

const SCHED = process.env.NEXT_PUBLIC_ADVISOR_SCHEDULING_URL;

function Inner() {
  const sp = useSearchParams();
  const { record, originalRecord, corrections, goals } = useStudent();
  const [open, setOpen] = useState<"advisor" | null>(sp.get("review") ? "advisor" : null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ name: "", email: "", phone: "", term: "Fall 2027", program: "", note: "", time: "", topic: "", consent: false, type: sp.get("review") ? "review" : "callback" });

  async function submit(_kind: "advisor") {
    setBusy(true); setErr(null); setMsg(null);
    try {
        const r = await postJson<{ message: string; id?: string }>("/api/advisor-request", { type: f.type, name: f.name, email: f.email || undefined, phone: f.phone || undefined, preferredTime: f.time, topic: f.topic, consent: f.consent, record: f.type === "review" ? (originalRecord ?? record) : undefined, context: f.type === "review" && originalRecord && (hasCorrections(corrections) || hasGoals(goals)) ? { goals: hasGoals(goals) ? { ...goals } : undefined, corrections: hasCorrections(corrections) ? { ...corrections } : undefined, correctionNotes: hasCorrections(corrections) ? describeCorrections(originalRecord, corrections) : undefined } : undefined });
        if (r.id) rememberRequest(r.id);
        setMsg(r.message);
    } catch (e) { setErr(e instanceof ApiError ? e.message : "Something went wrong."); } finally { setBusy(false); }
  }
  const set = (k: keyof typeof f, v: string | boolean) => setF((s) => ({ ...s, [k]: v }));

  return (
    <div className="wrap stack-lg">
      <div className="stack"><div className="eyebrow">Next steps</div><h1 className="page-title">What would you like to do next?</h1><p className="lede">No pressure. Call or talk to an advisor.</p></div>
      <div className="grid grid-2">
        <Card title="Call" className={open === "advisor" && f.type === "callback" ? "picked-card" : ""}><p className="small" style={{ margin: "6px 0 12px" }}>Leave a number and an advisor calls you back.</p><button className="btn btn-sm" onClick={() => { set("type", "callback"); setOpen("advisor"); }}>Request a call</button></Card>
        <Card title="Talk to an advisor" className={open === "advisor" && f.type !== "callback" ? "picked-card" : ""}><p className="small" style={{ margin: "6px 0 12px" }}>Schedule a meeting, or send your plan for review.</p><button className="btn btn-sm" onClick={() => { set("type", sp.get("review") ? "review" : "meeting"); setOpen("advisor"); }}>Talk to an advisor</button></Card>
      </div>

      {msg && <div className="banner banner-info" role="status"><span aria-hidden>✓</span><div>{msg} <Link href="/feedback">Tell us how it went</Link></div></div>}
      {err && <div className="banner" role="alert"><span aria-hidden>!</span><div>{err}</div></div>}

      {open === "advisor" && (
        <Card title="Connect to an advisor">
          <div className="tabs" role="tablist" aria-label="How to connect" style={{ marginBottom: 14 }}>
            {([["meeting", "Schedule a meeting"], ["callback", "Request a call back"], ["review", "Send my plan for review"]] as const).map(([v, l]) => <button key={v} role="tab" className="tab" aria-selected={f.type === v} onClick={() => set("type", v)}>{l}</button>)}
          </div>
          {f.type === "meeting" && SCHED && <p style={{ marginBottom: 12 }}><a className="btn btn-sm" href={SCHED} target="_blank" rel="noreferrer">Open the scheduling page</a> <span className="small">or send a request below.</span></p>}
          {f.type === "meeting" && !SCHED && <p className="small" style={{ marginBottom: 12 }}>The advising team&apos;s scheduling link is not configured yet (NEXT_PUBLIC_ADVISOR_SCHEDULING_URL). Send a request below and an advisor will follow up.</p>}
          {f.type === "review" && !record && <div className="banner" role="status" style={{ marginBottom: 12 }}><span aria-hidden>▲</span><div>A plan review needs a loaded transcript. <Link href="/student">Load one first</Link>.</div></div>}
          {f.type === "review" && record && <p className="small" style={{ marginBottom: 12 }}>An advisor will receive a packet: your plan, its findings, unverified items and the questions to decide. Your plan stays a draft until an advisor reviews it.</p>}
          <form className="stack" onSubmit={(e) => { e.preventDefault(); void submit("advisor"); }}>
            <div className="grid grid-2">
              <div className="field"><label htmlFor="an">Name</label><input id="an" type="text" value={f.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" /></div>
              <div className="field"><label htmlFor="ae">Email</label><input id="ae" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" /></div>
              <div className="field"><label htmlFor="ap">Phone (for a call back)</label><input id="ap" type="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} autoComplete="tel" /></div>
              <div className="field"><label htmlFor="at">Best time</label><input id="at" type="text" value={f.time} onChange={(e) => set("time", e.target.value)} placeholder="e.g. weekday afternoons" /></div>
            </div>
            <div className="field"><label htmlFor="ao">What would you like help with?</label><textarea id="ao" value={f.topic} onChange={(e) => set("topic", e.target.value)} maxLength={500} /></div>
            <label className="check"><input type="checkbox" checked={f.consent} onChange={(e) => set("consent", e.target.checked)} /> <span>I agree to be contacted about this request.</span></label>
            <div className="row"><button className="btn" disabled={busy || !f.consent || (f.type === "review" && !record)}>{busy ? "Sending…" : "Send request"}</button>
              <span className="small">Prefer to call? The Neeley Academic Advising Center can be reached through TCU.</span></div>
          </form>
        </Card>
      )}

    </div>
  );
}

export default function Next() { return <Suspense fallback={<div className="wrap"><p>Loading…</p></div>}><Inner /></Suspense>; }
