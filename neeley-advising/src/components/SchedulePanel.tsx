"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { PlanResult } from "@/lib/types";
import type { TermSchedule } from "@/lib/sections";
import { DAYS, DAY_NAME, fmtDays, fmtTime } from "@/lib/sections";
import { postJson } from "@/lib/client";
import { Icon } from "./ui";

interface Check { label: string; assumptions: string[]; terms: TermSchedule[]; totalConflicts: number; termsWithConflicts: number; waitlistedCourses: number }
const pretty = (c: string) => c.replace(/^([A-Z]+)(\d+)$/, "$1 $2");
const START = 8 * 60;
const ROWS = 18; // 8:00 to 17:00 in 30-minute rows

function Week({ t }: { t: TermSchedule }) {
  const clash = new Set(t.conflicts.flatMap((c) => [c.a, c.b]));
  return (
    <div className="week" role="img" aria-label={`Sample weekly schedule for ${t.label}`}>
      <div className="week-corner" />
      {DAYS.map((d, i) => <div key={d} className="week-day" style={{ gridColumn: i + 2, gridRow: 1 }}>{DAY_NAME[d]}</div>)}
      {Array.from({ length: ROWS / 2 }, (_, h) => <div key={h} className="week-hour" style={{ gridColumn: 1, gridRow: 2 + h * 2 }}>{fmtTime(START + h * 60).replace(":00", "")}</div>)}
      {t.chosen.flatMap((c, idx) =>
        c.section.days.map((d) => {
          const row = Math.round((c.section.start - START) / 30);
          const span = Math.max(1, Math.ceil((c.section.end - c.section.start) / 30));
          // Overlapping blocks on the same day sit side by side instead of hiding each other.
          const others = t.chosen.filter((o, j) => j !== idx && o.section.days.includes(d) && o.section.start < c.section.end && c.section.start < o.section.end);
          const lane = others.some((o) => t.chosen.indexOf(o) < idx) ? 1 : 0;
          const shared = others.length > 0;
          return (
            <div key={`${c.code}-${d}`} className={`week-block c${idx % 6} ${clash.has(c.code) ? "clash" : ""}`} style={{ gridColumn: DAYS.indexOf(d) + 2, gridRow: `${row + 2} / span ${span}`, ...(shared ? { width: "calc(50% - 4px)", justifySelf: lane ? "end" : "start" } : {}) }}>
              <b>{pretty(c.code)}</b><span>{fmtTime(c.section.start)}</span>
            </div>
          );
        }),
      )}
    </div>
  );
}

export function SchedulePanel({ plan }: { plan: PlanResult }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Check | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pref, setPref] = useState<"none" | "morning" | "afternoon">("none");
  const [ti, setTi] = useState(0);

  useEffect(() => {
    if (!open) return;
    let live = true;
    setErr(null);
    postJson<Check>("/api/schedule", {
      terms: plan.terms.map((t) => ({ termId: t.termId, label: t.label, credits: t.credits, courses: t.courses.map((c) => ({ code: c.code, title: c.title, credits: c.credits, placeholder: !!c.placeholder })) })),
      hints: { preferMorning: pref === "morning", preferAfternoon: pref === "afternoon" },
    }).then((d) => live && setData(d)).catch((e) => live && setErr(e.message));
    return () => { live = false; };
  }, [open, pref, plan]);

  const t = data?.terms[Math.min(ti, (data?.terms.length ?? 1) - 1)];
  return (
    <section className="stack" aria-labelledby="sched-h">
      <div className="row-between">
        <h2 id="sched-h">Weekly schedule <span className="badge b-warn" style={{ verticalAlign: "middle" }}>Sample, assumed</span></h2>
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>{open ? "Hide the sample schedule" : "Show a sample weekly schedule"}</button>
      </div>
      <p className="small">TCU&apos;s real class times and seats were not supplied, so this uses a generated sample schedule to show how conflicts and full sections would look. It never changes your plan.</p>
      {open && (
        <div className="stack">
          {err && <div className="banner" role="alert"><span aria-hidden>!</span><div>{err}</div></div>}
          {!data && !err && <p><span className="spin" aria-hidden /> Building the sample schedule…</p>}
          {data && t && (
            <>
              <div className="banner banner-info" role="note"><span aria-hidden>i</span><div><b>{data.label}</b> {data.totalConflicts === 0 ? "No overlaps in any term of the sample." : `${data.totalConflicts} overlap${data.totalConflicts === 1 ? "" : "s"} in ${data.termsWithConflicts} term${data.termsWithConflicts === 1 ? "" : "s"}.`} {data.waitlistedCourses > 0 && `${data.waitlistedCourses} sample section${data.waitlistedCourses === 1 ? " is" : "s are"} full.`}</div></div>
              <div className="row" style={{ gap: 8 }} role="group" aria-label="Choose a term">
                {data.terms.map((x, i) => <button key={x.termId} className="chip" aria-pressed={i === ti} onClick={() => setTi(i)}>{x.label}{!x.conflictFree && " ▲"}</button>)}
              </div>
              <div className="row" style={{ gap: 8 }} role="group" aria-label="Preferred time of day">
                <span className="small">Prefer</span>
                {(["none", "morning", "afternoon"] as const).map((p) => <button key={p} className="chip" aria-pressed={pref === p} onClick={() => setPref(p)}>{p === "none" ? "No preference" : p === "morning" ? "Mornings" : "Afternoons"}</button>)}
              </div>
              <div className="week-wrap"><Week t={t} /></div>
              {t.conflicts.length > 0 && (
                <div className="stack" style={{ gap: 8 }}>
                  {t.conflicts.map((c) => <div key={c.a + c.b} className="finding warning"><span className="icon" aria-hidden><Icon name="alert" size={14} /></span><div><p><b>Overlap.</b> {c.message}</p><p className="fix">{t.note}</p></div></div>)}
                </div>
              )}
              <div className="table-wrap">
                <table>
                  <thead><tr><th scope="col">Course</th><th scope="col">Section</th><th scope="col">Meets</th><th scope="col">Format</th><th scope="col">Seats (sample)</th></tr></thead>
                  <tbody>
                    {t.chosen.map((c) => (
                      <tr key={c.code}>
                        <td><Link href={`/course/${c.code}`}><b>{pretty(c.code)}</b></Link> {c.title}<div className="small">{c.credits} hrs{c.alternatives > 0 ? ` · ${c.alternatives} other sample section${c.alternatives > 1 ? "s" : ""}` : ""}</div></td>
                        <td>{c.section.section}</td>
                        <td className="mono">{fmtDays(c.section.days)} {fmtTime(c.section.start)}–{fmtTime(c.section.end)}</td>
                        <td>{c.section.delivery}</td>
                        <td>{c.status === "waitlist" ? <span className="badge b-bad">Full · waitlist {c.section.waitlist}</span> : c.status === "few" ? <span className="badge b-warn">{c.section.seatsOpen} of {c.section.capacity} open</span> : <span className="badge b-ok">{c.section.seatsOpen} of {c.section.capacity} open</span>}</td>
                      </tr>
                    ))}
                    {t.placeholders.map((p, i) => <tr key={`p${i}`}><td colSpan={5} className="small">{p}: any approved course. No sample section, because no specific course is recommended.</td></tr>)}
                  </tbody>
                </table>
              </div>
              <details><summary>How this sample is built</summary><ul className="small" style={{ margin: "8px 0 0", paddingLeft: 18 }}>{data.assumptions.map((a) => <li key={a}>{a}</li>)}</ul></details>
            </>
          )}
        </div>
      )}
    </section>
  );
}
