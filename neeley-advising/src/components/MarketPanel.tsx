"use client";
import { Bullets } from "./Bullets";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { DifficultyView, MarketView } from "@/lib/market";
import { getJson, postJson, ApiError } from "@/lib/client";
import { Card, Src } from "./Bits";
import { Stat } from "./ui";

const money = (n: number) => `$${n.toLocaleString("en-US")}`;
const pct = (n: number) => `${n > 0 ? "+" : ""}${n}%`;

export interface MarketData { market: MarketView; difficulty: DifficultyView }

export function useMarket(majorId: string | null) {
  const [data, setData] = useState<MarketData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!majorId) return;
    let live = true;
    setData(null); setErr(null);
    getJson<MarketData>(`/api/market/${majorId}`).then((d) => live && setData(d)).catch((e) => live && setErr(e.message));
    return () => { live = false; };
  }, [majorId]);
  return { data, err };
}

export function MarketPanel({ data, aiIds, interests, compact }: { data: MarketData; aiIds?: string[]; interests?: string; compact?: boolean }) {
  const m = data.market;
  const d = data.difficulty;
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  async function run() {
    setBusy(true); setNote(null);
    try {
      const r = await postJson<{ analysis: string }>("/api/market/analysis", { majorIds: aiIds ?? [m.majorId], interests });
      setAnalysis(r.analysis);
    } catch (e) {
      setNote(e instanceof ApiError ? e.message : "Could not write the analysis.");
    } finally { setBusy(false); }
  }
  return (
    <div className="stack">
      <div className="banner banner-info" role="note"><span aria-hidden>i</span><div><b>Possibilities, not guarantees.</b> {m.disclaimer.replace(/^Possibilities, not guarantees\.\s*/, "")}</div></div>
      {!compact && <div className="stat-grid">
        <Stat icon="chart" label="Outlook" value={m.outlookLabel} note={`${m.aggregate.weightedGrowthPct10}% projected over ${m.period} (BLS)`} />
        <Stat icon="flag" label="Estimated 3 years" value={pct(m.aggregate.est3yrPct)} note="Interpolated estimate, not a BLS figure" />
        <Stat icon="target" label="Estimated 5 years" value={pct(m.aggregate.est5yrPct)} note="Interpolated estimate, not a BLS figure" />
        <Stat icon="layers" label="Median pay, 2025" value={<>{money(m.aggregate.medianPayLow)}{m.aggregate.medianPayHigh !== m.aggregate.medianPayLow ? ` to ${money(m.aggregate.medianPayHigh)}` : ""}</>} note="Across the roles below" />
      </div>}
      <div className="table-wrap">
        <table>
          <thead><tr><th scope="col">Example role (BLS)</th><th scope="col">Median pay</th><th scope="col">10-yr growth</th><th scope="col">Est. 3 / 5 yr</th><th scope="col">Openings per year</th></tr></thead>
          <tbody>
            {m.occupations.map((o) => (
              <tr key={o.id}>
                <td><a href={o.url} target="_blank" rel="noreferrer">{o.title}</a></td>
                <td className="mono">{money(o.medianPay)} ({o.payYear})</td>
                <td className="mono">{pct(o.growthPct)} ({m.period})</td>
                <td className="mono">{pct(o.est3yrPct)} / {pct(o.est5yrPct)}</td>
                <td className="mono">{o.openingsPerYear.toLocaleString("en-US")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small">Source: {m.source.title}, {m.source.owner}. Pages last modified Aug. 27, 2026; retrieved {m.retrieved}. <Src id="S5" /></p>
      <div className="grid grid-2">
        <Card title="Typical routes">
          <ul className="stack" style={{ gap: 8, paddingLeft: 18, margin: 0 }}>{m.routes.map((r) => <li key={r}>{r}</li>)}</ul>
          <p className="small" style={{ marginTop: 10 }}>From the TCU catalog <Src id={m.routesSource.sourceId} page={m.routesSource.page} /></p>
          <p className="small" style={{ marginTop: 8 }}>{m.caveat}</p>
        </Card>
        <Card title="Skills this major builds">
          <ul className="stack" style={{ gap: 6, paddingLeft: 18, margin: 0 }}>{m.skillCourses.map((c) => <li key={c.code}><Link href={`/course/${c.code}`}>{c.code.replace(/^([A-Z]+)(\d+)$/, "$1 $2")}</Link> {c.title}</li>)}</ul>
        </Card>
      </div>
      <Card title={`Difficulty: ${d.label} (estimate)`}>
        <p>{d.note}</p>
        <p className="small" style={{ marginTop: 8 }}>Inputs: {d.inputs.requiredCourses} courses counted, {d.inputs.upperLevelCourses} upper-level, longest prerequisite chain {d.inputs.longestPrerequisiteChain} courses, {Math.round(d.inputs.quantitativeShare * 100)}% quantitative, {d.inputs.writingEmphasisHours} writing-emphasis hours.</p>
        <details style={{ marginTop: 8 }}><summary>How we calculated this</summary><p className="small" style={{ marginTop: 6 }}>{d.method}</p></details>
      </Card>
      <Card title="AI analysis" className="analysis-card">
        {analysis ? <><p className="eyebrow" style={{ marginBottom: 8 }}>Key takeaways</p><Bullets text={analysis} /></> : <p className="small">Claude can write a short plain-language read of this data, using only the numbers above.</p>}
        {note && <p className="small" role="alert" style={{ marginTop: 8 }}>{note}</p>}
        <div style={{ marginTop: 12 }}><button className="btn btn-sm" onClick={run} disabled={busy}>{busy ? "Writing…" : analysis ? "Write it again" : "Write an AI analysis"}</button></div>
      </Card>
    </div>
  );
}
