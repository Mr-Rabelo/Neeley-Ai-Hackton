"use client";
import { useStudent } from "@/components/StudentContext";
import { Card, NeedStudent } from "@/components/Bits";
import { describeCorrections, hasCorrections, EMPTY_CORRECTIONS, type CourseFix } from "@/lib/corrections";

const GRADES = ["A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "F", "P", "T"];
const pretty = (c: string) => c.replace(/^([A-Z]+)(\d+)$/, "$1 $2");

export default function CorrectionsPage() {
  const { originalRecord: orig, ready, corrections, setCorrections } = useStudent();
  if (!ready) return <p>Loading…</p>;
  if (!orig) return <NeedStudent />;

  const fixOf = (code: string): CourseFix => corrections.courses[code] ?? {};
  function setFix(code: string, fix: CourseFix | null) {
    const courses = { ...corrections.courses };
    if (!fix || (fix.grade === undefined && !fix.termId && !fix.removed)) delete courses[code];
    else courses[code] = fix;
    setCorrections({ ...corrections, courses });
  }
  const transfers = orig.courses.filter((c) => c.transfer);
  const notes = describeCorrections(orig, corrections);

  return (
    <div className="stack-lg">
      <div className="stack"><div className="eyebrow">Corrections</div><h1 className="page-title">Something on your record look wrong?</h1><p className="lede">Fix a grade or term, remove a course that does not belong, or see what the plan would look like if your transfer credit were evaluated. Your corrections appear as an overlay labelled &quot;corrected by you&quot;. The record we read stays untouched, and an advisor sees both.</p></div>
      {hasCorrections(corrections) && (
        <div className="banner" role="status"><span aria-hidden>✎</span><div><strong>Using your corrections.</strong> Every page now reflects the changes below. They are not official and an advisor has not confirmed them.<ul className="plain small">{notes.map((n) => <li key={n}>{n}</li>)}</ul><button className="btn btn-ghost btn-sm" onClick={() => setCorrections(EMPTY_CORRECTIONS)}>Reset all corrections</button></div></div>
      )}
      {transfers.length > 0 && (
        <Card title="Transfer credit">
          <p>{transfers.map((c) => `${pretty(c.code)} ${c.title}`).join("; ")} are posted as transfer credit, and the app counts them toward total hours only because nobody has evaluated them against BBA requirements.</p>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="chip" aria-pressed={corrections.transferEvaluated} onClick={() => setCorrections({ ...corrections, transferEvaluated: !corrections.transferEvaluated })}>Treat transfer credit as evaluated</button>
          </div>
          <p className="small" style={{ marginTop: 8 }}>This is a what-if. Core areas are guessed from the transfer title (for example HUM, LT), so only an advisor or the registrar can confirm it.</p>
        </Card>
      )}
      <Card title="Courses on your record">
        <div className="table-wrap">
          <table className="report">
            <thead><tr><th scope="col">Course</th><th scope="col">Term</th><th scope="col">Grade we read</th><th scope="col">Your correction</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {orig.courses.map((c) => {
                const f = fixOf(c.code);
                const fixed = Object.keys(f).length > 0;
                return (
                  <tr key={c.code + c.termId} style={f.removed ? { opacity: 0.55 } : undefined}>
                    <td><b>{pretty(c.code)}</b> {c.title}{c.transfer && <span className="badge b-neutral" style={{ marginLeft: 6 }}>Transfer</span>}{fixed && <span className="badge b-info" style={{ marginLeft: 6 }}>Corrected by you</span>}</td>
                    <td>{c.termId.replace("-", " ")}</td>
                    <td>{c.grade || "In progress"}</td>
                    <td>
                      {f.removed ? <span className="small">Removed</span> : (
                        <select aria-label={`Grade for ${pretty(c.code)}`} value={f.grade ?? c.grade} onChange={(e) => setFix(c.code, { ...f, grade: e.target.value === c.grade ? undefined : e.target.value })}>
                          {!GRADES.includes(c.grade) && <option value={c.grade}>{c.grade || "In progress"}</option>}
                          {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
                          <option value="">In progress</option>
                        </select>
                      )}
                    </td>
                    <td>
                      {f.removed
                        ? <button className="btn btn-ghost btn-sm" onClick={() => setFix(c.code, { ...f, removed: undefined })}>Put back</button>
                        : <div className="row"><button className="btn btn-ghost btn-sm" onClick={() => setFix(c.code, { ...f, removed: true })}>Remove</button>{fixed && <button className="btn btn-ghost btn-sm" onClick={() => setFix(c.code, null)}>Undo</button>}</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="small">To send these to an advisor, request a plan review from the <a href="/next">next steps page</a>. Your corrections go along with the original record.</p>
    </div>
  );
}
