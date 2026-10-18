import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parseTranscriptText } from "@/lib/transcript";
import { planFor } from "@/lib/engine/plan";
import { addMinorAlternative, baselineAlternative, compare } from "@/lib/engine/alternatives";

/**
 * Golden master: the sample student's plan and one comparison, captured before the redesign work.
 * Presentation changes must never alter these. To intentionally change engine behavior, regenerate with
 * UPDATE_GOLDEN=1 npx vitest run tests/golden.test.ts and review the diff.
 */
const raw = fs.readFileSync(path.join(process.cwd(), "data/sample/sample-transcript.txt"), "utf8");
const rec = parseTranscriptText(raw, { isSample: true });
const file = path.join(process.cwd(), "tests/golden/sample-student.json");

function core() {
  const p = planFor(rec);
  const base = baselineAlternative(rec);
  const alt = addMinorAlternative(rec, base, "accounting-minor");
  return {
    plan: {
      earliestGraduation: p.earliestGraduation,
      totalCredits: p.totalCredits,
      remainingCredits: p.remainingCredits,
      peakCredits: p.peakCredits,
      summerUsed: p.summerUsed,
      completeness: p.completeness,
      bottleneck: p.bottleneck,
      slips: p.slips,
      openCredits: p.openCredits,
      terms: p.terms.map((t) => ({ termId: t.termId, credits: t.credits, courses: t.courses.map((c) => [c.code, c.credits, !!c.placeholder, c.satisfies, c.availability.confidence]) })),
      findings: p.findings.map((f) => [f.severity, f.type, f.message, f.fix ?? null, f.confidence, f.needsAdvisor, f.sourceIds]),
      unverified: p.unverified,
      advisorQuestions: p.advisorQuestions,
      requirements: p.requirements.map((r) => [r.id, r.status, r.hoursDone, r.hoursInProgress, r.hoursNeeded, r.satisfiedBy, r.remainingCourses]),
    },
    comparison: compare(base, [alt]).map((r) => [r.key, r.values, r.differs]),
  };
}

describe("golden master for the sample student", () => {
  it("is unchanged", () => {
    const now = JSON.parse(JSON.stringify(core()));
    if (process.env.UPDATE_GOLDEN === "1") fs.writeFileSync(file, JSON.stringify(now, null, 1));
    expect(now).toEqual(JSON.parse(fs.readFileSync(file, "utf8")));
  });
});
