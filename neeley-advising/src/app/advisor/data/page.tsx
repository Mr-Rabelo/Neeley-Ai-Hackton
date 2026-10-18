"use client";
import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/Bits";

const SAMPLE = "course,term,section,days,start,end,seats,enrolled\nFINA30153,2027-Spring,01,MWF,09:00,09:50,35,30";
interface Row { course: string; term: string; section: string; days: string; start: string; end: string; seats?: number; enrolled?: number }

function parse(text: string): { rows: Row[]; errors: string[] } {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  const head = lines.shift()?.split(",").map((h) => h.trim().toLowerCase()) ?? [];
  const need = ["course", "term", "days", "start", "end"];
  const errors = need.filter((n) => !head.includes(n)).map((n) => `Missing column: ${n}`);
  if (errors.length) return { rows: [], errors };
  const rows: Row[] = [];
  lines.forEach((l, i) => {
    const c = l.split(",").map((x) => x.trim());
    const g = (k: string) => c[head.indexOf(k)] ?? "";
    const num = (k: string) => (g(k) === "" ? undefined : Number(g(k)));
    const r = { course: g("course").toUpperCase().replace(/\s/g, ""), term: g("term"), section: g("section") || "01", days: g("days").toUpperCase(), start: g("start"), end: g("end"), seats: num("seats"), enrolled: num("enrolled") };
    if (!/^[A-Z]{2,8}\d{5}$/.test(r.course) || !/^\d{4}-(Fall|Spring|Summer)$/.test(r.term) || !/^[MTWRF]{1,5}$/.test(r.days) || !/^\d{1,2}:\d{2}$/.test(r.start) || !/^\d{1,2}:\d{2}$/.test(r.end)) errors.push(`Row ${i + 2} is not in the expected format.`);
    else rows.push(r);
  });
  return { rows, errors };
}

export default function DataUpload() {
  const [pass, setPass] = useState("");
  const [text, setText] = useState("");
  const [source, setSource] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const { rows, errors } = text.trim() ? parse(text) : { rows: [], errors: [] };

  async function send() {
    setMsg(null);
    const res = await fetch("/api/data-upload", { method: "POST", headers: { "content-type": "application/json", ...(pass ? { "x-advisor-passcode": pass } : {}) }, body: JSON.stringify({ kind: "sections", source, rows }) });
    const d = await res.json();
    setMsg(res.ok ? `${d.message} (${d.rows} rows, ${d.stored})${d.warning ? ` ${d.warning}` : ""}` : d.error || "Upload failed.");
  }

  return (
    <div className="wrap stack-lg">
      <div className="stack"><div className="eyebrow">Advisors</div><h1 className="page-title">Upload section data</h1><p className="lede">Meeting times and seats from the registrar, so the schedule view can use real sections instead of the sample. Data is stored for review and is not yet used in plans. <Link href="/advisor">Back to the queue</Link></p></div>
      <Card>
        <div className="stack">
          <div className="field"><label htmlFor="pc">Advisor passcode</label><input id="pc" type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="off" /></div>
          <div className="field"><label htmlFor="src">Where did this data come from?</label><input id="src" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Registrar export, Spring 2027 schedule" /></div>
          <div className="field"><label htmlFor="csv">CSV (columns: course, term, section, days, start, end, seats, enrolled)</label><textarea id="csv" rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder={SAMPLE} /></div>
          <input type="file" accept=".csv,text/csv" aria-label="Choose a CSV file" onChange={async (e) => { const f = e.target.files?.[0]; if (f && f.size < 1_000_000) setText(await f.text()); }} />
          {errors.length > 0 && <ul className="plain" role="alert">{errors.slice(0, 5).map((x) => <li key={x}>{x}</li>)}</ul>}
          {rows.length > 0 && <p className="small">{rows.length} valid rows ready.</p>}
          <div><button className="btn" disabled={!rows.length || errors.length > 0 || source.trim().length < 2} onClick={send}>Store for review</button></div>
          {msg && <p role="status">{msg}</p>}
        </div>
      </Card>
    </div>
  );
}
