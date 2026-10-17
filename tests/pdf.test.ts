import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { pdfToLines } from "@/lib/pdf";
import { parseTranscriptText } from "@/lib/transcript";

describe("PDF transcript reading", () => {
  it("reads the sample PDF into the same record as the text version", async () => {
    const buf = new Uint8Array(fs.readFileSync(path.join(process.cwd(), "public/sample-transcript.pdf")));
    const rec = parseTranscriptText((await pdfToLines(buf)).join("\n"), { isSample: true });
    const txt = parseTranscriptText(fs.readFileSync(path.join(process.cwd(), "data/sample/sample-transcript.txt"), "utf8"), { isSample: true });
    expect(rec.plans).toEqual(["Business Info Systems BBA", "Finance", "Honors College"]);
    expect(rec.catalogTermId).toBe("2025-Fall");
    expect(rec.courses.map((c) => [c.code, c.grade, c.termId, c.transfer])).toEqual(txt.courses.map((c) => [c.code, c.grade, c.termId, c.transfer]));
    expect(rec.cumGpa).toBeCloseTo(3.791, 3);
  });
});
