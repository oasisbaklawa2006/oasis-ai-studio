import { describe, expect, it, beforeEach, vi } from "vitest";
import { PRODUCTION_SNAPSHOT_CATALOG } from "@/features/productIntelligence/runtime/fixtures/productionSnapshotCatalog";
import {
  resolveProductUtterance,
  type RuntimeCatalog,
} from "@/features/productIntelligence/runtime";
import { resolveInboundMessage } from "./resolveInboundMessage";
import {
  confirmSuggestion,
  initialOperatorState,
  rejectSuggestion,
  selectAlternative,
} from "./operatorSuggestionState";
import {
  appendSuggestionAudit,
  clearSuggestionAuditLog,
  getSuggestionAuditLog,
} from "./suggestionAudit";
import {
  canConfirmSuggestion,
  canPreselectTopMatch,
  displayActionForBand,
  formatDetectedQuantity,
  requiresExplicitProductSelection,
  showPrimarySuggestion,
} from "./suggestionGovernance";
import { isCashewTartFamilySku } from "@/features/productIntelligence/runtime/productFamilies";

const catalog: RuntimeCatalog = PRODUCTION_SNAPSHOT_CATALOG;
const loadCatalog = async () => catalog;

describe("Phase 2B operator inbox — resolver suggestions", () => {
  it("pista bulbul shows high-confidence suggestion (Suggested)", async () => {
    const res = await resolveInboundMessage("pista bulbul", loadCatalog);
    expect(res).not.toBeNull();
    expect(res!.confidence_band).toBe("HIGH");
    expect(displayActionForBand(res!.confidence_band)).toBe("Suggested");
    expect(canPreselectTopMatch(res!)).toBe(true);
    expect(showPrimarySuggestion(res!)).toBe(true);
    expect(res!.resolved_sku).toBe("OAS-AS-BKL-PST-BULK-0017");
  });

  it("midya shows clarification with bulk + gift alternatives", async () => {
    const res = await resolveInboundMessage("midya", loadCatalog);
    expect(res).not.toBeNull();
    expect(res!.action).toBe("ask_clarification");
    expect(displayActionForBand(res!.confidence_band)).toBe("Ask clarification");
    expect(showPrimarySuggestion(res!)).toBe(false);
    const skus = res!.alternatives.map((a) => a.sku);
    expect(skus).toContain("OAS-AS-BKL-PST-BULK-0016");
    expect(skus).toContain("OAS-AS-BKL-PST-MAAPET-0003");
  });

  it("6 pc midya suggests gift pack", async () => {
    const res = await resolveInboundMessage("6 pc midya", loadCatalog);
    expect(res).not.toBeNull();
    expect(res!.confidence_band).toBe("HIGH");
    expect(res!.resolved_sku).toBe("OAS-AS-BKL-PST-MAAPET-0003");
  });

  it("kaju tart resolves within cashew tart family", async () => {
    const res = await resolveInboundMessage("kaju tart", loadCatalog);
    expect(res).not.toBeNull();
    expect(res!.confidence_band).toBe("HIGH");
    expect(isCashewTartFamilySku(res!.resolved_sku)).toBe(true);
  });
});

describe("Phase 2B operator inbox — governance", () => {
  it("LOW confidence is never preselected for auto-confirm", () => {
    const res = resolveProductUtterance("midya", catalog);
    expect(res.confidence_band).toBe("LOW");
    const state = initialOperatorState(res);
    expect(state.selected_sku).toBeNull();
    expect(canPreselectTopMatch(res)).toBe(false);
    expect(requiresExplicitProductSelection(res)).toBe(true);
    expect(canConfirmSuggestion(res, state)).toBe(false);
  });

  it("formatDetectedQuantity shows kg from pyramid utterance", () => {
    const res = resolveProductUtterance("Hi send 50 kg pyramid", catalog);
    expect(res.order_quantity).toBe(50);
    expect(formatDetectedQuantity(res)).toBe("50 kg");
  });

  it("HIGH is preselected but still pending until operator confirms", () => {
    const res = resolveProductUtterance("pista bulbul", catalog);
    const state = initialOperatorState(res);
    expect(state.decision).toBe("pending");
    expect(state.selected_sku).toBe("OAS-AS-BKL-PST-BULK-0017");
    const confirmed = confirmSuggestion(state, res);
    expect(confirmed.decision).toBe("confirmed");
  });
});

describe("Phase 2B operator inbox — operator actions (no orders)", () => {
  beforeEach(() => {
    clearSuggestionAuditLog();
  });

  it("confirm action writes audit only — no order side effects", () => {
    const res = resolveProductUtterance("pista bulbul", catalog);
    let state = initialOperatorState(res);
    state = confirmSuggestion(state, res);
    const event = appendSuggestionAudit({
      message_id: "test-msg",
      utterance: "pista bulbul",
      action: "confirm",
      sku: state.selected_sku,
      product_name: state.selected_product_name,
      confidence_band: res.confidence_band,
    });
    expect(event.action).toBe("confirm");
    expect(event.sku).toBe("OAS-AS-BKL-PST-BULK-0017");
    expect(getSuggestionAuditLog()[0].sku).toBe("OAS-AS-BKL-PST-BULK-0017");
    expect("order_id" in event).toBe(false);
  });

  it("reject action clears selection and does not create order", () => {
    const res = resolveProductUtterance("pista bulbul", catalog);
    const state = rejectSuggestion(initialOperatorState(res));
    appendSuggestionAudit({
      message_id: "test-msg",
      utterance: "pista bulbul",
      action: "reject",
      sku: null,
      product_name: null,
      confidence_band: res.confidence_band,
    });
    expect(state.decision).toBe("rejected");
    expect(state.selected_sku).toBeNull();
    expect(getSuggestionAuditLog()[0].action).toBe("reject");
  });

  it("select alternative updates selection but stays pending until confirm", () => {
    const res = resolveProductUtterance("midya", catalog);
    const alt = res.alternatives.find((a) => a.sku === "OAS-AS-BKL-PST-MAAPET-0003")!;
    const state = selectAlternative(initialOperatorState(res), alt);
    expect(state.decision).toBe("pending");
    expect(state.selected_sku).toBe("OAS-AS-BKL-PST-MAAPET-0003");
    expect(canConfirmSuggestion(res, state)).toBe(true);
    const confirmed = confirmSuggestion(state, res);
    expect(confirmed.decision).toBe("confirmed");
  });
});

describe("Phase 2B operator inbox — resolver failure resilience", () => {
  it("returns null when catalog load fails — inbox can still show message", async () => {
    const failingLoader = vi.fn(async () => {
      throw new Error("catalog unavailable");
    });
    const res = await resolveInboundMessage("pista bulbul", failingLoader);
    expect(res).toBeNull();
  });

  it("returns null for empty utterance", async () => {
    const res = await resolveInboundMessage("  ", loadCatalog);
    expect(res).toBeNull();
  });
});
