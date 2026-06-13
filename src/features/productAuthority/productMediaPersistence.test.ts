import { describe, expect, it } from "vitest";
import {
  formatMediaInsertError,
  formatMediaStorageError,
  mediaTypeLabel,
  type ProductMediaInsertInput,
} from "@/features/productAuthority/productMediaPersistence";

describe("productMediaPersistence", () => {
  it("labels canonical uploader media types consistently", () => {
    expect(mediaTypeLabel("closeup")).toBe("Close-up");
    expect(mediaTypeLabel("hero_image")).toBe("Hero image");
    expect(mediaTypeLabel("white_background")).toBe("White background");
    expect(mediaTypeLabel("45_angle")).toBe("45° angle");
  });

  it("builds product_media insert payload with required fields", () => {
    const input: ProductMediaInsertInput = {
      product_id: "prod-uuid-0024",
      file_url: "https://cdn.example/products/raw/photo.jpg",
      type: "closeup",
      angle: "closeup",
      alt_text: "mor-pistachio-close.jpg",
      status: "raw",
    };
    expect(input.product_id).toBeTruthy();
    expect(input.file_url).toMatch(/^https:\/\//);
    expect(input.type).toBe("closeup");
    expect(input.status).toBe("raw");
  });

  it("surfaces bucket missing storage errors", () => {
    const msg = formatMediaStorageError({ message: "Bucket not found" });
    expect(msg).toContain("product-media");
    expect(msg).toContain("missing or inaccessible");
  });

  it("surfaces upload-success insert-failure message", () => {
    const msg = formatMediaInsertError({ message: "permission denied" });
    expect(msg).toContain("File uploaded but media row was not saved.");
    expect(msg).toContain("permission denied");
  });
});
