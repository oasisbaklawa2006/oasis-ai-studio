import { describe, expect, it } from "vitest";
import {
  isMediaCatalogueApprovalAvailable,
  isMediaDraftApprovalUiBlocked,
  MEDIA_CATALOGUE_APPROVAL_BLOCKED_MESSAGE,
} from "./mediaCatalogueApprovalPolicy";

describe("mediaCatalogueApprovalPolicy", () => {
  it("exposes the existing Core media approval capability without a local backend", () => {
    expect(isMediaCatalogueApprovalAvailable()).toBe(true);
    expect(MEDIA_CATALOGUE_APPROVAL_BLOCKED_MESSAGE).toMatch(/private staging/i);
  });

  it.each([
    { storage_path: "products/fixture/submissions/photo.jpg" },
    { storagePath: "products/fixture/submissions/photo.jpg" },
    { bucket_id: "product-media-staging" },
    { storage_bucket: "product-media-staging" },
    { file_url: "private://product-media-staging/photo.jpg" },
    {
      file_url:
        "https://fixture.supabase.co/storage/v1/object/sign/product-media/photo.jpg?token=synthetic",
    },
    {
      file_url:
        "https://fixture.supabase.co/storage/v1/object/public/product-media-staging/photo.jpg",
    },
    { fileUrl: "https://fixture.supabase.co/storage/v1/object/%73ign/media/photo.jpg" },
    { file_url: "not a URL" },
    { file_url: "javascript:alert(1)" },
    { file_url: "https://fixture.supabase.co/storage/v1/object/authenticated/media/photo.jpg" },
    { file_url: "https://fixture.supabase.co/storage/v1/object/public/../sign/media/photo.jpg" },
    { file_url: "https://fixture.supabase.co/storage/v1/object/public/./photo.jpg" },
    {
      file_url:
        "https://fixture.supabase.co\\\\storage\\\\v1\\\\object\\\\sign\\\\media\\\\photo.jpg",
    },
    { file_url: "https://user:pass@fixture.supabase.co/published.jpg" },
    { file_url: "https://fixture.supabase.co:invalid/photo.jpg" },
    { file_url: "https://fixture.supabase.co/published%2Ejpg" },
    { bucket_id: " Product-Media-Staging " },
  ])("blocks unpromoted media references: %j", (payload) => {
    expect(isMediaDraftApprovalUiBlocked("media", payload)).toBe(true);
    expect(isMediaDraftApprovalUiBlocked("product", payload)).toBe(false);
  });

  it("retains the existing durable URL approval path", () => {
    expect(
      isMediaDraftApprovalUiBlocked("media", {
        file_url: "https://fixture.supabase.co/storage/v1/object/public/product-media/photo.jpg",
        storage_path: null,
      }),
    ).toBe(false);
  });

  it("does not suppress canonical media approval after the Core mapping deployment", () => {
    expect(isMediaDraftApprovalUiBlocked("media")).toBe(false);
    expect(isMediaDraftApprovalUiBlocked("product")).toBe(false);
    expect(isMediaDraftApprovalUiBlocked("alias")).toBe(false);
  });
});
