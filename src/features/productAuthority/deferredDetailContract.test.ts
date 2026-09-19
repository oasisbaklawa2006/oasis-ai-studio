import { describe, expect, it } from "vitest";
import {
  attachDeferredDetailToSourceSnapshot,
  contentHasMissingFieldPlaceholder,
  createDeferredDetailField,
  DEFERRED_DETAIL_CONTRACT_VERSION,
  type DeferredDetailManifest,
  deferredDetailFromCatalogueContent,
  deferredDetailFromPayload,
  emptyDeferredDetailManifest,
  evaluateTransitionGate,
  fieldBlocksStage,
  fieldStateFromAiConfidence,
  fieldStateFromReadiness,
  fieldStateFromValue,
  isFieldComplete,
  MISSING_FIELD_PLACEHOLDER_PREFIX,
  mergeDeferredDetailOnResubmit,
  parseDeferredDetailManifest,
  serializeDeferredDetailManifest,
} from "./deferredDetailContract";

describe("deferredDetailContract — state semantics", () => {
  it("only known is complete", () => {
    expect(isFieldComplete("known")).toBe(true);
    expect(isFieldComplete("deferred")).toBe(false);
    expect(isFieldComplete("unknown")).toBe(false);
    expect(isFieldComplete("pending_review")).toBe(false);
  });

  it("distinguishes null, empty string, and known values", () => {
    expect(fieldStateFromValue(null)).toBe("unknown");
    expect(fieldStateFromValue(undefined)).toBe("unknown");
    expect(fieldStateFromValue("")).toBe("unknown");
    expect(fieldStateFromValue("   ")).toBe("unknown");
    expect(fieldStateFromValue("Baklawa")).toBe("known");
    expect(fieldStateFromValue(0)).toBe("unknown");
    expect(fieldStateFromValue(0, { allowZero: true })).toBe("known");
    expect(fieldStateFromValue(18)).toBe("known");
  });

  it("maps readiness tri-state without coercing warn to known", () => {
    expect(fieldStateFromReadiness("pass").state).toBe("known");
    expect(fieldStateFromReadiness("warn").state).toBe("deferred");
    expect(fieldStateFromReadiness("missing").state).toBe("unknown");
  });

  it("maps governed AI confidence bands", () => {
    expect(fieldStateFromAiConfidence("high")).toBe("pending_review");
    expect(fieldStateFromAiConfidence("medium")).toBe("pending_review");
    expect(fieldStateFromAiConfidence("low")).toBe("deferred");
    expect(fieldStateFromAiConfidence("unresolved")).toBe("unknown");
  });
});

describe("deferredDetailContract — fail-closed transition gates", () => {
  const manifest: DeferredDetailManifest = {
    contract_version: DEFERRED_DETAIL_CONTRACT_VERSION,
    fields: [
      createDeferredDetailField("sku", "deferred", {
        deferredUntilStage: "approval",
        blockingStages: ["approval", "publication"],
      }),
      createDeferredDetailField("export_fields", "deferred", {
        deferredUntilStage: "publication",
        blockingStages: ["publication"],
      }),
      createDeferredDetailField("hsn_code", "unknown", {
        blockingStages: ["approval", "publication"],
      }),
    ],
  };

  it("allows draft_creation when only approval-deferred fields are open", () => {
    const gate = evaluateTransitionGate(manifest, "draft_creation");
    expect(gate.allowed).toBe(true);
    expect(gate.blocking_fields).toHaveLength(0);
  });

  it("blocks approval when unknown or unresolved deferred fields remain", () => {
    const gate = evaluateTransitionGate(manifest, "approval");
    expect(gate.allowed).toBe(false);
    expect(gate.blocking_fields.map((f) => f.field_key)).toContain("sku");
    expect(gate.blocking_fields.map((f) => f.field_key)).toContain("hsn_code");
    expect(gate.blocking_fields.map((f) => f.field_key)).not.toContain("export_fields");
  });

  it("blocks publication until all fields are known", () => {
    const gate = evaluateTransitionGate(manifest, "publication");
    expect(gate.allowed).toBe(false);
    expect(gate.blocking_fields.length).toBeGreaterThanOrEqual(3);
  });

  it("fieldBlocksStage respects deferred_until_stage", () => {
    const sku = manifest.fields[0];
    expect(fieldBlocksStage(sku, "draft_creation")).toBe(false);
    expect(fieldBlocksStage(sku, "approval")).toBe(true);
    const exportField = manifest.fields[1];
    expect(fieldBlocksStage(exportField, "approval")).toBe(false);
    expect(fieldBlocksStage(exportField, "publication")).toBe(true);
  });
});

describe("deferredDetailContract — serialization and rehydration", () => {
  const manifest: DeferredDetailManifest = {
    contract_version: DEFERRED_DETAIL_CONTRACT_VERSION,
    fields: [
      createDeferredDetailField("sku", "deferred", {
        reason: "Awaiting admin approval",
        deferredUntilStage: "approval",
        provenance: { source: "system", recorded_at: "2026-01-01T00:00:00.000Z" },
      }),
    ],
  };

  it("round-trips through serialize/parse", () => {
    const serialized = serializeDeferredDetailManifest(manifest);
    const parsed = parseDeferredDetailManifest(serialized);
    expect(parsed).toEqual(manifest);
  });

  it("returns null for invalid shapes (fail-closed)", () => {
    expect(parseDeferredDetailManifest(null)).toBeNull();
    expect(parseDeferredDetailManifest({})).toBeNull();
    expect(
      parseDeferredDetailManifest({ contract_version: 1, fields: [{ bad: true }] }),
    ).toBeNull();
    expect(
      parseDeferredDetailManifest({
        contract_version: 1,
        fields: [{ field_key: "x", state: "bogus" }],
      }),
    ).toBeNull();
  });

  it("attaches to and reads from source_snapshot payload", () => {
    const snapshot = { product_name: "Test", snapshotted_at: "2026-01-01" };
    const attached = attachDeferredDetailToSourceSnapshot(snapshot, manifest);
    const read = deferredDetailFromPayload(attached);
    expect(read?.fields[0].field_key).toBe("sku");
  });

  it("reads deferred_fields from contributor payload", () => {
    const payload = { deferred_fields: serializeDeferredDetailManifest(manifest) };
    expect(deferredDetailFromPayload(payload)?.fields[0].state).toBe("deferred");
  });
});

describe("deferredDetailContract — correction/resubmission provenance", () => {
  it("records previous_state when a field resolves on resubmit", () => {
    const previous: DeferredDetailManifest = {
      contract_version: DEFERRED_DETAIL_CONTRACT_VERSION,
      fields: [createDeferredDetailField("hsn_code", "unknown")],
    };
    const current: DeferredDetailManifest = {
      contract_version: DEFERRED_DETAIL_CONTRACT_VERSION,
      fields: [createDeferredDetailField("hsn_code", "known")],
    };
    const merged = mergeDeferredDetailOnResubmit(previous, current, "Operator added HSN");
    expect(merged.fields[0].state).toBe("known");
    expect(merged.fields[0].provenance?.previous_state).toBe("unknown");
    expect(merged.fields[0].provenance?.source).toBe("correction_resubmit");
    expect(merged.fields[0].provenance?.note).toBe("Operator added HSN");
  });

  it("passes through current when no previous manifest exists", () => {
    const current = emptyDeferredDetailManifest();
    expect(mergeDeferredDetailOnResubmit(null, current)).toEqual(current);
  });
});

describe("deferredDetailFromCatalogueContent", () => {
  it("detects placeholder-bearing content blocks", () => {
    const fields = deferredDetailFromCatalogueContent({
      catalogue_title: "Real title",
      b2b_sales_copy: `${MISSING_FIELD_PLACEHOLDER_PREFIX} B2B price.`,
    });
    expect(fields).toHaveLength(1);
    expect(fields[0].field_key).toBe("b2b_sales_copy");
    expect(fields[0].state).toBe("unknown");
  });

  it("contentHasMissingFieldPlaceholder matches embedded placeholders", () => {
    expect(
      contentHasMissingFieldPlaceholder(`Wholesale copy. ${MISSING_FIELD_PLACEHOLDER_PREFIX} MOQ.`),
    ).toBe(true);
    expect(contentHasMissingFieldPlaceholder("Complete real copy.")).toBe(false);
  });
});
