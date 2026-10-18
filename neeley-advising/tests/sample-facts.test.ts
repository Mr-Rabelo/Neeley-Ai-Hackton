import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parseTranscriptText } from "@/lib/transcript";
import { SAMPLE_FACTS } from "@/lib/sample-facts";

describe("demo student tile", () => {
  it("matches the shipped sample transcript", () => {
    const rec = parseTranscriptText(fs.readFileSync(path.join(process.cwd(), "data/sample/sample-transcript.txt"), "utf8"), { isSample: true });
    expect(rec.earnedHours).toBe(SAMPLE_FACTS.earned);
    expect(rec.cumGpa.toFixed(2)).toBe(SAMPLE_FACTS.gpa);
    expect(rec.courses.filter((c) => c.transfer).reduce((a, c) => a + c.earned, 0)).toBe(SAMPLE_FACTS.transfer);
    expect(rec.catalogTermId).toBe("2025-Fall");
    expect(SAMPLE_FACTS.started).toBe("Fall 2025");
  });
});
