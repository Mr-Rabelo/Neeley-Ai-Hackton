"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useStudent } from "@/components/StudentContext";
import { NeedStudent } from "@/components/Bits";
import { MarketPanel, useMarket } from "@/components/MarketPanel";
import { getJson } from "@/lib/client";

interface Prog { id: string; name: string }

const MAP: Record<string, string> = { "business info": "bis", finance: "finance", accounting: "accounting", marketing: "marketing", management: "management", supply: "scm", entrepreneur: "entrepreneurship" };

export default function Careers() {
  const { record, ready } = useStudent();
  const [progs, setProgs] = useState<Prog[]>([]);
  const [major, setMajor] = useState<string | null>(null);
  useEffect(() => { getJson<{ majors: Prog[] }>("/api/programs").then((r) => setProgs(r.majors)).catch(() => undefined); }, []);
  const mine = (record?.plans ?? []).map((p) => Object.entries(MAP).find(([k]) => p.toLowerCase().includes(k))?.[1]).filter((x): x is string => !!x);
  useEffect(() => { if (!major && mine.length) setMajor(mine[0]); }, [mine, major]);
  const { data, err } = useMarket(major);
  if (!ready) return <p>Loading…</p>;
  if (!record) return <NeedStudent />;
  return (
    <div className="stack-lg">
      <div className="stack"><div className="eyebrow">Careers</div><h1 className="page-title">Where each major can lead</h1><p className="lede">Demand, growth, pay and routes from the U.S. Bureau of Labor Statistics and the TCU catalog. Possibilities to explore, not predictions.</p></div>
      <div className="row" role="group" aria-label="Choose a major">
        {progs.map((p) => <button key={p.id} className="chip" aria-pressed={major === p.id} onClick={() => setMajor(p.id)}>{p.name}{mine.includes(p.id) ? " (yours)" : ""}</button>)}
      </div>
      {err && <p role="alert">{err}</p>}
      {!data && !err && major && <p><span className="spin" aria-hidden /> Loading…</p>}
      {data && <MarketPanel data={data} aiIds={[data.market.majorId]} interests={record.plans.join(", ")} />}
      <p className="small">Want two majors side by side? <Link href={`/compare?a=${mine[0] ?? "finance"}&b=${mine[1] ?? "bis"}`}>Compare majors</Link>.</p>
    </div>
  );
}
