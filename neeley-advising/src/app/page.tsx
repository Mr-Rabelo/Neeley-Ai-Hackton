import Link from "next/link";
import { VapiVoiceCall } from "@/components/VapiVoiceCall";

export default function Landing() {
  return (
    <>
      <section className="hero">
        <div className="wrap stack-lg">
          <div className="stack">
            <div className="eyebrow">TCU Neeley School of Business</div>
            <h1>Find the path that gets you there.</h1>
            <p className="lede">Courses, plans and honest answers about where each major can lead. We check every plan for problems and tell you what we could not confirm.</p>
          </div>
          <div className="row" style={{ alignItems: "stretch", gap: 20 }}>
            <div className="card card-accent stack" style={{ flex: "1 1 340px", maxWidth: 520, padding: 32 }}>
              <h3 style={{ fontSize: 26 }}>Get started</h3>
              <p>Load your transcript if you are a current student, or answer a few questions if you are exploring.</p>
              <div><Link className="btn btn-light" href="/start">Get started</Link></div>
            </div>
            <div className="card stack" style={{ flex: "1 1 340px", maxWidth: 520, padding: 32 }}>
              <h3 style={{ fontSize: 26 }}>Prefer to talk?</h3>
              <p className="small">Talk with the Neeley AI assistant by voice in your browser. It can discuss majors, courses and careers, and request an advisor call-back. It cannot see your student record.</p>
              <VapiVoiceCall />
            </div>
          </div>
          <div className="row small"><span style={{ width: 1, height: 40, background: "var(--line-strong)", display: "inline-block" }} aria-hidden /> Scroll to see what Neeley stands for</div>
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
          <div className="eyebrow">Plans you can trust</div>
          <div className="grid grid-3" style={{ gap: 32 }}>
            <div className="stack" style={{ gap: 8 }}><h3 style={{ fontSize: 20 }}>We check the plan</h3><p className="lede" style={{ fontSize: 17 }}>Prerequisites, missing information, policy limits and anything that could delay graduation. The math is done by a planning engine, not guessed by AI.</p></div>
            <div className="stack" style={{ gap: 8 }}><h3 style={{ fontSize: 20 }}>We show our sources</h3><p className="lede" style={{ fontSize: 17 }}>Every academic claim has a source and a date. A course a catalog says is &quot;typically offered&quot; is never promised.</p></div>
            <div className="stack" style={{ gap: 8 }}><h3 style={{ fontSize: 20 }}>Advisors decide</h3><p className="lede" style={{ fontSize: 17 }}>Anything that needs approval goes to a real advisor, with a summary so you do not start over.</p></div>
          </div>
        </div>
      </section>
    </>
  );
}
