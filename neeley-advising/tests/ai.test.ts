import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { ContentBlock } from "@anthropic-ai/sdk/resources/messages";
import type { Llm, LlmRequest } from "@/lib/ai/llm";
import { runChat } from "@/lib/ai/chat";
import { verifyReply } from "@/lib/ai/verify";
import { executeTool, newContext } from "@/lib/ai/tools";
import { extractTranscript, profileStudent, rulesProfile } from "@/lib/ai/profile";
import { recommend } from "@/lib/ai/recommend";
import { parseTranscriptText } from "@/lib/transcript";
import { baselineAlternative } from "@/lib/engine/alternatives";

const raw = fs.readFileSync(path.join(process.cwd(), "data/sample/sample-transcript.txt"), "utf8");
const rec = parseTranscriptText(raw, { isSample: true });

const text = (t: string): ContentBlock[] => [{ type: "text", text: t, citations: null } as ContentBlock];
const toolUse = (id: string, name: string, input: unknown): ContentBlock => ({ type: "tool_use", id, name, input } as ContentBlock);

/** A scripted fake model: each call returns the next scripted response. */
function script(...responses: ((req: LlmRequest) => ContentBlock[])[]): { llm: Llm; calls: LlmRequest[] } {
  const calls: LlmRequest[] = [];
  let i = 0;
  const llm: Llm = async (req) => {
    calls.push(req);
    const r = responses[Math.min(i++, responses.length - 1)];
    const content = r(req);
    return { content, stopReason: content.some((b) => b.type === "tool_use") ? "tool_use" : "end_turn" };
  };
  return { llm, calls };
}

describe("tools", () => {
  it("get_plan returns an engine plan labeled as a draft, with sources", async () => {
    const ctx = newContext("student", rec);
    const out = (await executeTool("get_plan", {}, ctx)) as { status: string; earliestGraduation: { term: string }; sources: unknown[] };
    expect(out.status).toMatch(/Draft/);
    expect(out.earliestGraduation.term).toBe("Spring 2029");
    expect(out.sources.length).toBeGreaterThan(1);
    expect(ctx.toolCourseCodes.has("FINA30153")).toBe(true);
  });
  it("get_course reports the offering label and never invents a course", async () => {
    const ctx = newContext("student", rec);
    const ok = (await executeTool("get_course", { code: "FINA 30213" }, ctx)) as { typicallyOffered: { confidence: string } };
    expect(ok.typicallyOffered.confidence).toBe("historical_pattern");
    const bad = (await executeTool("get_course", { code: "FINA 99999" }, ctx)) as { error: string };
    expect(bad.error).toMatch(/not in the supplied/);
  });
  it("advisor packet needs explicit confirmation", async () => {
    const ctx = newContext("student", rec);
    const no = (await executeTool("create_advisor_packet", { reason: "x", studentConfirmed: false }, ctx)) as { error: string };
    expect(no.error).toMatch(/Ask the student first/);
    const yes = (await executeTool("create_advisor_packet", { reason: "AP credit", studentConfirmed: true }, ctx)) as { status: string; requestId: string };
    expect(yes.status).toBe("review_requested");
    expect(yes.requestId).toBeTruthy();
  });
  it("fit_programs asks for more answers when most are skipped", async () => {
    const ctx = newContext("prospect");
    const out = (await executeTool("fit_programs", { interests: ["money"] }, ctx)) as { needMoreAnswers: boolean };
    expect(out.needMoreAnswers).toBe(true);
  });
  it("market info carries BLS source and hedging rules", async () => {
    const out = (await executeTool("get_market_info", { majorId: "finance" }, newContext("prospect"))) as { rules: string; source: { owner: string } };
    expect(out.rules).toMatch(/possibilities/i);
    expect(out.source.owner).toMatch(/Bureau of Labor/);
  });
  it("sample_plan builds a four-year plan from zero", async () => {
    const out = (await executeTool("sample_plan", { majorId: "marketing" }, newContext("prospect"))) as { terms: unknown[]; sampleNote: string };
    expect(out.terms.length).toBeGreaterThanOrEqual(7);
    expect(out.sampleNote).toMatch(/sample/i);
  });
});

describe("verifier", () => {
  const ctx = newContext("student", rec);
  ctx.toolCourseCodes.add("FINA30153");
  ctx.toolText = "median 83680 growth 5";
  it("flags invented courses and unsupported promises", () => {
    expect(verifyReply("Take FINA 99999 next.", ctx).ok).toBe(false);
    expect(verifyReply("You will graduate in Spring 2029.", ctx).ok).toBe(false);
    expect(verifyReply("Your plan is approved.", ctx).ok).toBe(false);
    expect(verifyReply("FINA 30153 will be offered in Fall.", ctx).ok).toBe(false);
    expect(verifyReply("FINA 30153 is usually offered in Fall, but that is not a guarantee.", ctx).ok).toBe(true);
    expect(verifyReply("It is guaranteed.", ctx).ok).toBe(false);
  });
  it("checks quoted figures against tool results", () => {
    expect(verifyReply("Median pay is $83,680 with 5% growth.", ctx).ok).toBe(true);
    expect(verifyReply("Median pay is $120,000.", ctx).ok).toBe(false);
    expect(verifyReply("Growth is 42%.", ctx).ok).toBe(false);
  });
});

describe("chat loop", () => {
  it("runs tools, then answers, and verifies the result", async () => {
    const { llm, calls } = script(
      () => [toolUse("t1", "get_plan", {})],
      () => text("Based on current information, the earliest finish is Spring 2029 [S1]. FINA 30153 is planned for Spring 2027."),
    );
    const out = await runChat({ llm, mode: "student", messages: [{ role: "user", content: "When can I finish?" }], record: rec });
    expect(out.toolsUsed).toEqual(["get_plan"]);
    expect(out.verified).toBe(true);
    expect(out.text).toMatch(/Spring 2029/);
    expect(calls.length).toBe(2);
    expect(calls[0].tools!.map((t) => t.name)).toContain("get_plan");
  });
  it("rewrites once when the first answer breaks the rules, then adds a caution if still bad", async () => {
    const { llm } = script(
      () => [toolUse("t1", "get_plan", {})],
      () => text("You will graduate in 2029 and FINA 99999 is easy."),
      () => text("You will graduate in 2029."),
    );
    const out = await runChat({ llm, mode: "student", messages: [{ role: "user", content: "hi" }], record: rec });
    expect(out.verified).toBe(false);
    expect(out.correctedText).toMatch(/could not be checked/);
  });
  it("surfaces option chips for prospects", async () => {
    const { llm } = script(
      () => [toolUse("o1", "offer_options", { question: "What excites you?", options: [{ id: "tech", label: "Technology" }, { id: "money", label: "Money" }] })],
      () => text("Great, let's start with what excites you."),
    );
    const out = await runChat({ llm, mode: "prospect", messages: [{ role: "user", content: "I know nothing" }] });
    expect(out.options[0].options.length).toBe(2);
  });
  it("voice mode cannot see student records or plans", async () => {
    const { llm, calls } = script(() => text("Happy to help."));
    await runChat({ llm, mode: "voice", messages: [{ role: "user", content: "what is my plan" }], record: rec });
    const names = calls[0].tools!.map((t) => t.name);
    expect(names).not.toContain("get_plan");
    expect(names).not.toContain("create_advisor_packet");
    expect(calls[0].system).toMatch(/BROWSER VOICE CONVERSATION/);
  });
});

describe("transcript extraction and profiling", () => {
  it("cross-checks the AI reading against the parser", async () => {
    const aiCourses = rec.courses.map((c) => ({ code: c.code, title: c.title, term: `${c.termId.replace("-", " ")} Term`, attempted: c.attempted, earned: c.earned, grade: c.grade, transfer: c.transfer }));
    const good = script(() => [toolUse("x", "submit_transcript", { courses: aiCourses })]);
    const r1 = await extractTranscript(raw, good.llm, { isSample: true });
    expect(r1.agreed).toBe(true);
    const wrong = aiCourses.map((c) => (c.code === "ECON10233" ? { ...c, grade: "A" } : c));
    const bad = script(() => [toolUse("x", "submit_transcript", { courses: wrong })]);
    const r2 = await extractTranscript(raw, bad.llm, { isSample: true });
    expect(r2.agreed).toBe(false);
    expect(r2.discrepancies.join(" ")).toMatch(/ECON10233: grade differs/);
    expect(r2.record.courses.find((c) => c.code === "ECON10233")!.grade).toBe("B+");
  });
  it("falls back to the parser and the rules profile when Claude fails, and says why", async () => {
    const boom: Llm = async () => { throw Object.assign(new Error("401 invalid x-api-key"), { status: 401 }); };
    const r = await extractTranscript(raw, boom, { isSample: true });
    expect(r.method).toBe("deterministic");
    expect(r.record.courses.length).toBe(18);
    expect(r.notes.join(" ")).toMatch(/AI extraction failed \(HTTP 401/);
    const p = await profileStudent(rec, boom);
    expect(p.generatedBy).toBe("rules");
    expect(p.limits).toMatch(/Claude was unavailable/);
  });
  it("drops profile claims that cite courses not on the transcript", async () => {
    const { llm } = script(() => [
      toolUse("p", "submit_profile", {
        headline: "x",
        strengths: [
          { claim: "Strong in economics", evidence: ["ECON 10223", "ECON 10233"], confidence: "high" },
          { claim: "Loves chemistry", evidence: ["CHEM 10113"], confidence: "high" },
        ],
        interests: [], risks: [], gaps: [], careerPossibilities: [{ field: "Finance", why: "grades", evidence: ["MATH 99999"] }], questionsToConfirm: ["q"],
      }),
    ]);
    const p = await profileStudent(rec, llm);
    expect(p.generatedBy).toBe("claude");
    expect(p.strengths.map((s) => s.claim)).toEqual(["Strong in economics"]);
    expect(p.careerPossibilities.length).toBe(0);
    expect(p.removedUnsupported).toBe(2);
  });
  it("has a rules-based profile when no API key is set", () => {
    const p = rulesProfile(rec);
    expect(p.generatedBy).toBe("rules");
    expect(p.risks.length).toBeGreaterThan(0);
    expect(p.limits).toMatch(/Rule-based/);
  });
});

describe("recommendations", () => {
  it("keeps only courses that are in the plan or the catalog", async () => {
    const { llm } = script(
      () => [toolUse("a", "get_plan", {})],
      () => [toolUse("b", "submit_recommendations", {
        summary: "Based on current information, take these.",
        nextTerm: [
          { code: "FINA 30153", why: "Unlocks the finance sequence.", satisfies: "Business core", sources: ["S1"] },
          { code: "FINA 99999", why: "invented", satisfies: "x", sources: [] },
        ],
        electives: [{ code: "INSC 40843", why: "Analytics", interestLink: "data" }, { code: "ZZZZ 11111", why: "bad", interestLink: "x" }],
        watchOuts: ["w"], tradeoffs: "t", questionsForAdvisor: ["q"],
      })],
    );
    const r = await recommend(rec, llm);
    expect(r.nextTerm.map((c) => c.code)).toEqual(["FINA 30153"]);
    expect(r.electives.map((c) => c.code)).toEqual(["INSC 40843"]);
    expect(r.removedUnsupported).toBe(2);
    expect(baselineAlternative(rec).plan.terms[0].courses.some((c) => c.code === "FINA30153")).toBe(true);
  });
});
