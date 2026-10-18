/** Life of an advisor request. The AI never sets "reviewed"; only an advisor action does. */
export type ReqStatus = "draft" | "requested" | "review_requested" | "needs_info" | "reviewed" | "superseded";

export const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  requested: "Requested",
  review_requested: "Waiting for an advisor",
  needs_info: "Advisor needs more from you",
  reviewed: "Reviewed by an advisor",
  superseded: "Replaced by a newer request",
};

export const STATUS_TONE: Record<string, string> = {
  draft: "b-neutral",
  requested: "b-info",
  review_requested: "b-info",
  needs_info: "b-warn",
  reviewed: "b-good",
  superseded: "b-neutral",
};

export type AdvisorAction = "request_info" | "mark_reviewed" | "supersede" | "reopen" | "note";

export const ACTION_RESULT: Record<AdvisorAction, ReqStatus | null> = {
  request_info: "needs_info",
  mark_reviewed: "reviewed",
  supersede: "superseded",
  reopen: "review_requested",
  note: null,
};

export const ACTION_LABEL: Record<AdvisorAction, string> = {
  request_info: "Ask student for more info",
  mark_reviewed: "Mark reviewed",
  supersede: "Mark superseded",
  reopen: "Reopen",
  note: "Add private note",
};

export interface LogEntry {
  at: string;
  by: "advisor" | "student";
  action: string;
  /** Shown to the student only when true. */
  visible: boolean;
  note: string;
}

export function appendLog(packet: Record<string, unknown> | null | undefined, e: LogEntry): Record<string, unknown> {
  const log = Array.isArray(packet?.advisorLog) ? (packet!.advisorLog as LogEntry[]) : [];
  return { ...(packet ?? {}), advisorLog: [...log, e] };
}
