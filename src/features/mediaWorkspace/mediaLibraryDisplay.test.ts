import { describe, expect, it } from "vitest";
import {
  countCompletedMediaUploads,
  formatSubmissionAge,
  mediaRowApprovalState,
  mediaRowStatusLabel,
  mediaSubmissionProductLabel,
  safeDisplayableMediaUrl,
  shouldShowMediaReviewEmptyState,
  summarizeMediaSubmissionPayload,
} from "./mediaLibraryDisplay";

describe("mediaRowApprovalState", () => {
  it("maps known statuses deterministically", () => {
    expect(mediaRowApprovalState("approved")).toBe("approved");
    expect(mediaRowApprovalState("pending_approval")).toBe("pending_approval");
    expect(mediaRowApprovalState("rejected")).toBe("rejected");
    expect(mediaRowApprovalState("raw")).toBe("raw");
    expect(mediaRowApprovalState(null)).toBe("raw");
  });

  it("fail-closes unknown statuses to raw", () => {
    expect(mediaRowApprovalState("mystery")).toBe("raw");
  });
});

describe("mediaRowStatusLabel", () => {
  it("returns user-facing labels", () => {
    expect(mediaRowStatusLabel("approved")).toBe("Approved");
    expect(mediaRowStatusLabel("pending")).toBe("Pending approval");
    expect(mediaRowStatusLabel("raw")).toBe("Raw");
  });
});

describe("summarizeMediaSubmissionPayload", () => {
  it("extracts governed fields without inventing facts", () => {
    const summary = summarizeMediaSubmissionPayload({
      product_id: "prod-1",
      file_url: "https://cdn.example/hero.jpg",
      type: "hero_image",
      angle: "front",
      alt_text: "Front hero",
      operation_intent: "create",
      storage_path: "products/sku/raw/1-photo.jpg",
    });
    expect(summary.productId).toBe("prod-1");
    expect(summary.fileUrl).toBe("https://cdn.example/hero.jpg");
    expect(summary.typeLabel).toBe("Hero image");
    expect(summary.angle).toBe("front");
    expect(summary.altText).toBe("Front hero");
    expect(summary.operationIntent).toBe("create");
    expect(summary.storagePath).toBe("products/sku/raw/1-photo.jpg");
  });

  it("returns nulls for missing payload fields", () => {
    const summary = summarizeMediaSubmissionPayload({});
    expect(summary.fileUrl).toBeNull();
    expect(summary.productId).toBeNull();
    expect(summary.storagePath).toBeNull();
  });
});

describe("safeDisplayableMediaUrl", () => {
  it("returns trimmed https URL when displayable", () => {
    expect(safeDisplayableMediaUrl("  https://cdn.example/a.jpg  ")).toBe(
      "https://cdn.example/a.jpg",
    );
  });

  it("returns null for non-http(s) URLs", () => {
    expect(safeDisplayableMediaUrl("javascript:alert(1)")).toBeNull();
    expect(safeDisplayableMediaUrl(null)).toBeNull();
  });
});

describe("formatSubmissionAge", () => {
  it("returns a human-readable age string", () => {
    const recent = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(formatSubmissionAge(recent)).toMatch(/Submitted 5 minutes ago/);
  });
});

describe("mediaSubmissionProductLabel", () => {
  it("uses payload product id only and never invents identity", () => {
    expect(mediaSubmissionProductLabel("prod-abc")).toBe("prod-abc");
    expect(mediaSubmissionProductLabel(null)).toBe("(unlinked)");
    expect(mediaSubmissionProductLabel("")).toBe("(unlinked)");
  });
});

describe("shouldShowMediaReviewEmptyState", () => {
  it("suppresses empty state while loading or after load error", () => {
    expect(shouldShowMediaReviewEmptyState({ loading: true, loadError: null, itemCount: 0 })).toBe(
      false,
    );
    expect(
      shouldShowMediaReviewEmptyState({ loading: false, loadError: "network", itemCount: 0 }),
    ).toBe(false);
    expect(shouldShowMediaReviewEmptyState({ loading: false, loadError: null, itemCount: 0 })).toBe(
      true,
    );
    expect(shouldShowMediaReviewEmptyState({ loading: false, loadError: null, itemCount: 2 })).toBe(
      false,
    );
  });
});

describe("countCompletedMediaUploads", () => {
  it("counts only outcomes where storage and insert both succeeded", () => {
    expect(
      countCompletedMediaUploads([
        { storageOk: true, insertOk: true },
        { storageOk: true, insertOk: false },
        { storageOk: false, insertOk: false },
        { storageOk: true, insertOk: true },
      ]),
    ).toBe(2);
  });

  it("returns zero when every upload failed", () => {
    expect(
      countCompletedMediaUploads([
        { storageOk: false, insertOk: false },
        { storageOk: true, insertOk: false },
      ]),
    ).toBe(0);
  });
});
