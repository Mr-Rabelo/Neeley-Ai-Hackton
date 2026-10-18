"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { PlanResult } from "@/lib/types";
import { buildFindingsReport, reportToCsv } from "@/lib/report";
import { useStudent } from "@/components/StudentContext";
import { Card, NeedStudent } from "@/components/Bits";
import { Icon, Stat } from "@/components/ui";
import { postJson } from "@/lib/client";
import { ChallengeButton } from "@/components/ChallengeButton";

const SEV_LABEL = { blocker: "Blocker", warning: "Warning", info: "Note" } as const;
const SEV_CLS = { blocker: "b-bad", warning: "b-warn", info: "b-info" } as const;

export default function FindingsPage() {
  const { record, ready } = useStudent();
  const [plan, setPlan] = useState<PlanResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sev, setSev] = useState<"all" | "blocker" | "warning" | "info">("all");
  useEffect(() => {
    if (!record) return;
    postJson<{ plan: PlanResult }>("/api/plan", { record }).then((r) => setPlan(r.plan)).catch((e) => setErr(e.message));
  }, [record]);
  const rows = useMemo(() => (plan ? buildFindingsReport(plan) : []), [plan]);
  if (!ready) return <p>Loading…</p>;
  if (!record) return <NeedStudent />;

  const shown = rows.filter((r) => sev === "all" || r.severity === sev);
  const n = (s: string) => rows.filter((r) => r.severity === s).length;
  const bottleneckRow = rows.find((r) => /^Sharpest bottleneck/.test(r.finding));

  function download() {
    const blob = new Blob([reportToCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "neeley-findings-report.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="stack-lg printable">
      <div className="stack"><div className="eyebrow">{record.isSample ? "Sample student" : "Your plan"}</div><h1 className="page-title">Findings report</h1><p className="lede">Every issue the engine found, with the evidence behind it, what it could mean for the student, who it affects, and how confident we are. Impacts are estimates with their assumptions shown. Costs are not estimated.</p></div>
      {err && <div className="banner" role="alert"><span aria-hidden>!</span><div>{err}</div></div>}
      {!plan && !err && <p><span className="spin" aria-hidden /> Building the report…</p>}
      {plan && (
        <>
          <div className="banner" role="status"><span aria-hidden>▲</span><div><strong>Draft. Not reviewed by an advisor.</strong> This report restates the engine&apos;s findings in plain terms. It is not an official audit.</div></div>
          {plan.bottleneck && (
            <div className="callout">
              <div className="eyebrow">Sharpest bottleneck</div>
              <h3><Link href={`/course/${plan.bottleneck.code}`}>{plan.bottleneck.code.replace(/^([A-Z]+)(\d+)$/, "$1 $2")}</Link> {plan.bottleneck.title}</h3>
              <p>{plan.bottleneck.why}</p>
              {bottleneckRow && <p className="small"><b>Impact:</b> {bottleneckRow.impact} <b>Confidence:</b> {bottleneckRow.confidence}.</p>}
            </div>
          )}
          <div className="stat-grid">
            <Stat icon="alert" label="Blockers" value={n("blocker")} />
            <Stat icon="info" label="Warnings" value={n("warning")} />
            <Stat icon="check" label="Notes" value={n("info")} />
            <Stat icon="user" label="Need an advisor" value={rows.filter((r) => r.needsAdvisor).length} />
          </div>
          <div className="row-between no-print">
            <div className="tabs" role="tablist" aria-label="Filter by severity">
              {(["all", "blocker", "warning", "info"] as const).map((k) => <button key={k} role="tab" aria-selected={sev === k} className="tab" onClick={() => setSev(k)}>{k === "all" ? `All (${rows.length})` : `${SEV_LABEL[k]}s (${n(k)})`}</button>)}
            </div>
            <div className="row">
              <button className="btn btn-ghost btn-sm" onClick={download}><Icon name="upload" size={14} /> Download CSV</button>
              <button className="btn btn-ghost btn-sm" onClick={() => window.print()}>Print</button>
            </div>
          </div>
          <div className="stack" style={{ gap: 10 }}>
            {shown.map((r) => (
              <details key={r.id} className="collapse">
                <summary>
                  <span className="collapse-title"><span className={`badge ${SEV_CLS[r.severity]}`}>{SEV_LABEL[r.severity]}</span>{r.needsAdvisor && <span className="badge b-bad" style={{ marginLeft: 6 }}>Advisor</span>} <span style={{ marginLeft: 8 }}>{r.finding}</span></span>
                  <span className="collapse-chev" aria-hidden><Icon name="chevron" size={16} /></span>
                </summary>
                <div className="collapse-body stack" style={{ gap: 12 }}>
                  {r.fix && <p><b>Fix:</b> {r.fix}</p>}
                  <div><b>Evidence</b><ul className="plain">{r.evidence.map((e) => <li key={e}>{e}</li>)}</ul></div>
                  <div><b>Student impact</b><p>{r.impact}</p>{r.assumptions.length > 0 && <ul className="plain small">{r.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>}</div>
                  <p><b>Affected students:</b> {r.affected}</p>
                  <p><b>Confidence:</b> {r.confidence}</p>
                  <div className="no-print"><ChallengeButton id={r.id} message={r.finding} /></div>
                </div>
              </details>
            ))}
          </div>
          <Card title="How to read this"><p className="small">Evidence names the source record (for example S1 is the TCU 2026-27 catalog) and the courses involved. &quot;Engine calculation&quot; means the number comes from the planning engine, not from a document. Confidence is High when a rule is stated in the catalog, Medium when it rests on a usual pattern, and Low when it rests on an assumption.</p></Card>
        </>
      )}
    </div>
  );
}
