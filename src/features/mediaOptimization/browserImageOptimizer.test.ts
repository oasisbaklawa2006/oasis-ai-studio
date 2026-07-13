import { describe, expect, it, vi } from "vitest";
import {
  IMAGE_RENDITION_PROFILES,
  MAX_IMAGE_SOURCE_BYTES,
  assertRenditionUploadable,
  optimizeImageForProfile,
  optimizedMediaFileName,
  selectCatalogueUploadProfile,
  type ImageCodec,
  type ImageOptimizationReport,
} from "./browserImageOptimizer";

const imageFile = (name = "Hero Photo.JPG", type = "image/jpeg", size = 1_500_000) =>
  new File([new Uint8Array(size)], name, { type });

describe("browser image optimizer", () => {
  it("selects explicit delivery profiles", () => {
    expect(selectCatalogueUploadProfile({ destination: "catalogue" })).toBe("desktop");
    expect(selectCatalogueUploadProfile({ destination: "whatsapp" })).toBe("whatsapp");
    expect(IMAGE_RENDITION_PROFILES.print.maxDimension).toBe(3840);
    expect(IMAGE_RENDITION_PROFILES.thumbnail).toMatchObject({ targetBytes: 15 * 1024, maxBytes: 30 * 1024 });
    expect(IMAGE_RENDITION_PROFILES.mobile).toMatchObject({ targetBytes: 35 * 1024, maxBytes: 75 * 1024 });
    expect(IMAGE_RENDITION_PROFILES.desktop).toMatchObject({ targetBytes: 80 * 1024, maxBytes: 160 * 1024 });
    expect(IMAGE_RENDITION_PROFILES.whatsapp).toMatchObject({ targetBytes: 120 * 1024, maxBytes: 250 * 1024 });
    expect(IMAGE_RENDITION_PROFILES.print).toMatchObject({ targetBytes: null, maxBytes: Math.round(1.5 * 1024 * 1024) });
  });

  it("creates stable sanitized WebP names", () => {
    expect(optimizedMediaFileName("  Pistachio Hero (Final).PNG", "desktop"))
      .toBe("pistachio-hero-final-desktop.webp");
  });

  it("rejects unsafe or unsupported image formats before decode", async () => {
    await expect(optimizeImageForProfile(imageFile("x.svg", "image/svg+xml", 20), "mobile", {
      decode: vi.fn(),
      encodeWebP: vi.fn(),
    })).rejects.toThrow("Unsupported image type");
  });

  it("reduces quality until the byte target is met without crossing its floor", async () => {
    const encodeWebP = vi.fn(async (_source: object, _width: number, _height: number, quality: number) => {
      const size = quality > 0.65 ? 200_000 : 70_000;
      return new Blob([new Uint8Array(size)], { type: "image/webp" });
    });
    const codec: ImageCodec<object> = {
      decode: async () => ({ source: {}, width: 3000, height: 2000 }),
      encodeWebP,
    };
    const result = await optimizeImageForProfile(imageFile(), "desktop", codec);
    expect(result.report.budgetMet).toBe(true);
    expect(result.report.width).toBe(1920);
    expect(result.report.height).toBe(1280);
    expect(result.report.quality).toBeGreaterThanOrEqual(IMAGE_RENDITION_PROFILES.desktop.minQuality);
    expect(encodeWebP).toHaveBeenCalledTimes(4);
  });

  it("truthfully reports when the byte budget cannot be reached above the floors", async () => {
    const codec: ImageCodec<object> = {
      decode: async () => ({ source: {}, width: 500, height: 500 }),
      encodeWebP: async () => new Blob([new Uint8Array(900_000)], { type: "image/webp" }),
    };
    const result = await optimizeImageForProfile(imageFile(), "mobile", codec);
    expect(result.report.budgetMet).toBe(false);
    expect(result.report.maximumMet).toBe(false);
    expect(result.report.width).toBe(500);
    expect(result.report.height).toBe(500);
  });

  it("blocks a screen upload when its hard maximum remains unmet", async () => {
    const codec: ImageCodec<object> = {
      decode: async () => ({ source: {}, width: 500, height: 500 }),
      encodeWebP: async () => new Blob([new Uint8Array(200_000)], { type: "image/webp" }),
    };
    const result = await optimizeImageForProfile(imageFile(), "mobile", codec);
    expect(() => assertRenditionUploadable(result.report)).toThrow("75 KB maximum");
  });

  it("permits the governed print maximum exception only for a source-limited image", () => {
    const report: ImageOptimizationReport = {
      profile: "print",
      originalBytes: 2_000_000,
      optimizedBytes: 1_700_000,
      originalWidth: 1200,
      originalHeight: 1200,
      width: 1200,
      height: 1200,
      quality: 0.7,
      budgetMet: false,
      maximumMet: false,
      targetBytes: null,
      maximumBytes: Math.round(1.5 * 1024 * 1024),
      sourceLimited: true,
      savingsPercent: 15,
      attempts: 3,
    };
    expect(() => assertRenditionUploadable(report)).not.toThrow();
    expect(() => assertRenditionUploadable({ ...report, sourceLimited: false }))
      .toThrow("maximum");
  });

  it("rejects hostile source byte size before decode", async () => {
    const decode = vi.fn();
    const oversized = { name: "huge.jpg", type: "image/jpeg", size: MAX_IMAGE_SOURCE_BYTES + 1 } as File;
    await expect(optimizeImageForProfile(oversized, "mobile", { decode, encodeWebP: vi.fn() }))
      .rejects.toThrow("25 MB browser-processing limit");
    expect(decode).not.toHaveBeenCalled();
  });

  it("rejects hostile decoded dimensions before allocating a canvas", async () => {
    const encodeWebP = vi.fn();
    await expect(optimizeImageForProfile(imageFile(), "mobile", {
      decode: async () => ({ source: {}, width: 20_000, height: 20_000 }),
      encodeWebP,
    })).rejects.toThrow("dimensions exceed the safe browser-processing limit");
    expect(encodeWebP).not.toHaveBeenCalled();
  });

  it("fails truthfully when WebP conversion fails", async () => {
    const codec: ImageCodec<object> = {
      decode: async () => ({ source: {}, width: 1000, height: 800 }),
      encodeWebP: async () => { throw new Error("codec unavailable"); },
    };
    await expect(optimizeImageForProfile(imageFile(), "mobile", codec))
      .rejects.toThrow("conversion failed during WebP encoding");
  });
});
