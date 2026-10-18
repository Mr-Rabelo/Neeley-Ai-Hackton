import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Header } from "@/components/Header";
import { StudentProvider } from "@/components/StudentContext";
import { FloatingAssistant } from "@/components/FloatingAssistant";

export const metadata: Metadata = {
  title: "Neeley Advising",
  description: "AI-powered graduation planning for TCU Neeley School of Business: plans that check prerequisites, show sources, and send hard decisions to a real advisor.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <a className="skip" href="#main">Skip to content</a>
        <StudentProvider>
          <Header />
          <main id="main">{children}</main>
          <footer className="footer">
            <div className="wrap">
              Demo built on the TCU Undergraduate 2026-2027 Catalog and a sample student. Plans are drafts that no advisor has reviewed. Nothing here changes an official record or promises a job, a salary or admission.
            </div>
          </footer>
          <FloatingAssistant />
        </StudentProvider>
      </body>
    </html>
  );
}
