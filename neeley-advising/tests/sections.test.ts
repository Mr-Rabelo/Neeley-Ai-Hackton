import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parseTranscriptText } from "@/lib/transcript";
import { planFor } from "@/lib/engine/plan";
import { chooseSections, overlaps, scheduleCheck, sectionsFor, SAMPLE_LABEL, type SampleSection } from "@/lib/sections";

const rec = parseTranscriptText(fs.readFileSync(path.join(process.cwd(), "data/sample/sample-transcript.txt"), "utf8"), { isSample: true });
const plan = planFor(rec);

const sec = (code: string, days: SampleSection["days"], start: number, end: number): SampleSection => ({ courseCode: code, termId: "2027-Spring", section: "01", days, start, end, delivery: "In person", capacity: 30, seatsOpen: 10, waitlist: 0, sample: true });

describe("sample schedule generator", () => {
  it("is deterministic", () => {
    expect(sectionsFor("FINA30153", "2027-Spring", 3)).toEqual(sectionsFor("FINA30153", "2027-Spring", 3));
    expect(sectionsFor("FINA30153", "2027-Spring", 3)).not.toEqual(sectionsFor("FINA30153", "2027-Fall", 3));
  });
  it("only makes standard blocks and flags every section as sample data", () => {
    for (const code of ["FINA30153", "ACCT30153", "INSC30801", "MANA30250", "ENTR20263"]) {
      for (const s of sectionsFor(code, "2027-Fall", code === "INSC30801" ? 1 : 3)) {
        expect(s.sample).toBe(true);
        expect(s.capacity).toBeGreaterThanOrEqual(20);
        expect(s.seatsOpen).toBeLessThanOrEqual(s.capacity);
        const key = s.days.join("");
        expect(["MWF", "TR", "T", "R"]).toContain(key);
        if (key === "MWF") expect(s.end - s.start).toBe(50);
        else expect(s.end - s.start).toBe(75);
        expect(s.start).toBeGreaterThanOrEqual(480);
        expect(s.end).toBeLessThanOrEqual(17 * 60);
      }
    }
  });
});

describe("conflict logic", () => {
  it("detects overlap only on shared days with intersecting times", () => {
    expect(overlaps(sec("A", ["M", "W", "F"], 540, 590), sec("B", ["M", "W", "F"], 570, 620))).toBe(true);
    expect(overlaps(sec("A", ["M", "W", "F"], 540, 590), sec("B", ["T", "R"], 540, 615))).toBe(false);
    expect(overlaps(sec("A", ["M"], 540, 590), sec("B", ["M"], 590, 640))).toBe(false); // back to back
  });
  it("finds a conflict-free pick when one exists", () => {
    const picks = chooseSections([
      { code: "A", title: "A", credits: 3, sections: [sec("A", ["M", "W", "F"], 540, 590), sec("A", ["T", "R"], 540, 615)] },
      { code: "B", title: "B", credits: 3, sections: [sec("B", ["M", "W", "F"], 540, 590)] },
    ]);
    expect(picks).toEqual([1, 0]);
  });
  it("minimizes overlaps when none can be avoided", () => {
    const only = (c: string) => ({ code: c, title: c, credits: 3, sections: [sec(c, ["T", "R"], 540, 615)] });
    const picks = chooseSections([only("A"), only("B"), only("C")]);
    expect(picks).toEqual([0, 0, 0]);
  });
});

describe("schedule check on the sample student's plan", () => {
  const check = scheduleCheck(plan);
  it("is labeled as assumed and covers every planned term", () => {
    expect(check.label).toBe(SAMPLE_LABEL);
    expect(check.terms.map((t) => t.termId)).toEqual(plan.terms.map((t) => t.termId));
    for (const t of check.terms) expect(t.chosen.length + t.placeholders.length).toBe(plan.terms.find((x) => x.termId === t.termId)!.courses.length);
  });
  it("reports conflicts consistently with its own picks", () => {
    for (const t of check.terms) {
      expect(t.conflictFree).toBe(t.conflicts.length === 0);
      for (const c of t.conflicts) {
        const a = t.chosen.find((x) => x.code === c.a)!.section, b = t.chosen.find((x) => x.code === c.b)!.section;
        expect(overlaps(a, b)).toBe(true);
      }
    }
  });
  it("never changes the plan", () => {
    const before = JSON.stringify(plan);
    scheduleCheck(plan, { preferMorning: true });
    expect(JSON.stringify(plan)).toBe(before);
  });
});
