import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parseTranscriptText } from "@/lib/transcript";
import { buildSampleStudent, SAMPLE_STUDENTS } from "@/lib/samples";
import { baselineAlternative, addMinorAlternative } from "@/lib/engine/alternatives";

const base = parseTranscriptText(fs.readFileSync(path.join(process.cwd(), "data/sample/sample-transcript.txt"), "utf8"), { isSample: true });

describe("sample students", () => {
  for (const s of SAMPLE_STUDENTS) {
    it(`${s.id} builds a plan`, () => {
      const rec = buildSampleStudent(base, s.id)!;
      expect(rec.isSample).toBe(true);
      const b = baselineAlternative(rec);
      expect(b.plan.terms.length).toBeGreaterThan(0);
    });
  }
  it("does not modify the base record", () => {
    const before = JSON.stringify(base);
    for (const s of SAMPLE_STUDENTS) buildSampleStudent(base, s.id);
    expect(JSON.stringify(base)).toBe(before);
  });
  it("jordan can compare an accounting minor", () => {
    const rec = buildSampleStudent(base, "jordan")!;
    const a = addMinorAlternative(rec, baselineAlternative(rec), "accounting-minor");
    expect(a.kind).toBe("add_minor");
  });
});
