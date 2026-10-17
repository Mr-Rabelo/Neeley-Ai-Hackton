import { getDocumentProxy } from "unpdf";

interface TextItem { str: string; transform: number[]; hasEOL?: boolean }

/** Read a text PDF into lines by position, so rows like "UGRD BU-UG 2025 Fall Term Finance ..." stay together. */
export async function pdfToLines(buf: Uint8Array): Promise<string[]> {
  const pdf = await getDocumentProxy(buf);
  const lines: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    let line = "";
    let lastY: number | null = null;
    for (const raw of content.items as unknown[]) {
      const it = raw as Partial<TextItem>;
      if (typeof it.str !== "string" || !it.transform) continue;
      const y = it.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 2.5) {
        if (line.trim()) lines.push(line.trim());
        line = "";
      }
      line += it.str;
      lastY = y;
      if (it.hasEOL) {
        if (line.trim()) lines.push(line.trim());
        line = "";
        lastY = null;
      }
    }
    if (line.trim()) lines.push(line.trim());
  }
  return lines;
}
