"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { PlanResult, ComparisonRow, StudentRecord } from "@/lib/types";
import type { SampleStudent } from "@/lib/samples";
import { useStudent } from "@/components/StudentContext";
import { Card } from "@/components/Bits";
import { postJson } from "@/lib/client";

type S = SampleStudent & { record: StudentRecord };
interface Out { plan: PlanResult; comparison?: ComparisonRow[]; gains?: string[]; costs?: string[] }
const pretty = (c: string) => c.replace(/^([A-Z]+)(\d+)$/, "$1 $2");

export default function SamplesPage() {
  const { loadRecord, record } = useStudent();
  const [list, setList] = useState<S[] | null>(null);
  const [out, setOut] = useState<Record<string, Out>>({});
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/samples").then((r) => r.json()).then((d) => setList(d.students)).catch(() => setErr("Could not load the sample students."));
  }, []);

  async function run(s: S) {
    try {
      const base = await postJson<{ plan: PlanResult }>("/api/plan", { record: s.record });
      if (s.scenario === 2) {
        const a = await postJson<{ alternative: { plan: PlanResult; gains: string[]; costs: string[] }; comparison: ComparisonRow[] }>("/api/alternatives", { record: s.record, kind: "add_minor", minorId: "accounting-minor" });
        setOut((o) => ({ ...o, [s.id]: { plan: base.plan, comparison: a.comparison, gains: a.alternative.gains, costs: a.alternative.costs } }));
      } else setOut((o) => ({ ...o, [s.id]: { plan: base.plan } }));
    } catch (e) { setErr(e instanceof Error ? e.message : "Could not run that scenario."); }
  }

  return (
    <div className="stack-lg">
      <div className="stack"><div className="eyebrow">Test cases</div><h1 className="page-title">Five sample students</h1><p className="lede">Fictional students built from the structure of the sample transcript, with invented names. They exist so the four required scenarios can be run end to end. None is a real person, and no plan here has been reviewed by an advisor.</p></div>
      {err && <div className="banner" role="alert"><span aria-hidden>!</span><div>{err}</div></div>}
      {!list && !err && <p><span className="spin" aria-hidden /> Loading…</p>}
      {list?.map((s) => {
        const o = out[s.id];
        const p = o?.plan;
        return (
          <Card key={s.id}>
            <div className="row-between">
              <div><div className="eyebrow">{s.scenario ? `Scenario ${s.scenario}` : "Extra profile"}</div><h3>{s.name}: {s.headline}</h3></div>
              <div className="row">
                <button className="btn btn-ghost btn-sm" onClick={() => run(s)}>Run scenario</button>
                <button className="btn btn-sm" onClick={() => loadRecord(s.record, `Fictional sample student: ${s.name}`)}>{record?.name === s.record.name ? "Loaded" : "Open as this student"}</button>
              </div>
            </div>
            <p style={{ marginTop: 8 }}>{s.story}</p>
            <p className="small"><b>What it should show:</b> {s.expect}</p>
            <p className="small">{s.record.plans.join(" · ")} · catalog term {s.record.catalogTermId.replace("-", " ")}</p>
            {p && (
              <div className="callout stack" style={{ marginTop: 12 }}>
                <p><b>Expected finish:</b> {p.earliestGraduation.label ?? "not determined"} ({p.earliestGraduation.confidence.replace("_", " ")}) · {p.totalCredits} credits · {p.findings.filter((f) => f.severity === "blocker").length} blockers · {p.findings.filter((f) => f.severity === "warning").length} warnings</p>
                {s.scenario === 1 && <p>{p.bottleneck ? `Sharpest bottleneck: ${pretty(p.bottleneck.code)} ${p.bottleneck.title}. ` : ""}{p.slips.length} single-course misses would add a term. The plan is a draft until an advisor reviews it.</p>}
                {s.scenario === 2 && o.comparison && (
                  <>
                    <div className="table-wrap"><table className="report"><thead><tr><th scope="col">Measure</th><th scope="col">Current plan</th><th scope="col">With accounting minor</th></tr></thead><tbody>{o.comparison.slice(0, 6).map((r) => <tr key={r.key}><td>{r.label}</td>{Object.values(r.values).slice(0, 2).map((v, i) => <td key={i}>{v}</td>)}</tr>)}</tbody></table></div>
                    <ul className="plain small">{[...(o.gains ?? []), ...(o.costs ?? [])].map((x) => <li key={x}>{x}</li>)}</ul>
                  </>
                )}
                {s.scenario === 3 && p.bottleneck && (
                  <>
                    <p><b>Bottleneck:</b> {pretty(p.bottleneck.code)} {p.bottleneck.title}, which holds up {p.bottleneck.descendants} later courses. {p.bottleneck.why}</p>
                    {p.slips.length > 0 && <p className="small">If missed once: {p.slips.slice(0, 3).map((x) => `${pretty(x.code)} (+${x.slipTerms} term${x.slipTerms > 1 ? "s" : ""})`).join(", ")}.</p>}
                    <p className="small">An alternative is only offered when the catalog lists one. Otherwise the plan says so and asks an advisor.</p>
                  </>
                )}
                {s.scenario === 4 && (
                  <>
                    <p><b>Uncertainty detected.</b> Completeness {Math.round(p.completeness * 100)}% · {p.unverified.length} unverified items · {p.findings.filter((f) => f.needsAdvisor).length} findings need an advisor. This plan is not presented as fact.</p>
                    <ul className="plain small">{[...p.findings.filter((f) => /catalog|transfer/i.test(f.message) && f.type === "missing_info"), ...p.findings.filter((f) => f.type === "unverified")].slice(0, 5).map((f) => <li key={f.id}>{f.message}</li>)}</ul>
                    <p className="small">Next step: <Link href="/next">ask an advisor to review</Link>. Nothing here clears a student to graduate.</p>
                  </>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
