import { describe, expect, it } from "vitest";
import type { CaptureEnvironment } from "./guidedMobileCameraCapture";
import {
  assessCaptureCapability,
  assessCapturePermission,
  bindCaptureSlot,
  buildCaptureGuidance,
  buildGuidedMobileCaptureCensus,
  CAPTURE_VIEWPORT_GUIDANCE,
  captureViewportGuidance,
  defaultCaptureEnvironment,
  isMobileUserAgent,
  isMobileViewport,
  resolveGuidedMobileCapture,
  validateCaptureHandoff,
  validateCaptureTargetMatch,
} from "./guidedMobileCameraCapture";

const POINT43_HEAD = "5f446a00a9a9a11d8854b8b8191c6293e7190eaf";

import type { ProductMediaContext } from "./types";

const baklawaProduct: ProductMediaContext = {
  productId: "prod-baklawa-1",
  category: "Baklawa",
  subcategory: "Pyramid",
};

const exportProduct: ProductMediaContext = {
  productId: "prod-export-1",
  productClass: "export",
  category: "Export",
};

const mobileCameraEnv: CaptureEnvironment = {
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
  viewportWidth: 390,
  viewportHeight: 844,
  isSecureContext: true,
  hasMediaDevices: true,
  hasGetUserMedia: true,
  permissionState: "granted",
};

const desktopEnv: CaptureEnvironment = {
  userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
  viewportWidth: 1440,
  viewportHeight: 900,
  isSecureContext: true,
  hasMediaDevices: true,
  hasGetUserMedia: true,
  permissionState: "granted",
};

describe("guidedMobileCameraCapture", () => {
  describe("viewport and capability detection", () => {
    it("detects mobile user agents and viewports deterministically", () => {
      expect(isMobileUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)")).toBe(true);
      expect(isMobileUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X)")).toBe(false);
      expect(isMobileViewport(390)).toBe(true);
      expect(isMobileViewport(1024)).toBe(false);
    });

    it("assesses guided camera eligibility on mobile with secure camera API", () => {
      const capability = assessCaptureCapability(mobileCameraEnv);
      expect(capability.guidedCameraEligible).toBe(true);
      expect(capability.cameraApiAvailable).toBe(true);
      expect(capability.isMobileViewport).toBe(true);
    });

    it("does not mark desktop as guided-camera eligible", () => {
      const capability = assessCaptureCapability(desktopEnv);
      expect(capability.guidedCameraEligible).toBe(false);
      expect(capability.cameraApiAvailable).toBe(true);
    });

    it("fail-closed when camera API unavailable outside secure context on mobile", () => {
      const insecureMobile: CaptureEnvironment = {
        ...mobileCameraEnv,
        isSecureContext: false,
        hasMediaDevices: false,
        hasGetUserMedia: false,
      };
      const capability = assessCaptureCapability(insecureMobile);
      expect(capability.guidedCameraEligible).toBe(false);
      expect(capability.cameraApiAvailable).toBe(false);
    });

    it("reads permission state from injected environment", () => {
      expect(assessCapturePermission({ ...mobileCameraEnv, permissionState: "denied" })).toBe(
        "denied",
      );
      expect(assessCapturePermission({ ...mobileCameraEnv, permissionState: "prompt" })).toBe(
        "prompt",
      );
    });

    it("provides deterministic viewport guidance per readiness slot", () => {
      expect(captureViewportGuidance("catalogue_image").aspectRatio).toBe("1:1");
      expect(captureViewportGuidance("primary_image").preferredOrientation).toBe("portrait");
      expect(captureViewportGuidance("label_front_image").cropHint).toContain("legible");
      expect(Object.keys(CAPTURE_VIEWPORT_GUIDANCE).length).toBeGreaterThanOrEqual(8);
    });
  });

  describe("slot binding", () => {
    it("binds hero_image to primary_image for baklawa family", () => {
      const bound = bindCaptureSlot(baklawaProduct, "hero_image");
      expect(bound.ok).toBe(true);
      if (!bound.ok) return;
      expect(bound.binding.readinessSlot).toBe("primary_image");
      expect(bound.familyKey).toBe("baklawa_small_sweets");
      expect(bound.binding.requiredForCatalogue).toBe(true);
    });

    it("binds white_background to catalogue_image for baklawa family", () => {
      const bound = bindCaptureSlot(baklawaProduct, "white_background");
      expect(bound.ok).toBe(true);
      if (!bound.ok) return;
      expect(bound.binding.readinessSlot).toBe("catalogue_image");
    });

    it("binds label_image to export pack label slot when readiness slot is explicit", () => {
      const bound = bindCaptureSlot(exportProduct, "label_image", "label_front_image");
      expect(bound.ok).toBe(true);
      if (!bound.ok) return;
      expect(bound.familyKey).toBe("export_pack");
      expect(bound.binding.readinessSlot).toBe("label_front_image");
    });

    it("fail-closed when uploader type is ambiguous across family slots", () => {
      const bound = bindCaptureSlot(exportProduct, "label_image");
      expect(bound.ok).toBe(false);
      if (bound.ok) return;
      expect(bound.error).toBe("ambiguous_slot");
    });

    it("fail-closed on unknown uploader type", () => {
      const bound = bindCaptureSlot(baklawaProduct, "not_a_real_slot");
      expect(bound.ok).toBe(false);
      if (bound.ok) return;
      expect(bound.error).toBe("unknown_uploader_type");
    });

    it("rejects capture target mismatch", () => {
      const mismatch = validateCaptureTargetMatch("hero_image", "white_background");
      expect(mismatch.ok).toBe(false);
      if (mismatch.ok) return;
      expect(mismatch.error).toBe("capture_target_mismatch");
    });
  });

  describe("guided capture resolution", () => {
    it("resolves point44_v1 contract with Point 42 family and Point 43 benchmark guidance", () => {
      const resolved = resolveGuidedMobileCapture(baklawaProduct, "hero_image", mobileCameraEnv);
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) return;

      expect(resolved.contract.schema).toBe("point44_v1");
      expect(resolved.contract.familyKey).toBe("baklawa_small_sweets");
      expect(resolved.governance.schema).toBe("point43_v1");
      expect(resolved.contract.guidance.benchmarkConstraints.length).toBeGreaterThan(0);
      expect(resolved.contract.guidance.operatorChecklist.length).toBeGreaterThan(
        OPERATOR_CHECKLIST_MIN,
      );
      expect(resolved.contract.handoffPolicy.preserveOriginalPixels).toBe(true);
      expect(resolved.contract.handoffPolicy.preserveExifOrientation).toBe(true);
    });

    it("presents Point 43 benchmark constraints in capture guidance before acceptance", () => {
      const guidance = buildCaptureGuidance("baklawa_small_sweets", {
        uploaderType: "hero_image",
        readinessSlot: "primary_image",
        familyKey: "baklawa_small_sweets",
        slotLabel: "Hero image",
        requiredForCatalogue: true,
      });
      expect(guidance.benchmarkConstraints.some((c) => c.domain === "composition")).toBe(true);
      expect(guidance.viewport.aspectRatio).toBe("3:4");
    });

    it("fail-closed when product identity is unresolved", () => {
      const resolved = resolveGuidedMobileCapture(
        { category: "Baklawa" },
        "hero_image",
        mobileCameraEnv,
      );
      expect(resolved.ok).toBe(false);
      if (resolved.ok) return;
      expect(resolved.error).toBe("product_identity_unresolved");
    });

    it("fail-closed when camera permission is denied on mobile", () => {
      const deniedEnv: CaptureEnvironment = { ...mobileCameraEnv, permissionState: "denied" };
      const resolved = resolveGuidedMobileCapture(baklawaProduct, "hero_image", deniedEnv);
      expect(resolved.ok).toBe(false);
      if (resolved.ok) return;
      expect(resolved.error).toBe("camera_permission_denied");
    });

    it("allows resolution on desktop without guided camera eligibility", () => {
      const resolved = resolveGuidedMobileCapture(baklawaProduct, "hero_image", desktopEnv);
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) return;
      expect(resolved.contract.capability.guidedCameraEligible).toBe(false);
    });

    it("marks downstream enhancement/QA/outputs as separate authorities", () => {
      const resolved = resolveGuidedMobileCapture(baklawaProduct, "hero_image", mobileCameraEnv);
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) return;
      expect(resolved.contract.downstreamAuthority).toEqual({
        enhancement: "point45",
        qa: "point46",
        outputs: "point47",
      });
    });
  });

  describe("capture handoff validation", () => {
    it("accepts guided camera handoff with matching slot and image MIME", () => {
      const resolved = resolveGuidedMobileCapture(baklawaProduct, "hero_image", mobileCameraEnv);
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) return;

      const handoff = validateCaptureHandoff(resolved.contract, {
        uploaderType: "hero_image",
        mimeType: "image/jpeg",
        source: "guided_camera",
      });
      expect(handoff.ok).toBe(true);
    });

    it("rejects silent gallery fallback on mobile without explicit acknowledgement", () => {
      const resolved = resolveGuidedMobileCapture(baklawaProduct, "hero_image", mobileCameraEnv);
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) return;

      const handoff = validateCaptureHandoff(resolved.contract, {
        uploaderType: "hero_image",
        mimeType: "image/jpeg",
        source: "governed_gallery_fallback",
      });
      expect(handoff.ok).toBe(false);
      if (handoff.ok) return;
      expect(handoff.error).toBe("silent_fallback_forbidden");
    });

    it("allows governed gallery fallback when operator explicitly acknowledges", () => {
      const resolved = resolveGuidedMobileCapture(baklawaProduct, "hero_image", mobileCameraEnv);
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) return;

      const handoff = validateCaptureHandoff(resolved.contract, {
        uploaderType: "hero_image",
        mimeType: "image/png",
        source: "governed_gallery_fallback",
        explicitFallbackAcknowledged: true,
      });
      expect(handoff.ok).toBe(true);
    });

    it("allows desktop gallery without acknowledgement when not guided-camera eligible", () => {
      const resolved = resolveGuidedMobileCapture(baklawaProduct, "hero_image", desktopEnv);
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) return;

      const handoff = validateCaptureHandoff(resolved.contract, {
        uploaderType: "hero_image",
        mimeType: "image/jpeg",
        source: "desktop_gallery",
      });
      expect(handoff.ok).toBe(true);
    });

    it("rejects non-image MIME types", () => {
      const resolved = resolveGuidedMobileCapture(baklawaProduct, "hero_image", mobileCameraEnv);
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) return;

      const handoff = validateCaptureHandoff(resolved.contract, {
        uploaderType: "hero_image",
        mimeType: "video/mp4",
        source: "guided_camera",
      });
      expect(handoff.ok).toBe(false);
      if (handoff.ok) return;
      expect(handoff.error).toBe("unsupported_media_type");
    });
  });

  it("defaultCaptureEnvironment returns a stable shape in Node tests", () => {
    const env = defaultCaptureEnvironment();
    expect(env).toHaveProperty("userAgent");
    expect(env).toHaveProperty("viewportWidth");
    expect(env).toHaveProperty("isSecureContext");
  });

  it("builds census with Point 43 predecessor SHA and surface gaps", () => {
    const census = buildGuidedMobileCaptureCensus(POINT43_HEAD, POINT43_HEAD);
    expect(census.schema).toBe("point44_census_v1");
    expect(census.baselineSha).toBe(POINT43_HEAD);
    expect(census.predecessorSha).toBe(POINT43_HEAD);
    expect(census.gaps.length).toBeGreaterThan(0);
    expect(census.surfaces.productMediaUploader).toContain("ProductMediaUploader");
  });
});

const OPERATOR_CHECKLIST_MIN = 4;
