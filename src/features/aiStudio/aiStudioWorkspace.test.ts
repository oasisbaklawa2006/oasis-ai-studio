import { describe, expect, it } from "vitest";
import { AI_STUDIO_WORKSPACES, summarizeAiStudioWorkspaces } from "./aiStudioWorkspace";

describe("AI Studio operational workspace", () => {
  it("routes every usable workspace to an application page", () => {
    const usable = AI_STUDIO_WORKSPACES.filter((workspace) => workspace.status !== "blocked");

    expect(usable.length).toBeGreaterThan(0);
    expect(usable.every((workspace) => workspace.href?.startsWith("/"))).toBe(true);
  });

  it("does not expose a link for backend-blocked work", () => {
    const blocked = AI_STUDIO_WORKSPACES.filter((workspace) => workspace.status === "blocked");

    expect(blocked.length).toBeGreaterThan(0);
    expect(blocked.every((workspace) => workspace.href === null)).toBe(true);
  });

  it("reports a complete, non-overlapping status summary", () => {
    const summary = summarizeAiStudioWorkspaces();

    expect(summary.operational + summary.review + summary.blocked).toBe(
      AI_STUDIO_WORKSPACES.length,
    );
    expect(summary.operational).toBe(5);
  });
});
