"use client";
import Link from "next/link";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import type { MarketData } from "@/components/MarketPanel";
import { Card } from "@/components/Bits";
import { ApiError, getJson, postJson } from "@/lib/client";

interface Prog { id: string; name: string; totalHours: number | string; page: number; required: { code: string; title: string; associated: boolean }[]; groups: { label: string; hours: number }[]; writingEmphasisHours: number | null }

const money = (n: number) => `$${n.toLocaleString("en-US")}`;

function Inner() {
  const sp = useSearchParams();
  const [progs, setProgs] = useState<Prog[]>([]);
  const [a, setA] = useState(sp.get("a") ?? "finance");
  const [b, setB] = useState(sp.get("b") ?? "bis");
  const [da, setDa] = useState<MarketData | null>(null);
  const [db, setDb] = useState<MarketData | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { getJson<{ majors: Prog[] }>("/api/programs").then((r) => setProgs(r.majors)).catch(() => undefined); }, []);
  useEffect(() => { setDa(null); setAnalysis(null); getJson<MarketData>(`/api/market/${a}`).then(setDa).catch(() => undefined); }, [a]);
  useEffect(() => { setDb(null); setAnalysis(null); getJson<MarketData>(`/api/market/${b}`).then(setDb).catch(() => undefined); }, [b]);

  const pa = progs.find((p) => p.id === a);
  const pb = progs.find((p) => p.id === b);
  async function run() {
    setBusy(true); setNote(null);
    try { setAnalysis((await postJson<{ analysis: string }>("/api/market/analysis", { majorIds: [a, b] })).analysis); } catch (e) { setNote(e instanceof ApiError ? e.message : "Could not write the analysis."); } finally { setBusy(false); }
  }
  const Pick = ({ v, set, label }: { v: string; set: (s: string) => void; label: string }) => (
    <div className="field"><label htmlFor={label}>{label}</label><select id={label} value={v} onChange={(e) => set(e.target.value)}>{progs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
  );
  const cell = (d: MarketData | null, f: (d: MarketData) => string) => (d ? f(d) : "…");
  const rows: [string, (d: MarketData | null, p?: Prog) => ReactNode][] = [
    ["Catalog hours for the major", (_d, p) => (p ? `${p.totalHours} hours (catalog p.${p.page})` : "…")],
    ["Required courses", (_d, p) => (p ? <details><summary>{p.required.length} courses</summary><ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>{p.required.map((r) => <li key={r.code}>{r.code} {r.title}</li>)}</ul></details> : "…")],
    ["Choice requirements", (_d, p) => (p ? p.groups.map((g) => `${g.hours} hrs: ${g.label}`).join("; ") || "None" : "…")],
    ["Difficulty (estimate)", (d) => cell(d, (x) => `${x.difficulty.label}. ${x.difficulty.inputs.longestPrerequisiteChain}-course prerequisite chain, ${Math.round(x.difficulty.inputs.quantitativeShare * 100)}% quantitative`)],
    ["Demand outlook (BLS)", (d) => cell(d, (x) => `${x.market.outlookLabel}: ${x.market.aggregate.weightedGrowthPct10}% over ${x.market.period}`)],
    ["Estimated growth, 3 and 5 years", (d) => cell(d, (x) => `${x.market.aggregate.est3yrPct}% and ${x.market.aggregate.est5yrPct}% (interpolated estimates)`)],
    ["Median pay (2025)", (d) => cell(d, (x) => `${money(x.market.aggregate.medianPayLow)}${x.market.aggregate.medianPayHigh !== x.market.aggregate.medianPayLow ? ` to ${money(x.market.aggregate.medianPayHigh)}` : ""}`)],
    ["Job openings per year", (d) => cell(d, (x) => x.market.aggregate.openingsPerYear.toLocaleString("en-US"))],
    ["Typical routes (catalog)", (d) => cell(d, (x) => x.market.routes.join("; "))],
    ["Example roles (BLS)", (d) => cell(d, (x) => x.market.occupations.map((o) => o.title).join("; "))],
    ["Skills built", (d) => cell(d, (x) => x.market.skills.map((s) => s.skill).join(", "))],
  ];
  return (
    <div className="wrap stack-lg">
      <div className="stack"><div className="eyebrow">Compare majors</div><h1 className="page-title">Two majors, side by side</h1><p className="lede">Required courses from the catalog, difficulty estimated from course structure, and job market data from the Bureau of Labor Statistics. Possibilities, not guarantees.</p></div>
      <div className="grid grid-2"><Pick v={a} set={setA} label="First major" /><Pick v={b} set={setB} label="Second major" /></div>
      <div className="table-wrap">
        <table>
          <thead><tr><th scope="col">&nbsp;</th><th scope="col">{pa?.name ?? a}</th><th scope="col">{pb?.name ?? b}</th></tr></thead>
          <tbody>{rows.map(([label, f]) => <tr key={label}><th scope="row" style={{ background: "transparent", textTransform: "none", letterSpacing: 0, fontSize: 15, color: "inherit", minWidth: 150 }}>{label}</th><td>{f(da, pa)}</td><td>{f(db, pb)}</td></tr>)}</tbody>
        </table>
      </div>
      <p className="small">Sources: TCU Undergraduate 2026-2027 Catalog (S1); BLS Occupational Outlook Handbook, 2025-35 projections, pages last modified Aug. 27, 2026 (S5). Difficulty compares structure only and says nothing about anyone&apos;s grades. {da?.market.disclaimer}</p>
      <Card title="AI comparison">
        {analysis ? <div style={{ whiteSpace: "pre-wrap" }}>{analysis}</div> : <p className="small">Claude can write a plain-language comparison of the two majors using only the data above, including 3 to 5 year demand and growth, and end with the trade-offs.</p>}
        {note && <p className="small" role="alert" style={{ marginTop: 8 }}>{note}</p>}
        <div style={{ marginTop: 12 }}><button className="btn btn-sm" onClick={run} disabled={busy || a === b}>{busy ? "Writing…" : analysis ? "Write it again" : "Write an AI comparison"}</button></div>
      </Card>
      <div className="row"><Link className="btn" href={`/explore/${a}`}>Sample plan: {pa?.name ?? a}</Link><Link className="btn btn-ghost" href={`/explore/${b}`}>Sample plan: {pb?.name ?? b}</Link><Link className="btn btn-ghost" href="/next">Next steps</Link></div>
    </div>
  );
}

export default function Compare() { return <Suspense fallback={<div className="wrap"><p>Loading…</p></div>}><Inner /></Suspense>; }
