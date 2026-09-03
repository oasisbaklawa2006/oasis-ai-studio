import { describe, expect, it } from "vitest";
import {
  isDisplayableMediaUrl,
  mediaRowApprovalState,
  mediaRowStatusLabel,
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

describe("isDisplayableMediaUrl", () => {
  it("accepts http(s) URLs only", () => {
    expect(isDisplayableMediaUrl("https://cdn.example/a.jpg")).toBe(true);
    expect(isDisplayableMediaUrl("ftp://cdn.example/a.jpg")).toBe(false);
    expect(isDisplayableMediaUrl("")).toBe(false);
  });
});
