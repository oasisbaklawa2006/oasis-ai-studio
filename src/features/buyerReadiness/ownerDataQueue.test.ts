import { describe, expect, it } from "vitest";
import { buildOwnerDataCompletionQueue } from "./ownerDataQueue";

const baseProduct = {
  id: "p1",
  sku: "SKU-1",
  product_name: "Product One",
  category: "Baklawa",
  product_type: "Baklawa",
  product_class: "ready_pack",
  is_active: true,
  is_catalogue_ready: true,
  visible_in_catalog: true,
  media_status: "approved",
  private_label_allowed: false,
  private_label_moq: null,
  private_label_moq_uom: null,
  private_label_price: null,
  lead_time_days: 7,
  price_b2b: null,
  moq: null,
  uom: "Piece",
  primary_uom: "pack",
};

const approvedPrice = {
  product_id: "p1",
  price_channel: "b2b",
  approval_status: "approved",
  base_price: 100,
  calculated_price: 100,
  valid_from: null,
  valid_until: null,
};

describe("Buyer owner-data completion queue", () => {
  it("flags a published private-label SKU when explicit private-label price and lead time are missing", () => {
    const queue = buildOwnerDataCompletionQueue(
      [
        {
          ...baseProduct,
          private_label_allowed: true,
          private_label_moq: 200,
          private_label_moq_uom: "box",
          lead_time_days: null,
        },
      ],
      [approvedPrice],
      "2026-10-06",
    );

    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({
      lane: "private_label",
      governedB2bPrice: 100,
      privateLabelMoq: 200,
      privateLabelPrice: null,
    });
    expect(queue[0].missing).toContain(
      "Confirm explicit customer-facing private-label selling price",
    );
    expect(queue[0].missing).toContain("Provide private-label lead time");
  });

  it("never substitutes ordinary B2B pricing for the private-label selling price", () => {
    const queue = buildOwnerDataCompletionQueue(
      [{ ...baseProduct, private_label_allowed: true }],
      [approvedPrice],
      "2026-10-06",
    );

    expect(queue[0].governedB2bPrice).toBe(100);
    expect(queue[0].privateLabelPrice).toBeNull();
    expect(queue[0].missing).toContain(
      "Confirm explicit customer-facing private-label selling price",
    );
  });

  it("flags an active packaging candidate for publication and governed pricing", () => {
    const queue = buildOwnerDataCompletionQueue(
      [
        {
          ...baseProduct,
          category: "Packaging & Decoration Material",
          is_catalogue_ready: false,
          price_b2b: 1890,
          moq: 8,
          lead_time_days: null,
        },
      ],
      [],
      "2026-10-06",
    );

    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({
      lane: "packaging",
      published: false,
      governedB2bPrice: null,
      legacyB2bPrice: 1890,
      legacyMoq: 8,
    });
    expect(queue[0].missing).toContain("Confirm Buyer publication and catalogue readiness");
    expect(queue[0].missing).toContain("Approve governed B2B selling price");
  });

  it("does not treat expired or unapproved pricing as governed B2B coverage", () => {
    const packaging = {
      ...baseProduct,
      category: "Packaging & Decoration Material",
    };
    const queue = buildOwnerDataCompletionQueue(
      [packaging],
      [
        { ...approvedPrice, valid_until: "2026-10-05" },
        {
          ...approvedPrice,
          approval_status: "draft",
          calculated_price: 150,
        },
      ],
      "2026-10-06",
    );

    expect(queue[0].governedB2bPrice).toBeNull();
    expect(queue[0].missing).toContain("Approve governed B2B selling price");
  });

  it("excludes inactive packaging records from the owner go-live queue", () => {
    const queue = buildOwnerDataCompletionQueue(
      [
        {
          ...baseProduct,
          category: "Packaging & Decoration Material",
          is_active: false,
          is_catalogue_ready: false,
          visible_in_catalog: false,
        },
      ],
      [],
      "2026-10-06",
    );

    expect(queue).toEqual([]);
  });

  it("removes fully ready items from the completion queue", () => {
    const privateLabel = {
      ...baseProduct,
      private_label_allowed: true,
      private_label_price: 180,
    };
    const packaging = {
      ...baseProduct,
      id: "p2",
      sku: "SKU-2",
      product_name: "Packaging",
      category: "Packaging & Decoration Material",
    };
    const packagingPrice = {
      ...approvedPrice,
      product_id: "p2",
    };

    const queue = buildOwnerDataCompletionQueue(
      [privateLabel, packaging],
      [approvedPrice, packagingPrice],
      "2026-10-06",
    );

    expect(queue).toEqual([]);
  });
});
