import { describe, expect, it } from "vitest";
import {
  ALLOWED_MEDIA_MIME_TYPES,
  IMAGE_MIME_TYPES,
  MAX_MEDIA_FILE_SIZE_BYTES,
  sanitizeMediaFileName,
  VIDEO_MIME_TYPES,
  validateMediaFile,
} from "./mediaDraftBoundary";

// Point 27, Phase 12: mirrors the server-side product-media bucket enforcement
// (Core migration 20260809210000_enforce_product_media_bucket_limits.sql) so a
// bad file is rejected client-side before any storage call is made.
describe("validateMediaFile", () => {
  it("accepts a file within the size limit and an allowed MIME type", () => {
    const file = new File(["x"], "photo.jpg", { type: "image/jpeg" });
    expect(validateMediaFile(file)).toBeNull();
  });

  it("rejects a file over the size limit", () => {
    const big = new File([new Uint8Array(MAX_MEDIA_FILE_SIZE_BYTES + 1)], "huge.mp4", {
      type: "video/mp4",
    });
    expect(validateMediaFile(big)).toMatch(/too large/i);
  });

  it("rejects a disallowed MIME type", () => {
    const file = new File(["x"], "script.js", { type: "application/javascript" });
    expect(validateMediaFile(file)).toMatch(/unsupported file type/i);
  });

  it("matches the server-side allowlist exactly", () => {
    expect(ALLOWED_MEDIA_MIME_TYPES).toEqual([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/avif",
      "video/mp4",
      "video/webm",
      "application/pdf",
    ]);
  });

  // CodeRabbit-flagged: an image-only input must not accept a video/PDF just because the
  // bucket as a whole permits it (accept="..." is a UI hint, not a validation boundary).
  it("rejects a video file when restricted to image MIME types", () => {
    const file = new File(["x"], "clip.mp4", { type: "video/mp4" });
    expect(validateMediaFile(file, IMAGE_MIME_TYPES)).toMatch(/unsupported file type/i);
  });

  it("rejects a PDF file when restricted to image MIME types", () => {
    const file = new File(["x"], "doc.pdf", { type: "application/pdf" });
    expect(validateMediaFile(file, IMAGE_MIME_TYPES)).toMatch(/unsupported file type/i);
  });

  it("rejects an image file when restricted to video MIME types", () => {
    const file = new File(["x"], "photo.jpg", { type: "image/jpeg" });
    expect(validateMediaFile(file, VIDEO_MIME_TYPES)).toMatch(/unsupported file type/i);
  });

  it("accepts a video file when restricted to video MIME types", () => {
    const file = new File(["x"], "clip.mp4", { type: "video/mp4" });
    expect(validateMediaFile(file, VIDEO_MIME_TYPES)).toBeNull();
  });

  // CodeRabbit-flagged: an empty/unrecognized file.type (e.g. an unusual browser, a renamed
  // file, or a spoofed extension the browser can't sniff) must not silently skip MIME
  // validation - fail closed, don't treat "unknown" as "allowed".
  it("rejects a file with an empty/unknown MIME type", () => {
    const file = new File(["x"], "mystery", { type: "" });
    expect(validateMediaFile(file, IMAGE_MIME_TYPES)).toMatch(/unsupported file type/i);
  });
});

describe("sanitizeMediaFileName", () => {
  it("strips path-traversal and unsafe characters from an uploaded file name", () => {
    expect(sanitizeMediaFileName("../../etc/passwd")).toBe(".._.._etc_passwd");
    expect(sanitizeMediaFileName("photo 1 (final).jpg")).toBe("photo_1__final_.jpg");
  });
});
