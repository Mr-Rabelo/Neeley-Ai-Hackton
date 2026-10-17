import { z } from "zod";
import { NextResponse } from "next/server";
import type { StudentRecord } from "./types";
import { anthropicLlm } from "./ai/llm";
import { hasAnthropicKey } from "./ai/client";
import type { Llm } from "./ai/llm";

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });
export const bad = (message: string, status = 400) => json({ error: message }, status);

const course = z.object({
  code: z.string().max(12),
  title: z.string().max(120),
  attempted: z.number(),
  earned: z.number(),
  grade: z.string().max(3),
  termId: z.string().max(12),
  attributes: z.array(z.string().max(80)).max(20),
  topic: z.string().max(120).optional(),
  transfer: z.boolean(),
  transferFrom: z.string().max(120).optional(),
  status: z.enum(["completed", "in_progress", "withdrawn", "failed"]),
  program: z.string().max(120).optional(),
});

export const recordSchema = z.object({
  name: z.string().max(120),
  idMasked: z.string().max(20),
  printDate: z.string().max(20),
  catalogTermId: z.string().max(12),
  plans: z.array(z.string().max(120)).max(10),
  courses: z.array(course).max(200),
  cumGpa: z.number(),
  earnedHours: z.number(),
  attemptedHours: z.number(),
  currentTermId: z.string().max(12),
  isSample: z.boolean(),
});

export function parseRecord(v: unknown): StudentRecord | null {
  const r = recordSchema.safeParse(v);
  return r.success ? (r.data as StudentRecord) : null;
}

export function llmOrNull(): Llm | null {
  return hasAnthropicKey() ? anthropicLlm : null;
}

export const AI_OFF = "The AI assistant is not configured on this server (ANTHROPIC_API_KEY is missing). The planning engine, courses and market data still work.";

export async function readJson<T>(req: Request, schema: z.ZodType<T>): Promise<{ ok: true; data: T } | { ok: false; res: NextResponse }> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { ok: false, res: bad("Request body must be JSON.") };
  }
  const r = schema.safeParse(body);
  if (!r.success) return { ok: false, res: bad(`Invalid request: ${r.error.issues[0]?.path.join(".")} ${r.error.issues[0]?.message}`) };
  return { ok: true, data: r.data };
}
