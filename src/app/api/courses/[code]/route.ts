import { json } from "@/lib/api";
import { courseDetail } from "@/lib/ai/tools";

export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const d = courseDetail(decodeURIComponent(code));
  return json(d, "error" in d ? 404 : 200);
}
