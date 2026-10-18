import fs from "node:fs";
import path from "node:path";
import { pdfToLines } from "@/lib/pdf";
import { bad, json, llmOrNull } from "@/lib/api";
import { extractTranscript } from "@/lib/ai/profile";

export const maxDuration = 60;
const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: Request) {
  let text = "";
  let isSample = false;
  const type = req.headers.get("content-type") ?? "";
  try {
    if (type.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return bad("Attach a transcript file.");
      if (file.size > MAX_BYTES) return bad("The file is larger than 5 MB.", 413);
      const buf = new Uint8Array(await file.arrayBuffer());
      if (file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf") {
        text = (await pdfToLines(buf)).join("\n");
      } else text = new TextDecoder().decode(buf);
    } else {
      const body = (await req.json()) as { text?: string; sample?: boolean };
      if (body.sample) {
        text = fs.readFileSync(path.join(process.cwd(), "data", "sample", "sample-transcript.txt"), "utf8");
        isSample = true;
      } else text = String(body.text ?? "");
    }
  } catch (e) {
    return bad(`Could not read the transcript: ${e instanceof Error ? e.message : "unknown error"}`);
  }
  if (text.trim().length < 40) return bad("That file has no readable text. Scanned image transcripts are not supported yet; ask an advisor or paste the text.");
  const report = await extractTranscript(text, llmOrNull(), { isSample });
  if (!report.record.courses.length) return bad("No courses were found in that transcript. It may not be a TCU transcript.", 422);
  return json({ record: report.record, extraction: { method: report.method, agreed: report.agreed, discrepancies: report.discrepancies, notes: report.notes } });
}
