"use client";
import { Chat } from "@/components/Chat";
import { Card } from "@/components/Bits";

export default function ProspectChat() {
  return (
    <div className="wrap narrow stack-lg">
      <div className="stack"><div className="eyebrow">Talk it through</div><h1 className="page-title">I&apos;ll ask, you tap</h1><p className="lede">Not sure where you fit? The assistant asks one question at a time with options you can tap. It only uses what the catalog and the Bureau of Labor Statistics say, and it will tell you when it doesn&apos;t know.</p></div>
      <Card>
        <Chat mode="prospect" intro="Hi! I'd love to help you find a path that fits. To start, which of these sounds most like you?" starters={["I have no idea what I want", "I like working with numbers", "I like creative work", "I like leading people"]} />
      </Card>
    </div>
  );
}
