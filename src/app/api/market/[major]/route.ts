import { bad, json } from "@/lib/api";
import { difficultyFor, marketForMajor } from "@/lib/market";

export async function GET(_req: Request, { params }: { params: Promise<{ major: string }> }) {
  const { major } = await params;
  const m = marketForMajor(major);
  if (!m) return bad("No market data for that major.", 404);
  return json({ market: m, difficulty: difficultyFor(major) });
}
