export type ImageRenditionProfileName =
  | "thumbnail"
  | "mobile"
  | "desktop"
  | "whatsapp"
  | "print";

export type ImageRenditionProfile = {
  name: ImageRenditionProfileName;
  maxDimension: number;
  minDimension: number;
  targetBytes: number | null;
  maxBytes: number;
  preferredQuality: number;
  minQuality: number;
};

export const IMAGE_RENDITION_PROFILES: Record<ImageRenditionProfileName, ImageRenditionProfile> = {
  thumbnail: { name: "thumbnail", maxDimension: 320, minDimension: 160, targetBytes: 15 * 1024, maxBytes: 30 * 1024, preferredQuality: 0.76, minQuality: 0.5 },
  mobile: { name: "mobile", maxDimension: 960, minDimension: 480, targetBytes: 35 * 1024, maxBytes: 75 * 1024, preferredQuality: 0.8, minQuality: 0.56 },
  desktop: { name: "desktop", maxDimension: 1920, minDimension: 960, targetBytes: 80 * 1024, maxBytes: 160 * 1024, preferredQuality: 0.84, minQuality: 0.6 },
  whatsapp: { name: "whatsapp", maxDimension: 1600, minDimension: 800, targetBytes: 120 * 1024, maxBytes: 250 * 1024, preferredQuality: 0.8, minQuality: 0.56 },
  print: { name: "print", maxDimension: 3840, minDimension: 1800, targetBytes: null, maxBytes: Math.round(1.5 * 1024 * 1024), preferredQuality: 0.9, minQuality: 0.7 },
};

export const MAX_IMAGE_SOURCE_BYTES = 25 * 1024 * 1024;
export const MAX_IMAGE_SOURCE_DIMENSION = 12_000;
export const MAX_IMAGE_SOURCE_PIXELS = 40_000_000;

export const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

export type DecodedImage<TSource = unknown> = {
  source: TSource;
  width: number;
  height: number;
  dispose?: () => void;
};

export type ImageCodec<TSource = unknown> = {
  decode: (file: File) => Promise<DecodedImage<TSource>>;
  encodeWebP: (
    source: TSource,
    width: number,
    height: number,
    quality: number,
  ) => Promise<Blob>;
  yieldToMain?: () => Promise<void>;
};

export type ImageOptimizationReport = {
  profile: ImageRenditionProfileName;
  originalBytes: number;
  optimizedBytes: number;
  originalWidth: number;
  originalHeight: number;
  width: number;
  height: number;
  quality: number;
  budgetMet: boolean;
  maximumMet: boolean;
  targetBytes: number | null;
  maximumBytes: number;
  sourceLimited: boolean;
  savingsPercent: number;
  attempts: number;
};

export type ImageOptimizationResult = {
  file: File;
  report: ImageOptimizationReport;
};

export function selectCatalogueUploadProfile(input: {
  destination: "thumbnail" | "mobile" | "catalogue" | "whatsapp" | "print";
}): ImageRenditionProfileName {
  if (input.destination === "catalogue") return "desktop";
  return input.destination;
}

export function optimizedMediaFileName(
  originalName: string,
  profile: ImageRenditionProfileName,
): string {
  const stem = originalName.replace(/\.[^.]+$/, "").trim() || "product-image";
  const safeStem = stem
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "product-image";
  return `${safeStem}-${profile}.webp`;
}

export function validateOptimizableImage(file: File): void {
  if (!SUPPORTED_IMAGE_MIME_TYPES.has(file.type.toLowerCase())) {
    throw new Error(
      `Unsupported image type "${file.type || "unknown"}". Use JPEG, PNG, WebP, or AVIF.`,
    );
  }
  if (file.size <= 0) throw new Error("The selected image is empty.");
  if (file.size > MAX_IMAGE_SOURCE_BYTES) {
    throw new Error("The selected image exceeds the 25 MB browser-processing limit. Use the backend media processor.");
  }
}

const fitWithin = (width: number, height: number, maxDimension: number) => {
  const largest = Math.max(width, height);
  if (largest <= maxDimension) return { width, height };
  const scale = maxDimension / largest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
};

export async function optimizeImageForProfile<TSource>(
  file: File,
  profileName: ImageRenditionProfileName,
  codec: ImageCodec<TSource> = createBrowserImageCodec() as ImageCodec<TSource>,
): Promise<ImageOptimizationResult> {
  validateOptimizableImage(file);
  const profile = IMAGE_RENDITION_PROFILES[profileName];
  let decoded: DecodedImage<TSource>;
  try {
    decoded = await codec.decode(file);
  } catch (error) {
    throw new Error(
      `Image conversion failed during decode: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }

  if (!Number.isFinite(decoded.width) || !Number.isFinite(decoded.height) || decoded.width < 1 || decoded.height < 1) {
    decoded.dispose?.();
    throw new Error("Image conversion failed: decoded dimensions are invalid.");
  }
  if (
    decoded.width > MAX_IMAGE_SOURCE_DIMENSION ||
    decoded.height > MAX_IMAGE_SOURCE_DIMENSION ||
    decoded.width * decoded.height > MAX_IMAGE_SOURCE_PIXELS
  ) {
    decoded.dispose?.();
    throw new Error(
      "Image dimensions exceed the safe browser-processing limit. Use the backend media processor.",
    );
  }

  let dimensions = fitWithin(decoded.width, decoded.height, profile.maxDimension);
  const sourceLargest = Math.max(dimensions.width, dimensions.height);
  const dimensionFloor = Math.min(profile.minDimension, sourceLargest);
  let quality = profile.preferredQuality;
  const desiredBytes = profile.targetBytes ?? profile.maxBytes;
  let best: { blob: Blob; width: number; height: number; quality: number } | null = null;
  let attempts = 0;

  try {
    while (attempts < 20) {
      attempts += 1;
      await codec.yieldToMain?.();
      let blob: Blob;
      try {
        blob = await codec.encodeWebP(decoded.source, dimensions.width, dimensions.height, quality);
      } catch (error) {
        throw new Error(
          `Image conversion failed during WebP encoding: ${error instanceof Error ? error.message : "unknown error"}`,
        );
      }
      if (blob.type !== "image/webp" || blob.size <= 0) {
        throw new Error("Image conversion failed: the browser did not produce a valid WebP image.");
      }
      if (!best || blob.size < best.blob.size) {
        best = { blob, width: dimensions.width, height: dimensions.height, quality };
      }
      if (blob.size <= desiredBytes) break;

      if (quality - 0.08 >= profile.minQuality) {
        quality = Math.max(profile.minQuality, Number((quality - 0.08).toFixed(2)));
        continue;
      }

      const largest = Math.max(dimensions.width, dimensions.height);
      if (largest <= dimensionFloor) break;
      dimensions = fitWithin(
        dimensions.width,
        dimensions.height,
        Math.max(dimensionFloor, Math.floor(largest * 0.84)),
      );
      quality = profile.preferredQuality;
    }
  } finally {
    decoded.dispose?.();
  }

  if (!best) throw new Error("Image conversion failed: no WebP rendition was produced.");
  const optimizedFile = new File(
    [best.blob],
    optimizedMediaFileName(file.name, profileName),
    { type: "image/webp", lastModified: Date.now() },
  );
  const savingsPercent = file.size > 0
    ? Math.round(((file.size - optimizedFile.size) / file.size) * 100)
    : 0;

  return {
    file: optimizedFile,
    report: {
      profile: profileName,
      originalBytes: file.size,
      optimizedBytes: optimizedFile.size,
      originalWidth: decoded.width,
      originalHeight: decoded.height,
      width: best.width,
      height: best.height,
      quality: best.quality,
      budgetMet: optimizedFile.size <= desiredBytes,
      maximumMet: optimizedFile.size <= profile.maxBytes,
      targetBytes: profile.targetBytes,
      maximumBytes: profile.maxBytes,
      sourceLimited: Math.max(decoded.width, decoded.height) < profile.minDimension,
      savingsPercent,
      attempts,
    },
  };
}

export async function optimizeImageRenditions<TSource>(
  file: File,
  profiles: ImageRenditionProfileName[],
  codec: ImageCodec<TSource>,
): Promise<ImageOptimizationResult[]> {
  const results: ImageOptimizationResult[] = [];
  for (const profile of profiles) {
    results.push(await optimizeImageForProfile(file, profile, codec));
  }
  return results;
}

export function createBrowserImageCodec(): ImageCodec<CanvasImageSource> {
  return {
    async decode(file) {
      if (typeof createImageBitmap !== "function") {
        throw new Error("This browser does not support safe asynchronous image decoding.");
      }
      // createImageBitmap honours EXIF orientation before pixels reach the canvas. Re-encoding the
      // normalized pixels into WebP prevents orientation metadata from being required downstream.
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, dispose: () => bitmap.close() };
    },
    encodeWebP(source, width, height, quality) {
      return new Promise((resolve, reject) => {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        // Preserve transparent product cut-outs; catalogue composition can place them on the
        // channel-specific background later without baking in a black canvas.
        const context = canvas.getContext("2d", { alpha: true });
        if (!context) return reject(new Error("Canvas 2D is unavailable."));
        context.drawImage(source, 0, 0, width, height);
        canvas.toBlob(
          (blob) => blob ? resolve(blob) : reject(new Error("Canvas WebP encoding returned no data.")),
          "image/webp",
          quality,
        );
      });
    },
    yieldToMain: () => new Promise((resolve) => window.setTimeout(resolve, 0)),
  };
}

export const formatOptimizationSummary = (report: ImageOptimizationReport) => {
  const originalKb = Math.max(1, Math.round(report.originalBytes / 1024));
  const optimizedKb = Math.max(1, Math.round(report.optimizedBytes / 1024));
  const savings = report.savingsPercent > 0 ? `${report.savingsPercent}% smaller` : "WebP normalized";
  const budget = report.budgetMet
    ? "target met"
    : report.maximumMet
      ? "within maximum; quality floor retained"
      : "maximum exceeded";
  return `${report.profile}: ${originalKb} KB → ${optimizedKb} KB, ${report.width}×${report.height}, ${savings}, ${budget}`;
};

export function assertRenditionUploadable(report: ImageOptimizationReport): void {
  if (report.maximumMet) return;
  // The contract permits an over-budget print source only when it is already below the minimum
  // print dimension; further reduction would compound its quality limitation. The UI must retain
  // and label that exception when a print upload path is introduced.
  if (report.profile === "print" && report.sourceLimited) return;
  const maximumKb = Math.round(report.maximumBytes / 1024);
  const actualKb = Math.ceil(report.optimizedBytes / 1024);
  throw new Error(
    `Image optimization could not meet the ${report.profile} ${maximumKb} KB maximum (${actualKb} KB produced). Choose a simpler/smaller source image or use the backend media processor.`,
  );
}
