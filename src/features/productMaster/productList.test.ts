import { describe, expect, it } from "vitest";
import { buildFallbackResults } from "@/lib/productSearch";
import {
  filterProductsForMasterList,
  productDisplayName,
  productVisibleInActiveView,
} from "./productListModel";

describe("productListModel", () => {
  const activeNameOnly = {
    id: "p-new",
    sku: "OAS-NEW-001",
    name: "Cashew Kitta",
    product_name: null,
    short_name: null,
    is_active: true,
    archived_at: null,
  };

  it("treats is_active true or null as active", () => {
    expect(productVisibleInActiveView({ is_active: true, archived_at: null })).toBe(true);
    expect(productVisibleInActiveView({ is_active: null, archived_at: null })).toBe(true);
    expect(productVisibleInActiveView({ is_active: false, archived_at: null })).toBe(false);
    expect(productVisibleInActiveView({ is_active: true, archived_at: "2026-01-01" })).toBe(false);
  });

  it("shows product with name set and product_name null in active list", () => {
    const visible = filterProductsForMasterList(
      [activeNameOnly, { id: "off", is_active: false, archived_at: null }],
      {
        showArchived: false,
        searchIds: null,
        div: "",
        cat: "",
        pack: "",
        pclass: "",
        mainDept: "",
        prodDept: "",
        uom: "",
        pl: "",
        bom: "",
        carton: "",
        ready: "",
        labelStatus: "",
      },
    );
    expect(visible).toHaveLength(1);
    expect(visible[0].id).toBe("p-new");
    expect(productDisplayName(activeNameOnly)).toBe("Cashew Kitta");
  });

  it("finds name-only product via search fallback scoring", () => {
    const results = buildFallbackResults([activeNameOnly], [], "Cashew Kitta");
    expect(results).toHaveLength(1);
    expect(results[0].sku).toBe("OAS-NEW-001");
    expect(results[0].product_name).toBe("Cashew Kitta");
  });
});
