import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { educationOptions, programDetails } from "@/lib/ai/tools";
import { majors, minors } from "@/lib/catalog";
import { VAPI_ANSWER_TOOL, vapiDirectToolNames, vapiFunctions } from "@/lib/vapi";

const dir = path.join(process.cwd(), "vapi");
const configPath = path.join(dir, "assistant.json");
const prompt = fs.readFileSync(path.join(dir, "system-prompt.md"), "utf8");

// `WRITE_VAPI_CONFIG=1 npx vitest run tests/vapi-config.test.ts` regenerates the tool schemas after a tool changes.
if (process.env.WRITE_VAPI_CONFIG) {
  const current = JSON.parse(fs.readFileSync(configPath, "utf8"));
  fs.writeFileSync(configPath, JSON.stringify({ ...current, tools: vapiFunctions() }, null, 2) + "\n");
}
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

describe("Vapi assistant config", () => {
  it("keeps vapi/assistant.json tool schemas in sync with the app's voice tools", () => {
    expect(config.tools).toEqual(vapiFunctions());
  });

  it("gives every tool spoken filler, a timeout and a description Vapi accepts", () => {
    for (const t of vapiFunctions()) {
      expect(t.name).toMatch(/^[a-zA-Z0-9_-]{1,64}$/);
      expect(t.description.length).toBeLessThan(1000);
      expect(config.toolSettings[t.name]?.requestStart).toBeTruthy();
      expect(config.toolSettings[t.name]?.timeoutSeconds).toBeGreaterThan(0);
    }
  });

  it("routes every configured tool to a handler", () => {
    const direct = vapiDirectToolNames();
    for (const t of vapiFunctions()) expect(direct.has(t.name) || t.name === VAPI_ANSWER_TOOL).toBe(true);
  });

  it("tells the assistant when to use every tool and discloses that it is an AI", () => {
    for (const t of vapiFunctions()) expect(prompt).toContain(`\`${t.name}\``);
    expect(config.firstMessage).toMatch(/\bAI\b/);
  });

  it("names only programs that exist in the catalog data", () => {
    for (const m of majors()) expect(prompt).toContain(m.name.replace("Finance with Real Estate Concentration", "Finance with a Real Estate Concentration"));
    for (const m of minors()) expect(prompt).toContain(m.name.replace(" Minor", ""));
  });
});

describe("program overview tools", () => {
  it("lists every major and minor with outlook, entry rules and data limits", () => {
    const o = educationOptions();
    expect(o.majors.map((m) => m.id)).toEqual(majors().map((m) => m.id));
    expect(o.minors.map((m) => m.id)).toEqual(minors().map((m) => m.id));
    for (const m of o.majors) {
      expect(m.skills.length).toBeGreaterThan(0);
      expect(m.whereItLeads.length).toBeGreaterThan(0);
      expect(m.demandOutlook).toMatch(/BLS/);
    }
    expect(o.gettingIn.length).toBe(3);
    expect(o.notInData).toMatch(/Tuition/);
    expect(JSON.stringify(o).length).toBeLessThan(16_000);
  });

  it("describes one program with courses, market data and a draft-labeled fit profile", () => {
    const d = programDetails("finance") as Record<string, unknown> & { requiredCourses: { course: string }[]; tendsToSuit: { caution: string } };
    expect(d.requiredCourses.some((c) => c.course.includes("Investments"))).toBe(true);
    expect(d.jobMarket).toBeTruthy();
    expect(d.tendsToSuit.caution).toMatch(/Draft/);
    expect(programDetails("finance-minor")).toMatchObject({ kind: "minor", openTo: "business majors" });
    expect(programDetails("nursing")).toHaveProperty("error");
  });
});
