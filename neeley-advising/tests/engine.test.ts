import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parseTranscriptText } from "@/lib/transcript";
import { planFor } from "@/lib/engine/plan";
import { addMinorAlternative, baselineAlternative, careerAlternative, changeMajorAlternative, compare } from "@/lib/engine/alternatives";
import type { StudentRecord } from "@/lib/types";

const raw = fs.readFileSync(path.join(process.cwd(), "data/sample/sample-transcript.txt"), "utf8");
const load = (text = raw): StudentRecord => parseTranscriptText(text, { isSample: true });
const rec = load();
const plan = planFor(rec);
const msgs = (p = plan) => p.findings.map((f) => f.message).join("\n");

describe("baseline plan for the sample student", () => {
  it("places every required course and finishes in the target window", () => {
    expect(plan.earliestGraduation.label).toBe("Spring 2029");
    expect(plan.findings.some((f) => f.type === "delay" && /could not place/.test(f.message))).toBe(false);
    expect(plan.totalCredits).toBeGreaterThanOrEqual(120);
  });
  it("respects prerequisite order", () => {
    const term = (code: string) => plan.terms.findIndex((t) => t.courses.some((c) => c.code === code));
    expect(term("FINA30153")).toBeGreaterThanOrEqual(0);
    expect(term("FINA30203")).toBeGreaterThan(term("FINA30153"));
    expect(term("FINA30233")).toBeGreaterThan(term("FINA30203"));
    expect(term("FINA40153")).toBeGreaterThanOrEqual(term("FINA30233")); // concurrent enrollment allowed
    expect(term("ACCT30253")).toBeGreaterThan(term("ACCT30153"));
  });
  it("never exceeds the load assumption", () => {
    for (const t of plan.terms) expect(t.credits).toBeLessThanOrEqual(15);
  });
  it("detects the same-term prerequisite on the current schedule", () => {
    expect(msgs()).toMatch(/MARK 30153 is in progress this term, but its prerequisite INSC 20153/);
  });
  it("finds the missing lower-division course", () => {
    expect(plan.requirements.find((r) => r.id === "lower-division")!.remainingCourses).toEqual(["INSC20263"]);
    expect(msgs()).toMatch(/INSC 20263 must be completed in the semester you acknowledge/);
  });
  it("reports hidden constraints and unverified items", () => {
    expect(msgs()).toMatch(/6 of the 6 pass\/no-credit hours/);
    expect(msgs()).toMatch(/14 transfer hours/);
    expect(msgs()).toMatch(/2025-26/);
    expect(msgs()).toMatch(/Digital Culture and Data Analytics/);
    expect(plan.unverified.join(" ")).toMatch(/seat counts/);
    expect(plan.advisorQuestions.length).toBeGreaterThan(2);
  });
  it("never claims a confirmed future offering", () => {
    for (const t of plan.terms) for (const c of t.courses) expect(c.availability.confidence).not.toBe("confirmed");
  });
  it("names a bottleneck with a slip estimate", () => {
    expect(plan.bottleneck).toBeTruthy();
    expect(plan.bottleneck!.descendants).toBeGreaterThan(0);
    expect(plan.slips.length).toBeGreaterThan(0);
  });
  it("labels the plan as an unreviewed draft with low-ish completeness", () => {
    expect(plan.status).toBe("draft");
    expect(plan.notReviewed).toBe(true);
    expect(plan.completeness).toBeLessThan(0.9);
  });
  it("flags offering-unknown courses instead of guessing", () => {
    expect(msgs()).toMatch(/BUSI 30383: .*Offering must be confirmed/);
  });
});

describe("mutation tests (change one fact, expect the right finding)", () => {
  it("removing ECON 10223 pulls it in as a prerequisite", () => {
    const text = raw.replace(/ECON 10223 Intro Microeconomics 3.00 3.00 A 12.000\n(?:Course Attribute:.*\n)*/, "");
    const p = planFor(load(text));
    const codes = p.terms.flatMap((t) => t.courses.map((c) => c.code));
    expect(codes).toContain("ECON10223");
    const term = (c: string) => p.terms.findIndex((t) => t.courses.some((x) => x.code === c));
    expect(term("ECON10223")).toBeLessThan(term("FINA30153"));
  });
  it("finishing INSC 20153 removes the same-term warning", () => {
    const text = raw.replace("INSC 20153 Statistical Analysis 3.00 0.00 0.000", "INSC 20153 Statistical Analysis 3.00 3.00 B 9.000");
    expect(msgs(planFor(load(text)))).not.toMatch(/MARK 30153 is in progress this term, but its prerequisite/);
  });
  it("a D in a prerequisite blocks the dependent course", () => {
    const text = raw.replace("ECON 10233 Intro Macroeconomics 3.00 3.00 B+ 9.990", "ECON 10233 Intro Macroeconomics 3.00 3.00 D 3.000");
    const p = planFor(load(text));
    const term = (c: string) => p.terms.findIndex((t) => t.courses.some((x) => x.code === c));
    // FINA 30203 needs ECON 10233 with C-; a D must not satisfy it
    expect(term("FINA30203")).toBe(-1);
    expect(p.findings.some((f) => f.severity === "blocker")).toBe(true);
  });
  it("a missing catalog term lowers confidence instead of crashing (incomplete data scenario)", () => {
    const text = raw.replace(/UGRD BU-UG.*\n/g, "");
    const p = planFor(load(text), { majors: ["bis"] });
    expect(p.status).toBe("draft");
    expect(p.advisorQuestions.length).toBeGreaterThan(0);
    expect(p.completeness).toBeLessThan(0.9);
  });
});

describe("catalog data problems", () => {
  it("flags a cited-but-missing course (MANA 30350) instead of leaving courses unplaceable", () => {
    const p = planFor(rec, { majors: ["bis", "management"] });
    expect(p.findings.some((f) => f.type === "delay" && /could not place/.test(f.message))).toBe(false);
    expect(p.findings.map((f) => f.message).join("\n")).toMatch(/MANA 30350 as a prerequisite or corequisite/);
    expect(p.earliestGraduation.label).toBeTruthy();
  });
  it("does not offer a minor that duplicates a current major", async () => {
    const { allMinorOptions } = await import("@/lib/engine/alternatives");
    const base2 = baselineAlternative(rec);
    expect(allMinorOptions(rec, base2).map((a) => a.plan.generatedFor.minors[0])).not.toContain("finance-minor");
  });
});

describe("alternatives and comparison", () => {
  const base = baselineAlternative(rec);
  it("adding the accounting minor needs only a few extra courses and flags double counting", () => {
    const alt = addMinorAlternative(rec, base, "accounting-minor");
    expect(alt.plan.generatedFor.minors).toEqual(["accounting-minor"]);
    expect(alt.costs.join(" ")).toMatch(/ACCT 30163/);
    expect(alt.unverified.join(" ")).toMatch(/major and a minor/);
    expect(alt.advisorDecisions.length).toBeGreaterThan(0);
  });
  it("switching finance to marketing changes the course set", () => {
    const alt = changeMajorAlternative(rec, base, "finance", "marketing");
    const codes = alt.plan.terms.flatMap((t) => t.courses.map((c) => c.code));
    expect(codes).toContain("MARK30243");
    expect(codes).not.toContain("FINA30213");
    expect(alt.creditMap).toBeTruthy();
  });
  it("a data career focus prefers analytics electives and never drops required courses", () => {
    const alt = careerAlternative(rec, base, ["data"]);
    const codes = new Set(alt.plan.terms.flatMap((t) => t.courses.map((c) => c.code)));
    for (const req of ["INSC30723", "FINA30203", "INSC40813"]) expect(codes.has(req)).toBe(true);
    expect(alt.unverified.join(" ")).toMatch(/not been reviewed by an advisor/);
  });
  it("the comparison has fixed rows and highlights differences", () => {
    const alt = addMinorAlternative(rec, base, "accounting-minor");
    const rows = compare(base, [alt]);
    expect(rows.map((r) => r.key)).toContain("grad");
    expect(rows.find((r) => r.key === "cost")!.values[base.title]).toMatch(/Not estimated/);
    expect(rows.find((r) => r.key === "credits")!.differs).toBe(true);
  });
});
