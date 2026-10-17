"use client";
import { useEffect, useState } from "react";
import type { PlanResult } from "@/lib/types";
import { useStudent } from "@/components/StudentContext";
import { NeedStudent } from "@/components/Bits";
import { PlanView } from "@/components/PlanView";
import { postJson } from "@/lib/client";

export default function PlanPage() {
  const { record, ready } = useStudent();
  const [plan, setPlan] = useState<PlanResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!record) return;
    postJson<{ plan: PlanResult }>("/api/plan", { record }).then((r) => setPlan(r.plan)).catch((e) => setErr(e.message));
  }, [record]);
  if (!ready) return <p>Loading…</p>;
  if (!record) return <NeedStudent />;
  return (
    <div className="stack-lg">
      <div className="stack"><div className="eyebrow">{record.isSample ? "Sample student" : "Your plan"}</div><h1 className="page-title">Your degree plan</h1><p className="lede">Built by the planning engine from the 2026-27 catalog. Courses labeled &quot;usually offered&quot; follow the catalog&apos;s typical pattern; the schedule for those terms has not been published.</p></div>
      {err && <div className="banner" role="alert"><span aria-hidden>!</span><div>{err}</div></div>}
      {!plan && !err && <p><span className="spin" aria-hidden /> Checking prerequisites, offerings and delays…</p>}
      {plan && <PlanView plan={plan} record={record} />}
    </div>
  );
}
