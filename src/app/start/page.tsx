import Link from "next/link";

export const metadata = { title: "Get started · Neeley Advising" };

export default function Start() {
  return (
    <div className="wrap stack-lg">
      <div className="stack"><div className="eyebrow">Advising</div><h1 className="page-title">Which describes you?</h1><p className="lede">We show different help depending on where you are. Nothing you do here changes an official record.</p></div>
      <div className="grid grid-2">
        <div className="card stack" style={{ padding: 32 }}>
          <h3 style={{ fontSize: 26 }}>I&apos;m a current TCU student</h3>
          <p>See what is left, what could delay graduation, and what each choice costs. We read your transcript and build a plan from the 2026-27 catalog.</p>
          <p className="small">Sign-in with a TCU email is the next integration. For now, load your transcript PDF, or use the sample student.</p>
          <div><Link className="btn" href="/student">Load my transcript</Link></div>
        </div>
        <div className="card stack" style={{ padding: 32 }}>
          <h3 style={{ fontSize: 26 }}>I&apos;m not a current student</h3>
          <p>Answer a few quick questions and we will show where you might fit, a sample four-year plan, and an honest look at the job market. Every question is skippable.</p>
          <p className="small">Not sure what you want at all? The assistant can ask the questions for you.</p>
          <div className="row"><Link className="btn" href="/survey">Take the short survey</Link><Link className="btn btn-ghost" href="/chat">Talk it through</Link></div>
        </div>
      </div>
    </div>
  );
}
