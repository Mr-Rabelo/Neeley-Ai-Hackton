"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/student", label: "Current student" },
  { href: "/survey", label: "Explore Neeley" },
  { href: "/compare", label: "Compare majors" },
  { href: "/next", label: "Next steps" },
];

export function Header() {
  const path = usePathname();
  return (
    <header className="site-header">
      <div className="wrap">
        <Link href="/" className="brand"><span className="logo" aria-hidden>TCU</span> Neeley Advising</Link>
        <nav className="nav" aria-label="Main">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} aria-current={path === l.href || path.startsWith(l.href + "/") ? "page" : undefined}>{l.label}</Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
