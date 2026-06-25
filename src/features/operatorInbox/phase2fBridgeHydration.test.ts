import { describe, expect, it, vi } from "vitest";
import { PRODUCTION_SNAPSHOT_CATALOG } from "@/features/productIntelligence/runtime/fixtures/productionSnapshotCatalog";
import { resolveProductUtterance } from "@/features/productIntelligence/runtime";
import {
  hydrateOperatorStateFromPersistence,
  indexOperatorHydration,
} from "./hydrateOperatorState";
import type { WhatsAppDraftRow, WhatsAppOperatorDecisionRow } from "./fetchDraftVisibility";

const resolution = resolveProductUtterance("6 pc midya", PRODUCTION_SNAPSHOT_CATALOG);

const baseDraft = (overrides: Partial<WhatsAppDraftRow> = {}): WhatsAppDraftRow => ({
  id: "draft-abc-123",
  source_message_id: "msg-live-1",
  sender_phone: "919999999999",
  customer_name: "Test",
  message_body: "6 pc midya",
  resolved_sku: "OAS-AS-BKL-PST-MAAPET-0003",
  resolved_product_name: "Classic Pistachio Midya Gift Pack 6 pcs",
  confidence_band: "HIGH",
  operator_decision: "confirmed",
  status: "pending_review",
  quantity: 6,
  created_at: "2026-06-24T12:00:00.000Z",
  ...overrides,
});

const baseDecision = (
  overrides: Partial<WhatsAppOperatorDecisionRow> = {},
): WhatsAppOperatorDecisionRow => ({
  id: "decision-1",
  source_message_id: "msg-live-1",
  action: "reject",
  sku: null,
  product_name: null,
  confidence_band: "HIGH",
  whatsapp_sales_order_draft_id: null,
  decided_at: "2026-06-24T12:05:00.000Z",
  ...overrides,
});

describe("Phase 2F bridge — operator hydration", () => {
  it("existing draft hydrates confirmed state after refresh", () => {
    const hydrated = hydrateOperatorStateFromPersistence(resolution, baseDraft(), null);
    expect(hydrated.operator.decision).toBe("confirmed");
    expect(hydrated.operator.selected_sku).toBe("OAS-AS-BKL-PST-MAAPET-0003");
    expect(hydrated.draftId).toBe("draft-abc-123");
  });

  it("existing reject decision hydrates rejected state", () => {
    const hydrated = hydrateOperatorStateFromPersistence(
      resolution,
      null,
      baseDecision({ action: "reject" }),
    );
    expect(hydrated.operator.decision).toBe("rejected");
    expect(hydrated.draftId).toBeNull();
  });

  it("existing alternative/draft hydrates alternative confirmed state", () => {
    const altDraft = baseDraft({
      id: "draft-alt-9",
      operator_decision: "alternative_selected",
      resolved_sku: "OAS-AS-BKL-PST-BULK-0017",
      resolved_product_name: "Pistachio Bulk",
    });
    const hydrated = hydrateOperatorStateFromPersistence(resolution, altDraft, null);
    expect(hydrated.operator.decision).toBe("alternative_selected");
    expect(hydrated.draftId).toBe("draft-alt-9");
  });

  it("indexOperatorHydration joins drafts and decisions by source_message_id", () => {
    const index = indexOperatorHydration(
      [baseDraft({ source_message_id: "m1" })],
      [baseDecision({ source_message_id: "m2", action: "reject" })],
    );
    expect(index.get("m1")?.draft?.id).toBe("draft-abc-123");
    expect(index.get("m2")?.latestDecision?.action).toBe("reject");
  });
});

describe("Phase 2F bridge — studio fan-out", () => {
  it("fan-out duplicates same WAMID idempotently via RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { id: "inbound-1" }, error: null });
    const admin = { rpc } as never;
    const { fanOutToStudioInbox } = await import(
      "../../../supabase/functions/_shared/studioInboxFanOut.ts"
    );

    const input = {
      supabaseAdmin: admin,
      providerMessageId: "wamid.TEST123",
      senderPhone: "919891162212",
      senderName: "Dinesh",
      messageBody: "10 kg Midya pista",
      rawPayload: { entry: [] },
      timestampSec: 1719254524,
    };

    await fanOutToStudioInbox(input);
    await fanOutToStudioInbox(input);

    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[0][0]).toBe("ingest_whatsapp_inbound_message");
    expect(rpc.mock.calls[0][1]._provider_message_id).toBe("wamid.TEST123");
    expect(rpc.mock.calls[1][1]._provider_message_id).toBe("wamid.TEST123");
  });

  it("fan-out failure does not throw to caller", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "db down" } });
    const admin = { rpc } as never;
    const { fanOutToStudioInbox } = await import(
      "../../../supabase/functions/_shared/studioInboxFanOut.ts"
    );

    await expect(
      fanOutToStudioInbox({
        supabaseAdmin: admin,
        providerMessageId: "wamid.FAIL",
        senderPhone: "919999999999",
        senderName: null,
        messageBody: "test order 2 kg",
        rawPayload: {},
        timestampSec: null,
      }),
    ).resolves.toBeUndefined();
  });

  it("non-text inbound is ignored by fan-out helper", async () => {
    const rpc = vi.fn();
    const admin = { rpc } as never;
    const { fanOutToStudioInbox } = await import(
      "../../../supabase/functions/_shared/studioInboxFanOut.ts"
    );

    await fanOutToStudioInbox({
      supabaseAdmin: admin,
      providerMessageId: "wamid.EMPTY",
      senderPhone: "919999999999",
      senderName: null,
      messageBody: "   ",
      rawPayload: {},
      timestampSec: null,
    });

    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("Phase 2F bridge — legacy webhook fan-out gate", () => {
  it("legacy webhook source includes non-blocking text-only fan-out after buffer", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const source = readFileSync(
      join(process.cwd(), "supabase/functions/whatsapp-webhook/index.ts"),
      "utf8",
    );

    expect(source).toContain('from "../_shared/studioInboxFanOut.ts"');
    expect(source).toContain("void fanOutToStudioInbox");
    expect(source).toContain('messageType || "").toLowerCase() === "text"');
    expect(source).toContain("BANYAN BUFFER");
    expect(source).toContain("whatsapp_buffer");
    expect(source).toContain("Pipeline C auto-order");
  });
});
