"use client";
import { useState } from "react";
import { postJson } from "@/lib/client";
import { rememberRequest } from "@/lib/my-requests";

export function ChallengeButton({ id, message }: { id: string; message: string }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (ok) return <p className="small" role="status">Sent to an advisor. This finding stays as shown until they review it.</p>;
  if (!open) return <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>Challenge this</button>;
  async function send() {
    setBusy(true); setErr(null);
    try {
      const r = await postJson<{ id: string }>("/api/challenge", { findingId: id, finding: message, note, consent: true });
      rememberRequest(r.id);
      setOk(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not send.");
    } finally { setBusy(false); }
  }
  return (
    <div className="stack" style={{ gap: 6 }}>
      <label className="small" htmlFor={`ch-${id}`}>What looks wrong? An advisor will read this. Nothing on your record changes.</label>
      <textarea id={`ch-${id}`} rows={2} maxLength={800} value={note} onChange={(e) => setNote(e.target.value)} />
      {err && <p className="small" role="alert">{err}</p>}
      <div className="row"><button className="btn btn-sm" disabled={busy || note.trim().length < 3} onClick={send}>{busy ? "Sending…" : "Send to advisor"}</button><button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button></div>
    </div>
  );
}
