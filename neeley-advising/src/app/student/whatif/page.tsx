"use client";
import { useEffect, useState } from "react";
import type { Alternative } from "@/lib/engine/alternatives";
import type { ComparisonRow } from "@/lib/types";
import { useStudent } from "@/components/StudentContext";
import { Card, NeedStudent } from "@/components/Bits";
import { PlanView } from "@/components/PlanView";
import { Collapse, Icon } from "@/components/ui";
import { ApiError, postJson } from "@/lib/client";

interface Overview { baseline: Alternative; minors: Alternative[]; majorSwitches: Alternative[]; summer: Alternative }
const CAREERS = ["data", "banking", "consulting", "startups", "brand", "operations", "sales", "real-estate", "technology"];

type Pick = { kind: "add_minor"; minorId: string } | { kind: "change_major"; toMajorId: string } | { kind: "career_focus"; careerTags: string[] } | { kind: "summer" };

export default function WhatIf() {
  const { record, ready } = useStudent();
  const [ov, setOv] = useState<Overview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [picks, setPicks] = useState<{ key: string; pick: Pick; alt: Alternative }[]>([]);
  const [cmp, setCmp] = useState<ComparisonRow[] | null>(null);
  const [careerAlt, setCareerAlt] = useState<Alternative | null>(null);
  const [tag, setTag] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!record) return;
    postJson<Overview>("/api/alternatives", { record, kind: "overview" }).then(setOv).catch((e) => setErr(e.message));
  }, [record]);

  async function compare(next: { key: string; pick: Pick; alt: Alternative }[]) {
    setPicks(next);
    if (!record || !next.length) { setCmp(null); return; }
    try {
      const r = await postJson<{ comparison: ComparisonRow[] }>("/api/alternatives", { record, kind: "compare", picks: next.map((p) => p.pick) });
      setCmp(r.comparison);
    } catch (e) { setErr(e instanceof ApiError ? e.message : "Could not compare."); }
  }
  const toggle = (key: string, pick: Pick, alt: Alternative) => {
    const has = picks.some((p) => p.key === key);
    void compare(has ? picks.filter((p) => p.key !== key) : [...picks, { key, pick, alt }].slice(-3));
  };
  async function runCareer() {
    if (!record || !tag.length) return;
    setBusy(true);
    try { const r = await postJson<{ alternative: Alternative }>("/api/alternatives", { record, kind: "career_focus", careerTags: tag }); setCareerAlt(r.alternative); } catch (e) { setErr(e instanceof ApiError ? e.message : "Failed."); } finally { setBusy(false); }
  }

  if (!ready) return <p>Loading…</p>;
  if (!record) return <NeedStudent />;

  const PM = ({ kind, items }: { kind: "gain" | "cost" | "same"; items: string[] }) => (
    <div className="pm">
      <div className="pm-label">{kind === "gain" ? "What you gain" : kind === "cost" ? "What it costs" : "What stays the same"}</div>
      {items.map((g) => (
        <div key={g} className={`pm-row ${kind}`}>
          <span className="pm-mark" aria-hidden><Icon name={kind === "gain" ? "plus" : kind === "cost" ? "minus" : "equals"} size={14} /></span>
          <span>{g}</span>
        </div>
      ))}
    </div>
  );

  const AltCard = ({ a, k, pick }: { a: Alternative; k: string; pick: Pick }) => {
    const picked = picks.some((p) => p.key === k);
    return (
      <div className={`alt-card ${picked ? "picked" : ""}`}>
        <div className="row-between"><h3>{a.title}</h3><span className="badge b-neutral">Finish {a.plan.earliestGraduation.label ?? "not in window"}</span></div>
        <PM kind="gain" items={a.gains} />
        <PM kind="cost" items={a.costs} />
        <PM kind="same" items={a.stays} />
        <details><summary>Could not confirm ({a.unverified.length}) and advisor decisions ({a.advisorDecisions.length})</summary>
          <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>{a.unverified.map((g) => <li key={g}>{g}</li>)}{a.advisorDecisions.map((g) => <li key={g}><b>Ask an advisor:</b> {g}</li>)}</ul>
        </details>
        <div className="row">
          <label className="check"><input type="checkbox" checked={picked} onChange={() => toggle(k, pick, a)} /> {picked ? "In comparison" : "Add to comparison (up to 3)"}</label>
          <button className="btn btn-ghost btn-sm" onClick={() => setOpen(open === k ? null : k)}>{open === k ? "Hide full plan" : "See full plan"}</button>
        </div>
        {open === k && <PlanView plan={a.plan} record={record} />}
      </div>
    );
  };

  return (
    <div className="stack-lg">
      <div className="stack"><div className="eyebrow">What if</div><h1 className="page-title">See the consequences before you decide</h1><p className="lede">Every path below is built by the same engine, so the comparison is fair. None is labeled best. Nothing changes your official record.</p></div>
      {err && <div className="banner" role="alert"><span aria-hidden>!</span><div>{err}</div></div>}
      {!ov && !err && <p><span className="spin" aria-hidden /> Building the alternatives…</p>}
      {ov && (
        <>
          <section className="stack" aria-labelledby="cmp-h">
            <div className="row-between">
              <h2 id="cmp-h">Side by side</h2>
              <span className="badge b-neutral">{picks.length} of 3 paths picked</span>
            </div>
            {cmp ? (
              <>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th scope="col">Measure</th>{Object.keys(cmp[0].values).map((k) => <th scope="col" key={k}>{k}</th>)}</tr></thead>
                    <tbody>{cmp.map((r) => <tr key={r.key} className={r.differs ? "differs" : ""}><th scope="row" style={{ background: "transparent", textTransform: "none", letterSpacing: 0, fontSize: 15, color: "inherit" }}>{r.label}</th>{Object.values(r.values).map((v, i) => <td key={i}>{v}</td>)}</tr>)}</tbody>
                  </table>
                </div>
                <p className="small">Rows with a purple edge differ between paths. Cost is not estimated because no sourced tuition rate was supplied. No path is ranked: bring this to your advisor.</p>
              </>
            ) : (
              <div className="linkcard"><span>Pick up to three paths below and they line up here against your current plan, row by row.</span><span className="small">Current plan: finish {ov.baseline.plan.earliestGraduation.label ?? "not in window"}</span></div>
            )}
          </section>
          <section className="stack" aria-labelledby="m-h"><h2 id="m-h">Add a minor</h2><div className="grid grid-2">{ov.minors.map((a, i) => <AltCard key={i} a={a} k={`minor-${a.plan.generatedFor.minors[0]}`} pick={{ kind: "add_minor", minorId: a.plan.generatedFor.minors[0] }} />)}</div></section>
          <section className="stack" aria-labelledby="c-h">
            <h2 id="c-h">Prioritize a career interest</h2>
            <Card>
              <p className="small" style={{ marginBottom: 10 }}>Pick one to three. Required courses stay; electives shift. The interest-to-course mapping is a draft that no advisor has reviewed.</p>
              <div className="row" role="group" aria-label="Career interests">{CAREERS.map((c) => <button key={c} className="chip" aria-pressed={tag.includes(c)} onClick={() => setTag((t) => (t.includes(c) ? t.filter((x) => x !== c) : [...t, c].slice(-3)))}>{c}</button>)}</div>
              <div style={{ marginTop: 12 }}><button className="btn btn-sm" disabled={!tag.length || busy} onClick={runCareer}>{busy ? "Building…" : "Build this path"}</button></div>
            </Card>
            {careerAlt && <AltCard a={careerAlt} k="career" pick={{ kind: "career_focus", careerTags: tag }} />}
          </section>
          <section className="stack" aria-labelledby="s-h">
            <h2 id="s-h">Change a major</h2>
            <Collapse title="Each option replaces your last major with another Neeley major" hint={`${ov.majorSwitches.length} options`}>
              <div className="grid grid-2">{ov.majorSwitches.map((a, i) => <AltCard key={i} a={a} k={`major-${a.plan.generatedFor.majors.join("+")}`} pick={{ kind: "change_major", toMajorId: a.plan.generatedFor.majors[a.plan.generatedFor.majors.length - 1] }} />)}</div>
            </Collapse>
          </section>
          <section className="stack" aria-labelledby="su-h">
            <h2 id="su-h">Use summer terms</h2>
            <Collapse title="See how summer courses change your finish date and term loads" hint="1 path">
              <div className="grid grid-2"><AltCard a={ov.summer} k="summer" pick={{ kind: "summer" }} /></div>
            </Collapse>
          </section>
        </>
      )}
    </div>
  );
}
