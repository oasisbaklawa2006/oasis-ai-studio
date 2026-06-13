import { describe, expect, it } from "vitest";
import {
  formatMediaInsertError,
  formatMediaStorageError,
  mediaTypeLabel,
} from "@/features/productAuthority/productMediaPersistence";

describe("productMediaPersistence", () => {
  it("labels canonical uploader media types consistently", () => {
    expect(mediaTypeLabel("closeup")).toBe("Close-up");
    expect(mediaTypeLabel("hero_image")).toBe("Hero image");
    expect(mediaTypeLabel("white_background")).toBe("White background");
    expect(mediaTypeLabel("45_angle")).toBe("45° angle");
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
