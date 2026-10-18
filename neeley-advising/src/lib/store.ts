import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

export type Table = "advisor_requests" | "feedback" | "applications_mock" | "survey_responses" | "conversations" | "plans" | "data_uploads";

let _sb: SupabaseClient | null | undefined;
function supabase(): SupabaseClient | null {
  if (_sb !== undefined) return _sb;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  _sb = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  return _sb;
}

// Fallback used when Supabase is not configured (local demos). Cleared on restart.
const memory: Record<string, Record<string, unknown>[]> = {};

export function storageMode(): "supabase" | "memory" {
  return supabase() ? "supabase" : "memory";
}

export async function saveRow(table: Table, row: Record<string, unknown>): Promise<{ id: string; stored: "supabase" | "memory"; warning?: string }> {
  const id = randomUUID();
  const record = { id, created_at: new Date().toISOString(), ...row };
  const sb = supabase();
  if (sb) {
    const { error } = await sb.from(table).insert(record);
    if (!error) return { id, stored: "supabase" };
    (memory[table] ??= []).push(record);
    return { id, stored: "memory", warning: `Supabase insert failed (${error.message}); kept in memory only.` };
  }
  (memory[table] ??= []).push(record);
  return { id, stored: "memory" };
}

export async function listRows(table: Table, limit = 50): Promise<Record<string, unknown>[]> {
  const sb = supabase();
  if (sb) {
    const { data, error } = await sb.from(table).select("*").order("created_at", { ascending: false }).limit(limit);
    if (!error && data) return data as Record<string, unknown>[];
  }
  return [...(memory[table] ?? [])].reverse().slice(0, limit);
}

// ---------- keyed state (voice conversations) ----------
const kv = new Map<string, Record<string, unknown>>();

export async function putState(table: Table, id: string, row: Record<string, unknown>): Promise<void> {
  const record = { id, updated_at: new Date().toISOString(), ...row };
  const sb = supabase();
  if (sb) {
    const { error } = await sb.from(table).upsert(record);
    if (!error) return;
  }
  kv.set(`${table}:${id}`, record);
}

export async function getState(table: Table, id: string): Promise<Record<string, unknown> | null> {
  const sb = supabase();
  if (sb) {
    const { data, error } = await sb.from(table).select("*").eq("id", id).maybeSingle();
    if (!error && data) return data as Record<string, unknown>;
  }
  return kv.get(`${table}:${id}`) ?? null;
}

// ---------- single-row read and update (advisor lifecycle) ----------
export async function getRow(table: Table, id: string): Promise<Record<string, unknown> | null> {
  const sb = supabase();
  if (sb) {
    const { data, error } = await sb.from(table).select("*").eq("id", id).maybeSingle();
    if (!error && data) return data as Record<string, unknown>;
  }
  return (memory[table] ?? []).find((r) => r.id === id) ?? null;
}

export async function updateRow(table: Table, id: string, patch: Record<string, unknown>): Promise<boolean> {
  const sb = supabase();
  if (sb) {
    const { error, data } = await sb.from(table).update(patch).eq("id", id).select("id");
    if (!error && data?.length) return true;
  }
  const row = (memory[table] ?? []).find((r) => r.id === id);
  if (!row) return false;
  Object.assign(row, patch);
  return true;
}
