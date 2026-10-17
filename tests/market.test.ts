import { describe, it, expect } from "vitest";
import { allMarketMajors, difficultyFor, interpolateGrowth, marketForMajor, marketSummaryForAI } from "@/lib/market";

describe("market data", () => {
  it("covers every Neeley major with sourced occupations", () => {
    expect(allMarketMajors().length).toBe(8);
    for (const id of allMarketMajors()) {
      const v = marketForMajor(id)!;
      expect(v.occupations.length).toBeGreaterThan(0);
      expect(v.source.owner).toMatch(/Bureau of Labor Statistics/);
      expect(v.disclaimer).toMatch(/not guarantees/i);
    }
  });
  it("interpolates 3 and 5 year growth from the 10-year figure", () => {
    expect(interpolateGrowth(10, 5)).toBeCloseTo(4.9, 1);
    expect(interpolateGrowth(10, 3)).toBeCloseTo(2.9, 1);
    expect(interpolateGrowth(0, 5)).toBe(0);
  });
  it("aggregates growth by jobs", () => {
    const v = marketForMajor("scm")!;
    expect(v.aggregate.weightedGrowthPct10).toBeGreaterThan(6);
    expect(v.aggregate.est5yrPct).toBeLessThan(v.aggregate.weightedGrowthPct10);
  });
  it("labels difficulty relative to other majors and shows the inputs", () => {
    const labels = allMarketMajors().map((id) => difficultyFor(id).label);
    expect(new Set(labels).size).toBeGreaterThan(1);
    expect(difficultyFor("finance").inputs.longestPrerequisiteChain).toBeGreaterThan(1);
  });
  it("gives the AI only sourced fields and an instruction to hedge", () => {
    const s = marketSummaryForAI("finance")!;
    expect(s.rules).toMatch(/possibilities/i);
    expect(JSON.stringify(s)).toMatch(/bls\.gov/);
  });
});
