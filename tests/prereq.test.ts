import { describe, it, expect } from "vitest";
import { parsePrereq, describeExpr, evalExpr } from "@/lib/prereq";
import { availabilityFromCatalog } from "@/lib/availability";

describe("prerequisite parser", () => {
  it("reads an all-of list with bare numbers and grades", () => {
    const r = parsePrereq("Prerequisite: ECON 10223, 10233, and FINA 30153 with a grade of at least C-, and must be a declared Business major or Finance minor.");
    expect(describeExpr(r.prereq)).toBe("ECON10223 and ECON10233 and FINA30153");
    expect(r.restrictions.join(" ")).toMatch(/Business major/);
    expect(r.ambiguous).toBe(false);
    expect(r.prereq && JSON.stringify(r.prereq)).toContain('"minGrade":"C-"');
  });
  it("reads any-of and flags other paths", () => {
    const r = parsePrereq("Prerequisite: MATH 10273 with a grade of C- or better, or MATH 10054 with a grade of C- or better, or a score of at least 600 on the SAT.");
    expect(describeExpr(r.prereq)).toBe("MATH10273 or MATH10054");
    expect(r.otherPaths).toBe(true);
  });
  it("treats concurrent enrollment as a corequisite", () => {
    const r = parsePrereq("Prerequisite: FINA 30153 and FINA 30203 and credit for, or concurrent enrollment in FINA 30233, and must be a declared Business major.");
    expect(r.coreq).toContain("FINA30233");
    expect(describeExpr(r.prereq)).not.toContain("FINA30233");
  });
  it("uses the first sentence as the business-major path", () => {
    const r = parsePrereq("Prerequisite: ACCT 20353 and INSC 20153 for Business Majors. ACCT 20353 and either MATH 10043 or MATH 30853 for others.");
    expect(describeExpr(r.prereq)).toBe("ACCT20353 and INSC20153");
    expect(r.otherPaths).toBe(true);
  });
  it("flags mixed and/or wording", () => {
    const r = parsePrereq("Prerequisite: FINA 30153 or FINA 30253 and FINA 30203.");
    expect(r.ambiguous).toBe(true);
  });
  it("evaluates expressions", () => {
    const r = parsePrereq("Prerequisite: MATH 10273 or MATH 10054.");
    expect(evalExpr(r.prereq, (c) => c === "MATH10054")).toBe(true);
    expect(evalExpr(r.prereq, () => false)).toBe(false);
  });
});

describe("availability", () => {
  it("never labels a catalog pattern as confirmed", () => {
    expect(availabilityFromCatalog("Fall and Spring").confidence).toBe("historical_pattern");
    expect(availabilityFromCatalog("Fall and Spring").terms).toEqual(["Fall", "Spring"]);
    expect(availabilityFromCatalog("").unknown).toBe(true);
    expect(availabilityFromCatalog("Rarely").rare).toBe(true);
    expect(availabilityFromCatalog("Every other fall").alternating).toBe(true);
    expect(availabilityFromCatalog("Study Abroad Course").unknown).toBe(true);
  });
});
