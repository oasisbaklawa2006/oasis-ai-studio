import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => {
  throw new Error("Unavailable lifecycle actions must not initialize a write client");
});

import {
  archiveProduct,
  assessProductDeleteEligibility,
  PRODUCT_ARCHIVE_AVAILABLE,
  PRODUCT_DELETE_AVAILABLE,
  permanentDeleteConfirmationPhrase,
  permanentlyDeleteProduct,
} from "./productGovernanceService";

describe("unavailable Core lifecycle authority", () => {
  it("keeps archive and delete unavailable without attempting fabricated RPCs", async () => {
    expect(PRODUCT_ARCHIVE_AVAILABLE).toBe(false);
    expect(PRODUCT_DELETE_AVAILABLE).toBe(false);
    expect(await archiveProduct("core-id")).toMatchObject({
      ok: false,
      message: expect.stringContaining("Core"),
    });
    expect(await permanentlyDeleteProduct("core-id")).toMatchObject({ ok: false });
    expect(await assessProductDeleteEligibility("core-id")).toMatchObject({
      eligible: false,
      blockers: [expect.stringContaining("Core")],
    });
  });
  it("retains the explicit SKU confirmation phrase for a future governed action", () => {
    expect(permanentDeleteConfirmationPhrase(" SKU-1 ")).toBe("DELETE SKU-1");
  });
});
