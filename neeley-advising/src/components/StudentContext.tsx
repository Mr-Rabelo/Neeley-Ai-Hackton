"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { StudentRecord } from "@/lib/types";
import type { StudentProfile } from "@/lib/ai/profile";
import { postJson } from "@/lib/client";

export interface Extraction {
  method: string;
  agreed: boolean;
  discrepancies: string[];
  notes: string[];
}

interface Ctx {
  record: StudentRecord | null;
  profile: StudentProfile | null;
  extraction: Extraction | null;
  loading: boolean;
  profiling: boolean;
  error: string | null;
  ready: boolean;
  loadSample: () => Promise<void>;
  loadFile: (f: File) => Promise<void>;
  loadText: (t: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  clear: () => void;
}

const KEY = "neeley.student.v1";
const StudentCtx = createContext<Ctx | null>(null);

export function StudentProvider({ children }: { children: ReactNode }) {
  const [record, setRecord] = useState<StudentRecord | null>(null);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [loading, setLoading] = useState(false);
  const [profiling, setProfiling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const v = JSON.parse(raw);
        setRecord(v.record ?? null);
        setProfile(v.profile ?? null);
        setExtraction(v.extraction ?? null);
      }
    } catch {
      /* storage can be blocked; the app works without it */
    }
    setReady(true);
  }, []);

  const persist = useCallback((r: StudentRecord | null, p: StudentProfile | null, e: Extraction | null) => {
    try {
      if (!r) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, JSON.stringify({ record: r, profile: p, extraction: e }));
    } catch {
      /* ignore */
    }
  }, []);

  const buildProfile = useCallback(async (r: StudentRecord, e: Extraction | null) => {
    setProfiling(true);
    try {
      const out = await postJson<{ profile: StudentProfile }>("/api/profile", { record: r });
      setProfile(out.profile);
      persist(r, out.profile, e);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not build the profile.");
    } finally {
      setProfiling(false);
    }
  }, [persist]);

  const accept = useCallback(async (res: { record: StudentRecord; extraction: Extraction }) => {
    setRecord(res.record);
    setExtraction(res.extraction);
    setProfile(null);
    persist(res.record, null, res.extraction);
    void buildProfile(res.record, res.extraction);
  }, [buildProfile, persist]);

  const wrap = useCallback(async (fn: () => Promise<{ record: StudentRecord; extraction: Extraction }>) => {
    setLoading(true);
    setError(null);
    try {
      await accept(await fn());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [accept]);

  const value = useMemo<Ctx>(() => ({
    record, profile, extraction, loading, profiling, error, ready,
    loadSample: () => wrap(() => postJson("/api/transcript", { sample: true })),
    loadText: (text) => wrap(() => postJson("/api/transcript", { text })),
    loadFile: (file) => wrap(async () => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/transcript", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not read that file.");
      return data;
    }),
    refreshProfile: async () => { if (record) await buildProfile(record, extraction); },
    clear: () => { setRecord(null); setProfile(null); setExtraction(null); setError(null); persist(null, null, null); },
  }), [record, profile, extraction, loading, profiling, error, ready, wrap, buildProfile, persist]);

  return <StudentCtx.Provider value={value}>{children}</StudentCtx.Provider>;
}

export function useStudent(): Ctx {
  const c = useContext(StudentCtx);
  if (!c) throw new Error("useStudent must be used inside StudentProvider");
  return c;
}
