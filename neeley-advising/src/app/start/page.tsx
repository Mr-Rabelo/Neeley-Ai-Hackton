import Link from "next/link";
import { Icon } from "@/components/ui";

export const metadata = { title: "Get started · Neeley Advising" };

const Bullets = ({ items }: { items: string[] }) => (
  <ul className="bullets">{items.map((i) => <li key={i}><span className="bullet-ico"><Icon name="check" size={14} /></span>{i}</li>)}</ul>
);

export default function Start() {
  return (
    <div className="wrap stack-lg">
      <div className="stack"><div className="eyebrow">Advising</div><h1 className="page-title">Which describes you?</h1><p className="lede">We show different help depending on where you are. Nothing you do here changes an official record.</p></div>
      <div className="grid grid-2">
        <div className="card stack choice" style={{ padding: 32 }}>
          <span className="badge b-neutral" style={{ alignSelf: "flex-start" }}>Already enrolled</span>
          <h3 style={{ fontSize: 26 }}>I&apos;m a current TCU student</h3>
          <p>Load your transcript and get a plan built from the 2026-27 catalog.</p>
          <Bullets items={["See what's left to graduate", "Spot what could delay you", "Compare what each choice costs"]} />
          <p className="small">Sign-in with a TCU email is the next integration. For now, load your transcript PDF, or use the sample student.</p>
          <div><Link className="btn" href="/student">Load my transcript</Link></div>
        </div>
        <div className="card stack choice" style={{ padding: 32 }}>
          <span className="badge b-neutral" style={{ alignSelf: "flex-start" }}>Exploring Neeley</span>
          <h3 style={{ fontSize: 26 }}>I&apos;m not a current student</h3>
          <p>Answer a few quick questions. Every one is skippable.</p>
          <Bullets items={["Find majors where you might fit", "See a sample four-year plan", "Get an honest look at the job market"]} />
          <p className="small">Not sure what you want at all? The assistant can ask the questions for you.</p>
          <div className="row"><Link className="btn" href="/survey">Take the short survey</Link><Link className="btn btn-ghost" href="/chat">Talk it through with the assistant</Link></div>
        </div>
      </div>
    </div>
  );
}
