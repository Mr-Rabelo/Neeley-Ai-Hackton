import type { ReactNode } from "react";

/** Small shared building blocks for the redesign: icons, numbered steps, stat tiles, collapsible sections. */

const PATHS: Record<string, string> = {
  flag: "M5 21V4m0 0h11l-2 4 2 4H5",
  layers: "M12 3 3 8l9 5 9-5-9-5ZM3 12l9 5 9-5M3 16l9 5 9-5",
  chart: "M4 20V10m6 10V4m6 16v-7m4 7H2",
  checksq: "M4 4h16v16H4zM8 12l3 3 5-6",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z",
  bulb: "M9 18h6m-5 3h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z",
  target: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z",
  book: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Zm2 14h13",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 9a8 8 0 0 1 16 0",
  check: "M5 12.5l4.5 4.5L19 7",
  alert: "M12 3 2 20h20L12 3Zm0 6v5m0 3v.5",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  equals: "M5 9h14M5 15h14",
  cap: "M2 9l10-5 10 5-10 5L2 9Zm5 3v5c0 1.5 2.2 3 5 3s5-1.5 5-3v-5",
  chevron: "M9 6l6 6-6 6",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-10v6m0-9v.5",
  lock: "M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3",
  upload: "M12 16V4m0 0-4 4m4-4 4 4M4 20h16",
};

export function Icon({ name, size = 18 }: { name: keyof typeof PATHS | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
      <path d={PATHS[name] ?? PATHS.info} />
    </svg>
  );
}

/** A numbered section: "1  What we read from the transcript". */
export function Step({ n, title, chip, children, tone }: { n?: number | string; title: string; chip?: ReactNode; children: ReactNode; tone?: "tint" }) {
  return (
    <section className={`step ${tone === "tint" ? "step-tint" : ""}`}>
      <header className="step-head">
        {n !== undefined && <span className="step-num" aria-hidden>{n}</span>}
        <h2>{title}</h2>
        {chip && <span className="step-chip">{chip}</span>}
      </header>
      <div className="step-body">{children}</div>
    </section>
  );
}

export function Stat({ icon, label, value, note, tone, children }: { icon: string; label: string; value: ReactNode; note?: ReactNode; tone?: "tint"; children?: ReactNode }) {
  return (
    <div className={`stat ${tone === "tint" ? "stat-tint" : ""}`}>
      <div className="stat-label"><span className="stat-icon"><Icon name={icon} size={16} /></span>{label}</div>
      <div className="stat-value">{value}</div>
      {children}
      {note && <p className="small">{note}</p>}
    </div>
  );
}

/** Collapsed by default. The summary line stays visible, so nothing is hidden without a hint. */
export function Collapse({ title, hint, children, open }: { title: ReactNode; hint?: ReactNode; children: ReactNode; open?: boolean }) {
  return (
    <details className="collapse" open={open}>
      <summary><span className="collapse-title">{title}</span>{hint && <span className="small">{hint}</span>}<span className="collapse-chev" aria-hidden><Icon name="chevron" size={16} /></span></summary>
      <div className="collapse-body">{children}</div>
    </details>
  );
}
