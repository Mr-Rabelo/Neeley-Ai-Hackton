"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Chat } from "@/components/Chat";
import { useStudent } from "@/components/StudentContext";
import { Card, NeedStudent } from "@/components/Bits";

function Inner() {
  const { record, profile, ready } = useStudent();
  const q = useSearchParams().get("q") ?? undefined;
  if (!ready) return <p>Loading…</p>;
  if (!record) return <NeedStudent />;
  return (
    <div className="stack-lg">
      <div className="stack"><div className="eyebrow">Ask the AI</div><h1 className="page-title">Ask about your plan</h1><p className="lede">The assistant uses the planning engine for anything about requirements or timing, cites its sources, and hands approvals to an advisor.</p></div>
      <Card>
        <Chat
          mode="student" record={record} profile={profile} initial={q}
          intro="Hi! I've read your record. I can explain your plan, what could delay graduation, how a minor or a different major would change things, or what the job market looks like. What would you like to know?"
          starters={["What could delay my graduation?", "What should I take next term?", "Would an accounting minor fit?", "How is the job market for my majors?"]}
        />
      </Card>
    </div>
  );
}

export default function Page() { return <Suspense fallback={<p>Loading…</p>}><Inner /></Suspense>; }
