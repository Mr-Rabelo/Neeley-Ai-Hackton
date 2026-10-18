"use client";
import { useEffect, useMemo, useState } from "react";
import type { PlanResult, RequirementStatus, StudentRecord } from "@/lib/types";
import type { SampleStudent } from "@/lib/samples";
import { Card } from "@/components/Bits";
import { postJson } from "@/lib/client";

type S = SampleStudent & { record: StudentRecord };
const LAYERS: { key: RequirementStatus["category"][]; title: string; note: string }[] = [
  { key: ["core-curriculum"], title: "University-wide: TCU Core Curriculum", note: "Applies to every undergraduate, whatever the major." },
  { key: ["lower-division"], title: "Business lower division", note: "Courses due before declaring a business major." },
  { key: ["business-core"], title: "Business core", note: "Shared by all Neeley majors." },
  { key: ["major"], title: "Major", note: "Set by the program." },
  { key: ["minor"], title: "Minor", note: "Only when a minor is chosen." },
  { key: ["associated", "policy"], title: "Electives and credit-hour rules", note: "Free electives, pass/no-credit cap, total hours." },
];
const pretty = (c: string) => c.replace(/^([A-Z]+)(\d+)$/, "$1 $2");

function Column({ s, plan }: { s: S; plan: PlanResult }) {
  const shared = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const r of plan.requirements) for (const c of r.satisfiedBy) m.set(c, [...(m.get(c) ?? []), r.label]);
    return [...m.entries()].filter(([, v]) => v.length > 1);
  }, [plan]);
  return (
    <div className="stack">
      <h3>{s.name}</h3>
      <p className="small">{s.record.plans.join(" · ")} · {plan.totalCredits} credits in plan · finishes {plan.earliestGraduation.label ?? "n/a"}</p>
      {LAYERS.map((L) => {
        const rows = plan.requirements.filter((r) => L.key.includes(r.category));
        return (
          <section key={L.title} className="card">
            <h4>{L.title}</h4><p className="small">{L.note}</p>
            {!rows.length && <p className="small">None for this student.</p>}
            <ul className="plain">{rows.map((r) => <li key={r.id}><span className={`badge ${r.status === "complete" ? "b-good" : r.status === "in_progress" ? "b-info" : "b-warn"}`}>{r.status.replace("_", " ")}</span> {r.label.replace(/^Core Curriculum: /, "")} <span className="small">{r.hoursDone + r.hoursInProgress}/{r.hoursNeeded} h{r.remainingCourses.length ? ` · needs ${r.remainingCourses.slice(0, 3).map(pretty).join(", ")}${r.remainingCourses.length > 3 ? "…" : ""}` : ""}</span></li>)}</ul>
          </section>
        );
      })}
      <section className="card"><h4>Where requirements overlap</h4>{shared.length ? <ul className="plain small">{shared.slice(0, 8).map(([c, v]) => <li key={c}><b>{pretty(c)}</b> counts toward {v.join(" and ")}</li>)}</ul> : <p className="small">No course counts toward more than one requirement here.</p>}<p className="small">Whether one course may count twice is a catalog rule. Where the catalog is silent, the engine does not assume it and an advisor decides.</p></section>
    </div>
  );
}

export default function MapPage() {
  const [list, setList] = useState<S[] | null>(null);
  const [a, setA] = useState("riley");
  const [b, setB] = useState("sam");
  const [plans, setPlans] = useState<Record<string, PlanResult>>({});
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { fetch("/api/samples").then((r) => r.json()).then((d) => setList(d.students)).catch(() => setErr("Could not load the sample students.")); }, []);
  useEffect(() => {
    if (!list) return;
    for (const id of [a, b]) {
      const s = list.find((x) => x.id === id);
      if (s && !plans[id]) postJson<{ plan: PlanResult }>("/api/plan", { record: s.record }).then((r) => setPlans((p) => ({ ...p, [id]: r.plan }))).catch((e) => setErr(e.message));
    }
  }, [list, a, b, plans]);
  const sa = list?.find((x) => x.id === a);
  const sb = list?.find((x) => x.id === b);
  return (
    <div className="stack-lg">
      <div className="stack"><div className="eyebrow">Requirements map</div><h1 className="page-title">How the requirements fit together</h1><p className="lede">University-wide, major, minor, elective and credit-hour rules, side by side for two different students. Both are fictional sample students.</p></div>
      {err && <div className="banner" role="alert"><span aria-hidden>!</span><div>{err}</div></div>}
      {list && (
        <div className="grid-2">
          {[[a, setA, "Profile 1"], [b, setB, "Profile 2"]].map(([v, set, label]) => (
            <label key={label as string} className="stack" style={{ gap: 4 }}>{label as string}
              <select value={v as string} onChange={(e) => (set as (x: string) => void)(e.target.value)}>{list.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.record.plans.join(", ")})</option>)}</select>
            </label>
          ))}
        </div>
      )}
      <div className="grid-2" style={{ alignItems: "start" }}>
        {sa && plans[a] ? <Column s={sa} plan={plans[a]} /> : <p><span className="spin" aria-hidden /> Loading…</p>}
        {sb && plans[b] ? <Column s={sb} plan={plans[b]} /> : <p><span className="spin" aria-hidden /> Loading…</p>}
      </div>
      <Card><p className="small">Source: TCU Undergraduate Catalog 2026-27. A draft that no advisor has reviewed. The catalog does not say whether one course can satisfy a Core area and a major requirement at once, so overlaps here are what the engine found, not a ruling.</p></Card>
    </div>
  );
}
