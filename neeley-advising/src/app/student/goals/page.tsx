"use client";
import { useState } from "react";
import type { Alternative } from "@/lib/engine/alternatives";
import type { ComparisonRow } from "@/lib/types";
import { useStudent } from "@/components/StudentContext";
import { Card, NeedStudent } from "@/components/Bits";
import { ApiError, postJson } from "@/lib/client";
import { EMPTY_GOALS, goalsToOptions, hasGoals, type Goals } from "@/lib/corrections";

const CAREERS = ["data", "banking", "consulting", "startups", "brand", "operations", "sales", "real-estate", "technology"];
const TERMS = ["2028-Spring", "2028-Fall", "2029-Spring", "2029-Fall", "2030-Spring"];
const CODE = /^[A-Z]{2,8}\d{5}$/;
const parseCodes = (t: string) => t.split(/[,\s]+/).map((x) => x.toUpperCase().replace(/[^A-Z0-9]/g, "")).filter((x) => CODE.test(x));
const pretty = (c: string) => c.replace(/^([A-Z]+)(\d+)$/, "$1 $2");

export default function GoalsPage() {
  const { record, ready, goals, setGoals } = useStudent();
  const [want, setWant] = useState(goals.want.join(", "));
  const [avoid, setAvoid] = useState(goals.avoid.join(", "));
  const [res, setRes] = useState<{ baseline: Alternative; alternative: Alternative; comparison: ComparisonRow[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!ready) return <p>Loading…</p>;
  if (!record) return <NeedStudent />;

  const set = (patch: Partial<Goals>) => setGoals({ ...goals, ...patch });
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  async function build() {
    if (!record) return;
    const next = { ...goals, want: parseCodes(want), avoid: parseCodes(avoid) };
    setGoals(next);
    setBusy(true); setErr(null);
    try {
      const o = goalsToOptions(next);
      setRes(await postJson("/api/alternatives", { record, kind: "goals", goals: { ...o, careerTags: o.careerTags } }));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Could not build the goals plan.");
    } finally { setBusy(false); }
  }

  return (
    <div className="stack-lg">
      <div className="stack"><div className="eyebrow">Your goals</div><h1 className="page-title">What do you want from your degree?</h1><p className="lede">Tell us your preferences. We build a separate &quot;Your goals&quot; plan next to the default one and show what changes. Your default plan is not touched, and no advisor has reviewed either.</p></div>
      <div className="banner" role="status"><span aria-hidden>i</span><div>Goals are saved in this browser only. They are shared with an advisor only if you send a review request.</div></div>
      <Card title="Timing">
        <div className="grid-2">
          <label className="stack" style={{ gap: 4 }}>Target graduation
            <select value={goals.targetTermId ?? ""} onChange={(e) => set({ targetTermId: e.target.value || undefined })}>
              <option value="">No preference</option>
              {TERMS.map((t) => <option key={t} value={t}>{t.replace("-", " ")}</option>)}
            </select>
          </label>
          <label className="stack" style={{ gap: 4 }}>Most credits per term
            <select value={goals.maxCreditsPerTerm ?? ""} onChange={(e) => set({ maxCreditsPerTerm: e.target.value ? Number(e.target.value) : undefined })}>
              <option value="">Default (15)</option>
              {[12, 13, 14, 15, 16, 17, 18].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </div>
        <div className="row" style={{ marginTop: 12, flexWrap: "wrap" }}>
          <button className="chip" aria-pressed={!!goals.allowSummer} onClick={() => set({ allowSummer: !goals.allowSummer })}>Use summer terms</button>
          <span className="small">Preferred class times:</span>
          {(["none", "morning", "afternoon"] as const).map((p) => <button key={p} className="chip" aria-pressed={(goals.classTimes ?? "none") === p} onClick={() => set({ classTimes: p })}>{p === "none" ? "No preference" : p === "morning" ? "Mornings" : "Afternoons"}</button>)}
        </div>
      </Card>
      <Card title="Interests and experiences">
        <p className="small" style={{ marginBottom: 8 }}>Careers you want to explore</p>
        <div className="row" style={{ flexWrap: "wrap" }}>{CAREERS.map((c) => <button key={c} className="chip" aria-pressed={goals.careers.includes(c)} onClick={() => set({ careers: toggle(goals.careers, c) })}>{c}</button>)}</div>
        <div className="row" style={{ marginTop: 12, flexWrap: "wrap" }}>
          <button className="chip" aria-pressed={!!goals.gradSchool} onClick={() => set({ gradSchool: !goals.gradSchool })}>Grad school</button>
          <button className="chip" aria-pressed={!!goals.internship} onClick={() => set({ internship: !goals.internship })}>Internship</button>
          <button className="chip" aria-pressed={!!goals.studyAbroad} onClick={() => set({ studyAbroad: !goals.studyAbroad })}>Study abroad</button>
        </div>
        <p className="small" style={{ marginTop: 8 }}>Grad school, internship and study abroad are noted for your advisor. They do not move courses around.</p>
      </Card>
      <Card title="Courses">
        <div className="grid-2">
          <label className="stack" style={{ gap: 4 }}>Courses I want (codes, e.g. FINA 30153)
            <input value={want} onChange={(e) => setWant(e.target.value)} placeholder="FINA30153, ISYS 20343" />
          </label>
          <label className="stack" style={{ gap: 4 }}>Courses I want to avoid
            <input value={avoid} onChange={(e) => setAvoid(e.target.value)} placeholder="Required courses cannot be avoided" />
          </label>
        </div>
        <p className="small" style={{ marginTop: 8 }}>Required courses stay in the plan even if you list them under avoid, and we say so.</p>
      </Card>
      <div className="row">
        <button className="btn" disabled={busy} onClick={build}>{busy ? "Building…" : "Build my goals plan"}</button>
        {hasGoals(goals) && <button className="btn btn-ghost" onClick={() => { setGoals(EMPTY_GOALS); setWant(""); setAvoid(""); setRes(null); }}>Clear goals</button>}
      </div>
      {err && <div className="banner" role="alert"><span aria-hidden>!</span><div>{err}</div></div>}
      {res && (
        <div className="stack-lg">
          <div className="callout">
            <div className="eyebrow">Your goals plan (draft, not reviewed)</div>
            <h3>Finishes {res.alternative.plan.earliestGraduation.label ?? "n/a"} · default plan finishes {res.baseline.plan.earliestGraduation.label ?? "n/a"}</h3>
          </div>
          <div className="grid-2">
            <Card title="What you gain"><ul className="plain">{res.alternative.gains.map((g) => <li key={g}>{g}</li>)}</ul></Card>
            <Card title="What it costs"><ul className="plain">{res.alternative.costs.map((g) => <li key={g}>{g}</li>)}</ul></Card>
          </div>
          <div className="table-wrap">
            <table className="report">
              <thead><tr><th scope="col">Measure</th><th scope="col">Default plan</th><th scope="col">Your goals plan</th></tr></thead>
              <tbody>{res.comparison.map((r) => <tr key={r.key}><td>{r.label}</td>{Object.values(r.values).slice(0, 2).map((v, i) => <td key={i} style={r.differs ? { fontWeight: 600 } : undefined}>{v}</td>)}</tr>)}</tbody>
            </table>
          </div>
          <Card title="Term by term (your goals plan)">
            <ol className="plain stack" style={{ gap: 8 }}>
              {res.alternative.plan.terms.map((t) => <li key={t.termId}><b>{t.label}</b> · {t.credits} credits<br /><span className="small">{t.courses.map((c) => (c.placeholder ? c.title : `${pretty(c.code)} ${c.title}`)).join(" · ")}</span></li>)}
            </ol>
          </Card>
          <Card title="Not verified"><ul className="plain">{[...res.alternative.unverified, ...res.alternative.advisorDecisions].map((g) => <li key={g}>{g}</li>)}</ul></Card>
        </div>
      )}
    </div>
  );
}
