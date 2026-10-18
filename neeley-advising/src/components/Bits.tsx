import Link from "next/link";
import type { ReactNode } from "react";
import type { Availability, Finding, SourceRecord } from "@/lib/types";
import { CONF_LABEL } from "@/lib/client";

export function ConfBadge({ c }: { c: string }) {
  const l = CONF_LABEL[c] ?? CONF_LABEL.assumption;
  return <span className={`badge ${l.cls}`}><span aria-hidden>{l.icon}</span>{l.text}</span>;
}

export function AvailText({ a }: { a: Availability }) {
  const text = a.rare ? "Rarely offered" : a.unknown ? "Offering unknown" : a.alternating ? `Every other ${a.terms[0]}` : a.terms.join(" + ");
  return <span>{text} · <ConfBadge c={a.confidence} /></span>;
}

export const Src = ({ id, page }: { id: string; page?: number | null }) => <span className="src" title="Source record">{id}{page ? ` p.${page}` : ""}</span>;

const SEV: Record<string, { label: string; icon: string }> = {
  blocker: { label: "Blocker", icon: "!" },
  warning: { label: "Warning", icon: "▲" },
  info: { label: "Note", icon: "i" },
  opportunity: { label: "Opportunity", icon: "★" },
};

export function FindingCard({ f }: { f: Finding }) {
  const s = SEV[f.type === "opportunity" ? "opportunity" : f.severity];
  return (
    <div className={`finding ${f.type === "opportunity" ? "opportunity" : f.severity}`}>
      <span className="icon" aria-hidden>{s.icon}</span>
      <div>
        <p><b>{s.label}.</b> {f.message} {f.sourceIds.map((id) => <Src key={id} id={id} />)}</p>
        {f.fix && <p className="fix">{f.fix}</p>}
        <p className="small"><ConfBadge c={f.confidence} />{f.needsAdvisor && <span className="badge b-bad" style={{ marginLeft: 6 }}>Needs an advisor</span>}</p>
      </div>
    </div>
  );
}

export function SourceList({ sources }: { sources: SourceRecord[] }) {
  return (
    <ul className="stack" style={{ gap: 8, paddingLeft: 18, margin: 0 }}>
      {sources.map((s) => (
        <li key={s.id}><b>{s.id}</b> · {s.title} <span className="small">({s.owner}{s.catalogYear !== "n/a" ? `, ${s.catalogYear}` : ""}{s.document ? `, ${s.document}` : ""})</span>{s.url && <> · <a href={s.url} target="_blank" rel="noreferrer">link</a></>}</li>
      ))}
    </ul>
  );
}

export function Card({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{title && <h3 style={{ marginBottom: 12 }}>{title}</h3>}{children}</section>;
}

export function NeedStudent() {
  return (
    <div className="card stack narrow" style={{ margin: "0 auto" }}>
      <h2>Load a transcript first</h2>
      <p className="lede">This page needs a student record. Use the sample student to see how it works, or upload a transcript.</p>
      <div><Link className="btn" href="/student">Go to the student page</Link></div>
    </div>
  );
}
