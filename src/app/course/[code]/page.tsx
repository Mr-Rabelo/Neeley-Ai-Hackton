"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import calendar from "../../../../data/catalog/calendar.json";
import { useStudent } from "@/components/StudentContext";
import { Card, ConfBadge, Src } from "@/components/Bits";
import { getJson } from "@/lib/client";
import type { StudentRecord } from "@/lib/types";

interface Detail {
  error?: string;
  code: string; title: string; credits: number; department: string; description: string;
  prerequisitesAsWritten: string; prerequisitesParsed: string; corequisites: string[]; otherConditions: string[];
  wordingNeedsHumanReading: boolean; otherEntryPaths: boolean;
  typicallyOffered: { pattern: string; confidence: string; note: string };
  unlocks: string[]; prereqCodes: string[]; unlockCodes: string[]; countsTowardPrograms: string[];
  offeredTerms: string[]; offeredUnknown: boolean; offeredRare: boolean; offeredAlternating: boolean;
  yourStatus?: { status: string; grade: string; term: string };
  seats: string; source: { id: string; page: number; title: string };
}

const pretty = (c: string) => c.replace(/^([A-Z]+)(\d+)$/, "$1 $2");
const UPCOMING = ["2027-Spring", "2027-Summer", "2027-Fall", "2028-Spring", "2028-Fall"];

function statusOf(code: string, rec: StudentRecord | null): { cls: string; text: string } {
  const c = rec?.courses.find((x) => x.code === code && x.status !== "withdrawn");
  if (!c) return { cls: "s-todo", text: rec ? "Not taken" : "" };
  if (c.status === "in_progress") return { cls: "s-prog", text: "In progress" };
  if (c.status === "completed") return { cls: "s-done", text: c.transfer ? "Transfer credit" : `Completed (${c.grade})` };
  return { cls: "s-todo", text: c.status };
}

export default function CoursePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { record } = useStudent();
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { setD(null); setErr(null); getJson<Detail>(`/api/courses/${encodeURIComponent(code)}`).then(setD).catch((e) => setErr(e.message)); }, [code]);
  if (err) return <div className="wrap"><div className="card stack"><h2>Course not found</h2><p>{err}</p><div><Link className="btn" href="/student/courses">Search courses</Link></div></div></div>;
  if (!d) return <div className="wrap"><p><span className="spin" aria-hidden /> Loading…</p></div>;
  const cal = calendar.terms as Record<string, { date: string; label: string; page: number }[]>;
  const flat = d.code.replace(/\s/g, "");
  return (
    <div className="wrap stack-lg">
      <div className="stack">
        <div className="eyebrow">{d.department}</div>
        <h1 className="page-title">{d.code} · {d.title}</h1>
        <p className="lede">{d.credits} credit hours. {d.yourStatus && <span className="badge b-neutral">Your status: {d.yourStatus.status.replace("_", " ")} ({d.yourStatus.grade})</span>}</p>
      </div>

      <Card title="Course tree">
        <div className="tree">
          <div className="tree-col"><h4>Prerequisites</h4>{d.prereqCodes.length ? d.prereqCodes.map((c) => { const s = statusOf(c, record); return <Link key={c} href={`/course/${c}`} className={`node ${s.cls}`}><b>{pretty(c)}</b>{s.text && <small>{s.text}</small>}</Link>; }) : <div className="small">No course prerequisites listed.</div>}</div>
          <div className="node center"><b style={{ fontSize: 18 }}>{d.code}</b><small>{d.title}</small></div>
          <div className="tree-col"><h4>Unlocks</h4>{d.unlockCodes.length ? d.unlockCodes.slice(0, 8).map((c) => { const s = statusOf(c, record); return <Link key={c} href={`/course/${c}`} className={`node ${s.cls}`}><b>{pretty(c)}</b>{s.text && <small>{s.text}</small>}</Link>; }) : <div className="small">No other Neeley program course lists this as a prerequisite.</div>}</div>
        </div>
        <p className="small" style={{ marginTop: 14 }}>Solid green edge: completed. Dashed green: in progress. Grey: not taken. The tree covers Neeley program courses. <Src id={d.source.id} page={d.source.page} /></p>
      </Card>

      <div className="grid grid-2">
        <Card title="Details">
          <p>{d.description}{d.description.length >= 600 ? "…" : ""}</p>
          <dl className="stack" style={{ gap: 8, margin: "14px 0 0" }}>
            <div><dt className="small">Prerequisites as written</dt><dd style={{ margin: 0 }}>{d.prerequisitesAsWritten}</dd></div>
            <div><dt className="small">How the engine reads them</dt><dd style={{ margin: 0 }}>{d.prerequisitesParsed}{d.wordingNeedsHumanReading && <> <span className="badge b-warn">Wording needs human reading</span></>}{d.otherEntryPaths && <> <span className="badge b-info">Other entry paths exist</span></>}</dd></div>
            {d.corequisites.length > 0 && <div><dt className="small">Corequisites</dt><dd style={{ margin: 0 }}>{d.corequisites.map(pretty).join(", ")}</dd></div>}
            {d.otherConditions.length > 0 && <div><dt className="small">Other conditions (not verified by the engine)</dt><dd style={{ margin: 0 }}>{d.otherConditions.join("; ")}</dd></div>}
            {d.countsTowardPrograms.length > 0 && <div><dt className="small">Counts toward</dt><dd style={{ margin: 0 }}>{d.countsTowardPrograms.join(", ")}</dd></div>}
          </dl>
        </Card>
        <Card title="When it is offered">
          <p><b>{d.typicallyOffered.pattern}</b> <ConfBadge c={d.typicallyOffered.confidence} /></p>
          <p className="small" style={{ margin: "6px 0 12px" }}>{d.typicallyOffered.note}</p>
          <div className="table-wrap"><table>
            <thead><tr><th scope="col">Term</th><th scope="col">Expected</th></tr></thead>
            <tbody>{UPCOMING.map((t) => { const [y, n] = t.split("-"); const on = d.offeredTerms.includes(n); return <tr key={t}><td>{n} {y}</td><td>{d.offeredRare ? "Rarely offered" : d.offeredUnknown ? "Unknown: confirm with the department" : on ? (d.offeredAlternating ? "Maybe (alternating years)" : "Usually offered, not published") : "Not typical"}</td></tr>; })}</tbody>
          </table></div>
          <p className="small" style={{ marginTop: 8 }}>Source: catalog &quot;Course Typically Offered&quot; <Src id="S1" page={d.source.page} />. A past pattern is not a promise.</p>
        </Card>
      </div>

      <div className="grid grid-2">
        <Card title="Milestones and dates">
          <p className="small" style={{ marginBottom: 8 }}>Official term dates from the academic calendar <Src id="S1" page={15} />. Registration-opening and add/drop deadlines are not in the supplied catalog pages.</p>
          {Object.entries(cal).map(([term, evs]) => (
            <details key={term} style={{ marginBottom: 6 }}><summary>{term.replace("-", " ")}</summary><ul className="small" style={{ margin: "6px 0 0", paddingLeft: 18 }}>{evs.map((e) => <li key={e.date + e.label}>{new Date(e.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}: {e.label}</li>)}</ul></details>
          ))}
        </Card>
        <Card title="Seats and sections">
          <p>{d.seats}</p>
          <p className="small" style={{ marginTop: 8 }}>Live section data would come from a registrar or Stellic integration, which needs an authorized token from TCU.</p>
          <div className="row" style={{ marginTop: 14 }}>
            <Link className="btn btn-sm" href={`/student/chat?q=${encodeURIComponent(`Tell me about ${d.code}`)}`}>Ask the AI about this course</Link>
            <Link className="btn btn-ghost btn-sm" href="/next">Talk to an advisor</Link>
          </div>
          <p className="small" style={{ marginTop: 10 }}>Catalog reference: {flat}, page {d.source.page}.</p>
        </Card>
      </div>
    </div>
  );
}
