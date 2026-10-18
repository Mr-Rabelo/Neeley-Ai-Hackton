import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parseTranscriptText } from "@/lib/transcript";
import { planFor } from "@/lib/engine/plan";
import { buildFindingsReport, chosenFor, reportToCsv } from "@/lib/report";

const rec = parseTranscriptText(fs.readFileSync(path.join(process.cwd(), "data/sample/sample-transcript.txt"), "utf8"), { isSample: true });
const plan = planFor(rec);
const rows = buildFindingsReport(plan);

describe("findings report (case brief: Finding, Evidence, Student impact, Affected students, Confidence)", () => {
  it("has one row per finding, none dropped, and at least five", () => {
    expect(rows.length).toBe(plan.findings.length);
    expect(rows.length).toBeGreaterThanOrEqual(5);
    expect(rows.map((r) => r.id)).toEqual(plan.findings.map((f) => f.id));
  });
  it("fills every column on every row", () => {
    for (const r of rows) {
      expect(r.finding.length).toBeGreaterThan(10);
      expect(r.evidence.length).toBeGreaterThan(0);
      expect(r.impact.length).toBeGreaterThan(20);
      expect(r.affected.length).toBeGreaterThan(10);
      expect(r.confidence).toMatch(/High|Medium|Low/);
    }
  });
  it("shows assumptions for timing claims and never invents costs", () => {
    const bottleneck = rows.find((r) => /^Sharpest bottleneck/.test(r.finding))!;
    expect(bottleneck.impact).toMatch(/about \d+ term/);
    expect(bottleneck.assumptions.join(" ")).toMatch(/typical offering pattern/);
    for (const r of rows) expect(r.impact).not.toMatch(/\$\s?\d/);
    const major = rows.find((r) => /majors/.test(r.finding));
    expect(major?.impact).toMatch(/extra hours/);
    expect(major?.impact).toMatch(/Cost is not estimated/);
  });
  it("exports CSV with a header and all rows", () => {
    const csv = reportToCsv(rows);
    expect(csv.split("\n").length).toBeGreaterThanOrEqual(rows.length + 1);
    expect(csv.startsWith('"Severity","Finding","Evidence"')).toBe(true);
  });
  it("is derived from the plan without changing it", () => {
    const before = JSON.stringify(plan);
    buildFindingsReport(plan);
    expect(JSON.stringify(plan)).toBe(before);
  });
});

describe("requirement alternatives", () => {
  it("lists the alternatives with titles and which one the plan chose", () => {
    const group = plan.requirements.find((r) => r.chooseFrom && r.chooseFrom.length > 3 && r.status !== "complete")!;
    expect(group.chooseFrom!.length).toBeGreaterThan(3);
    for (const c of group.chooseFrom!) expect(group.chooseFromTitles?.[c]).toBeTruthy();
    const chosen = chosenFor(plan, group);
    for (const c of chosen) expect(group.chooseFrom).toContain(c);
  });
});
