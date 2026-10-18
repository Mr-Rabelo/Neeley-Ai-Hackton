"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { PlanResult } from "@/lib/types";
import { useStudent } from "@/components/StudentContext";
import { Card, NeedStudent } from "@/components/Bits";
import { RequirementRow } from "@/components/PlanView";
import { chosenFor } from "@/lib/report";
import { Icon, Stat } from "@/components/ui";
import { getJson, postJson } from "@/lib/client";

interface Row { code: string; title: string; department: string; offered: string; prerequisites: string }

export default function CoursesPage() {
  const { record, ready } = useStudent();
  const [plan, setPlan] = useState<PlanResult | null>(null);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [searched, setSearched] = useState(false);
  const [show, setShow] = useState<"open" | "remaining" | "in_progress" | "complete">("open");
  useEffect(() => { if (record) postJson<{ plan: PlanResult }>("/api/plan", { record }).then((r) => setPlan(r.plan)).catch(() => undefined); }, [record]);
  useEffect(() => {
    if (q.trim().length < 2) { setRows([]); setSearched(false); return; }
    const t = setTimeout(() => getJson<{ courses: Row[] }>(`/api/courses?q=${encodeURIComponent(q)}`).then((r) => { setRows(r.courses); setSearched(true); }).catch(() => undefined), 250);
    return () => clearTimeout(t);
  }, [q]);
  if (!ready) return <p>Loading…</p>;
  if (!record) return <NeedStudent />;
  const done = plan?.requirements.filter((r) => r.status === "complete") ?? [];
  const aggregate = plan ? plan.requirements.reduce((a, r) => ({ need: a.need + r.hoursNeeded, done: a.done + r.hoursDone, prog: a.prog + r.hoursInProgress }), { need: 0, done: 0, prog: 0 }) : null;
  return (
    <div className="stack-lg">
      <div className="stack"><div className="eyebrow">Courses</div><h1 className="page-title">What is left, and what is available</h1><p className="lede">Select any course to see its prerequisite tree, when it is usually offered, and what it unlocks.</p></div>
      <Card title="Search the 2026-27 catalog">
        <div className="field"><label htmlFor="q">Course code, title or topic</label><input id="q" type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. FINA 30153, investments, analytics" /></div>
        {searched && <p className="small" style={{ marginTop: 10 }}>{rows.length} match{rows.length === 1 ? "" : "es"} (showing up to 25)</p>}
        {rows.length > 0 && (
          <div className="table-wrap" style={{ marginTop: 10 }}>
            <table>
              <thead><tr><th scope="col">Course</th><th scope="col">Typically offered</th><th scope="col">Prerequisites</th></tr></thead>
              <tbody>{rows.map((c) => <tr key={c.code}><td><Link href={`/course/${c.code.replace(/\s/g, "")}`}><b>{c.code}</b></Link> {c.title}<div className="small">{c.department}</div></td><td>{c.offered}</td><td className="small">{c.prerequisites.slice(0, 140)}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </Card>
      {!plan && <p><span className="spin" aria-hidden /> Checking requirements…</p>}
      {plan && aggregate && (() => {
        const counts = { remaining: plan.requirements.filter((r) => r.status === "remaining").length, in_progress: plan.requirements.filter((r) => r.status === "in_progress").length, complete: done.length };
        const shown = plan.requirements.filter((r) => (show === "open" ? r.status !== "complete" : r.status === show));
        const slips = plan.slips.filter((s) => s.slipTerms > 0);
        return (
          <>
            <section className="stack" aria-labelledby="req-h">
              <h2 id="req-h">Remaining requirements</h2>
              <div className="stat-grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
                <Stat icon="check" label="Done" value={`${aggregate.done} hrs`} />
                <Stat icon="chart" label="In progress" value={`${aggregate.prog} hrs`} />
                <Stat icon="layers" label="Needed across groups" value={`${aggregate.need} hrs`} />
              </div>
              <p className="small">Hours can count in more than one group, so groups do not add to 120.</p>
              <div className="tabs" role="tablist" aria-label="Filter requirements">
                {([["open", `Still open (${counts.remaining + counts.in_progress})`], ["remaining", `Still needed (${counts.remaining})`], ["in_progress", `In progress (${counts.in_progress})`], ["complete", `Done (${counts.complete})`]] as const).map(([k, label]) => (
                  <button key={k} role="tab" aria-selected={show === k} className="tab" onClick={() => setShow(k)}>{label}</button>
                ))}
              </div>
              <Card><div className="stack" style={{ gap: 20 }}>{shown.map((r) => <RequirementRow key={r.id} r={r} chosen={chosenFor(plan, r)} />)}{!shown.length && <p className="small">Nothing in this group.</p>}</div></Card>
            </section>
            {slips.length > 0 && (
              <section className="stack" aria-labelledby="slip-h">
                <h2 id="slip-h">Courses where a miss costs a term</h2>
                <div className="three">
                  {slips.map((s) => (
                    <div key={s.code} className="mini">
                      <h3><Icon name="alert" size={16} /><Link href={`/course/${s.code}`}>{s.code.replace(/^([A-Z]+)(\d+)$/, "$1 $2")}</Link></h3>
                      <span>{s.title}</span>
                      <span className="badge b-warn" style={{ alignSelf: "flex-start" }}>about {s.slipTerms} term{s.slipTerms > 1 ? "s" : ""} later if missed</span>
                    </div>
                  ))}
                </div>
                <p className="small">Engine calculation (slip test) from the catalog&apos;s typical offering pattern.</p>
              </section>
            )}
          </>
        );
      })()}
    </div>
  );
}
