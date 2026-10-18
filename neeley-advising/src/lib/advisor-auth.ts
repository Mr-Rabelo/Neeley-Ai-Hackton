import { json } from "./api";

/** Same rule as the review queue: ADVISOR_PASSCODE required in production. Returns a response when access is denied. */
export function advisorDenied(req: Request) {
  const pass = process.env.ADVISOR_PASSCODE;
  if (!pass && process.env.NODE_ENV === "production") return json({ error: "Advisor actions are disabled until ADVISOR_PASSCODE is set." }, 503);
  if (pass && req.headers.get("x-advisor-passcode") !== pass) return json({ error: "Advisor passcode required." }, 401);
  return null;
}
