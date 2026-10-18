import type { ReactNode } from "react";

/** Presentation only: turns a block of text into short bullet points. It never changes the words. */
export function toBullets(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const line = raw.replace(/^#{1,6}\s*/, "").replace(/\*\*|__|`/g, "").replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim();
    if (!line) continue;
    const parts = line.length > 140 ? line.split(/(?<=[.!?])\s+(?=[A-Z0-9])/) : [line];
    for (const p of parts) if (p.trim()) out.push(p.trim());
  }
  return out;
}

export function Bullets({ text, className }: { text: string; className?: string }): ReactNode {
  const items = toBullets(text);
  if (items.length < 2) return <p className={className}>{items[0] ?? text}</p>;
  return <ul className={`bullets ${className ?? ""}`}>{items.map((t, i) => <li key={i}>{t}</li>)}</ul>;
}
