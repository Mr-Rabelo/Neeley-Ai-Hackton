"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import type { PlanResult } from "@/lib/types";
import { MarketPanel, useMarket } from "@/components/MarketPanel";
import { PlanView } from "@/components/PlanView";
import { Collapse, Stat } from "@/components/ui";
import { getJson } from "@/lib/client";

export default function Explore({ params }: { params: Promise<{ major: string }> }) {
  const { major } = use(params);
  const [plan, setPlan] = useState<PlanResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const { data } = useMarket(major);
  useEffect(() => { getJson<{ plan: PlanResult }>(`/api/sample-plan?major=${major}`).then((r) => setPlan(r.plan)).catch((e) => setErr(e.message)); }, [major]);
  return (
    <div className="wrap stack-lg">
      <div className="stack"><div className="eyebrow">Sample four-year plan</div><h1 className="page-title">{data?.market.majorName ?? plan?.label.replace("Sample plan: ", "") ?? "Explore a major"}</h1><p className="lede">What four years could look like from zero credits, starting Fall 2027. This is a sample, not a prediction for you. Transfer, AP and dual credit would change it.</p></div>
      {err && <div className="banner" role="alert"><span aria-hidden>!</span><div>{err}</div></div>}
      {!plan && !err && <p><span className="spin" aria-hidden /> Building the plan…</p>}
      {plan && <PlanView plan={plan} />}
      <section className="stack" aria-labelledby="mk-h">
        <h2 id="mk-h">Job market and routes</h2>
        {data ? (
          <>
            <div className="banner banner-info" role="note"><span aria-hidden>i</span><div><b>Possibilities, not guarantees.</b> {data.market.disclaimer.replace(/^Possibilities, not guarantees\.\s*/, "")}</div></div>
            <div className="stat-grid">
              <Stat icon="chart" label="Outlook" value={data.market.outlookLabel} note={`${data.market.aggregate.weightedGrowthPct10}% over ${data.market.period} (BLS)`} />
              <Stat icon="flag" label="Estimated 3 years" value={`${data.market.aggregate.est3yrPct > 0 ? "+" : ""}${data.market.aggregate.est3yrPct}%`} note="Interpolated estimate, not a BLS figure" />
              <Stat icon="target" label="Estimated 5 years" value={`${data.market.aggregate.est5yrPct > 0 ? "+" : ""}${data.market.aggregate.est5yrPct}%`} note="Interpolated estimate, not a BLS figure" />
              <Stat icon="layers" label="Median pay, 2025" value={`$${data.market.aggregate.medianPayLow.toLocaleString("en-US")}${data.market.aggregate.medianPayHigh !== data.market.aggregate.medianPayLow ? ` to $${data.market.aggregate.medianPayHigh.toLocaleString("en-US")}` : ""}`} note="Across example roles" />
            </div>
            <Collapse title="See roles, routes and skills" hint="BLS roles, catalog routes, difficulty, AI analysis">
              <MarketPanel data={data} aiIds={[major]} compact />
            </Collapse>
          </>
        ) : <p><span className="spin" aria-hidden /> Loading…</p>}
      </section>
      <div className="row"><Link className="btn" href="/next">Next steps</Link><Link className="btn btn-ghost" href={`/compare?a=${major}`}>Compare with another major</Link><Link className="btn btn-ghost" href="/chat">Ask the assistant</Link></div>
    </div>
  );
}
