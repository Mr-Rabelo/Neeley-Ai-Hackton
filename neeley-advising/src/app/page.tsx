import Link from "next/link";
import { VapiVoiceCall } from "@/components/VapiVoiceCall";
import { Icon } from "@/components/ui";

const TRUST = [
  { n: 1, title: "We check the plan", text: "Prerequisites, missing information, policy limits and anything that could delay graduation. The math is done by a planning engine, not guessed by AI." },
  { n: 2, title: "We show our sources", text: "Every academic claim has a source and a date. A course a catalog says is \"typically offered\" is never promised." },
  { n: 3, title: "Advisors decide", text: "Anything that needs approval goes to a real advisor, with a summary so you do not start over." },
];

export default function Landing() {
  return (
    <>
      <section className="hero-purple">
        <div className="wrap stack-lg">
          <div className="stack">
            <div className="eyebrow">TCU Neeley School of Business</div>
            <h1>Find the path that gets you there.</h1>
            <p className="lede">Courses, plans and honest answers about where each major can lead. We check every plan for problems and tell you what we could not confirm.</p>
          </div>
          <div className="hero-actions">
            <Link className="btn btn-white" href="/start"><Icon name="cap" size={18} /> Get advising now</Link>
            <div className="stack" style={{ gap: 6, alignItems: "flex-start" }}>
              <VapiVoiceCall tone="onDark" />
            </div>
          </div>
          <p className="hero-note">Prefer to talk? The Neeley AI assistant can discuss majors, courses and careers, and request an advisor call-back. It cannot see your student record.</p>
          <div className="row small on-dark"><span style={{ width: 1, height: 40, background: "rgba(255,255,255,.4)", display: "inline-block" }} aria-hidden /> Scroll to see what Neeley stands for</div>
        </div>
      </section>

      <section className="section">
        <div className="wrap stack-lg">
          <div className="stack">
            <div className="eyebrow">What Neeley stands for</div>
            <h2 style={{ fontSize: 40, maxWidth: 700 }}>A balanced education with a business core.</h2>
          </div>
          <div className="grid grid-3" style={{ gap: 40 }}>
            <div><div className="divider" /><h3>A broad base</h3><p className="lede" style={{ fontSize: 17 }}>Humanities, social sciences, natural sciences, mathematics, economics and business are studied together, so a business degree rests on a liberal-arts foundation.</p></div>
            <div><div className="divider" /><h3>Every business fundamental</h3><p className="lede" style={{ fontSize: 17 }}>All students learn accounting, information systems, entrepreneurship and innovation, finance, management, marketing, and supply and value chain management, then concentrate in one.</p></div>
            <div><div className="divider" /><h3>Ties to the business community</h3><p className="lede" style={{ fontSize: 17 }}>Corporate partners contribute internships, jobs, scholarships, classroom speakers and mentors. The school is accredited by AACSB International.</p></div>
          </div>
          <p className="small">Source: Neeley School of Business department pages, TCU Undergraduate 2026-2027 Catalog (S2). Paraphrased.</p>
        </div>
      </section>

      <section className="section">
        <div className="wrap stack-lg">
          <div className="stack">
            <div className="eyebrow">Plans you can trust</div>
            <h2 style={{ fontSize: 32, maxWidth: 700 }}>Every plan goes through three checks before you see it.</h2>
          </div>
          <ol className="trust">
            {TRUST.map((s) => (
              <li key={s.n}>
                <span className="trust-num" aria-hidden>{s.n}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
