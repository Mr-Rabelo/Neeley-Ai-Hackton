"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

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
  return (
    <div className="wrap stack-lg">
      <nav className="tabs" aria-label="Student sections">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} className="tab" aria-selected={path === t.href} style={{ textDecoration: "none" }}>{t.label}</Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
