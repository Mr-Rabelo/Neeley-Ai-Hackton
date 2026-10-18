"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { useStudent } from "@/components/StudentContext";
import { Card, Src } from "@/components/Bits";
import { Icon, Step } from "@/components/ui";
import { SAMPLE_FACTS } from "@/lib/sample-facts";
import type { Recommendations } from "@/lib/ai/recommend";
import type { StudentProfile as Profile } from "@/lib/ai/profile";
import { ApiError, postJson } from "@/lib/client";

const TYPE_LABEL: Record<string, { text: string; icon: string }> = {
  strength: { text: "Strength", icon: "star" },
  interest: { text: "Interest", icon: "bulb" },
  risk: { text: "Watch-out", icon: "eye" },
  gap: { text: "Gap to close", icon: "target" },
};

function claimsByConfidence(p: Profile) {
  const all = [
    ...p.strengths.map((c) => ({ ...c, kind: "strength" })),
    ...p.interests.map((c) => ({ ...c, kind: "interest" })),
    ...p.risks.map((c) => ({ ...c, kind: "risk" })),
    ...p.gaps.map((c) => ({ ...c, kind: "gap" })),
  ];
  return (["high", "medium", "low"] as const).map((level) => ({ level, items: all.filter((c) => c.confidence === level) }));
}

export default function StudentHome() {
  const s = useStudent();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pasted, setPasted] = useState("");
  const [drag, setDrag] = useState(false);
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
          <div className="step step-tint">
            <header className="step-head"><span className="step-chip" style={{ marginLeft: 0 }}><span className="badge b-info">Try the demo</span></span></header>
            <h2 style={{ fontSize: 22 }}>{SAMPLE_FACTS.name}</h2>
            <p className="small">{SAMPLE_FACTS.plans}</p>
            <div className="mini-stats">
              <div><span className="small">Earned</span><b>{SAMPLE_FACTS.earned} hrs</b></div>
              <div><span className="small">GPA</span><b>{SAMPLE_FACTS.gpa}</b></div>
              <div><span className="small">Transfer</span><b>{SAMPLE_FACTS.transfer} hrs</b></div>
              <div><span className="small">Started</span><b>{SAMPLE_FACTS.started}</b></div>
            </div>
            <p>See how the app works with a made-up student record: a double major with transfer credit, an Honors College plan and a few real-world wrinkles. No real student data is used.</p>
            <div><button className="btn" onClick={() => void s.loadSample()} disabled={s.loading}>{s.loading ? "Reading…" : "Use the sample student"} <Icon name="arrow" size={14} /></button></div>
          </div>
          <div className="step">
            <header className="step-head"><h2>Upload a transcript PDF</h2></header>
            <p className="small">A TCU unofficial transcript PDF or a .txt copy. Scanned images are not supported yet. <a href="/sample-transcript.pdf" download>Download the sample PDF</a> to try it.</p>
            <label className={`dropzone${drag ? " over" : ""}`} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f && !s.loading) void s.loadFile(f); }}>
              <Icon name="upload" size={26} />
              <span><b>Drop your transcript here</b> or <span className="link-like">browse</span></span>
              <span className="small">PDF or .txt · unofficial TCU transcript</span>
              <input ref={fileRef} type="file" accept=".pdf,.txt,application/pdf,text/plain" aria-label="Transcript file" onChange={(e) => { const f = e.target.files?.[0]; if (f) void s.loadFile(f); }} disabled={s.loading} />
            </label>
            <details>
              <summary>Or paste the text</summary>
              <div className="stack" style={{ marginTop: 8 }}>
                <textarea value={pasted} onChange={(e) => setPasted(e.target.value)} aria-label="Transcript text" placeholder="Paste transcript text here" />
                <div><button className="btn btn-sm" disabled={s.loading || pasted.length < 40} onClick={() => void s.loadText(pasted)}>Read this text</button></div>
              </div>
            </details>
          </div>
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
        <Step n={1} title="What we read from the transcript" chip={ex.method === "ai+deterministic" ? <span className="badge b-info">AI + rule-based check</span> : <span className="badge b-neutral">Rule-based only</span>}>
          <p>{ex.notes.join(" ")}</p>
          {ex.discrepancies.length > 0 && <ul className="small" style={{ margin: 0 }}>{ex.discrepancies.map((d) => <li key={d}>{d}</li>)}</ul>}
          <details>
            <summary>Check the {r.courses.length} courses we found</summary>
            <div className="table-wrap" style={{ marginTop: 10 }}>
              <table>
                <thead><tr><th scope="col">Term</th><th scope="col">Course</th><th scope="col">Hours</th><th scope="col">Grade</th></tr></thead>
                <tbody>{r.courses.map((c, i) => <tr key={i}><td>{c.termId.replace("-", " ")}</td><td><Link href={`/course/${c.code}`}>{c.code.replace(/^([A-Z]+)(\d+)$/, "$1 $2")}</Link> {c.title}{c.transfer ? " (transfer)" : ""}</td><td className="mono">{c.status === "in_progress" ? c.attempted : c.earned}</td><td>{c.grade || "in progress"}</td></tr>)}</tbody>
              </table>
            </div>
            <p className="small" style={{ marginTop: 8 }}>Something wrong? Your plan uses the record as printed. Tell the Registrar or an advisor, and use <b>Start over</b> to reload a corrected copy.</p>
          </details>
        </Step>
      )}

      <Step n={2} title="Your academic profile" chip={s.profile ? <span className="badge b-neutral">{s.profile.generatedBy === "claude" ? "Written by Claude from your transcript" : "Rule-based"}</span> : undefined}>
        {s.profiling && <p><span className="spin" aria-hidden /> Reading your transcript…</p>}
        {!s.profile && !s.profiling && <p className="small">No profile yet. <button className="btn btn-sm" onClick={() => void s.refreshProfile()}>Build my profile</button></p>}
        {s.profile && (
          <>
            <p style={{ fontSize: 18 }}>{s.profile.headline}</p>
            <div className="conf-cols">
              {claimsByConfidence(s.profile).map(({ level, items }) => (
                <div key={level} className={`conf-col ${level}`}>
                  <h3><Icon name={level === "high" ? "check" : level === "medium" ? "info" : "alert"} size={16} />{level === "high" ? "High" : level === "medium" ? "Medium" : "Low"} confidence</h3>
                  {items.map((c) => (
                    <div key={`${c.kind}-${c.claim}`} className="claim">
                      <span className="type-chip"><Icon name={TYPE_LABEL[c.kind].icon} size={12} />{TYPE_LABEL[c.kind].text}</span>
                      <span>{c.claim}</span>
                      <span className="small">Based on: {c.evidence.join(", ")}</span>
                    </div>
                  ))}
                  {!items.length && <p className="small" style={{ color: "inherit" }}>Nothing at this level.</p>}
                </div>
              ))}
            </div>
            {s.profile.careerPossibilities.length > 0 && (
              <div className="stack" style={{ gap: 8 }}>
                <h4>Careers to explore (possibilities, not predictions)</h4>
                <ul className="stack" style={{ gap: 8, paddingLeft: 18, margin: 0 }}>{s.profile.careerPossibilities.map((c) => <li key={c.field}><b>{c.field}.</b> {c.why} <span className="small">Based on: {c.evidence.join(", ")}</span></li>)}</ul>
                <div><Link href="/student/careers">See the job market data</Link></div>
              </div>
            )}
            <details><summary>Is this right? Questions to confirm</summary><ul style={{ marginTop: 8 }}>{s.profile.questionsToConfirm.map((q) => <li key={q}>{q}</li>)}</ul></details>
            <p className="small">{s.profile.limits}{s.profile.removedUnsupported > 0 && ` ${s.profile.removedUnsupported} unsupported claim(s) were removed because they cited courses not on your transcript.`}</p>
          </>
        )}
      </Step>

      <Step n={3} tone="tint" title="What to take next" chip={<button className="btn btn-sm" onClick={getRecs} disabled={recBusy}>{recBusy ? "Working…" : recs ? "Refresh recommendations" : "Get my recommendations"} <Icon name="arrow" size={14} /></button>}>
        {!recs && <p className="small">Claude reads the planning engine&apos;s results and explains what to take next and why. Required courses stay separate from optional ideas.</p>}
        {recNote && <p className="small" role="status">{recNote}</p>}
        {recs && <p>{recs.summary} <span className="badge b-neutral">{recs.generatedBy === "claude" ? "Explained by Claude" : "Engine facts only"}</span></p>}
        <div className="three">
          <div className="mini">
            <h3><Icon name="book" size={16} />Required next term</h3>
            <span className="badge b-ok" style={{ alignSelf: "flex-start" }}>From the planning engine</span>
            {recs ? <ul className="stack" style={{ gap: 10, paddingLeft: 18, margin: 0 }}>{recs.nextTerm.map((c) => <li key={c.code}><Link href={`/course/${c.code.replace(/\s/g, "")}`}><b>{c.code}</b></Link> {c.title}. {c.why} <span className="small">({c.satisfies}) {c.sources.map((x) => <Src key={x} id={x} />)}</span></li>)}</ul> : <p className="small">Appears after you ask for recommendations.</p>}
          </div>
          <div className="mini">
            <h3><Icon name="bulb" size={16} />Optional, tied to your interests</h3>
            <span className="badge b-info" style={{ alignSelf: "flex-start" }}>Suggestions only</span>
            {recs ? (recs.electives.length ? <ul className="stack" style={{ gap: 10, paddingLeft: 18, margin: 0 }}>{recs.electives.map((c) => <li key={c.code}><Link href={`/course/${c.code.replace(/\s/g, "")}`}><b>{c.code}</b></Link> {c.title}. {c.why} <span className="small">Connects to: {c.interestLink}{c.careerLink ? `; career: ${c.careerLink}` : ""}</span></li>)}</ul> : <p className="small">No optional suggestions this time.</p>) : <p className="small">Appears after you ask for recommendations.</p>}
          </div>
          <div className="mini">
            <h3><Icon name="user" size={16} />Questions for your advisor</h3>
            <span className="badge b-warn" style={{ alignSelf: "flex-start" }}>Bring to your meeting</span>
            {recs ? (recs.questionsForAdvisor.length ? <ul className="stack" style={{ gap: 6, paddingLeft: 18, margin: 0 }}>{recs.questionsForAdvisor.map((w) => <li key={w}>{w}</li>)}</ul> : <p className="small">None this time.</p>) : <p className="small">Appears after you ask for recommendations.</p>}
          </div>
        </div>
        {recs && recs.watchOuts.length > 0 && <div><h4>Watch out for</h4><ul className="stack" style={{ gap: 6, paddingLeft: 18, margin: "6px 0 0" }}>{recs.watchOuts.map((w) => <li key={w}>{w}</li>)}</ul></div>}
        {recs && recs.tradeoffs && <div><h4>Trade-offs between paths</h4><p>{recs.tradeoffs}</p></div>}
        <p className="small">{recs ? `Required courses come from the engine. Electives are suggestions only. ${recs.removedUnsupported > 0 ? `${recs.removedUnsupported} suggestion(s) were removed because they were not in the catalog or plan. ` : ""}` : ""}Also covers watch-outs and trade-offs between paths. Nothing here replaces advisor approval.</p>
      </Step>

      <div className="grid grid-3">
        <Card><h3>My plan</h3><p className="small" style={{ margin: "6px 0 12px" }}>Semester by semester, with findings and sources.</p><Link className="btn btn-sm" href="/student/plan">Open plan</Link></Card>
        <Card><h3>What if</h3><p className="small" style={{ margin: "6px 0 12px" }}>Add a minor, switch a major, or follow a career interest.</p><Link className="btn btn-sm" href="/student/whatif">Compare paths</Link></Card>
        <Card><h3>Ask the AI</h3><p className="small" style={{ margin: "6px 0 12px" }}>Questions about courses, requirements and careers.</p><Link className="btn btn-sm" href="/student/chat">Start chatting</Link></Card>
      </div>
    </div>
  );
}
