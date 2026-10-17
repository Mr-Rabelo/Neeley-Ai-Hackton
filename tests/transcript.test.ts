import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parseTranscriptText, plansToMajorIds, gpaBySubject, meetsGrade } from "@/lib/transcript";

const raw = fs.readFileSync(path.join(process.cwd(), "data/sample/sample-transcript.txt"), "utf8");
const rec = parseTranscriptText(raw, { isSample: true });

describe("sample transcript parser", () => {
  it("reads the header and plans", () => {
    expect(rec.name).toBe("Student,Sample");
    expect(rec.idMasked).toBe("••••0000");
    expect(rec.plans).toEqual(["Business Info Systems BBA", "Finance", "Honors College"]);
    expect(rec.catalogTermId).toBe("2025-Fall");
    expect(plansToMajorIds(rec.plans)).toEqual({ majors: ["bis", "finance"], other: ["Honors College"] });
  });
  it("finds every course with the right status", () => {
    expect(rec.courses.length).toBe(18);
    const byCode = Object.fromEntries(rec.courses.map((c) => [c.code, c]));
    expect(byCode.ECON10223.grade).toBe("A");
    expect(byCode.ECON10233.grade).toBe("B+");
    expect(byCode.PHYS10263.grade).toBe("P");
    expect(byCode.MATH10054.transfer).toBe(true);
    expect(byCode.MATH10054.earned).toBe(5);
    expect(byCode.MARK30153.status).toBe("in_progress");
    expect(byCode.ACCT20353.status).toBe("in_progress");
    expect(rec.currentTermId).toBe("2026-Fall");
  });
  it("captures attributes and totals", () => {
    const eng = rec.courses.find((c) => c.code === "ENGL20803")!;
    expect(eng.attributes).toContain("Written Communication");
    expect(rec.cumGpa).toBeCloseTo(3.791, 3);
    expect(rec.earnedHours).toBe(44);
  });
  it("computes subject GPAs from TCU courses only", () => {
    const econ = gpaBySubject(rec).find((s) => s.subject === "ECON")!;
    expect(econ.hours).toBe(6);
    expect(econ.gpa).toBeGreaterThan(3.6);
  });
  it("grade checks", () => {
    expect(meetsGrade("B+", "C-")).toBe(true);
    expect(meetsGrade("D", "C-")).toBe(false);
  });
});
