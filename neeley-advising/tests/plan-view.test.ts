import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parseTranscriptText } from "@/lib/transcript";
import { planFor } from "@/lib/engine/plan";
import { buildYearGroups, defaultYearIndex, academicYearOf, completedTerms, findingSummary } from "@/lib/plan-view";
import { prospectRecord } from "@/lib/ai/tools";
import { buildPlan } from "@/lib/engine/plan";

const rec = parseTranscriptText(fs.readFileSync(path.join(process.cwd(), "data/sample/sample-transcript.txt"), "utf8"), { isSample: true });
const plan = planFor(rec);

describe("plan view grouping (display only)", () => {
  it("maps terms to academic years", () => {
    expect(academicYearOf("2025-Fall")).toBe(2025);
    expect(academicYearOf("2026-Spring")).toBe(2025);
    expect(academicYearOf("2026-Summer")).toBe(2025);
    expect(academicYearOf("2029-Spring")).toBe(2028);
  });
  it("groups the sample student into Freshman to Senior with the right terms", () => {
    const g = buildYearGroups(plan, rec);
    expect(g.map((x) => [x.name, x.range, x.status])).toEqual([
      ["Freshman", "2025–26", "completed"],
      ["Sophomore", "2026–27", "current"],
      ["Junior", "2027–28", "upcoming"],
      ["Senior", "2028–29", "upcoming"],
    ]);
    expect(g[0].completed.map((t) => t.label)).toEqual(["Fall 2025", "Spring 2026"]);
    expect(g[0].earnedHours).toBe(44);
    expect(g[0].transferHours).toBe(14);
    expect(g[1].inProgress?.label).toBe("Fall 2026");
    expect(g[1].planned.map((t) => t.label)).toEqual(["Spring 2027"]);
    expect(g[3].planned.map((t) => t.label)).toEqual(["Fall 2028", "Spring 2029"]);
  });
  it("loses no planned term, completed course or in-progress course", () => {
    const g = buildYearGroups(plan, rec);
    expect(g.flatMap((x) => x.planned).length).toBe(plan.terms.length);
    expect(g.flatMap((x) => x.completed).flatMap((t) => t.courses).length).toBe(rec.courses.filter((c) => c.status === "completed").length);
    expect(g.flatMap((x) => (x.inProgress ? x.inProgress.courses : [])).length).toBe(rec.courses.filter((c) => c.status === "in_progress").length);
    expect(completedTerms(rec).reduce((a, t) => a + t.hours, 0)).toBe(44);
  });
  it("opens on the current year", () => {
    expect(defaultYearIndex(buildYearGroups(plan, rec))).toBe(1);
  });
  it("labels a from-zero sample plan as Year 1 to Year 4", () => {
    const sample = buildPlan(prospectRecord("2027-Fall", "Finance"), { majors: ["finance"], minors: [], maxCreditsPerTerm: 15, allowSummer: false }, "Sample");
    const g = buildYearGroups(sample, null);
    expect(g.map((x) => x.name).slice(0, 4)).toEqual(["Year 1", "Year 2", "Year 3", "Year 4"]);
    expect(g.flatMap((x) => x.planned).length).toBe(sample.terms.length);
  });
  it("counts findings by severity without dropping any", () => {
    const s = findingSummary(plan);
    expect(s.blocker + s.warning + s.info).toBe(s.total);
    expect(s.total).toBe(plan.findings.length);
  });
});
