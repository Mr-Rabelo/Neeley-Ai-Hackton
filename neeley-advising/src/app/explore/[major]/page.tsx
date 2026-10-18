"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import type { PlanResult } from "@/lib/types";
import { MarketPanel, useMarket } from "@/components/MarketPanel";
import { PlanView } from "@/components/PlanView";
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
      <section className="stack"><h2>Job market and routes</h2>{data ? <MarketPanel data={data} aiIds={[major]} /> : <p><span className="spin" aria-hidden /> Loading…</p>}</section>
      <div className="row"><Link className="btn" href="/next">Next steps</Link><Link className="btn btn-ghost" href={`/compare?a=${major}`}>Compare with another major</Link><Link className="btn btn-ghost" href="/chat">Ask the assistant</Link></div>
    </div>
  );
}
