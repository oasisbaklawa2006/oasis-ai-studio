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
    { storage_path: 0 },
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
    { file_url: "" },
    { file_url: "  " },
    { file_url: 123 },
    { file_url: { signedUrl: "https://fixture.supabase.co/media.jpg" } },
    { file_url: "javascript:alert(1)" },
    { file_url: "https://fixture.supabase.co/storage/v1/object/authenticated/media/photo.jpg" },
    { file_url: "https://fixture.supabase.co/storage/v1/render/image/sign/media/photo.jpg" },
    {
      file_url: "https://fixture.supabase.co/storage/v1/render/image/authenticated/media/photo.jpg",
    },
    {
      file_url:
        "https://fixture.supabase.co/storage/v1/render/image/public/product-media-staging/photo.jpg",
    },
    { file_url: "https://fixture.supabase.co/storage/v1/object/public/../sign/media/photo.jpg" },
    { file_url: "https://fixture.supabase.co/storage/v1/object/public/./photo.jpg" },
    {
      file_url:
        "https://fixture.supabase.co\\\\storage\\\\v1\\\\object\\\\sign\\\\media\\\\photo.jpg",
    },
    { file_url: "https://user:pass@fixture.supabase.co/published.jpg" },
    { file_url: "https://fixture.supabase.co:invalid/photo.jpg" },
    { file_url: "https://fixture.supabase.co:0/photo.jpg" },
    { file_url: "https://fixture.supabase.co:000080/photo.jpg" },
    { file_url: "https://0x7f000001/photo.jpg" },
    { file_url: "https://127.0.0.1../photo.jpg" },
    { file_url: "https://0x7f000001../photo.jpg" },
    { file_url: "https://cdn.0x7f000001.../photo.jpg" },
    { file_url: " https://0x7f000001/photo.jpg" },
    { file_url: "  https://cdn.example.test/photos/../published.jpg" },
    { file_url: "\thttps://cdn.example.test/published.jpg" },
    { file_url: "https://cdn.example.test/published.jpg\n" },
    { file_url: "https://0x/photo.jpg" },
    { file_url: "https://127.1/photo.jpg" },
    { file_url: "https://0177.0.0.1/photo.jpg" },
    { file_url: "https://999.999.999.999/photo.jpg" },
    { file_url: "https://cdn.0x7f000001/photo.jpg" },
    { file_url: "https://fixture.supabase.co/published%2Ejpg" },
    { bucket_id: " Product-Media-Staging " },
    { file_url: "https:example.org" },
    { file_url: "https:/example.org/photo.jpg" },
  ])("blocks unpromoted media references: %j", (payload) => {
    expect(isMediaDraftApprovalUiBlocked("media", payload)).toBe(true);
    expect(isMediaDraftApprovalUiBlocked("product", payload)).toBe(false);
  });

  it.each([
    "https://cdn.example.test/published.jpg#/./preview",
    "https://cdn.example.test/published.jpg?view=/../preview",
    "https://cdn.example.test/photo.jpg#storage/v1/object/sign/example",
    "https://cdn.example.test/photo.jpg?note=storage/v1/render/image/authenticated/example",
    "https://cdn.example.test/photos/product-media-staging-guide.jpg",
    "https://cdn.example.test/storage/v1/render/image/public/product-media/photo.jpg",
    "https://203.0.113.10:8443/photo.jpg",
    "  https://cdn.example.test/published.jpg  ",
  ])(
    "keeps durable public media eligible despite harmless query/fragment or filename: %s",
    (url) => {
      expect(isMediaDraftApprovalUiBlocked("media", { file_url: url })).toBe(false);
    },
  );

  it("keeps a metadata-only draft available for Core's effective target URL validation", () => {
    expect(isMediaDraftApprovalUiBlocked("media", { alt_text: "x" })).toBe(false);
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
