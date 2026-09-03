import { describe, expect, it } from "vitest";
import { filterMediaReviewQueue, type MediaReviewQueueItem } from "./mediaReviewQueue";

const sampleItems: MediaReviewQueueItem[] = [
  {
    id: "1",
    source: "catalogue_submission",
    status: "pending_approval",
    productId: "p1",
    productName: "Baklava",
    productSku: "OAS-BAK-250",
    mediaType: "hero",
    submittedAt: "2026-09-01T10:00:00Z",
    submittedBy: "user-1",
  },
  {
    id: "2",
    source: "product_media",
    status: "approved",
    productId: "p2",
    productName: "Kunafa",
    productSku: "OAS-KUN-500",
    mediaType: "raw_photo",
    submittedAt: "2026-09-02T10:00:00Z",
    submittedBy: null,
  },
];

describe("filterMediaReviewQueue", () => {
  it("returns only items matching the requested status", () => {
    expect(filterMediaReviewQueue(sampleItems, "pending_approval")).toHaveLength(1);
    expect(filterMediaReviewQueue(sampleItems, "approved")).toHaveLength(1);
    expect(filterMediaReviewQueue(sampleItems, "rejected")).toHaveLength(0);
  });
});
