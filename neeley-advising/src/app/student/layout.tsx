"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useStudent } from "@/components/StudentContext";
import { Icon } from "@/components/ui";

const TABS = [
  { href: "/student", label: "Overview" },
  { href: "/student/plan", label: "My plan" },
  { href: "/student/courses", label: "Courses" },
  { href: "/student/whatif", label: "What if" },
  { href: "/student/careers", label: "Careers" },
  { href: "/student/chat", label: "Ask the AI" },
];

export default function StudentLayout({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { record, ready } = useStudent();
  const locked = ready && !record;
  return (
    <div className="wrap stack-lg">
      <nav className="tabs" aria-label="Student sections">
        {TABS.map((t) => {
          const isLocked = locked && t.href !== "/student";
          return (
            <Link key={t.href} href={t.href} className={`tab${isLocked ? " locked" : ""}`} aria-selected={path === t.href} title={isLocked ? "Load a transcript to unlock this section" : undefined} style={{ textDecoration: "none" }}>
              {isLocked && <span aria-hidden style={{ display: "inline-flex", marginRight: 6, verticalAlign: "-2px" }}><Icon name="lock" size={14} /></span>}{t.label}
            </Link>
          );
        })}
      </nav>
      {locked && <p className="small" role="status">Load a transcript to unlock these sections.</p>}
      {children}
    </div>
  );
}
