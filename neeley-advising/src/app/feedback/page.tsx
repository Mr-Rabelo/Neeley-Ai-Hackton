"use client";
import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/Bits";
import { ApiError, postJson } from "@/lib/client";

export default function Feedback() {
  const [rating, setRating] = useState(0);
  const [missing, setMissing] = useState("");
  const [rec, setRec] = useState<boolean | undefined>();
  const [follow, setFollow] = useState(false);
  const [contact, setContact] = useState("");
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function send() {
    setErr(null);
    try { await postJson("/api/feedback", { rating, missing: missing || undefined, recommend: rec, followUp: follow, contact: follow ? contact || undefined : undefined }); setDone(true); } catch (e) { setErr(e instanceof ApiError ? e.message : "Could not send."); }
  }
  if (done) return <div className="wrap narrow"><Card title="Thank you"><p>Your feedback helps make this better.</p><div style={{ marginTop: 12 }}><Link className="btn" href="/">Back to the start</Link></div></Card></div>;
  return (
    <div className="wrap narrow stack-lg">
      <div className="stack"><div className="eyebrow">Feedback</div><h1 className="page-title">How helpful was this?</h1><p className="lede">Short and optional. We save it without your name unless you ask for a follow-up.</p></div>
      <Card>
        <form className="stack" onSubmit={(e) => { e.preventDefault(); if (rating) void send(); }}>
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}><legend style={{ fontWeight: 600, marginBottom: 8 }}>How helpful was this? (1 to 5)</legend>
            <div className="row">{[1, 2, 3, 4, 5].map((n) => <button type="button" key={n} className="chip" aria-pressed={rating === n} onClick={() => setRating(n)}>{n}</button>)}</div><div className="row-between small" style={{ maxWidth: 300, marginTop: 4 }}><span>Not helpful</span><span>Very helpful</span></div></fieldset>
          <div className="field"><label htmlFor="m">What was missing?</label><textarea id="m" value={missing} onChange={(e) => setMissing(e.target.value)} maxLength={1000} /></div>
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}><legend style={{ fontWeight: 600, marginBottom: 8 }}>Would you recommend it?</legend><div className="row"><button type="button" className="chip" aria-pressed={rec === true} onClick={() => setRec(true)}>Yes</button><button type="button" className="chip" aria-pressed={rec === false} onClick={() => setRec(false)}>No</button></div></fieldset>
          <label className="check"><input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} /> <span>I would like a follow-up.</span></label>
          {follow && <div className="field"><label htmlFor="c">Email or phone</label><input id="c" type="text" value={contact} onChange={(e) => setContact(e.target.value)} /></div>}
          {err && <p role="alert">{err}</p>}
          <div><button className="btn" disabled={!rating}>Send feedback</button></div>
        </form>
      </Card>
    </div>
  );
}
