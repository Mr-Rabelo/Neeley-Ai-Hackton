"use client";
import Link from "next/link";
import { useState } from "react";
import type { PlanResult, RequirementStatus, StudentRecord } from "@/lib/types";
import { AvailText, Card, ConfBadge, FindingCard, Src, SourceList } from "./Bits";

const pretty = (c: string) => c.replace(/^([A-Z]+)(\d+)$/, "$1 $2");
const hoursLabel = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export function RequirementRow({ r }: { r: RequirementStatus }) {
  const total = Math.max(r.hoursNeeded, 0.0001);
  const done = Math.min(100, (r.hoursDone / total) * 100);
  const prog = Math.min(100 - done, (r.hoursInProgress / total) * 100);
  const status = r.status === "complete" ? "b-ok" : r.status === "in_progress" ? "b-info" : "b-warn";
  const statusText = r.status === "complete" ? "Complete" : r.status === "in_progress" ? "In progress" : "Still needed";
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="row-between">
        <b>{r.label}</b>
        <span className="small mono">{hoursLabel(r.hoursDone)}{r.hoursInProgress ? ` + ${hoursLabel(r.hoursInProgress)} in progress` : ""} of {hoursLabel(r.hoursNeeded)} hours · <span className={`badge ${status}`}>{statusText}</span></span>
      </div>
      <div className="bar" role="img" aria-label={`${hoursLabel(r.hoursDone)} of ${hoursLabel(r.hoursNeeded)} hours done`}><i className="done" style={{ width: `${done}%` }} /><i className="prog" style={{ width: `${prog}%` }} /></div>
      {r.remainingCourses.length > 0 && (
        <div className="small">Still needed: {r.remainingCourses.map((c, i) => <span key={c}>{i > 0 && ", "}<Link href={`/course/${c}`}>{pretty(c)}</Link></span>)}</div>
      )}
      {r.note && <div className="small">{r.note} <Src id={r.sourceId} page={r.page} /></div>}
    </div>
  );
}

export function PlanView({ plan, record }: { plan: PlanResult; record?: StudentRecord | null }) {
  const [filter, setFilter] = useState<"all" | "blocker" | "warning" | "info">("all");
  const findings = plan.findings.filter((f) => filter === "all" || (filter === "info" ? f.severity === "info" : f.severity === filter));
  const counts = { blocker: plan.findings.filter((f) => f.severity === "blocker").length, warning: plan.findings.filter((f) => f.severity === "warning").length, info: plan.findings.filter((f) => f.severity === "info").length };
  const inProgress = record?.courses.filter((c) => c.status === "in_progress") ?? [];
  const reqs = plan.requirements;
  return (
    <div className="stack-lg">
      <div className="banner" role="status">
        <span aria-hidden>▲</span>
        <div>
          <strong>Draft plan. Not yet reviewed by an advisor.</strong> {plan.unverified.length} item{plan.unverified.length === 1 ? " is" : "s are"} unverified. Review them before you decide. Based on current information only; nothing here changes your official record.
        </div>
      </div>

      <div className="grid grid-4">
        <Card className="card-tint">
          <div className="small">Earliest finish</div>
          <h3 style={{ fontSize: 26 }}>{plan.earliestGraduation.label ?? "Not within the window"}</h3>
          <div style={{ marginTop: 8 }}><ConfBadge c={plan.earliestGraduation.confidence} /></div>
          <p className="small" style={{ marginTop: 8 }}>Based on current information. Not a guarantee of graduation eligibility.</p>
        </Card>
        <Card><div className="small">Total credit hours</div><h3 style={{ fontSize: 26 }}>{hoursLabel(plan.totalCredits)}</h3><p className="small">{plan.remainingCredits} left to reach 120</p></Card>
        <Card><div className="small">Peak load</div><h3 style={{ fontSize: 26 }}>{hoursLabel(plan.peakCredits)} hrs</h3><p className="small">in one term{plan.summerUsed ? ", includes summer" : ", no summer"}</p></Card>
        <Card><div className="small">Plan completeness</div><h3 style={{ fontSize: 26 }}>{Math.round(plan.completeness * 100)}%</h3><p className="small">Share of required inputs that were present and sourced. Section times and seats are missing.</p></Card>
      </div>

      {plan.bottleneck && (
        <Card className="card-tint">
          <div className="eyebrow">Sharpest bottleneck</div>
          <h3 style={{ margin: "6px 0" }}><Link href={`/course/${plan.bottleneck.code}`}>{pretty(plan.bottleneck.code)}</Link> {plan.bottleneck.title}</h3>
          <p>{plan.bottleneck.why}</p>
        </Card>
      )}

      <section aria-labelledby="terms-h" className="stack">
        <h2 id="terms-h">Semester by semester</h2>
        <div className="terms">
          {inProgress.length > 0 && record && (
            <div className="term" style={{ borderColor: "var(--accent)" }}>
              <div className="term-head"><h4>{record.currentTermId.replace("-", " ")}</h4><span className="badge b-neutral">In progress now</span></div>
              {inProgress.map((c) => (
                <div key={c.code} className="course current">
                  <Link href={`/course/${c.code}`}>{pretty(c.code)}</Link>
                  <span>{c.title}</span>
                  <span className="meta">{c.attempted} hrs · grade pending</span>
                </div>
              ))}
              <div className="small">{inProgress.reduce((a, c) => a + c.attempted, 0)} hours</div>
            </div>
          )}
          {plan.terms.map((t) => (
            <div key={t.termId} className="term">
              <div className="term-head"><h4>{t.label}</h4><span className="small mono">{hoursLabel(t.credits)} hrs</span></div>
              {t.courses.map((c) => (
                <div key={c.code} className={`course ${c.placeholder ? "placeholder" : ""}`}>
                  {c.placeholder ? <b>{c.title}</b> : <Link href={`/course/${c.code}`}>{pretty(c.code)} <span style={{ fontWeight: 400 }}>{c.title}</span></Link>}
                  <span className="meta">{hoursLabel(c.credits)} hrs · {c.satisfies[0] ?? ""}</span>
                  {!c.placeholder && <span className="meta"><AvailText a={c.availability} /></span>}
                  {c.placeholder && <span className="meta">Placeholder: any approved course. No specific course is recommended.</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="find-h" className="stack">
        <div className="row-between">
          <h2 id="find-h">What the engine found</h2>
          <div className="tabs" role="tablist" aria-label="Filter findings">
            {(["all", "blocker", "warning", "info"] as const).map((k) => (
              <button key={k} role="tab" aria-selected={filter === k} className="tab" onClick={() => setFilter(k)}>
                {k === "all" ? `All (${plan.findings.length})` : k === "blocker" ? `Blockers (${counts.blocker})` : k === "warning" ? `Warnings (${counts.warning})` : `Notes (${counts.info})`}
              </button>
            ))}
          </div>
        </div>
        <div className="stack">{findings.map((f) => <FindingCard key={f.id} f={f} />)}{!findings.length && <p className="small">Nothing in this group.</p>}</div>
      </section>

      <div className="grid grid-2">
        <Card title="Verification checklist">
          <p className="small" style={{ marginBottom: 10 }}>Bring this to your advisor. These are things the plan could not confirm.</p>
          <ul className="stack" style={{ gap: 10, listStyle: "none", padding: 0, margin: 0 }}>
            {plan.unverified.map((u) => <li key={u}><label className="check"><input type="checkbox" /> <span>{u}</span></label></li>)}
          </ul>
        </Card>
        <Card title="Questions for your advisor">
          <ol className="stack" style={{ gap: 10, paddingLeft: 20, margin: 0 }}>
            {plan.advisorQuestions.map((q) => <li key={q}>{q}</li>)}
          </ol>
          <div style={{ marginTop: 14 }}><Link className="btn btn-sm" href="/next?review=1">Ask an advisor to review this plan</Link></div>
        </Card>
      </div>

      <section aria-labelledby="req-h" className="stack">
        <h2 id="req-h">Requirements: what is done and what is left</h2>
        <Card><div className="stack" style={{ gap: 20 }}>{reqs.map((r) => <RequirementRow key={r.id} r={r} />)}</div></Card>
      </section>

      <Card title="Sources"><SourceList sources={plan.sources} /></Card>
    </div>
  );
}
