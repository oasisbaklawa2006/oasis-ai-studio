import { describe, expect, it } from "vitest";
import {
  evaluateLaunchAction,
  evaluateMobileApprovalAction,
  isSupportedMobileViewport,
  MOBILE_APPROVAL_MIN_VIEWPORT_PX,
  MOBILE_APPROVAL_SURFACE_CENSUS,
} from "./mobileApprovalAuthority";

describe("mobileApprovalAuthority viewport policy", () => {
  it("supports operator viewports at or above the 390px programme minimum", () => {
    expect(MOBILE_APPROVAL_MIN_VIEWPORT_PX).toBe(390);
    expect(isSupportedMobileViewport(390)).toBe(true);
    expect(isSupportedMobileViewport(768)).toBe(true);
    expect(isSupportedMobileViewport(389)).toBe(false);
  });
});

describe("mobileApprovalAuthority role gates (fail-closed)", () => {
  it("blocks reviewer actions for non-reviewers", () => {
    for (const action of [
      "approve_contributor_draft",
      "reject_contributor_draft",
      "approve_copy_draft",
      "reject_copy_draft",
      "approve_snapshot_preview",
      "approve_pilot_alias",
    ] as const) {
      const result = evaluateMobileApprovalAction(action, { isCatalogueReviewer: false });
      expect(result.allowed).toBe(false);
      expect(result.blockReason).toMatch(/reviewer/i);
    }
  });

  it("allows reviewer actions for catalogue reviewers", () => {
    for (const action of [
      "approve_contributor_draft",
      "reject_contributor_draft",
      "approve_copy_draft",
      "reject_copy_draft",
      "approve_snapshot_preview",
    ] as const) {
      const result = evaluateMobileApprovalAction(action, { isCatalogueReviewer: true });
      expect(result.allowed).toBe(true);
    }
  });

  it("blocks Central-governed contributor draft actions even for reviewers", () => {
    const result = evaluateMobileApprovalAction("approve_contributor_draft", {
      isCatalogueReviewer: true,
      governedByCentral: true,
    });
    expect(result.allowed).toBe(false);
    expect(result.blockReason).toMatch(/Central/i);
  });

  it("blocks export bundle when not distributable", () => {
    const result = evaluateMobileApprovalAction("export_approved_bundle", {
      isCatalogueReviewer: true,
      exportDistributable: false,
    });
    expect(result.allowed).toBe(false);
    expect(result.blockReason).toMatch(/distributable/i);
  });

  it("allows export bundle when distributable", () => {
    const result = evaluateMobileApprovalAction("export_approved_bundle", {
      isCatalogueReviewer: false,
      exportDistributable: true,
    });
    expect(result.allowed).toBe(true);
  });

  it("allows contributor submit-for-review without reviewer role", () => {
    const result = evaluateMobileApprovalAction("submit_copy_draft_for_review", {
      isCatalogueReviewer: false,
    });
    expect(result.allowed).toBe(true);
  });
});

describe("mobileApprovalAuthority launch boundary (Point 54)", () => {
  it("fail-closes all launch actions", () => {
    for (const action of [
      "publish_catalogue_version",
      "live_central_write",
      "activate_knowledge_in_core",
      "public_catalogue_route",
    ] as const) {
      const result = evaluateLaunchAction(action);
      expect(result.allowed).toBe(false);
      expect(result.blockReason).toMatch(/Point 54/i);
    }
  });
});

describe("mobileApprovalAuthority surface census", () => {
  it("lists every governed approval surface with a route", () => {
    expect(MOBILE_APPROVAL_SURFACE_CENSUS.length).toBeGreaterThanOrEqual(5);
    for (const entry of MOBILE_APPROVAL_SURFACE_CENSUS) {
      expect(entry.route).toBeTruthy();
      expect(["supported", "scroll_heavy"]).toContain(entry.mobilePosture);
      expect(["none", "preview_handoff_only"]).toContain(entry.launchAuthority);
    }
  });

  it("does not assign live launch authority to any surface", () => {
    for (const entry of MOBILE_APPROVAL_SURFACE_CENSUS) {
      expect(["none", "preview_handoff_only"]).toContain(entry.launchAuthority);
    }
    const noLaunch = MOBILE_APPROVAL_SURFACE_CENSUS.filter((e) => e.launchAuthority === "none");
    expect(noLaunch.map((e) => e.surface)).toEqual(
      expect.arrayContaining(["approval_inbox", "pilot_alias_review"]),
    );
    const handoffOnly = MOBILE_APPROVAL_SURFACE_CENSUS.filter(
      (e) => e.launchAuthority === "preview_handoff_only",
    );
    expect(handoffOnly.map((e) => e.surface)).toEqual(
      expect.arrayContaining([
        "catalogue_product_studio",
        "central_sync_preview",
        "product_intelligence_handoff",
      ]),
    );
  });
});
