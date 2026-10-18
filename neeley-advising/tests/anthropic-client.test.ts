import { afterEach, describe, expect, it } from "vitest";
import { anthropicHeaders } from "@/lib/ai/client";

const saved = process.env.ANTHROPIC_WORKSPACE_ID;
afterEach(() => { if (saved === undefined) delete process.env.ANTHROPIC_WORKSPACE_ID; else process.env.ANTHROPIC_WORKSPACE_ID = saved; });

describe("Anthropic workspace header", () => {
  it("sends no extra header unless a workspace ID is configured", () => {
    delete process.env.ANTHROPIC_WORKSPACE_ID;
    expect(anthropicHeaders()).toEqual({});
    process.env.ANTHROPIC_WORKSPACE_ID = "   ";
    expect(anthropicHeaders()).toEqual({});
  });
  it("adds the anthropic-workspace-id header when it is", () => {
    process.env.ANTHROPIC_WORKSPACE_ID = " wrkspc_test123 ";
    expect(anthropicHeaders()).toEqual({ "anthropic-workspace-id": "wrkspc_test123" });
  });
});
