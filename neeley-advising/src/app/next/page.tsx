"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useStudent } from "@/components/StudentContext";
import { Card } from "@/components/Bits";
import { ApiError, postJson } from "@/lib/client";
import { describeCorrections, hasCorrections, hasGoals } from "@/lib/corrections";

const SCHED = process.env.NEXT_PUBLIC_ADVISOR_SCHEDULING_URL;

function Inner() {
  const sp = useSearchParams();
  const { record, originalRecord, corrections, goals } = useStudent();
  const [open, setOpen] = useState<"apply" | "advisor" | "check" | null>(sp.get("review") ? "advisor" : null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ name: "", email: "", phone: "", term: "Fall 2027", program: "", note: "", time: "", topic: "", consent: false, type: sp.get("review") ? "review" : "callback" });

  async function submit(kind: "apply" | "advisor") {
    setBusy(true); setErr(null); setMsg(null);
    try {
      if (kind === "apply") {
        const r = await postJson<{ message: string; saved: boolean }>("/api/apply-mock", { name: f.name, email: f.email, term: f.term, program: f.program || "Undecided", note: f.note, consent: f.consent });
        setMsg(`${r.message} ${r.saved ? "Your answers were saved because you agreed." : "Nothing was saved."}`);
      } else {
        const r = await postJson<{ message: string }>("/api/advisor-request", { type: f.type, name: f.name, email: f.email || undefined, phone: f.phone || undefined, preferredTime: f.time, topic: f.topic, consent: f.consent, record: f.type === "review" ? (originalRecord ?? record) : undefined, context: f.type === "review" && originalRecord && (hasCorrections(corrections) || hasGoals(goals)) ? { goals: hasGoals(goals) ? { ...goals } : undefined, corrections: hasCorrections(corrections) ? { ...corrections } : undefined, correctionNotes: hasCorrections(corrections) ? describeCorrections(originalRecord, corrections) : undefined } : undefined });
        setMsg(r.message);
      }
    } catch (e) { setErr(e instanceof ApiError ? e.message : "Something went wrong."); } finally { setBusy(false); }
  }
  const set = (k: keyof typeof f, v: string | boolean) => setF((s) => ({ ...s, [k]: v }));

  return (
    <div className="wrap stack-lg">
      <div className="stack"><div className="eyebrow">Next steps</div><h1 className="page-title">What would you like to do next?</h1><p className="lede">No pressure. Choose one, or just check and go.</p></div>
      <div className="grid grid-3">
        <Card title="Apply (demo form)" className={open === "apply" ? "picked-card" : ""}><p className="small" style={{ margin: "6px 0 12px" }}>A mock application. It does not submit anything to TCU.</p><button className="btn btn-sm" onClick={() => setOpen("apply")}>Open the demo form</button></Card>
        <Card title="Talk to an advisor" className={open === "advisor" ? "picked-card" : ""}><p className="small" style={{ margin: "6px 0 12px" }}>Schedule a meeting, request a call back, or send your plan for review.</p><button className="btn btn-sm" onClick={() => setOpen("advisor")}>Connect to an advisor</button></Card>
        <Card title="Just check, then go" className={open === "check" ? "picked-card" : ""}><p className="small" style={{ margin: "6px 0 12px" }}>Close up and tell us how it went.</p><button className="btn btn-sm btn-ghost" onClick={() => setOpen("check")}>Close and go</button></Card>
      </div>

      {msg && <div className="banner banner-info" role="status"><span aria-hidden>✓</span><div>{msg} <Link href="/feedback">Tell us how it went</Link></div></div>}
      {err && <div className="banner" role="alert"><span aria-hidden>!</span><div>{err}</div></div>}

      {open === "apply" && (
        <Card title="Demo application">
          <div className="banner" style={{ marginBottom: 14 }}><span aria-hidden>▲</span><div><b>Demo form.</b> This does not submit an application to TCU.</div></div>
          <form className="stack" onSubmit={(e) => { e.preventDefault(); void submit("apply"); }}>
            <div className="grid grid-2">
              <div className="field"><label htmlFor="n">Name</label><input id="n" type="text" required value={f.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" /></div>
              <div className="field"><label htmlFor="e">Email</label><input id="e" type="email" required value={f.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" /></div>
              <div className="field"><label htmlFor="t">Intended start term</label><select id="t" value={f.term} onChange={(e) => set("term", e.target.value)}><option>Fall 2027</option><option>Spring 2028</option><option>Fall 2028</option></select></div>
              <div className="field"><label htmlFor="p">Intended program</label><input id="p" type="text" value={f.program} onChange={(e) => set("program", e.target.value)} placeholder="Undecided is fine" /></div>
            </div>
            <div className="field"><label htmlFor="o">Short note (optional)</label><textarea id="o" value={f.note} onChange={(e) => set("note", e.target.value)} maxLength={500} /></div>
            <label className="check"><input type="checkbox" checked={f.consent} onChange={(e) => set("consent", e.target.checked)} /> <span>Save these answers for the demo. (Optional. Nothing is saved unless you check this.)</span></label>
            <div><button className="btn" disabled={busy}>{busy ? "Sending…" : "Submit demo form"}</button></div>
          </form>
        </Card>
      )}

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

      {open === "check" && (
        <Card title="Thanks for looking around">
          <p>Nothing was saved or changed. Come back any time.</p>
          <div className="row" style={{ marginTop: 12 }}><Link className="btn" href="/feedback">Share quick feedback</Link><Link className="btn btn-ghost" href="/">Back to the start</Link></div>
        </Card>
      )}
    </div>
  );
}

export default function Next() { return <Suspense fallback={<div className="wrap"><p>Loading…</p></div>}><Inner /></Suspense>; }
