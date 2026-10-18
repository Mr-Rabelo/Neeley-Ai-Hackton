import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parseTranscriptText } from "@/lib/transcript";
import { planFor } from "@/lib/engine/plan";
import { baselineAlternative, goalsAlternative } from "@/lib/engine/alternatives";
import { applyCorrections, describeCorrections, EMPTY_CORRECTIONS, goalsToOptions, inferTransferAttributes } from "@/lib/corrections";

const rec = parseTranscriptText(fs.readFileSync(path.join(process.cwd(), "data/sample/sample-transcript.txt"), "utf8"), { isSample: true });

describe("corrections overlay", () => {
  it("returns the same record when nothing is corrected", () => {
    expect(applyCorrections(rec, EMPTY_CORRECTIONS)).toBe(rec);
  });

  it("changes a grade without touching the original", () => {
    const c = rec.courses.find((x) => x.status === "completed" && !x.transfer)!;
    const before = c.grade;
    const out = applyCorrections(rec, { ...EMPTY_CORRECTIONS, courses: { [c.code]: { grade: "F" } } });
    const fixed = out.courses.find((x) => x.code === c.code)!;
    expect(fixed.grade).toBe("F");
    expect(fixed.status).toBe("failed");
    expect(c.grade).toBe(before);
    expect(describeCorrections(rec, { ...EMPTY_CORRECTIONS, courses: { [c.code]: { grade: "F" } } })[0]).toContain("→ F");
  });

  it("removes a course", () => {
    const c = rec.courses[0];
    const out = applyCorrections(rec, { ...EMPTY_CORRECTIONS, courses: { [c.code]: { removed: true } } });
    expect(out.courses.find((x) => x.code === c.code)).toBeUndefined();
  });

  it("transfer-evaluated what-if clears the transfer flag and infers core areas", () => {
    expect(inferTransferAttributes("General Transfer Credit-HUM, LT")).toEqual(["Humanities", "Literary Traditions"]);
    const out = applyCorrections(rec, { ...EMPTY_CORRECTIONS, transferEvaluated: true });
    expect(out.courses.some((x) => x.transfer)).toBe(false);
    expect(rec.courses.some((x) => x.transfer)).toBe(true);
    const plan = planFor(out);
    expect(plan.findings.some((f) => /counted toward total hours only/.test(f.message))).toBe(false);
  });
});

describe("goals plan", () => {
  it("is separate from the default plan and leaves it unchanged", () => {
    const base = baselineAlternative(rec);
    const before = base.plan.earliestGraduation.label;
    const g = goalsAlternative(rec, base, goalsToOptions({ careers: ["data"], want: [], avoid: [], maxCreditsPerTerm: 18, allowSummer: true }));
    expect(g.kind).toBe("goals");
    expect(g.plan.label).toBe("Your goals plan");
    expect(baselineAlternative(rec).plan.earliestGraduation.label).toBe(before);
  });
});
