"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { useStudent } from "@/components/StudentContext";
import { Card, ConfBadge, Src } from "@/components/Bits";
import type { Recommendations } from "@/lib/ai/recommend";
import type { Claim } from "@/lib/ai/profile";
import { ApiError, postJson } from "@/lib/client";

function ClaimList({ title, items }: { title: string; items: Claim[] }) {
  if (!items.length) return null;
  return (
    <div className="stack" style={{ gap: 8 }}>
      <h4>{title}</h4>
      <ul className="stack" style={{ gap: 10, paddingLeft: 0, margin: 0, listStyle: "none" }}>
        {items.map((c) => (
          <li key={c.claim}>
            {c.claim} <span className={`badge ${c.confidence === "high" ? "b-ok" : c.confidence === "medium" ? "b-info" : "b-warn"}`}>{c.confidence} confidence</span>
            <div className="small">Based on: {c.evidence.join(", ")}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function StudentHome() {
  const s = useStudent();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pasted, setPasted] = useState("");
  const [recs, setRecs] = useState<Recommendations | null>(null);
  const [recBusy, setRecBusy] = useState(false);
  const [recNote, setRecNote] = useState<string | null>(null);

  async function getRecs() {
    if (!s.record) return;
    setRecBusy(true); setRecNote(null);
    try {
      const r = await postJson<{ recommendations: Recommendations; notice?: string }>("/api/recommend", { record: s.record, profile: s.profile ?? undefined });
      setRecs(r.recommendations);
      if (r.notice) setRecNote(r.notice);
    } catch (e) {
      setRecNote(e instanceof ApiError ? e.message : "Could not get recommendations.");
    } finally { setRecBusy(false); }
  }

  if (!s.ready) return <p>Loading…</p>;

  if (!s.record) {
    return (
      <div className="stack-lg">
        <div className="stack"><div className="eyebrow">Current student</div><h1 className="page-title">Load your transcript</h1><p className="lede">We read it, show you what we found so you can correct it, then build your plan from the 2026-27 catalog.</p></div>
        {s.error && <div className="banner" role="alert"><span aria-hidden>!</span><div>{s.error}</div></div>}
        <div className="grid grid-2">
          <Card title="Use the sample student">
            <p>A demo transcript with a Business Information Systems and Finance double major, an Honors College plan, transfer credit and a few real-world wrinkles.</p>
            <div style={{ marginTop: 14 }}><button className="btn" onClick={() => void s.loadSample()} disabled={s.loading}>{s.loading ? "Reading…" : "Use the sample student"}</button></div>
          </Card>
          <Card title="Upload a transcript PDF">
            <p>A TCU unofficial transcript PDF or a .txt copy. Scanned images are not supported yet. <a href="/sample-transcript.pdf" download>Download the sample PDF</a> to try it.</p>
            <div style={{ marginTop: 14 }} className="row">
              <input ref={fileRef} type="file" accept=".pdf,.txt,application/pdf,text/plain" aria-label="Transcript file" onChange={(e) => { const f = e.target.files?.[0]; if (f) void s.loadFile(f); }} disabled={s.loading} />
            </div>
            <details style={{ marginTop: 12 }}>
              <summary>Or paste the text</summary>
              <div className="stack" style={{ marginTop: 8 }}>
                <textarea value={pasted} onChange={(e) => setPasted(e.target.value)} aria-label="Transcript text" placeholder="Paste transcript text here" />
                <div><button className="btn btn-sm" disabled={s.loading || pasted.length < 40} onClick={() => void s.loadText(pasted)}>Read this text</button></div>
              </div>
            </details>
          </Card>
        </div>
        <div className="banner banner-info" role="note"><span aria-hidden>i</span><div><b>Privacy.</b> Your transcript is kept in this browser, not saved on our server. When AI features are on, the transcript text is sent to Anthropic&apos;s API to be read and profiled. Use only sample data until TCU authorizes real student records.</div></div>
      </div>
    );
  }

  const r = s.record;
  const ex = s.extraction;
  return (
    <div className="stack-lg">
      <div className="row-between">
        <div className="stack" style={{ gap: 6 }}><div className="eyebrow">{r.isSample ? "Sample student" : "Your record"}</div><h1 className="page-title">{r.plans.filter((p) => !/honors/i.test(p)).join(" + ") || "Your overview"}</h1><p className="lede">{r.earnedHours} earned hours · {r.cumGpa.toFixed(2)} GPA · requirement term {r.catalogTermId.replace("-", " ")}</p></div>
        <button className="btn btn-ghost btn-sm" onClick={s.clear}>Start over</button>
      </div>

      {ex && (
        <Card title="1. What we read from the transcript">
          <p>{ex.notes.join(" ")} {ex.method === "ai+deterministic" ? <span className="badge b-info">AI + rule-based check</span> : <span className="badge b-neutral">Rule-based only</span>}</p>
          {ex.discrepancies.length > 0 && <ul className="small" style={{ marginTop: 8 }}>{ex.discrepancies.map((d) => <li key={d}>{d}</li>)}</ul>}
          <details style={{ marginTop: 10 }}>
            <summary>Check the {r.courses.length} courses we found</summary>
            <div className="table-wrap" style={{ marginTop: 10 }}>
              <table>
                <thead><tr><th scope="col">Term</th><th scope="col">Course</th><th scope="col">Hours</th><th scope="col">Grade</th></tr></thead>
                <tbody>{r.courses.map((c, i) => <tr key={i}><td>{c.termId.replace("-", " ")}</td><td><Link href={`/course/${c.code}`}>{c.code.replace(/^([A-Z]+)(\d+)$/, "$1 $2")}</Link> {c.title}{c.transfer ? " (transfer)" : ""}</td><td className="mono">{c.status === "in_progress" ? c.attempted : c.earned}</td><td>{c.grade || "in progress"}</td></tr>)}</tbody>
              </table>
            </div>
            <p className="small" style={{ marginTop: 8 }}>Something wrong? Your plan uses the record as printed. Tell the Registrar or an advisor, and use <b>Start over</b> to reload a corrected copy.</p>
          </details>
        </Card>
      )}

      <Card title="2. Your academic profile">
        {s.profiling && <p><span className="spin" aria-hidden /> Reading your transcript…</p>}
        {!s.profile && !s.profiling && <p className="small">No profile yet. <button className="btn btn-sm" onClick={() => void s.refreshProfile()}>Build my profile</button></p>}
        {s.profile && (
          <div className="stack">
            <p style={{ fontSize: 18 }}>{s.profile.headline} <span className="badge b-neutral">{s.profile.generatedBy === "claude" ? "Written by Claude from your transcript" : "Rule-based"}</span></p>
            <div className="grid grid-2">
              <ClaimList title="Strengths" items={s.profile.strengths} />
              <ClaimList title="Interests" items={s.profile.interests} />
              <ClaimList title="Watch-outs" items={s.profile.risks} />
              <ClaimList title="Gaps to close" items={s.profile.gaps} />
            </div>
            {s.profile.careerPossibilities.length > 0 && (
              <div className="stack" style={{ gap: 8 }}>
                <h4>Careers to explore (possibilities, not predictions)</h4>
                <ul className="stack" style={{ gap: 8, paddingLeft: 18, margin: 0 }}>{s.profile.careerPossibilities.map((c) => <li key={c.field}><b>{c.field}.</b> {c.why} <span className="small">Based on: {c.evidence.join(", ")}</span></li>)}</ul>
                <Link href="/student/careers">See the job market data</Link>
              </div>
            )}
            <details><summary>Is this right? Questions to confirm</summary><ul style={{ marginTop: 8 }}>{s.profile.questionsToConfirm.map((q) => <li key={q}>{q}</li>)}</ul></details>
            <p className="small">{s.profile.limits}{s.profile.removedUnsupported > 0 && ` ${s.profile.removedUnsupported} unsupported claim(s) were removed because they cited courses not on your transcript.`}</p>
          </div>
        )}
      </Card>

      <Card title="3. What to take next">
        {!recs && <p className="small">Claude reads the planning engine&apos;s results and explains what to take next and why, keeping required courses separate from optional ideas.</p>}
        {recNote && <p className="small" role="status" style={{ marginTop: 6 }}>{recNote}</p>}
        {recs && (
          <div className="stack">
            <p>{recs.summary} <span className="badge b-neutral">{recs.generatedBy === "claude" ? "Explained by Claude" : "Engine facts only"}</span></p>
            <h4>Required next term</h4>
            <ul className="stack" style={{ gap: 10, paddingLeft: 18, margin: 0 }}>{recs.nextTerm.map((c) => <li key={c.code}><Link href={`/course/${c.code.replace(/\s/g, "")}`}><b>{c.code}</b></Link> {c.title}. {c.why} <span className="small">({c.satisfies}) {c.sources.map((x) => <Src key={x} id={x} />)}</span></li>)}</ul>
            {recs.electives.length > 0 && <><h4>Optional, tied to your interests</h4><ul className="stack" style={{ gap: 10, paddingLeft: 18, margin: 0 }}>{recs.electives.map((c) => <li key={c.code}><Link href={`/course/${c.code.replace(/\s/g, "")}`}><b>{c.code}</b></Link> {c.title}. {c.why} <span className="small">Connects to: {c.interestLink}{c.careerLink ? `; career: ${c.careerLink}` : ""}</span></li>)}</ul></>}
            {recs.watchOuts.length > 0 && <><h4>Watch out for</h4><ul className="stack" style={{ gap: 6, paddingLeft: 18, margin: 0 }}>{recs.watchOuts.map((w) => <li key={w}>{w}</li>)}</ul></>}
            {recs.tradeoffs && <><h4>Trade-offs between paths</h4><p>{recs.tradeoffs}</p></>}
            {recs.questionsForAdvisor.length > 0 && <><h4>Questions for your advisor</h4><ul className="stack" style={{ gap: 6, paddingLeft: 18, margin: 0 }}>{recs.questionsForAdvisor.map((w) => <li key={w}>{w}</li>)}</ul></>}
            <p className="small">Required courses come from the engine. Electives are suggestions only. {recs.removedUnsupported > 0 && `${recs.removedUnsupported} suggestion(s) were removed because they were not in the catalog or plan.`}</p>
          </div>
        )}
        <div style={{ marginTop: 14 }}><button className="btn btn-sm" onClick={getRecs} disabled={recBusy}>{recBusy ? "Working…" : recs ? "Refresh recommendations" : "Get recommendations"}</button></div>
      </Card>

      <div className="grid grid-3">
        <Card><h3>My plan</h3><p className="small" style={{ margin: "6px 0 12px" }}>Semester by semester, with findings and sources.</p><Link className="btn btn-sm" href="/student/plan">Open plan</Link></Card>
        <Card><h3>What if</h3><p className="small" style={{ margin: "6px 0 12px" }}>Add a minor, switch a major, or follow a career interest.</p><Link className="btn btn-sm" href="/student/whatif">Compare paths</Link></Card>
        <Card><h3>Ask the AI</h3><p className="small" style={{ margin: "6px 0 12px" }}>Questions about courses, requirements and careers.</p><Link className="btn btn-sm" href="/student/chat">Start chatting</Link></Card>
      </div>
    </div>
  );
}
