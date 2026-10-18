"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { PlanResult } from "@/lib/types";
import { useStudent } from "@/components/StudentContext";
import { Card, NeedStudent } from "@/components/Bits";
import { RequirementRow } from "@/components/PlanView";
import { getJson, postJson } from "@/lib/client";

interface Row { code: string; title: string; department: string; offered: string; prerequisites: string }

export default function CoursesPage() {
  const { record, ready } = useStudent();
  const [plan, setPlan] = useState<PlanResult | null>(null);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [searched, setSearched] = useState(false);
  useEffect(() => { if (record) postJson<{ plan: PlanResult }>("/api/plan", { record }).then((r) => setPlan(r.plan)).catch(() => undefined); }, [record]);
  useEffect(() => {
    if (q.trim().length < 2) { setRows([]); setSearched(false); return; }
    const t = setTimeout(() => getJson<{ courses: Row[] }>(`/api/courses?q=${encodeURIComponent(q)}`).then((r) => { setRows(r.courses); setSearched(true); }).catch(() => undefined), 250);
    return () => clearTimeout(t);
  }, [q]);
  if (!ready) return <p>Loading…</p>;
  if (!record) return <NeedStudent />;
  const open = plan?.requirements.filter((r) => r.status !== "complete") ?? [];
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
      {plan && aggregate && (
        <>
          <Card title="Remaining requirements">
            <p className="small" style={{ marginBottom: 14 }}>Across all groups: {aggregate.done} hours done, {aggregate.prog} in progress, {aggregate.need} needed. Hours can count in more than one group, so groups do not add to 120.</p>
            <div className="stack" style={{ gap: 20 }}>{open.map((r) => <RequirementRow key={r.id} r={r} />)}</div>
          </Card>
          <details><summary>Completed requirements ({done.length})</summary><div className="stack" style={{ gap: 16, marginTop: 12 }}>{done.map((r) => <RequirementRow key={r.id} r={r} />)}</div></details>
          {plan.slips.filter((s) => s.slipTerms > 0).length > 0 && (
            <Card title="Courses where a miss costs a term">
              <ul className="stack" style={{ gap: 8, paddingLeft: 18, margin: 0 }}>{plan.slips.filter((s) => s.slipTerms > 0).map((s) => <li key={s.code}><Link href={`/course/${s.code}`}>{s.code.replace(/^([A-Z]+)(\d+)$/, "$1 $2")}</Link> {s.title}: about {s.slipTerms} term{s.slipTerms > 1 ? "s" : ""} later if missed</li>)}</ul>
              <p className="small" style={{ marginTop: 10 }}>Engine calculation (slip test) from the catalog&apos;s typical offering pattern.</p>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
