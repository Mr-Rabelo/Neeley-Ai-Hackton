import { json } from "@/lib/api";
import { listRows } from "@/lib/store";

// Advisors only. Set ADVISOR_PASSCODE on the server and send it as the x-advisor-passcode header.
export async function GET(req: Request) {
  const pass = process.env.ADVISOR_PASSCODE;
  if (!pass && process.env.NODE_ENV === "production") return json({ error: "The advisor queue is disabled until ADVISOR_PASSCODE is set." }, 503);
  if (pass && req.headers.get("x-advisor-passcode") !== pass) return json({ error: "Advisor passcode required." }, 401);
  return json({ requests: await listRows("advisor_requests", 50) });
}
