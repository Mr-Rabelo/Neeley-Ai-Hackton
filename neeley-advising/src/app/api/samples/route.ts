import fs from "node:fs";
import path from "node:path";
import { json } from "@/lib/api";
import { parseTranscriptText } from "@/lib/transcript";
import { buildSampleStudent, SAMPLE_STUDENTS } from "@/lib/samples";

/** The five fictional sample students, ready to load. Read-only. */
export async function GET() {
  const raw = fs.readFileSync(path.join(process.cwd(), "data", "sample", "sample-transcript.txt"), "utf8");
  const base = parseTranscriptText(raw, { isSample: true });
  return json({
    students: SAMPLE_STUDENTS.map((s) => ({ ...s, record: buildSampleStudent(base, s.id) })),
  });
}
