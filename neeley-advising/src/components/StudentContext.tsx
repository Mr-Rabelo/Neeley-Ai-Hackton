"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { StudentRecord } from "@/lib/types";
import type { StudentProfile } from "@/lib/ai/profile";
import { postJson } from "@/lib/client";
import { applyCorrections, EMPTY_CORRECTIONS, EMPTY_GOALS, type Corrections, type Goals } from "@/lib/corrections";

export interface Extraction {
  method: string;
  agreed: boolean;
  discrepancies: string[];
  notes: string[];
}

interface Ctx {
  /** Effective record: what we read plus the student's corrections. */
  record: StudentRecord | null;
  originalRecord: StudentRecord | null;
  corrections: Corrections;
  goals: Goals;
  setCorrections: (c: Corrections) => void;
  setGoals: (g: Goals) => void;
  profile: StudentProfile | null;
  extraction: Extraction | null;
  loading: boolean;
  profiling: boolean;
  error: string | null;
  ready: boolean;
  loadSample: () => Promise<void>;
  loadFile: (f: File) => Promise<void>;
  loadText: (t: string) => Promise<void>;
  /** Load an already-parsed record (the fictional sample students). */
  loadRecord: (r: StudentRecord, note: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  clear: () => void;
}

const KEY = "neeley.student.v1";
const EXTRA_KEY = "neeley.extras.v1";
const StudentCtx = createContext<Ctx | null>(null);

export function StudentProvider({ children }: { children: ReactNode }) {
  const [record, setRecord] = useState<StudentRecord | null>(null);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [loading, setLoading] = useState(false);
  const [profiling, setProfiling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [corrections, setCorrectionsState] = useState<Corrections>(EMPTY_CORRECTIONS);
  const [goals, setGoalsState] = useState<Goals>(EMPTY_GOALS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const v = JSON.parse(raw);
        setRecord(v.record ?? null);
        setProfile(v.profile ?? null);
        setExtraction(v.extraction ?? null);
      }
      const ex = localStorage.getItem(EXTRA_KEY);
      if (ex) {
        const v = JSON.parse(ex);
        if (v.corrections) setCorrectionsState({ ...EMPTY_CORRECTIONS, ...v.corrections });
        if (v.goals) setGoalsState({ ...EMPTY_GOALS, ...v.goals });
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

  const saveExtras = useCallback((c: Corrections, g: Goals) => {
    try {
      localStorage.setItem(EXTRA_KEY, JSON.stringify({ corrections: c, goals: g }));
    } catch {
      /* ignore */
    }
  }, []);

  const effective = useMemo(() => (record ? applyCorrections(record, corrections) : null), [record, corrections]);

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
    setCorrectionsState(EMPTY_CORRECTIONS);
    setGoalsState(EMPTY_GOALS);
    saveExtras(EMPTY_CORRECTIONS, EMPTY_GOALS);
    setRecord(res.record);
    setExtraction(res.extraction);
    setProfile(null);
    persist(res.record, null, res.extraction);
    void buildProfile(res.record, res.extraction);
  }, [buildProfile, persist, saveExtras]);

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
    record: effective, originalRecord: record, corrections, goals,
    setCorrections: (c) => { setCorrectionsState(c); saveExtras(c, goals); },
    setGoals: (g) => { setGoalsState(g); saveExtras(corrections, g); },
    profile, extraction, loading, profiling, error, ready,
    loadSample: () => wrap(() => postJson("/api/transcript", { sample: true })),
    loadRecord: (r, note) => wrap(async () => ({ record: r, extraction: { method: "sample", agreed: true, discrepancies: [], notes: [note] } })),
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
    clear: () => { setCorrectionsState(EMPTY_CORRECTIONS); setGoalsState(EMPTY_GOALS); saveExtras(EMPTY_CORRECTIONS, EMPTY_GOALS); setRecord(null); setProfile(null); setExtraction(null); setError(null); persist(null, null, null); },
  }), [record, effective, corrections, goals, profile, extraction, loading, profiling, error, ready, wrap, buildProfile, persist, saveExtras]);

  return <StudentCtx.Provider value={value}>{children}</StudentCtx.Provider>;
}

export function useStudent(): Ctx {
  const c = useContext(StudentCtx);
  if (!c) throw new Error("useStudent must be used inside StudentProvider");
  return c;
}
