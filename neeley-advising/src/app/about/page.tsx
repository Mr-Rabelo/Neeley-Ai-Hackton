"use client";
import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/Bits";

const num = (s: string) => (s.trim() === "" || Number.isNaN(Number(s)) ? null : Number(s));
const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function Impact() {
  const [f, setF] = useState({ tuition: "", living: "", marginal: "", students: "", share: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  const t = num(f.tuition), l = num(f.living), m = num(f.marginal), n = num(f.students), sh = num(f.share);
  const avoided = n !== null && sh !== null ? (n * sh) / 100 : null;
  const studentPer = t !== null && l !== null ? t + l : null;
  return (
    <Card title="Financial impact of one avoided semester (you supply the numbers)">
      <p className="small">No tuition, living-cost or university-cost figures were supplied, so none are assumed here. Enter your own sourced values. Student savings and university effects are kept apart because they are different things.</p>
      <div className="grid-2" style={{ marginTop: 10 }}>
        <div className="field"><label htmlFor="i1">Tuition and fees per semester ($)</label><input id="i1" inputMode="decimal" value={f.tuition} onChange={set("tuition")} /></div>
        <div className="field"><label htmlFor="i2">Living costs per semester ($)</label><input id="i2" inputMode="decimal" value={f.living} onChange={set("living")} /></div>
        <div className="field"><label htmlFor="i3">University marginal cost of one more student-semester ($)</label><input id="i3" inputMode="decimal" value={f.marginal} onChange={set("marginal")} /></div>
        <div className="field"><label htmlFor="i4">Students in the pilot</label><input id="i4" inputMode="numeric" value={f.students} onChange={set("students")} /></div>
        <div className="field"><label htmlFor="i5">Share who avoid an extra semester because of the tool (%)</label><input id="i5" inputMode="decimal" value={f.share} onChange={set("share")} /></div>
      </div>
      <ul className="plain" style={{ marginTop: 12 }}>
        <li><b>Student, per avoided semester:</b> {studentPer !== null ? `${usd(studentPer)} (tuition ${usd(t!)} + living ${usd(l!)}). Aid and scholarships that would not have lasted that semester are not netted out.` : "enter tuition and living costs"}</li>
        <li><b>Students avoiding a semester:</b> {avoided !== null ? Math.round(avoided * 10) / 10 : "enter pilot size and share"}</li>
        <li><b>All students together:</b> {studentPer !== null && avoided !== null ? usd(studentPer * avoided) : "n/a"}</li>
        <li><b>University:</b> {m !== null && t !== null && avoided !== null ? `marginal cost avoided ${usd(m * avoided)}, but tuition revenue not collected for those semesters ${usd(t * avoided)}. Whether that is a gain or a loss depends on whether the seat is refilled by another student.` : "enter marginal cost to see the university side"}</li>
      </ul>
    </Card>
  );
}

export default function About() {
  return (
    <div className="wrap stack-lg">
      <div className="stack"><div className="eyebrow">Project documents</div><h1 className="page-title">Drafts for the case deliverables</h1><p className="lede">Working drafts of the written parts of the case: how it was built, the pitch outline and the 12-month plan. They describe what exists today and mark everything that is a proposal or an assumption. Live evidence is on the <Link href="/validation">validation page</Link>.</p></div>

      <Card title="How we built it (draft)">
        <div className="stack">
          <p><b>Tools and data.</b> Next.js and TypeScript, a deterministic planning engine, the Claude API for explanation, chat and profiling, Vapi for browser voice calls, Supabase for requests, Vercel for hosting. Data: the TCU Undergraduate Catalog 2026-27 PDF, the sample transcript supplied with the case, and BLS Occupational Outlook Handbook pages for job-market data.</p>
          <p><b>Collection and structure.</b> A script parses the catalog PDF into about 3,900 courses with descriptions, prerequisites and typical offerings. Majors, minors and the Core Curriculum were structured by hand with a source and page for each. Pairing of course headers and descriptions is done per page after earlier drift errors.</p>
          <p><b>Profiles and requirements.</b> A student is a transcript record (courses, grades, terms, attributes, transfer flags). Requirements are lists and groups with credit-hour rules. The engine matches one to the other, then places remaining courses in terms using prerequisites and the catalog&apos;s typical offering pattern. Claude only explains what the engine returns.</p>
          <p><b>Important workflows.</b> Transcript reading cross-checks a rule-based parser against Claude. Every Claude reply passes a verifier that rewrites or cautions on invented courses, unsupported numbers and phrases like &quot;you will graduate&quot;. Goals and corrections build separate overlays and never edit the original record.</p>
          <p><b>Checking against authoritative requirements.</b> Each requirement carries a catalog source and page. An independent validator re-checks finished plans, and a golden-master test pins the sample plan so presentation changes cannot alter it.</p>
          <p><b>When the AI was wrong or uncertain.</b> (1) The prerequisite parser first read &quot;a grade of at least C-&quot; as an A; tests caught it and the pattern was fixed. (2) The catalog cites MANA 30350 as a prerequisite, but no such course exists; the engine ignores it, says so and sends it to an advisor. (3) The validator found a plan placing MARK 40253 without the course it can be taken concurrently with; this is reported as a failure and not yet fixed.</p>
          <p><b>With another week.</b> Get a real schedule feed and the real maximum credit load; have an advisor review the test plans; fix concurrent-enrollment placement; evaluate transfer credit with the registrar; review the career-to-course mapping.</p>
        </div>
      </Card>

      <Card title="Pitch outline (draft)">
        <ol className="stack" style={{ paddingLeft: 20 }}>
          <li><b>Problem.</b> Students can see what they have completed but not how today&apos;s choices affect the semesters ahead.</li>
          <li><b>Findings.</b> The <Link href="/student/findings">findings report</Link>: prerequisite chains, assumption-based offerings, unevaluated transfer credit, catalog-year mismatch.</li>
          <li><b>Sharpest bottleneck.</b> The course that holds up the most later courses and would add a term if missed once, computed per student.</li>
          <li><b>Solution.</b> Engine computes, Claude explains, advisors decide. Students can correct, challenge and compare without touching the official record.</li>
          <li><b>Demo.</b> The four scenarios on the <Link href="/student/samples">sample students</Link> page, then the requirements map for two profiles.</li>
          <li><b>Validation.</b> Eight checks per plan, failures shown, no independent reviewer yet.</li>
          <li><b>Recommendation.</b> A one-department pilot with an advisor in the loop, then expand on evidence.</li>
          <li><b>Impact.</b> Planning accuracy, student understanding, on-time readiness, advisor time on complex cases.</li>
          <li><b>Appendix.</b> Sources, test cases, plan comparisons, assumptions, calculations, known limits.</li>
        </ol>
      </Card>

      <Card title="12-month plan (draft proposal)">
        <div className="stack">
          <p className="small">This is a proposal. Staffing, budget and partner commitments are not decided, and no costs are estimated because none were supplied.</p>
          <p><b>Months 1–3: authorize and ground.</b> Agree access and privacy terms with the registrar and advising office. Get the official degree-requirement data and a section feed. Have advisors review the test plans and the career-to-course mapping. Replace assumed values (maximum load, offering patterns).</p>
          <p><b>Months 4–6: pilot.</b> One school or department, a small group of volunteer students with an advisor reviewing every plan. Sign-in through TCU accounts.</p>
          <p><b>Months 7–9: measure and fix.</b> Compare tool plans with advisor plans. Track errors, challenges raised and corrections made. Fix the failures the validator and advisors find.</p>
          <p><b>Months 10–12: decide.</b> Expand to more programs only if the criteria below are met.</p>
          <p><b>Success measures.</b> Share of plans an advisor accepts without changes; errors found per plan; students who say they understand their path better (survey); advisor time moved to complex cases; later, on-time graduation readiness.</p>
          <p><b>Expand if</b> advisors accept nearly all plans, serious errors are rare and fixed quickly, and students report better understanding. <b>Change or stop if</b> serious errors persist, data cannot be kept current, or privacy requirements cannot be met.</p>
          <p><b>Risks.</b> Wrong recommendations, stale schedules, privacy, overreliance on AI. Mitigations: sources and confidence labels, draft status, advisor review, minimal data, no model training on student records.</p>
          <p><b>Alternatives considered.</b> (a) A chatbot over the catalog only: easy but cannot compute prerequisites or delays. (b) A rebuilt degree-audit system: accurate but slow and expensive, and duplicates what the registrar owns.</p>
        </div>
      </Card>
      <Impact />
    </div>
  );
}
