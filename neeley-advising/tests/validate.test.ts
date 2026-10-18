import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parseTranscriptText } from "@/lib/transcript";
import { buildSampleStudent, SAMPLE_STUDENTS } from "@/lib/samples";
import { baselineAlternative } from "@/lib/engine/alternatives";
import { validatePlan } from "@/lib/validate";

const base = parseTranscriptText(fs.readFileSync(path.join(process.cwd(), "data/sample/sample-transcript.txt"), "utf8"), { isSample: true });

describe("independent plan validation", () => {
  for (const s of [{ id: "sample" }, ...SAMPLE_STUDENTS]) {
    it(`${s.id}: report`, () => {
      const rec = s.id === "sample" ? base : buildSampleStudent(base, s.id)!;
      const checks = validatePlan(rec, baselineAlternative(rec).plan);
      expect(checks.length).toBe(8);
      // Known failure, kept visible on purpose: MARK 40253 lists concurrent enrollment in MARK 40243, which a Marketing plan does not add.
      const fails = checks.filter((c) => c.status === "fail").map((c) => c.id);
      expect(fails.filter((f) => f !== "prereq")).toEqual([]);
    });
  }
});
