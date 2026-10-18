import type { StudentRecord, TranscriptCourse } from "./types";
import { termIdFromTranscript } from "./terms";

const COURSE_LINE = /^([A-Z]{2,5}) (\d{5}) (.+?) (\d+\.\d{2}) (\d+\.\d{2})(?: ([A-Z][+-]?))?(?: (\d+\.\d{3}))?$/;
const TERM_LINE = /^(\d{4} (?:Fall|Spring|Summer)) Term$/;
const PLAN_ROW = /^UGRD\s+\S+\s+(\d{4} (?:Fall|Spring|Summer)) Term\s+(.+?)\s+\d{4} (?:Fall|Spring|Summer) Term$/;

export function parseTranscriptText(raw: string, opts: { isSample?: boolean } = {}): StudentRecord {
  const lines = raw.split(/\r?\n/).map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  const courses: TranscriptCourse[] = [];
  const plans: string[] = [];
  let name = "";
  let id = "";
  let printDate = "";
  let catalogTermId = "";
  let termId = "";
  let program = "";
  let transferFrom: string | undefined;
  let last: TranscriptCourse | undefined;
  let cumGpa = 0;
  let attempted = 0;
  let earned = 0;

  for (const line of lines) {
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^Name:\s*(.+)$/))) { name = m[1].trim(); continue; }
    if ((m = line.match(/^Student ID:\s*(\S+)/))) { id = m[1]; continue; }
    if ((m = line.match(/^Print Date:\s*(\S+)/))) { printDate = m[1]; continue; }
    if ((m = line.match(PLAN_ROW))) {
      catalogTermId ||= termIdFromTranscript(m[1]) ?? "";
      if (!plans.includes(m[2])) plans.push(m[2]);
      continue;
    }
    if ((m = line.match(TERM_LINE))) { termId = termIdFromTranscript(m[1]) ?? ""; transferFrom = undefined; last = undefined; continue; }
    if ((m = line.match(/^Program:\s*(.+)$/))) { program = m[1]; continue; }
    if ((m = line.match(/^Transfer Credit from (.+)$/))) { transferFrom = m[1].trim(); continue; }
    if (/^Applied Toward/.test(line) || /^Course Transfer GPA/.test(line)) continue;
    if ((m = line.match(/^Cum GPA:\s*([\d.]+)\s+Cum Totals:\s*([\d.]+)\s+([\d.]+)/))) {
      cumGpa = Number(m[1]); attempted = Number(m[2]); earned = Number(m[3]); transferFrom = undefined; continue;
    }
    if (/^Term GPA/.test(line)) { transferFrom = undefined; continue; }
    if ((m = line.match(/^Course Attribute:\s*(.+)$/))) { last?.attributes.push(m[1].trim()); continue; }
    if ((m = line.match(/^Course Topic:\s*(.+)$/))) { if (last) last.topic = m[1].trim(); continue; }
    if ((m = line.match(COURSE_LINE)) && termId) {
      const [, subj, num, title, att, ern, grade] = m;
      const isTransfer = grade === "T" || !!transferFrom;
      const a = Number(att);
      const e = Number(ern);
      const g = grade ?? "";
      let status: TranscriptCourse["status"] = "completed";
      if (g === "W") status = "withdrawn";
      else if (g === "F") status = "failed";
      else if (!g && e === 0 && a > 0) status = "in_progress";
      const c: TranscriptCourse = {
        code: `${subj}${num}`,
        title: title.trim(),
        attempted: a,
        earned: e,
        grade: g,
        termId,
        attributes: [],
        transfer: isTransfer,
        transferFrom: isTransfer ? transferFrom : undefined,
        status,
        program,
      };
      courses.push(c);
      last = c;
    }
  }

  const inProgress = courses.filter((c) => c.status === "in_progress");
  const currentTermId = inProgress.length ? inProgress[inProgress.length - 1].termId : courses.length ? courses[courses.length - 1].termId : "";
  return {
    name,
    idMasked: id ? `••••${id.slice(-4)}` : "",
    printDate,
    catalogTermId,
    plans,
    courses,
    cumGpa,
    earnedHours: earned > 0 && attempted > 0 && earned >= attempted ? earned : earned,
    attemptedHours: attempted,
    currentTermId,
    isSample: !!opts.isSample,
  };
}

// ---------- grades ----------
const GRADE_POINTS: Record<string, number> = {
  "A+": 4, A: 4, "A-": 3.67, "B+": 3.33, B: 3, "B-": 2.67, "C+": 2.33, C: 2, "C-": 1.67, "D+": 1.33, D: 1, "D-": 0.67, F: 0,
};

export function gradeValue(g: string): number | null {
  return g in GRADE_POINTS ? GRADE_POINTS[g] : null;
}

/** Does a grade satisfy a minimum grade? P counts as a pass but is reported so callers can flag it. */
export function meetsGrade(grade: string, min = "C-"): boolean {
  if (grade === "P" || grade === "T") return true;
  const v = gradeValue(grade);
  const need = gradeValue(min);
  return v !== null && need !== null && v >= need;
}

export function plansToMajorIds(plans: string[]): { majors: string[]; other: string[] } {
  const majors: string[] = [];
  const other: string[] = [];
  for (const p of plans) {
    const l = p.toLowerCase();
    if (/business info/.test(l)) majors.push("bis");
    else if (/real estate/.test(l)) majors.push("finance-re");
    else if (/^finance/.test(l)) majors.push("finance");
    else if (/accounting/.test(l)) majors.push("accounting");
    else if (/entrepreneur/.test(l)) majors.push("entrepreneurship");
    else if (/^management/.test(l)) majors.push("management");
    else if (/marketing/.test(l)) majors.push("marketing");
    else if (/supply/.test(l)) majors.push("scm");
    else other.push(p);
  }
  return { majors: [...new Set(majors)], other };
}

export function completedCodes(rec: StudentRecord): Set<string> {
  return new Set(rec.courses.filter((c) => c.status === "completed").map((c) => c.code));
}

export function gpaBySubject(rec: StudentRecord) {
  const acc: Record<string, { points: number; hours: number; courses: string[] }> = {};
  for (const c of rec.courses) {
    if (c.status !== "completed" || c.transfer) continue;
    const v = gradeValue(c.grade);
    if (v === null) continue;
    const subj = c.code.replace(/\d+$/, "");
    const a = (acc[subj] ??= { points: 0, hours: 0, courses: [] });
    a.points += v * c.earned;
    a.hours += c.earned;
    a.courses.push(c.code);
  }
  return Object.entries(acc)
    .map(([subject, a]) => ({ subject, gpa: a.hours ? Math.round((a.points / a.hours) * 100) / 100 : 0, hours: a.hours, courses: a.courses }))
    .sort((x, y) => y.hours - x.hours);
}
