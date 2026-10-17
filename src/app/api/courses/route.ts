import { json } from "@/lib/api";
import { searchCourses } from "@/lib/catalog";
import { availabilityFromCatalog, describeAvailability } from "@/lib/availability";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const rows = searchCourses(q, 25).map((c) => ({
    code: c.code, title: c.title, department: c.department, offered: describeAvailability(availabilityFromCatalog(c.offered)),
    prerequisites: c.prerequisiteText || "none listed",
  }));
  return json({ query: q, count: rows.length, courses: rows });
}
