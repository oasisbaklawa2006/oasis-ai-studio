import { describe, expect, it } from "vitest";
import { formatActorLabel } from "./catalogueActorDisplay";

describe("formatActorLabel", () => {
  const actorId = "11111111-2222-3333-4444-555555555555";

  it("prefers full_name when present", () => {
    expect(formatActorLabel({ id: actorId, full_name: "Priya Rao", email: "priya@example.com" }, actorId)).toBe(
      "Priya Rao",
    );
  });

  it("falls back to email when full_name is missing", () => {
    expect(formatActorLabel({ id: actorId, full_name: null, email: "priya@example.com" }, actorId)).toBe(
      "priya@example.com",
    );
  });

  it("falls back to a short id when no profile is resolved", () => {
    expect(formatActorLabel(undefined, actorId)).toBe("11111111…");
  });

  it("falls back to a short id when the profile has neither name nor email", () => {
    expect(formatActorLabel({ id: actorId, full_name: null, email: null }, actorId)).toBe("11111111…");
  });
});
