import { z } from "zod";
import { bad, json, parseRecord, readJson } from "@/lib/api";
import { addMinorAlternative, allMajorSwitches, allMinorOptions, baselineAlternative, careerAlternative, changeMajorAlternative, compare, summerAlternative } from "@/lib/engine/alternatives";
import { getProgram } from "@/lib/catalog";

export const maxDuration = 60;

const schema = z.object({
  record: z.unknown(),
  kind: z.enum(["add_minor", "change_major", "career_focus", "summer", "overview", "compare"]),
  picks: z
    .array(z.object({ kind: z.enum(["add_minor", "change_major", "career_focus", "summer"]), minorId: z.string().optional(), toMajorId: z.string().optional(), careerTags: z.array(z.string()).max(3).optional() }))
    .max(3)
    .optional(),
  minorId: z.string().optional(),
  fromMajorId: z.string().optional(),
  toMajorId: z.string().optional(),
  careerTags: z.array(z.string()).max(3).optional(),
});

export async function POST(req: Request) {
  const r = await readJson(req, schema);
  if (!r.ok) return r.res;
  const record = parseRecord(r.data.record);
  if (!record) return bad("That does not look like a parsed transcript.");
  const d = r.data;
  const base = baselineAlternative(record);
  try {
    if (d.kind === "compare") {
      const from = base.plan.generatedFor.majors[base.plan.generatedFor.majors.length - 1];
      const alts = (d.picks ?? []).map((p) => {
        if (p.kind === "add_minor" && p.minorId && getProgram(p.minorId)) return addMinorAlternative(record, base, p.minorId);
        if (p.kind === "change_major" && p.toMajorId && getProgram(p.toMajorId)) return changeMajorAlternative(record, base, from, p.toMajorId);
        if (p.kind === "career_focus" && p.careerTags?.length) return careerAlternative(record, base, p.careerTags);
        return summerAlternative(record, base);
      });
      return json({ baseline: base, alternatives: alts, comparison: compare(base, alts) });
    }
    if (d.kind === "overview") {
      const from = base.plan.generatedFor.majors[base.plan.generatedFor.majors.length - 1];
      return json({
        baseline: base,
        minors: allMinorOptions(record, base),
        majorSwitches: allMajorSwitches(record, base, from),
        summer: summerAlternative(record, base),
      });
    }
    let alt;
    if (d.kind === "add_minor") {
      if (!d.minorId || !getProgram(d.minorId)) return bad("Unknown minor.");
      alt = addMinorAlternative(record, base, d.minorId);
    } else if (d.kind === "change_major") {
      const from = d.fromMajorId ?? base.plan.generatedFor.majors[base.plan.generatedFor.majors.length - 1];
      if (!d.toMajorId || !getProgram(d.toMajorId)) return bad("Unknown major.");
      alt = changeMajorAlternative(record, base, from, d.toMajorId);
    } else if (d.kind === "career_focus") {
      if (!d.careerTags?.length) return bad("Pick at least one career interest.");
      alt = careerAlternative(record, base, d.careerTags);
    } else alt = summerAlternative(record, base);
    return json({ baseline: base, alternative: alt, comparison: compare(base, [alt]) });
  } catch (e) {
    return bad(e instanceof Error ? e.message : "Could not build that alternative.", 422);
  }
}
