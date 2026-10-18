// Shared types for the planning engine, transcript parser and AI layers.

export type Confidence = "confirmed" | "historical_pattern" | "forecast" | "assumption";
export type TermName = "Spring" | "Summer" | "Fall";

export interface Term {
  id: string; // "2027-Spring"
  year: number;
  name: TermName;
  index: number; // monotonically increasing across terms
  label: string; // "Spring 2027"
}

export interface SourceRecord {
  id: string;
  title: string;
  owner: string;
  catalogYear: string;
  type: string;
  asOf: string;
  document?: string;
  url?: string;
}

// ---------- prerequisites ----------
export type PrereqExpr =
  | { kind: "course"; code: string; minGrade?: string }
  | { kind: "all"; items: PrereqExpr[] }
  | { kind: "any"; items: PrereqExpr[] };

export interface CourseRule {
  code: string; // "FINA30153"
  prereq?: PrereqExpr;
  coreq: string[];
  restrictions: string[]; // non-course conditions, e.g. "must be a business major"
  ambiguous: boolean; // wording mixes and/or; a human should read it
  otherPaths: boolean; // text also allows a score, permission or equivalent
  prereqText: string;
}

// ---------- catalog ----------
export interface CatalogCourse {
  code: string; // "FINA 30153"
  subject: string;
  number: string;
  title: string;
  department: string;
  description: string;
  prerequisiteText: string;
  offered: string;
  grading: string;
  crossListed: string[];
  catalogPage: number;
  sourceId: string;
  paired: boolean;
}

export interface ReqCourse {
  code: string;
  credits?: number;
  associated?: boolean;
}

export interface ReqGroup {
  id: string;
  label: string;
  hours: number;
  from: string[];
  minFromSubject?: Record<string, number>;
  maxOutsideSubject?: Record<string, number>;
  note?: string;
  advisorNote?: string;
  followUp?: string;
}

export interface Program {
  id: string;
  name: string;
  degree?: string;
  sourceId: string;
  page: number;
  totalHours?: number | string;
  writingEmphasisHours?: number;
  writingEmphasisCourses?: string[];
  required: ReqCourse[];
  groups: ReqGroup[];
  substitutions?: { replace: string; with: string; note: string }[];
  notes?: string[];
  advisorRequired?: boolean;
  minGpa?: number;
  forMajors?: string;
}

// ---------- student ----------
export interface TranscriptCourse {
  code: string; // "ECON10223"
  title: string;
  attempted: number;
  earned: number;
  grade: string; // "A", "B+", "P", "T", "" for in progress
  termId: string; // "2025-Fall"
  attributes: string[];
  topic?: string;
  transfer: boolean;
  transferFrom?: string;
  status: "completed" | "in_progress" | "withdrawn" | "failed";
  program?: string;
}

export interface StudentRecord {
  name: string;
  idMasked: string;
  printDate: string;
  catalogTermId: string; // requirement term on the record, e.g. "2025-Fall"
  plans: string[]; // plan descriptions as printed
  courses: TranscriptCourse[];
  cumGpa: number;
  earnedHours: number;
  attemptedHours: number;
  currentTermId: string;
  isSample: boolean;
}

export interface PlanOptions {
  majors: string[]; // program ids
  minors: string[];
  maxCreditsPerTerm: number;
  allowSummer: boolean;
  targetTermId?: string;
  careerTags?: string[];
  electivePrefs?: string[]; // course codes the student wants
  avoid?: string[];
  excludeSlots?: { code: string; termId: string }[]; // used by the slip test
}

// ---------- findings ----------
export type FindingType = "prereq" | "conflict" | "missing_info" | "delay" | "policy" | "unverified" | "opportunity";
export type Severity = "info" | "warning" | "blocker";

export interface Finding {
  id: string;
  type: FindingType;
  severity: Severity;
  courseIds: string[];
  termId?: string;
  message: string;
  fix?: string;
  confidence: Confidence;
  sourceIds: string[];
  needsAdvisor: boolean;
}

export interface PlannedCourse {
  code: string; // real code or placeholder id
  title: string;
  credits: number;
  placeholder?: boolean;
  satisfies: string[]; // requirement labels
  availability: Availability;
  reason: string;
}

export interface PlannedTerm {
  termId: string;
  label: string;
  courses: PlannedCourse[];
  credits: number;
  current?: boolean;
}

export interface Availability {
  terms: TermName[];
  rare: boolean;
  unknown: boolean;
  alternating: boolean;
  raw: string;
  confidence: Confidence;
  sourceId: string;
  note: string;
}

export interface RequirementStatus {
  id: string;
  label: string;
  category: "lower-division" | "business-core" | "major" | "minor" | "core-curriculum" | "associated" | "policy";
  programId?: string;
  hoursNeeded: number;
  hoursDone: number;
  hoursInProgress: number;
  status: "complete" | "in_progress" | "remaining";
  satisfiedBy: string[]; // course codes
  remainingCourses: string[]; // for required lists
  chooseFrom?: string[];
  /** Titles for the codes in chooseFrom. Display only; added so the UI can list alternatives by name. */
  chooseFromTitles?: Record<string, string>;
  sourceId: string;
  page?: number;
  note?: string;
}

export interface Bottleneck {
  code: string;
  title: string;
  descendants: number;
  offeredTerms: number;
  slipTerms: number;
  why: string;
}

export interface PlanResult {
  planId: string;
  label: string;
  generatedFor: { majors: string[]; minors: string[] };
  catalogYear: string;
  terms: PlannedTerm[];
  earliestGraduation: { termId: string | null; label: string | null; confidence: Confidence };
  totalCredits: number;
  remainingCredits: number;
  peakCredits: number;
  summerUsed: boolean;
  bottleneck: Bottleneck | null;
  slips: { code: string; title: string; slipTerms: number }[];
  openCredits: number;
  findings: Finding[];
  unverified: string[];
  requirements: RequirementStatus[];
  sources: SourceRecord[];
  completeness: number;
  advisorQuestions: string[];
  status: "draft";
  notReviewed: true;
}

export interface ComparisonRow {
  key: string;
  label: string;
  values: Record<string, string>;
  differs: boolean;
}
