import type { Availability, TermName } from "./types";

/**
 * "Course Typically Offered" in the catalog is a department statement of the usual pattern.
 * It is never a promise, so every known pattern is labeled `historical_pattern`.
 * Anything we cannot read is `assumption`.
 */
export function availabilityFromCatalog(raw: string | undefined, sourceId = "S1"): Availability {
  const text = (raw ?? "").trim();
  const base = { raw: text, sourceId };
  const l = text.toLowerCase();
  const mk = (terms: TermName[], extra: Partial<Availability> = {}): Availability => ({
    terms,
    rare: false,
    unknown: false,
    alternating: false,
    confidence: "historical_pattern",
    note: "",
    ...base,
    ...extra,
  });

  if (!l) {
    return mk([], { unknown: true, confidence: "assumption", note: "The catalog gives no typical offering for this course." });
  }
  if (l.includes("rarely")) {
    return mk([], { rare: true, note: "The catalog says this course is rarely offered." });
  }
  if (l.includes("contact department") || l.includes("administrative use") || l.includes("study abroad")) {
    return mk([], { unknown: true, confidence: "assumption", note: `Catalog says: "${text}". Offering must be confirmed with the department.` });
  }
  if (l.includes("all sessions")) return mk(["Fall", "Spring", "Summer"]);
  const alt = l.includes("every other");
  const terms: TermName[] = [];
  if (l.includes("fall")) terms.push("Fall");
  if (l.includes("spring")) terms.push("Spring");
  if (l.includes("summer")) terms.push("Summer");
  if (l.includes("intersession")) return mk([], { unknown: true, confidence: "assumption", note: "Intersession only." });
  if (terms.length === 0) return mk([], { unknown: true, confidence: "assumption", note: `Could not read the offering pattern "${text}".` });
  return mk(terms, alt ? { alternating: true, note: "Offered in alternating years; which years is not stated." } : {});
}

export function describeAvailability(a: Availability): string {
  if (a.rare) return "Rarely offered";
  if (a.unknown) return "Offering unknown";
  const t = a.terms.join(" and ") || "unknown";
  return a.alternating ? `Every other ${a.terms[0]}` : t;
}

export function isOfferedIn(a: Availability, name: TermName): boolean {
  if (a.rare) return false;
  if (a.unknown) return true; // plan assumes it, with a warning attached elsewhere
  return a.terms.includes(name);
}
