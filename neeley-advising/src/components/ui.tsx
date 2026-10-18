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
  laptop: "M4 5h16v11H4zM2 19h20",
  users: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9a6 6 0 0 1 12 0M17 11a3 3 0 1 0 0-6m1.5 9.5A5.5 5.5 0 0 1 21 20",
  dollar: "M12 3v18m4-14H10a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6H8",
  palette: "M12 3a9 9 0 1 0 0 18c1.5 0 2-1 1.5-2s0-2 1.5-2h2a4 4 0 0 0 4-4c0-5-4.5-10-9-10Zm-4 9h.01M9 8h.01M14 7h.01",
  tools: "M14 6a4 4 0 0 0 5 5l-9.5 9.5a2.1 2.1 0 0 1-3-3L16 8m-2-2 2-2 4 4-2 2",
  heart: "M12 20s-8-4.7-8-10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5C20 15.3 12 20 12 20Z",
  briefcase: "M3 8h18v12H3zM9 8V5h6v3M3 13h18",
  database: "M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3Zm0 0v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3",
  calc: "M6 3h12v18H6zM9 7h6M9 12h.01M12 12h.01M15 12h.01M9 16h.01M12 16h.01M15 16h.01",
  pen: "M4 20l1-4L16 5l3 3L8 19l-4 1Zm9-13 3 3",
  mic: "M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm-6-3a6 6 0 0 0 12 0m-6 6v3",
  flask: "M9 3h6M10 3v6L4 19a2 2 0 0 0 1.8 3h12.4A2 2 0 0 0 20 19l-6-10V3",
  crown: "M3 18h18M4 18 3 7l5 4 4-6 4 6 5-4-1 11",
  home: "M3 11 12 4l9 7M5 10v10h14V10",
  truck: "M2 6h12v10H2zM14 9h4l3 3v4h-7M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm11 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  megaphone: "M3 10v4h4l8 5V5L7 10H3Zm14 0a3 3 0 0 1 0 4",
  rocket: "M5 19c0-3 2-5 2-5l3 3s-2 2-5 2Zm4-5L14 4c3 0 6 3 6 6l-9 5-2-1ZM15 9h.01",
  shield: "M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z",
  trend: "M3 17l6-6 4 4 8-8m0 0h-5m5 0v5",
  seedling: "M12 21v-9m0 0c0-4 3-6 7-6 0 4-3 6-7 6Zm0 2c0-3-2-5-6-5 0 3 2 5 6 5Z",
  pin: "M12 21s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12Zm0-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  puzzle: "M10 4a2 2 0 1 1 4 0v2h4v4h-2a2 2 0 1 0 0 4h2v4h-4v-2a2 2 0 1 0-4 0v2H6v-4h2a2 2 0 1 0 0-4H6V6h4V4Z",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-14v5l3 2",
  scale: "M12 4v16M5 20h14M5 8h14M5 8l-2 6a3 3 0 0 0 6 0L7 8m10 0-2 6a3 3 0 0 0 6 0l-2-6",
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
