import { json } from "@/lib/api";
import { creditsFor, majors, minors, prettyCode, titleOf } from "@/lib/catalog";

export async function GET() {
  const shape = (p: ReturnType<typeof majors>[number]) => ({
    id: p.id, name: p.name, totalHours: p.totalHours, page: p.page, writingEmphasisHours: p.writingEmphasisHours ?? null,
    required: p.required.map((r) => ({ code: prettyCode(r.code), title: titleOf(r.code), credits: r.credits ?? creditsFor(r.code), associated: !!r.associated })),
    groups: p.groups.map((g) => ({ label: g.label, hours: g.hours, optionCount: g.from.length })),
    notes: p.notes ?? [], advisorRequired: !!p.advisorRequired,
  });
  return json({ majors: majors().map(shape), minors: minors().map(shape) });
}
