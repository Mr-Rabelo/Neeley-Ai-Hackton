/** Turn a chat answer into plain text a voice assistant can read: no markdown, no source tags, one line, short. */
export function plainSpeech(text: string, max = 900): string {
  const t = text
    .replace(/\[S\d[^\]]*\]/g, "")
    .replace(/[*_`#>]/g, "")
    .replace(/\s*\n\s*/g, ". ")
    .replace(/\.\s*\./g, ".")
    .replace(/\s+/g, " ")
    .trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
  return end > 200 ? cut.slice(0, end + 1) : cut;
}
