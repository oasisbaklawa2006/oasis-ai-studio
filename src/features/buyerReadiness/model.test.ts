import { describe, expect, it } from "vitest";
import {
  type BuyerBackendReadiness,
  buildBuyerReadinessCards,
  normalizeBuyerBackendReadiness,
} from "./model";

const ready: BuyerBackendReadiness = {
  published_product_count: 9,
  approved_b2b_price_rule_count: 15,
  b2b_priced_published_product_count: 9,
  published_private_label_count: 1,
  private_label_price_ready_count: 1,
  published_packaging_count: 2,
  packaging_price_ready_count: 2,
  connect_profile_count: 5,
  active_connect_consumer_count: 1,
  active_connect_binding_count: 1,
  active_connect_token_count: 1,
};

describe("Buyer backend readiness model", () => {
  it("normalizes numeric database values without inventing missing fields", () => {
    const normalized = normalizeBuyerBackendReadiness({
      ...ready,
      published_product_count: "9",
    });
    expect(normalized?.published_product_count).toBe(9);
    expect(normalizeBuyerBackendReadiness({ published_product_count: 9 })).toBeNull();
  });

  it("marks complete commercial and Connect coverage ready", () => {
    const cards = buildBuyerReadinessCards(ready);
    expect(cards.every((card) => card.status === "ready")).toBe(true);
  });

  it("marks incomplete price coverage partial rather than ready", () => {
    const cards = buildBuyerReadinessCards({
      ...ready,
      b2b_priced_published_product_count: 4,
      private_label_price_ready_count: 0,
      packaging_price_ready_count: 1,
    });
    expect(cards.find((card) => card.key === "pricing")?.status).toBe("partial");
    expect(cards.find((card) => card.key === "private_label")?.status).toBe("blocked");
    expect(cards.find((card) => card.key === "packaging")?.status).toBe("partial");
  });

  it("shows seeded Connect profiles without consumers as partial activation", () => {
    const cards = buildBuyerReadinessCards({
      ...ready,
      active_connect_consumer_count: 0,
      active_connect_binding_count: 0,
      active_connect_token_count: 0,
    });
    expect(cards.find((card) => card.key === "connect")?.status).toBe("partial");
  });

  it("never treats zero published catalogue as commercially ready", () => {
    const cards = buildBuyerReadinessCards({
      ...ready,
      published_product_count: 0,
      b2b_priced_published_product_count: 0,
      published_private_label_count: 0,
      private_label_price_ready_count: 0,
      published_packaging_count: 0,
      packaging_price_ready_count: 0,
    });
    expect(cards.find((card) => card.key === "catalogue")?.status).toBe("blocked");
    expect(cards.find((card) => card.key === "pricing")?.status).toBe("blocked");
  });
});
