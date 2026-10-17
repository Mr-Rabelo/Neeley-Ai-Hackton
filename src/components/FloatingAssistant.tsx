"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Chat } from "./Chat";
import { useStudent } from "./StudentContext";

export function FloatingAssistant() {
  const [open, setOpen] = useState(false);
  const { record, profile } = useStudent();
  const path = usePathname();
  if (path === "/chat" || path === "/student/chat") return null;
  const mode = record ? "student" : "prospect";
  return (
    <>
      {open && (
        <div className="dock-panel" role="dialog" aria-label="Ask the Neeley assistant">
          <div className="row-between">
            <b>Ask the assistant</b>
            <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)} aria-label="Close assistant">Close</button>
          </div>
          <Chat
            mode={mode}
            record={record}
            profile={profile}
            intro={record ? "Hi! I can explain your plan, check a course, or compare options. What would you like to know?" : "Hi! I can help you explore Neeley majors, courses and where they can lead. Want to start with a quick question?"}
            starters={record ? ["What could delay my graduation?", "Explain my next term"] : ["I'm not sure what I want", "Tell me about Finance"]}
          />
        </div>
      )}
      <button className="dock-btn" onClick={() => setOpen((o) => !o)} aria-label={open ? "Close the assistant" : "Open the assistant"} aria-expanded={open}>{open ? "×" : "✦"}</button>
    </>
  );
}
