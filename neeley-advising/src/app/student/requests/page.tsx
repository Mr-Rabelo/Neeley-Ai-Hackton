"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/Bits";
import { postJson } from "@/lib/client";
import { recallRequests } from "@/lib/my-requests";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/lifecycle";

interface Req { id: string; type: string; status: string; topic: string | null; created_at: string; messages: { at: string; by: string; note: string; action: string }[] }

export default function RequestsPage() {
  const [rows, setRows] = useState<Req[] | null>(null);
  const [reply, setReply] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    const ids = recallRequests();
    if (!ids.length) { setRows([]); return; }
    try { setRows((await postJson<{ requests: Req[] }>("/api/my-requests", { ids })).requests); } catch (e) { setErr(e instanceof Error ? e.message : "Could not load your requests."); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function send(id: string) {
    try { await postJson("/api/request-reply", { id, message: reply[id] ?? "" }); setReply((r) => ({ ...r, [id]: "" })); await load(); } catch (e) { setErr(e instanceof Error ? e.message : "Could not send."); }
  }

  return (
    <div className="stack-lg">
      <div className="stack"><div className="eyebrow">My requests</div><h1 className="page-title">Where your advisor requests stand</h1><p className="lede">Requests you sent from this browser. Only an advisor can mark something reviewed; the AI never does. Nothing here changes your official record.</p></div>
      {err && <div className="banner" role="alert"><span aria-hidden>!</span><div>{err}</div></div>}
      {rows && !rows.length && <Card><p>No requests from this browser yet.</p><p className="small" style={{ marginTop: 8 }}>Ask for a plan review on the <Link href="/next?review=1">next steps page</Link>, or use &quot;Challenge this&quot; on a finding.</p></Card>}
      {rows?.map((r) => (
        <Card key={r.id}>
          <div className="row-between"><h3>{r.type === "review" ? "Plan review" : r.type === "meeting" ? "Meeting request" : "Call back"}</h3><span className={`badge ${STATUS_TONE[r.status] ?? "b-neutral"}`}>{STATUS_LABEL[r.status] ?? r.status}</span></div>
          <p className="small">{new Date(r.created_at).toLocaleString()}</p>
          {r.topic && <p style={{ marginTop: 6 }}>{r.topic}</p>}
          {r.messages.length > 0 && <ul className="plain" style={{ marginTop: 10 }}>{r.messages.map((m) => <li key={m.at}><b>{m.by === "advisor" ? "Advisor" : "You"}:</b> {m.note || m.action.replace("_", " ")} <span className="small">({new Date(m.at).toLocaleDateString()})</span></li>)}</ul>}
          {r.status === "needs_info" && (
            <div className="stack" style={{ marginTop: 10, gap: 6 }}>
              <label className="small" htmlFor={`rp-${r.id}`}>Your answer to the advisor</label>
              <textarea id={`rp-${r.id}`} rows={2} maxLength={1000} value={reply[r.id] ?? ""} onChange={(e) => setReply((x) => ({ ...x, [r.id]: e.target.value }))} />
              <div><button className="btn btn-sm" disabled={(reply[r.id] ?? "").trim().length < 2} onClick={() => send(r.id)}>Send answer</button></div>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
