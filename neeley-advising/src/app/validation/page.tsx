"use client";
import { useEffect, useState } from "react";
import { Card } from "@/components/Bits";
import type { Check } from "@/lib/validate";

interface Result { id: string; name: string; scenario: number | null; plans: string[]; finish: string | null; checks: Check[] }
const TONE = { pass: "b-good", fail: "b-bad", labelled: "b-info" } as const;
const WORD = { pass: "Pass", fail: "Fail", labelled: "Labelled" } as const;

export default function ValidationPage() {
  const [res, setRes] = useState<Result[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { fetch("/api/validation").then((r) => r.json()).then((d) => setRes(d.results)).catch(() => setErr("Could not run the validation.")); }, []);
  const fails = res?.flatMap((r) => r.checks.filter((c) => c.status === "fail").map((c) => ({ who: r.name, ...c }))) ?? [];
  return (
    <div className="wrap stack-lg">
      <div className="stack"><div className="eyebrow">Validation</div><h1 className="page-title">Did the plans hold up?</h1><p className="lede">An independent re-check of every plan against the case brief&apos;s validation list. It runs live each time you open this page. It does not reuse the planner&apos;s placement logic, so a planner bug can show up here as a failure. Failures are listed, not hidden.</p></div>
      <div className="banner" role="status"><span aria-hidden>▲</span><div><strong>Not yet independently reviewed.</strong> The brief asks for a qualified advisor or registrar to verify the test plans. That has not happened. Everything here is the team&apos;s own checking, on sample and fictional students.</div></div>
      {err && <div className="banner" role="alert"><span aria-hidden>!</span><div>{err}</div></div>}
      {!res && !err && <p><span className="spin" aria-hidden /> Running checks…</p>}
      {res && (
        <>
          <Card title={`Failures found: ${fails.length}`}>
            {fails.length ? <ul className="plain">{fails.map((f) => <li key={f.who + f.id}><b>{f.who}</b>: {f.label}. {f.detail}</li>)}</ul> : <p>None.</p>}
            {fails.some((f) => f.id === "prereq") && <p className="small" style={{ marginTop: 8 }}>The prerequisite failure is real: a catalog line allows &quot;concurrent enrollment&quot; in another course, and the planner placed the first course without adding the second. A fix is on the improvement list; it was not hidden by loosening this check.</p>}
          </Card>
          <div className="table-wrap">
            <table className="report">
              <thead><tr><th scope="col">Check (from section 5 of the brief)</th>{res.map((r) => <th key={r.id} scope="col">{r.name.replace(" (supplied transcript)", "")}</th>)}</tr></thead>
              <tbody>
                {res[0].checks.map((c, i) => (
                  <tr key={c.id}>
                    <td>{c.label}</td>
                    {res.map((r) => { const k = r.checks[i]; return <td key={r.id}><span className={`badge ${TONE[k.status]}`}>{WORD[k.status]}</span><details><summary className="small">Detail</summary><p className="small">{k.detail}</p></details></td>; })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Card title="How to read this"><p className="small"><b>Pass</b> means the check found nothing wrong. <b>Fail</b> means it found a problem. <b>Labelled</b> means the item cannot be verified with the supplied data (no live schedule, no published seat counts, no stated maximum load), so the app marks it as an assumption instead of claiming it is right. A plan that passes still is not an official audit and clears no one to graduate.</p></Card>
        </>
      )}
    </div>
  );
}
