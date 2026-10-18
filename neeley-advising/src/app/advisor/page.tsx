"use client";
import { useState } from "react";
import { Card } from "@/components/Bits";
import type { AdvisorPacket } from "@/lib/packet";
import Link from "next/link";
import { ACTION_LABEL, STATUS_LABEL, STATUS_TONE, type AdvisorAction, type LogEntry } from "@/lib/lifecycle";

interface Row { id: string; created_at: string; type: string; status: string; contact?: { name?: string; email?: string; phone?: string } | null; topic?: string; preferred_time?: string; channel?: string; packet?: (AdvisorPacket & { advisorLog?: LogEntry[] }) | null }

export default function Advisor() {
  const [pass, setPass] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<Record<string, string>>({});
  const [vis, setVis] = useState<Record<string, boolean>>({});
  async function load() {
    setErr(null);
    const res = await fetch("/api/advisor-queue", { headers: pass ? { "x-advisor-passcode": pass } : {} });
    const d = await res.json();
    if (!res.ok) { setErr(d.error || "Could not load the queue."); setRows(null); return; }
    setRows(d.requests);
  }
  async function act(id: string, action: AdvisorAction) {
    setErr(null);
    const res = await fetch("/api/advisor-action", { method: "POST", headers: { "content-type": "application/json", ...(pass ? { "x-advisor-passcode": pass } : {}) }, body: JSON.stringify({ id, action, note: note[id] ?? "", visibleToStudent: !!vis[id] }) });
    const d = await res.json();
    if (!res.ok) { setErr(d.error || "Could not update."); return; }
    setNote((n) => ({ ...n, [id]: "" }));
    await load();
  }
  return (
    <div className="wrap stack-lg">
      <div className="stack"><div className="eyebrow">Advisors</div><h1 className="page-title">Review queue</h1><p><Link href="/advisor/data">Upload section data</Link></p><p className="lede">Requests from students and callers, with the plan, findings and the specific questions that need a decision. Advisors, not the AI, approve everything.</p></div>
      <Card>
        <form className="row" onSubmit={(e) => { e.preventDefault(); void load(); }}>
          <div className="field" style={{ minWidth: 240 }}><label htmlFor="pc">Advisor passcode</label><input id="pc" type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="off" /></div>
          <button className="btn" style={{ alignSelf: "flex-end" }}>Open the queue</button>
        </form>
        {err && <p role="alert" style={{ marginTop: 10 }}>{err}</p>}
      </Card>
      {rows && !rows.length && <p>No requests yet.</p>}
      {rows?.map((r) => (
        <Card key={r.id}>
          <div className="row-between"><h3>{r.type === "review" ? "Plan review" : r.type === "meeting" ? "Meeting request" : "Call back"} <span className={`badge ${STATUS_TONE[r.status] ?? "b-neutral"}`}>{STATUS_LABEL[r.status] ?? r.status}</span></h3><span className="small">{new Date(r.created_at).toLocaleString()} · via {r.channel}</span></div>
          {r.contact && <p className="small">{[r.contact.name, r.contact.email, r.contact.phone].filter(Boolean).join(" · ") || "No contact details"}{r.preferred_time ? ` · prefers ${r.preferred_time}` : ""}</p>}
          {r.topic && <p style={{ marginTop: 8 }}>{r.topic}</p>}
          {r.packet?.advisorLog?.length ? <ul className="plain small" style={{ marginTop: 8 }}>{r.packet.advisorLog.map((e) => <li key={e.at}><b>{e.by}</b> · {e.action.replace("_", " ")}{e.note ? `: ${e.note}` : ""}{e.by === "advisor" && !e.visible ? " (private)" : ""}</li>)}</ul> : null}
          <div className="stack" style={{ marginTop: 10, gap: 6 }}>
            <label className="small" htmlFor={`n-${r.id}`}>Note or question</label>
            <textarea id={`n-${r.id}`} rows={2} maxLength={1000} value={note[r.id] ?? ""} onChange={(e) => setNote((n) => ({ ...n, [r.id]: e.target.value }))} />
            <label className="small"><input type="checkbox" checked={!!vis[r.id]} onChange={(e) => setVis((v) => ({ ...v, [r.id]: e.target.checked }))} /> Show this note to the student</label>
            <div className="row" style={{ flexWrap: "wrap" }}>{(["request_info", "mark_reviewed", "supersede", "reopen", "note"] as AdvisorAction[]).map((a) => <button key={a} className="btn btn-ghost btn-sm" onClick={() => act(r.id, a)}>{ACTION_LABEL[a]}</button>)}</div>
          </div>
          {r.packet?.challenge && <div className="callout" style={{ marginTop: 10 }}><b>Student challenges a finding</b><p>{r.packet.challenge.finding}</p><p className="small">Their note: {r.packet.challenge.note}</p></div>}
          {r.packet && r.packet.plan && (
            <details style={{ marginTop: 10 }} open>
              <summary>Review packet: {r.packet.plan.label} (earliest finish {r.packet.plan.earliestGraduation ?? "n/a"}, completeness {Math.round(r.packet.plan.completeness * 100)}%)</summary>
              <div className="stack" style={{ marginTop: 10 }}>
                <p className="small">{r.packet.student.sample ? "SAMPLE student" : "Student"}: {r.packet.student.plans.join("; ")} · GPA {r.packet.student.cumGpa} · {r.packet.student.earnedHours} earned hours · catalog term {r.packet.student.catalogTerm}</p>
                <div><b>Decisions needed</b><ol>{r.packet.questions.map((q) => <li key={q}>{q}</li>)}</ol></div>
                <div><b>Blockers</b><ul>{r.packet.findings.blockers.map((q) => <li key={q}>{q}</li>)}{!r.packet.findings.blockers.length && <li>None</li>}</ul></div>
                <div><b>Warnings</b><ul>{r.packet.findings.warnings.map((q) => <li key={q}>{q}</li>)}</ul></div>
                <div><b>Unverified</b><ul>{r.packet.unverified.map((q) => <li key={q}>{q}</li>)}</ul></div>
                {r.packet.context?.correctionNotes?.length ? <div><b>Corrected by the student (original record kept)</b><ul>{r.packet.context.correctionNotes.map((q) => <li key={q}>{q}</li>)}</ul></div> : null}
                {r.packet.context?.goals ? <div><b>Student goals</b><pre className="small" style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(r.packet.context.goals, null, 1)}</pre></div> : null}
                <p className="small">Sources: {r.packet.sources.join(" · ")}</p>
              </div>
            </details>
          )}
        </Card>
      ))}
    </div>
  );
}
