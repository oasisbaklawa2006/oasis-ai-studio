import { describe, expect, it } from "vitest";
import { catalogueMediaTabDeepLink, catalogueRequiredMediaSlots } from "./catalogueMediaSlots";

describe("catalogueMediaTabDeepLink", () => {
  it("always deep-links to the literal Media tab path for the given product, regardless of slot type", () => {
    expect(catalogueMediaTabDeepLink("p1")).toBe("/products/p1?tab=media");
    expect(catalogueMediaTabDeepLink("abc-123")).toBe("/products/abc-123?tab=media");
  });
});

// Test governance mode defaults to "testing" (VITE_MEDIA_GOVERNANCE_MODE unset in this
// environment — see mediaGovernanceMode.ts) — required slots reduce to hero_image only. This
// test is intentionally about the *wiring* (does the adapter correctly pass rows/context through
// to evaluateMediaReadiness() and shape its output), not a re-test of that engine's own formula —
// mediaReadinessEngine.test.ts already covers required/optional classification and approval rules.
describe("catalogueRequiredMediaSlots", () => {
  it("marks the required slot missing when no matching approved media row exists", () => {
    const slots = catalogueRequiredMediaSlots({ productId: "p1" }, []);
    expect(slots.length).toBeGreaterThan(0);
    expect(slots.every((s) => s.status === "missing")).toBe(true);
  });

  it("marks the required slot satisfied only when an approved row of the matching type exists", () => {
    const slots = catalogueRequiredMediaSlots({ productId: "p1" }, [
      { id: "h1", type: "hero_image", status: "approved", file_url: "https://cdn.example/hero.jpg" },
    ]);
    expect(slots.some((s) => s.status === "satisfied")).toBe(true);
  });

  it("a pending/draft/rejected row does NOT satisfy a required slot (approved-only authority)", () => {
    const pending = catalogueRequiredMediaSlots({ productId: "p1" }, [
      { id: "h1", type: "hero_image", status: "pending_approval", file_url: "https://cdn.example/hero.jpg" },
    ]);
    expect(pending.every((s) => s.status === "missing")).toBe(true);

    const rejected = catalogueRequiredMediaSlots({ productId: "p1" }, [
      { id: "h1", type: "hero_image", status: "rejected", file_url: "https://cdn.example/hero.jpg" },
    ]);
    expect(rejected.every((s) => s.status === "missing")).toBe(true);
  });

  it("every returned slot carries a human label, not just a raw type", () => {
    const slots = catalogueRequiredMediaSlots({ productId: "p1" }, []);
    for (const slot of slots) {
      expect(slot.label).toBeTruthy();
      expect(typeof slot.label).toBe("string");
    }
  });

  // Bugbot-caught: a product with an approved legacy hero_image_url/media_status but zero
  // product_media rows must not disagree with the anchor/media preview, which already falls back
  // to that same legacy column via resolveProductCardHeroUrl().
  it("falls back to the legacy hero_image_url/media_status when there are no product_media rows", () => {
    const satisfied = catalogueRequiredMediaSlots({ productId: "p1" }, [], {
      hero_image_url: "https://cdn.example/legacy-hero.jpg",
      media_status: "approved",
    });
    expect(satisfied.some((s) => s.status === "satisfied")).toBe(true);
  });

  it("does not satisfy a slot from a legacy hero that isn't approved", () => {
    const pending = catalogueRequiredMediaSlots({ productId: "p1" }, [], {
      hero_image_url: "https://cdn.example/legacy-hero.jpg",
      media_status: "pending_approval",
    });
    expect(pending.every((s) => s.status === "missing")).toBe(true);
  });

  it("product_media rows take priority over the legacy hero fallback when rows exist", () => {
    const slots = catalogueRequiredMediaSlots(
      { productId: "p1" },
      [{ id: "h1", type: "hero_image", status: "pending_approval", file_url: "https://cdn.example/hero.jpg" }],
      { hero_image_url: "https://cdn.example/legacy-hero.jpg", media_status: "approved" },
    );
    expect(slots.every((s) => s.status === "missing")).toBe(true);
  });
});
