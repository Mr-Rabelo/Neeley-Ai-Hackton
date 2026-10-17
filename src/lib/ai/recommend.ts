import type { MessageParam, Tool, ToolResultBlockParam, ToolUseBlock } from "@anthropic-ai/sdk/resources/messages";
import type { PlanResult, StudentRecord } from "../types";
import type { Llm } from "./llm";
import { systemPrompt } from "./prompts";
import { executeTool, newContext, toolsFor } from "./tools";
import { getCourse, prettyCode } from "../catalog";
import { baselineAlternative } from "../engine/alternatives";
import type { StudentProfile } from "./profile";

export interface Recommendations {
  summary: string;
  nextTerm: { code: string; title: string; why: string; satisfies: string; sources: string[] }[];
  electives: { code: string; title: string; why: string; interestLink: string; careerLink?: string }[];
  watchOuts: string[];
  tradeoffs: string;
  questionsForAdvisor: string[];
  removedUnsupported: number;
  generatedBy: "claude" | "engine";
}

const SUBMIT: Tool = {
  name: "submit_recommendations",
  description: "Submit the final recommendations. Call exactly once, after you have used the planning tools. Only courses that exist in the catalog; required courses stay separate from elective suggestions.",
  input_schema: {
    type: "object",
    properties: {
      summary: { type: "string", description: "Two or three plain sentences. Use 'based on current information'." },
      nextTerm: {
        type: "array",
        description: "Courses to take next term, taken from the engine's plan.",
        items: { type: "object", properties: { code: { type: "string" }, why: { type: "string" }, satisfies: { type: "string" }, sources: { type: "array", items: { type: "string" } } }, required: ["code", "why", "satisfies", "sources"] },
      },
      electives: {
        type: "array",
        description: "Optional suggestions tied to the student's interests and career possibilities. Not requirements.",
        items: { type: "object", properties: { code: { type: "string" }, why: { type: "string" }, interestLink: { type: "string" }, careerLink: { type: "string" } }, required: ["code", "why", "interestLink"] },
      },
      watchOuts: { type: "array", items: { type: "string" } },
      tradeoffs: { type: "string", description: "What the main alternatives gain and cost, neutrally." },
      questionsForAdvisor: { type: "array", items: { type: "string" } },
    },
    required: ["summary", "nextTerm", "electives", "watchOuts", "tradeoffs", "questionsForAdvisor"],
  } as Tool["input_schema"],
};

export async function recommend(record: StudentRecord, llm: Llm, profile?: StudentProfile): Promise<Recommendations> {
  const ctx = newContext("student", record);
  const system = systemPrompt("student", record, profile);
  const tools = [...toolsFor("student").filter((t) => t.name !== "offer_options" && t.name !== "create_advisor_packet"), SUBMIT];
  const messages: MessageParam[] = [
    {
      role: "user",
      content:
        "Give me recommendations for next term. First call get_plan. Then, if useful, get_market_info for my majors, compare_alternatives for one or two realistic options (for example a minor or career focus that fits my interests), and get_course for anything you cite. Then call submit_recommendations. Required courses go in nextTerm; interest-based ideas go in electives and are clearly optional.",
    },
  ];
  let out: Recommendations | null = null;
  for (let round = 0; round < 8 && !out; round++) {
    const res = await llm({ system, messages, tools, maxTokens: 3500 });
    messages.push({ role: "assistant", content: res.content });
    const uses = res.content.filter((b): b is ToolUseBlock => b.type === "tool_use");
    if (!uses.length) break;
    const results: ToolResultBlockParam[] = [];
    for (const u of uses) {
      if (u.name === "submit_recommendations") {
        out = validate(u.input as never, ctx.baselineCache?.plan ?? baselineAlternative(record).plan);
        results.push({ type: "tool_result", tool_use_id: u.id, content: "received" });
      } else {
        const r = await executeTool(u.name, (u.input ?? {}) as Record<string, unknown>, ctx);
        results.push({ type: "tool_result", tool_use_id: u.id, content: JSON.stringify(r).slice(0, 60000) });
      }
    }
    messages.push({ role: "user", content: results });
  }
  return out ?? engineRecommendations(record, ctx.baselineCache?.plan ?? baselineAlternative(record).plan);
}

function validate(raw: Omit<Recommendations, "removedUnsupported" | "generatedBy" | "nextTerm" | "electives"> & { nextTerm: Recommendations["nextTerm"]; electives: Recommendations["electives"] }, plan: PlanResult): Recommendations {
  const inPlan = new Set(plan.terms.flatMap((t) => t.courses.map((c) => c.code)));
  let removed = 0;
  const norm = (c: string) => c.replace(/\s+/g, "").toUpperCase();
  const nextTerm = (raw.nextTerm ?? [])
    .filter((c) => {
      const ok = !!getCourse(c.code) && inPlan.has(norm(c.code));
      if (!ok) removed++;
      return ok;
    })
    .map((c) => ({ ...c, code: prettyCode(c.code), title: getCourse(c.code)?.title ?? "" }));
  const electives = (raw.electives ?? [])
    .filter((c) => {
      const ok = !!getCourse(c.code);
      if (!ok) removed++;
      return ok;
    })
    .map((c) => ({ ...c, code: prettyCode(c.code), title: getCourse(c.code)?.title ?? "" }));
  return { summary: raw.summary, nextTerm, electives, watchOuts: raw.watchOuts ?? [], tradeoffs: raw.tradeoffs ?? "", questionsForAdvisor: raw.questionsForAdvisor ?? [], removedUnsupported: removed, generatedBy: "claude" };
}

/** Engine-only recommendations: the same facts without Claude's explanations. */
export function engineRecommendations(record: StudentRecord, plan: PlanResult): Recommendations {
  void record;
  const first = plan.terms[0];
  return {
    summary: `Based on current information, the engine's plan for ${first?.label ?? "next term"} is below. The earliest finish is ${plan.earliestGraduation.label ?? "not within the planning window"}. Explanations from Claude are unavailable right now.`,
    nextTerm: (first?.courses ?? []).filter((c) => !c.placeholder).map((c) => ({ code: prettyCode(c.code), title: c.title, why: c.reason, satisfies: c.satisfies[0] ?? "", sources: ["S1"] })),
    electives: [],
    watchOuts: plan.findings.filter((f) => f.severity !== "info").slice(0, 5).map((f) => f.message),
    tradeoffs: "",
    questionsForAdvisor: plan.advisorQuestions,
    removedUnsupported: 0,
    generatedBy: "engine",
  };
}
