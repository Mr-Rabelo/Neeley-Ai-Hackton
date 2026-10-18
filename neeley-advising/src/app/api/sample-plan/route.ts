import { bad, json } from "@/lib/api";
import { buildPlan } from "@/lib/engine/plan";
import { getProgram } from "@/lib/catalog";
import { prospectRecord } from "@/lib/ai/tools";

export const maxDuration = 30;

export async function GET(req: Request) {
  const u = new URL(req.url);
  const major = u.searchParams.get("major") ?? "";
  const prog = getProgram(major);
  if (!prog || !(prog.degree === "BBA")) return bad("Unknown major.", 404);
  const start = u.searchParams.get("start") ?? "2027-Fall";
  if (!/^\d{4}-(Fall|Spring)$/.test(start)) return bad("start must look like 2027-Fall.");
  const plan = buildPlan(prospectRecord(start, prog.name), { majors: [major], minors: [], maxCreditsPerTerm: 15, allowSummer: false }, `Sample plan: ${prog.name}`);
  return json({ plan, sample: true });
}
