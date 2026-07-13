import { describe, expect, it, vi } from "vitest";
import {
  IMAGE_RENDITION_PROFILES,
  MAX_IMAGE_SOURCE_BYTES,
  MAX_IMAGE_SOURCE_PIXELS,
  assertRenditionUploadable,
  optimizeImageForProfile,
  optimizedMediaFileName,
  validateOptimizableImage,
  type ImageCodec,
} from "./browserImageOptimizer";

function file(size: number, name = "hero.jpg", type = "image/jpeg") {
  return new File([new Uint8Array(size)], name, { type });
}

describe("browser image optimizer adversarial boundaries", () => {
  it("accepts the exact source-byte ceiling and rejects one byte above it before decode", async () => {
    expect(() => validateOptimizableImage({
      name: "exact.jpg", type: "image/jpeg", size: MAX_IMAGE_SOURCE_BYTES,
    } as File)).not.toThrow();
    const decode = vi.fn();
    await expect(optimizeImageForProfile({
      name: "over.jpg", type: "image/jpeg", size: MAX_IMAGE_SOURCE_BYTES + 1,
    } as File, "mobile", { decode, encodeWebP: vi.fn() })).rejects.toThrow("25 MB");
    expect(decode).not.toHaveBeenCalled();
  });

  it("rejects zero-byte and content-type spoofed files before decode", async () => {
    const decode = vi.fn();
    await expect(optimizeImageForProfile(file(0), "mobile", { decode, encodeWebP: vi.fn() }))
      .rejects.toThrow("empty");
    await expect(optimizeImageForProfile(file(128, "attack.html", "text/html"), "mobile", {
      decode,
      encodeWebP: vi.fn(),
    })).rejects.toThrow("Unsupported image type");
    expect(decode).not.toHaveBeenCalled();
  });

  it.each([
    [0, 800],
    [-1, 800],
    [Number.NaN, 800],
    [Number.POSITIVE_INFINITY, 800],
    [800, 0],
  ])("rejects invalid decoded dimensions %s x %s and disposes the source", async (width, height) => {
    const dispose = vi.fn();
    const encodeWebP = vi.fn();
    await expect(optimizeImageForProfile(file(1_000), "mobile", {
      decode: async () => ({ source: {}, width, height, dispose }),
      encodeWebP,
    })).rejects.toThrow("decoded dimensions are invalid");
    expect(dispose).toHaveBeenCalledOnce();
    expect(encodeWebP).not.toHaveBeenCalled();
  });

  it("accepts the exact pixel ceiling and rejects one row over it", async () => {
    const encodeWebP = vi.fn(async () => new Blob([new Uint8Array(10_000)], { type: "image/webp" }));
    const exactWidth = 8_000;
    const exactHeight = MAX_IMAGE_SOURCE_PIXELS / exactWidth;
    await expect(optimizeImageForProfile(file(2_000), "thumbnail", {
      decode: async () => ({ source: {}, width: exactWidth, height: exactHeight }),
      encodeWebP,
    })).resolves.toMatchObject({ report: { budgetMet: true } });
    await expect(optimizeImageForProfile(file(2_000), "thumbnail", {
      decode: async () => ({ source: {}, width: exactWidth, height: exactHeight + 1 }),
      encodeWebP,
    })).rejects.toThrow("dimensions exceed");
  });

  it.each([
    ["wrong MIME", new Blob([new Uint8Array(128)], { type: "image/png" })],
    ["empty WebP", new Blob([], { type: "image/webp" })],
  ])("rejects %s encoder output and always disposes decoded media", async (_label, blob) => {
    const dispose = vi.fn();
    await expect(optimizeImageForProfile(file(1_000), "mobile", {
      decode: async () => ({ source: {}, width: 800, height: 800, dispose }),
      encodeWebP: async () => blob,
    })).rejects.toThrow("valid WebP image");
    expect(dispose).toHaveBeenCalledOnce();
  });

  it("bounds a pathological encoder to twenty attempts and reports failure honestly", async () => {
    const encodeWebP = vi.fn(async () => new Blob([new Uint8Array(100_000)], { type: "image/webp" }));
    const codec: ImageCodec<object> = {
      decode: async () => ({ source: {}, width: 4_000, height: 4_000 }),
      encodeWebP,
      yieldToMain: vi.fn(async () => undefined),
    };
    const result = await optimizeImageForProfile(file(2_000_000), "thumbnail", codec);
    expect(result.report.attempts).toBeLessThanOrEqual(20);
    expect(result.report.maximumMet).toBe(false);
    expect(() => assertRenditionUploadable(result.report)).toThrow("30 KB maximum");
  });

  it("sanitizes traversal, RTL and markup from generated WebP file names", () => {
    const generated = optimizedMediaFileName("../../\u202E<script>מוצר🍫.PNG", "whatsapp");
    expect(generated).toMatch(/^[a-z0-9_-]+-whatsapp\.webp$/);
    expect(generated).not.toContain("..");
    expect(generated).not.toContain("<");
  });

  it("enforces exact rendition hard maxima", () => {
    for (const profile of Object.values(IMAGE_RENDITION_PROFILES)) {
      const base = {
        profile: profile.name,
        originalBytes: profile.maxBytes * 2,
        originalWidth: profile.minDimension,
        originalHeight: profile.minDimension,
        width: profile.minDimension,
        height: profile.minDimension,
        quality: profile.minQuality,
        budgetMet: false,
        targetBytes: profile.targetBytes,
        maximumBytes: profile.maxBytes,
        sourceLimited: false,
        savingsPercent: 50,
        attempts: 1,
      };
      expect(() => assertRenditionUploadable({ ...base, optimizedBytes: profile.maxBytes, maximumMet: true }))
        .not.toThrow();
      expect(() => assertRenditionUploadable({
        ...base,
        optimizedBytes: profile.maxBytes + 1,
        maximumMet: false,
      })).toThrow("maximum");
    }
  });
});
