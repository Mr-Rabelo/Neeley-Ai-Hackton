"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useStudent } from "@/components/StudentContext";
import { Icon } from "@/components/ui";
import { hasCorrections } from "@/lib/corrections";

const TABS = [
  { href: "/student", label: "Overview" },
  { href: "/student/plan", label: "My plan" },
  { href: "/student/findings", label: "Findings" },
  { href: "/student/courses", label: "Courses" },
  { href: "/student/whatif", label: "What if" },
  { href: "/student/careers", label: "Careers" },
  { href: "/student/goals", label: "My goals" },
  { href: "/student/corrections", label: "Corrections" },
  { href: "/student/map", label: "Requirements map" },
  { href: "/student/samples", label: "Sample students" },
  { href: "/student/chat", label: "Ask the AI" },
];

export default function StudentLayout({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { record, ready, corrections } = useStudent();
  const locked = ready && !record;
  return (
    <div className="wrap stack-lg">
      <nav className="tabs" aria-label="Student sections">
        {TABS.map((t) => {
          const isLocked = locked && t.href !== "/student" && t.href !== "/student/samples" && t.href !== "/student/map";
          return (
            <Link key={t.href} href={t.href} className={`tab${isLocked ? " locked" : ""}`} aria-selected={path === t.href} title={isLocked ? "Load a transcript to unlock this section" : undefined} style={{ textDecoration: "none" }}>
              {isLocked && <span aria-hidden style={{ display: "inline-flex", marginRight: 6, verticalAlign: "-2px" }}><Icon name="lock" size={14} /></span>}{t.label}
            </Link>
          );
        })}
      </nav>
      {locked && <p className="small" role="status">Load a transcript to unlock these sections.</p>}
      {record && hasCorrections(corrections) && path !== "/student/corrections" && (
        <div className="banner" role="status"><span aria-hidden>✎</span><div><strong>Using your corrections.</strong> This page reflects changes you made, not the record we read. <Link href="/student/corrections">Review or reset</Link></div></div>
      )}
      {children}
    </div>
  );
}
