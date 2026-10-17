"use client";
import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/Bits";
import { ApiError, postJson } from "@/lib/client";

interface Fit { results: { programId: string; name: string; score: number; reasons: string[]; lowConfidence: boolean }[]; confidence: number; needMore: boolean; note: string; skipped: string[] }
type Answers = { interests: string[]; strengths: string[]; quant?: number; communication?: number; people?: number; creative?: number; leadership?: number; careers: string[]; values: string[]; worries: string[] };

const OPT = {
  interests: [["technology", "Technology"], ["people", "Working with people"], ["money", "Money and markets"], ["creativity", "Creative work"], ["building", "Building things"], ["helping", "Helping others"], ["business", "Running a business"], ["data", "Data and puzzles"]],
  strengths: [["math", "Math"], ["writing", "Writing"], ["speaking", "Speaking"], ["science", "Science"], ["art", "Art and design"], ["leading", "Leading a team"]],
  careers: [["data", "Data and analytics"], ["banking", "Banking and investing"], ["consulting", "Consulting"], ["startups", "Startups"], ["brand", "Brand and advertising"], ["operations", "Operations and logistics"], ["sales", "Sales"], ["real-estate", "Real estate"], ["technology", "Technology"]],
  values: [["income", "Income"], ["stability", "Stability"], ["impact", "Making an impact"], ["flexibility", "Flexibility"], ["growth", "Growth and learning"]],
  worries: [["cost", "Cost"], ["difficulty", "How hard it will be"], ["fit", "Finding the right fit"], ["jobs", "Finding a job"], ["distance", "Distance from home"]],
} as const;

const STEPS = ["about", "interests", "strengths", "style", "careers", "values", "know"] as const;

export default function Survey() {
  const [step, setStep] = useState(0);
  const [a, setA] = useState<Answers>({ interests: [], strengths: [], careers: [], values: [], worries: [] });
  const [knows, setKnows] = useState<"courses" | "little" | "nothing" | undefined>();
  const [consent, setConsent] = useState(false);
  const [out, setOut] = useState<{ fit: Fit; route: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const multi = (key: "interests" | "strengths" | "careers" | "values" | "worries", v: string, max: number) =>
    setA((s) => ({ ...s, [key]: s[key].includes(v) ? s[key].filter((x) => x !== v) : [...s[key], v].slice(-max) }));

  async function finish() {
    setBusy(true); setErr(null);
    try {
      const answers = { ...a, interests: a.interests, strengths: a.strengths };
      setOut(await postJson("/api/survey", { answers, knows, consentToSave: consent }));
    } catch (e) { setErr(e instanceof ApiError ? e.message : "Something went wrong."); } finally { setBusy(false); }
  }

  if (out) {
    const top = out.fit.results;
    return (
      <div className="wrap stack-lg">
        <div className="stack"><div className="eyebrow">Your results</div><h1 className="page-title">Paths worth exploring</h1><p className="lede">{out.fit.note}</p></div>
        {out.fit.needMore && <div className="banner" role="status"><span aria-hidden>▲</span><div><b>Low confidence.</b> You skipped most questions, so treat this as a rough guess. The assistant can ask follow-ups.</div></div>}
        <div className="grid grid-3">
          {top.map((r, i) => (
            <div key={r.programId} className="card stack" style={{ gap: 10 }}>
              <div className="row-between"><span className="badge b-neutral">#{i + 1} to explore</span><span className="small mono">fit {r.score}/100</span></div>
              <h3>{r.name}</h3>
              <ul style={{ margin: 0, paddingLeft: 18 }}>{r.reasons.length ? r.reasons.map((x) => <li key={x}>{x}</li>) : <li>Not enough answers to explain this one.</li>}</ul>
              <div className="row"><Link className="btn btn-sm" href={`/explore/${r.programId}`}>See a sample plan</Link></div>
            </div>
          ))}
        </div>
        <Card>
          <p className="small">Confidence {Math.round(out.fit.confidence * 100)}% (share of the scoring weight you answered). Not answered: {out.fit.skipped.length ? out.fit.skipped.join(", ") : "nothing"}. Major profiles are drafts built from catalog descriptions and have not been reviewed by advisors. This is a way to explore, not a decision.</p>
          <div className="row" style={{ marginTop: 12 }}>
            <Link className="btn" href="/chat">{out.route === "chat" ? "Keep going with the assistant" : "Talk it through with the assistant"}</Link>
            {top.length >= 2 && <Link className="btn btn-ghost" href={`/compare?a=${top[0].programId}&b=${top[1].programId}`}>Compare the top two</Link>}
            <Link className="btn btn-ghost" href="/next">Next steps</Link>
          </div>
        </Card>
      </div>
    );
  }

  const Opts = ({ k, max }: { k: "interests" | "strengths" | "careers" | "values" | "worries"; max: number }) => (
    <div className="row" role="group" aria-label="Options">{OPT[k].map(([id, label]) => <button key={id} className="chip" aria-pressed={a[k].includes(id)} onClick={() => multi(k, id, max)}>{label}</button>)}</div>
  );
  const Slider = ({ k, left, right }: { k: "quant" | "communication" | "people" | "creative" | "leadership"; left: string; right: string }) => (
    <div className="field">
      <div className="row-between"><span className="small">{left}</span><span className="small">{right}</span></div>
      <input type="range" min={1} max={5} step={1} value={a[k] ?? 3} onChange={(e) => setA((s) => ({ ...s, [k]: Number(e.target.value) }))} onFocus={() => a[k] === undefined && setA((s) => ({ ...s, [k]: 3 }))} aria-label={`${left} to ${right}`} aria-valuetext={a[k] === undefined ? "not answered" : String(a[k])} />
      <div className="small">{a[k] === undefined ? "Not answered (skipped)" : `You chose ${a[k]} of 5`} {a[k] !== undefined && <button className="btn btn-ghost btn-sm" onClick={() => setA((s) => ({ ...s, [k]: undefined }))}>Skip this</button>}</div>
    </div>
  );

  const name = STEPS[step];
  return (
    <div className="wrap narrow stack-lg">
      <div className="stack"><div className="eyebrow">Short survey</div><h1 className="page-title">Let&apos;s find where you might fit</h1>
        <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={STEPS.length} aria-valuenow={step} aria-label="Survey progress"><i className="done" style={{ width: `${(step / STEPS.length) * 100}%` }} /></div>
        <p className="small">Step {step + 1} of {STEPS.length}. Every question is skippable. We do not ask about race, religion, health or similar traits.</p></div>
      <Card>
        {name === "about" && <div className="stack"><h2>How much do you know about Neeley?</h2><div className="stack" style={{ gap: 8 }}>{([["courses", "I know some courses or a major"], ["little", "I know a little"], ["nothing", "I don't know much"]] as const).map(([v, l]) => <button key={v} className="chip" aria-pressed={knows === v} onClick={() => setKnows(v)}>{l}</button>)}</div><p className="small">This decides what we show next. Not sure? Pick the last one and the assistant will guide you.</p></div>}
        {name === "interests" && <div className="stack"><h2>What excites you? (pick up to 4)</h2><Opts k="interests" max={4} /></div>}
        {name === "strengths" && <div className="stack"><h2>What were you strongest at in school? (up to 3)</h2><Opts k="strengths" max={3} /></div>}
        {name === "style" && <div className="stack"><h2>How do you like to work?</h2><Slider k="quant" left="Math and data make me nervous" right="I like math and data" /><Slider k="communication" left="I prefer to stay quiet" right="I like writing and presenting" /><Slider k="people" left="Analysis and ideas" right="People" /><Slider k="creative" left="Structured and predictable" right="Creative and open" /><Slider k="leadership" left="Happy to follow" right="Drawn to lead" /></div>}
        {name === "careers" && <div className="stack"><h2>What work could you picture? (up to 3)</h2><Opts k="careers" max={3} /><p className="small">&quot;No idea yet&quot; is fine. Skip it.</p></div>}
        {name === "values" && <div className="stack"><h2>What matters most? (up to 2)</h2><Opts k="values" max={2} /><h3 style={{ fontSize: 18, marginTop: 12 }}>Any worries?</h3><Opts k="worries" max={5} /></div>}
        {name === "know" && <div className="stack"><h2>Almost done</h2><label className="check"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> <span>Save my answers so I can come back, and let Neeley contact me about next steps. (Optional. Nothing is saved unless you check this.)</span></label>{err && <p role="alert">{err}</p>}</div>}
      </Card>
      <div className="row-between">
        <button className="btn btn-ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>Back</button>
        <div className="row">{step < STEPS.length - 1 ? <><button className="btn btn-ghost" onClick={() => setStep((s) => s + 1)}>Skip</button><button className="btn" onClick={() => setStep((s) => s + 1)}>Next</button></> : <button className="btn" onClick={finish} disabled={busy}>{busy ? "Working…" : "Show my results"}</button>}</div>
      </div>
    </div>
  );
}
