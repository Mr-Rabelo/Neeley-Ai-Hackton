import type { StudentRecord, TranscriptCourse } from "./types";

/**
 * Five fictional students for demos and scenario testing. Each one reuses the structure of the supplied
 * sample transcript (terms, attributes, transfer lines) with invented names and small, deliberate changes.
 * None of them is a real person and none of them has a real record.
 */
export interface SampleStudent {
  id: string;
  name: string;
  scenario: 1 | 2 | 3 | 4 | null;
  headline: string;
  story: string;
  expect: string;
}

export const SAMPLE_STUDENTS: SampleStudent[] = [
  { id: "riley", name: "Riley Navarro", scenario: 1, headline: "Wants to graduate on time", story: "Finance major with Honors. Finished the first year and is in the middle of a normal second-year Fall.", expect: "A feasible plan to the four-year target, with the bottleneck and the slip risks shown." },
  { id: "jordan", name: "Jordan Whitaker", scenario: 2, headline: "Thinking about a minor", story: "Marketing major who is curious about an accounting minor because of an interest in consulting.", expect: "The original plan next to the minor plan: added requirements, scheduling, graduation effect." },
  { id: "priya", name: "Priya Raman", scenario: 3, headline: "Hits a prerequisite bottleneck", story: "Business Information Systems major whose gateway statistics and accounting courses are not yet taken.", expect: "The sharpest bottleneck named, with the courses it holds up and an alternative if one exists." },
  { id: "devon", name: "Devon Castillo", scenario: 4, headline: "The record is incomplete or outdated", story: "Accounting major on an older catalog year (2022-23) whose transfer credit has not been evaluated.", expect: "The app flags the uncertainty, does not present the plan as fact, and sends the student to an advisor." },
  { id: "sam", name: "Sam Okonkwo", scenario: null, headline: "Double major", story: "Accounting and Finance. Shows how shared courses and extra hours interact.", expect: "Combined requirements, overlap and the added hours." },
];

const swap = (b: StudentRecord, patch: Partial<StudentRecord>, n: number, name: string): StudentRecord => ({
  ...b,
  name,
  idMasked: `00000000${n}`,
  ...patch,
  isSample: true,
});

/** Builds one sample student from the parsed sample record. Pure; the base is not modified. */
export function buildSampleStudent(base: StudentRecord, id: string): StudentRecord | null {
  const keep = (drop: string[]): TranscriptCourse[] => base.courses.filter((c) => !drop.includes(c.code));
  switch (id) {
    case "riley":
      return swap(base, { plans: ["Finance", "Honors College"] }, 1, "Navarro,Riley");
    case "jordan":
      return swap(base, { plans: ["Marketing", "Honors College"] }, 2, "Whitaker,Jordan");
    case "priya":
      return swap(base, { plans: ["Business Info Systems BBA"], courses: keep(["INSC20153", "ACCT20353"]) }, 3, "Raman,Priya");
    case "devon": {
      const courses = base.courses.map((c) => (c.code === "ECON10223" || c.code === "ECON10233" ? { ...c, transfer: true, transferFrom: "Unknown institution" } : c));
      return swap(base, { plans: ["Accounting"], catalogTermId: "2022-Fall", courses }, 4, "Castillo,Devon");
    }
    case "sam":
      return swap(base, { plans: ["Accounting", "Finance"] }, 5, "Okonkwo,Sam");
    default:
      return null;
  }
}
