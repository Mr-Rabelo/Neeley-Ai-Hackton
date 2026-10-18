"use client";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import type { PlanResult, RequirementStatus, StudentRecord } from "@/lib/types";
import { buildYearGroups, defaultYearIndex, findingSummary, type CompletedTerm, type YearGroup } from "@/lib/plan-view";
import { AvailText, Card, ConfBadge, FindingCard, Src, SourceList } from "./Bits";
import { Collapse, Icon, Stat } from "./ui";
import { SchedulePanel } from "./SchedulePanel";
import { chosenFor } from "@/lib/report";

const pretty = (c: string) => c.replace(/^([A-Z]+)(\d+)$/, "$1 $2");
const hoursLabel = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const termOrder = (termId: string) => {
  const [y, n] = termId.split("-");
  return Number(y) * 3 + ({ Spring: 0, Summer: 1, Fall: 2 } as Record<string, number>)[n];
};

export function RequirementRow({ r, chosen }: { r: RequirementStatus; chosen?: string[] }) {
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
      {r.chooseFrom && r.chooseFrom.length > 1 && r.status !== "complete" && (
        <details>
          <summary>Choose from {r.chooseFrom.length} options</summary>
          <ul className="alts">
            {r.chooseFrom.map((c) => {
              const picked = chosen?.includes(c);
              const has = r.satisfiedBy.includes(c);
              return (
                <li key={c}>
                  <Link href={`/course/${c}`}>{pretty(c)}</Link> {r.chooseFromTitles?.[c] ?? ""}
                  {has && <span className="badge b-ok" style={{ marginLeft: 6 }}>Counts now</span>}
                  {!has && picked && <span className="badge b-info" style={{ marginLeft: 6 }}>In your plan</span>}
                </li>
              );
            })}
          </ul>
          <p className="small">Any option can satisfy this group; the plan picks the ones that fit your interests and the catalog&apos;s offering pattern. Substitutions need an advisor.</p>
        </details>
      )}
    </div>
  );
}

function Journey({ groups, finish, planStart }: { groups: YearGroup[]; finish: string | null; planStart: boolean }) {
  const here = groups.findIndex((g) => g.status === "current");
  const SHORT: Record<string, string> = { Freshman: "Fr", Sophomore: "So", Junior: "Jr", Senior: "Sr" };
  const short = (g: YearGroup) => SHORT[g.name] ?? g.name.replace("Year ", "Y");
  return (
    <div className="journey" aria-label="Your path to graduation">
      <div className="journey-track">
        {groups.map((g, i) => (
          <div key={g.ay} style={{ display: "contents" }}>
            <div className={`j-node ${i < here || (here < 0 && g.status === "completed") ? "done" : ""} ${i === here ? "here" : ""}`}>
              <span className="j-dot">{(i < here || (here < 0 && g.status === "completed")) && <Icon name="check" size={11} />}</span>
              <span>{short(g)}</span>
            </div>
            <span className={`j-line ${i < here ? "done" : ""}`} />
          </div>
        ))}
        <div className="j-node grad"><span className="j-dot"><Icon name="cap" size={14} /></span><span>Grad</span></div>
      </div>
      <div className="journey-meta">
        <span>{here >= 0 ? <>You are here: <b>{groups[here].name}{groups[here].name.startsWith("Year") ? "" : " year"}</b></> : planStart ? "Sample plan from zero credits" : " "}</span>
        <span>Finish: <b>{finish ?? "not within the window"}</b></span>
      </div>
    </div>
  );
}

function CompletedTermCard({ t }: { t: CompletedTerm }) {
  return (
    <div className="sem">
      <div className="sem-head"><h4>{t.label}</h4><span className="small mono">{hoursLabel(t.hours)} hrs earned</span></div>
      <div className="tiles">
        {t.courses.map((c) => (
          <div key={c.code} className="tile">
            <Link href={`/course/${c.code}`}>{pretty(c.code)}</Link>
            <span>{c.title}</span>
            <span className="meta">{hoursLabel(c.hours)} hrs · {c.grade}{c.transfer ? " · transfer" : ""}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PlanView({ plan, record }: { plan: PlanResult; record?: StudentRecord | null }) {
  const groups = useMemo(() => buildYearGroups(plan, record), [plan, record]);
  const [yi, setYi] = useState(() => defaultYearIndex(groups));
  const [showAll, setShowAll] = useState(false);
  const [filter, setFilter] = useState<"all" | "blocker" | "warning" | "info">("all");
  const sum = findingSummary(plan);
  const list = plan.findings.filter((f) => filter === "all" || f.severity === filter);
  const g = groups[Math.min(yi, Math.max(0, groups.length - 1))];
  const earlier = groups.slice(0, Math.max(0, yi)).filter((x) => x.completed.length > 0);
  const earlierTerms = earlier.flatMap((x) => x.completed);
  const earlierHours = earlier.reduce((a, x) => a + x.earnedHours, 0);
  const earlierTransfer = earlier.reduce((a, x) => a + x.transferHours, 0);
  const groupsDone = plan.requirements.filter((r) => r.status === "complete").length;

  type Sem = { termId: string; node: ReactNode };
  const sems: Sem[] = g
    ? [
        ...g.completed.map((t) => ({ termId: t.termId, node: <CompletedTermCard key={`c-${t.termId}`} t={t} /> })),
        ...(g.inProgress
          ? [{
              termId: g.inProgress.termId,
              node: (
                <div key="now" className="sem now">
                  <div className="sem-head"><h4>{g.inProgress.label}</h4><span className="badge b-neutral">In progress now</span></div>
                  <div className="tiles">
                    {g.inProgress.courses.map((c) => (
                      <div key={c.code} className="tile now">
                        <Link href={`/course/${c.code}`}>{pretty(c.code)}</Link>
                        <span>{c.title}</span>
                        <span className="meta">{hoursLabel(c.hours)} hrs · grade pending</span>
                      </div>
                    ))}
                  </div>
                  <div className="small">{hoursLabel(g.inProgress.hours)} hours</div>
                </div>
              ),
            }]
          : []),
        ...g.planned.map((t) => ({
          termId: t.termId,
          node: (
            <div key={t.termId} className="sem">
              <div className="sem-head"><h4>{t.label}</h4><span className="small mono">{hoursLabel(t.credits)} hrs</span></div>
              <div className="tiles">
                {t.courses.map((c) => (
                  <div key={c.code} className={`tile ${c.placeholder ? "slot" : ""}`}>
                    {c.placeholder ? <b>{c.title}</b> : <Link href={`/course/${c.code}`}>{pretty(c.code)} <span style={{ fontWeight: 400, color: "var(--fg)" }}>{c.title}</span></Link>}
                    <span className="meta">{hoursLabel(c.credits)} hrs · {c.satisfies[0] ?? ""}</span>
                    {!c.placeholder && <span className="meta"><AvailText a={c.availability} /></span>}
                    {c.placeholder && <span className="meta">Placeholder: any approved course. No specific course is recommended.</span>}
                    {!c.placeholder && (
                      <details className="why">
                        <summary>Why this course</summary>
                        <p>{c.reason}</p>
                        <p className="small">Counts toward: {c.satisfies.join("; ") || "total hours"}. Offering pattern from the catalog <Src id={c.availability.sourceId} />.</p>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ),
        })),
      ].sort((a, b) => termOrder(a.termId) - termOrder(b.termId))
    : [];

  return (
    <div className="stack-lg">
      <div className="banner" role="status">
        <span aria-hidden>▲</span>
        <div>
          <strong>Draft plan. Not yet reviewed by an advisor.</strong> {plan.unverified.length} item{plan.unverified.length === 1 ? " is" : "s are"} unverified. Review them before you decide. Based on current information only; nothing here changes your official record.
        </div>
      </div>

      {groups.length > 0 && <Journey groups={groups} finish={plan.earliestGraduation.label} planStart={!record || record.courses.length === 0} />}

      <div className="stat-grid">
        <Stat tone="tint" icon="flag" label="Earliest finish" value={plan.earliestGraduation.label ?? "Not within the window"} note="Based on current information. Not a guarantee of graduation eligibility.">
          <div><ConfBadge c={plan.earliestGraduation.confidence} /></div>
        </Stat>
        <Stat icon="layers" label="Total credit hours" value={hoursLabel(plan.totalCredits)} note={`${plan.remainingCredits} left to reach 120`} />
        <Stat icon="chart" label="Peak load" value={`${hoursLabel(plan.peakCredits)} hrs`} note={`in one term${plan.summerUsed ? ", includes summer" : ", no summer"}`} />
        <Stat icon="checksq" label="Plan completeness" value={`${Math.round(plan.completeness * 100)}%`} note="Share of required inputs that were present and sourced. Section times and seats are missing." />
      </div>

      {plan.bottleneck && (
        <div className="callout">
          <div className="eyebrow">Sharpest bottleneck</div>
          <h3><Link href={`/course/${plan.bottleneck.code}`}>{pretty(plan.bottleneck.code)}</Link> {plan.bottleneck.title}</h3>
          <p>{plan.bottleneck.why}</p>
        </div>
      )}

      <section aria-labelledby="terms-h" className="stack">
        <div className="row-between">
          <h2 id="terms-h">Year by year</h2>
          <span className="small">{record && record.courses.length > 0 ? "Year labels follow your start term, not official class standing." : "A sample from zero credits."}</span>
        </div>
        <div className="yeartabs" role="tablist" aria-label="Choose a year">
          {groups.map((x, i) => (
            <button key={x.ay} role="tab" aria-selected={i === yi} className="yeartab" onClick={() => setYi(i)}>
              <b>{x.name} {x.status === "completed" && <span className="tick" aria-label="completed">✓</span>}</b>
              <span>{x.range}{x.status === "current" ? " · now" : ""}</span>
            </button>
          ))}
        </div>
        {earlierTerms.length > 0 && (
          <Collapse title="Completed before this year" hint={`${hoursLabel(earlierHours)} hrs earned${earlierTransfer ? ` · incl. ${hoursLabel(earlierTransfer)} transfer` : ""} · show ${earlierTerms.map((t) => t.label).join(" and ")} courses`}>
            <div className="sem-grid">{earlierTerms.map((t) => <CompletedTermCard key={t.termId} t={t} />)}</div>
          </Collapse>
        )}
        {g && (
          <div className="stack" role="tabpanel">
            <div className="row-between">
              <span className="badge b-neutral">{g.name} · {g.range}</span>
              <span className="small mono">{g.status === "completed" ? `${hoursLabel(g.earnedHours)} hrs earned` : `${hoursLabel(g.plannedHours + (g.inProgress?.hours ?? 0))} hrs this year`}</span>
            </div>
            <div className="sem-grid">{sems.map((s) => s.node)}</div>
            {sems.length === 0 && <p className="small">Nothing scheduled in this year.</p>}
          </div>
        )}
      </section>

      <SchedulePanel plan={plan} />

      <section aria-labelledby="find-h" className="stack">
        <div className="row-between">
          <h2 id="find-h">What the engine found</h2>
          <div className="row" style={{ gap: 8 }}>
            <span className="badge b-bad">Blockers ({sum.blocker})</span>
            <span className="badge b-warn">Warnings ({sum.warning})</span>
            <span className="badge b-info">Notes ({sum.info})</span>
          </div>
        </div>
        {!showAll ? (
          <>
            <p className="small">Top priorities: blockers first, then warnings.</p>
            <div className="stack">{plan.findings.slice(0, 3).map((f) => <FindingCard key={f.id} f={f} />)}</div>
            {plan.findings.length > 3 && <div><button className="btn btn-ghost btn-sm" onClick={() => setShowAll(true)}>See all {plan.findings.length} findings <Icon name="arrow" size={14} /></button></div>}
          </>
        ) : (
          <>
            <div className="tabs" role="tablist" aria-label="Filter findings">
              {(["all", "blocker", "warning", "info"] as const).map((k) => (
                <button key={k} role="tab" aria-selected={filter === k} className="tab" onClick={() => setFilter(k)}>
                  {k === "all" ? `All (${sum.total})` : k === "blocker" ? `Blockers (${sum.blocker})` : k === "warning" ? `Warnings (${sum.warning})` : `Notes (${sum.info})`}
                </button>
              ))}
            </div>
            <div className="stack">{list.map((f) => <FindingCard key={f.id} f={f} />)}{!list.length && <p className="small">Nothing in this group.</p>}</div>
            <div><button className="btn btn-ghost btn-sm" onClick={() => { setShowAll(false); setFilter("all"); }}>Show fewer</button></div>
          </>
        )}
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

      <Collapse title="Requirements: what is done and what is left" hint={`${groupsDone} of ${plan.requirements.length} groups complete`}>
        <div className="stack" style={{ gap: 20 }}>{plan.requirements.map((r) => <RequirementRow key={r.id} r={r} chosen={chosenFor(plan, r)} />)}</div>
      </Collapse>

      <Collapse title="Sources" hint={`${plan.sources.length} records`}>
        <SourceList sources={plan.sources} />
      </Collapse>
    </div>
  );
}
