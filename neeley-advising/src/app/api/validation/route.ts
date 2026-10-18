import fs from "node:fs";
import path from "node:path";
import { json } from "@/lib/api";
import { parseTranscriptText } from "@/lib/transcript";
import { buildSampleStudent, SAMPLE_STUDENTS } from "@/lib/samples";
import { baselineAlternative } from "@/lib/engine/alternatives";
import { validatePlan } from "@/lib/validate";

/** Runs the independent validator on the sample student and the five fictional students. Read-only. */
export async function GET() {
  const base = parseTranscriptText(fs.readFileSync(path.join(process.cwd(), "data", "sample", "sample-transcript.txt"), "utf8"), { isSample: true });
  const cases = [{ id: "sample", name: "Sample student (supplied transcript)", scenario: null as number | null }, ...SAMPLE_STUDENTS.map((s) => ({ id: s.id, name: s.name, scenario: s.scenario as number | null }))];
  const results = cases.map((c) => {
    const rec = c.id === "sample" ? base : buildSampleStudent(base, c.id)!;
    const plan = baselineAlternative(rec).plan;
    return { ...c, plans: rec.plans, finish: plan.earliestGraduation.label, checks: validatePlan(rec, plan) };
  });
  return json({ generatedAt: new Date().toISOString(), results });
}
