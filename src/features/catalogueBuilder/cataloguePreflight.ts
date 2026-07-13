import type { CatalogueExportProfile } from "./exportProfiles";
import type { CatalogueMediaRendition, CatalogueProductCard } from "./types";

export type CataloguePreflightIssue = {
  severity: "error" | "warning" | "info";
  code: string;
  productId?: string;
  message: string;
};

export type CataloguePreflightResult = {
  ready: boolean;
  issues: CataloguePreflightIssue[];
  selectedImages: Record<string, CatalogueMediaRendition | null>;
};

export function requiredImagePixels(profile: CatalogueExportProfile) {
  return Math.ceil((profile.imageWidthMm / 25.4) * profile.dpi);
}

function renditionArea(item: CatalogueMediaRendition) {
  return (item.width ?? 0) * (item.height ?? 0);
}

export function selectCatalogueRendition(
  product: CatalogueProductCard,
  profile: CatalogueExportProfile,
): CatalogueMediaRendition | null {
  const fallback = product.imageUrl
    ? [{ url: product.imageUrl, width: null, height: null, role: "source" as const }]
    : [];
  const candidates = (product.imageRenditions?.length ? product.imageRenditions : fallback)
    .filter((item) => Boolean(item.url) && item.width !== 0 && item.height !== 0);
  if (!candidates.length) return null;

  const required = requiredImagePixels(profile);
  const adequate = candidates.filter((item) => (item.width ?? 0) >= required && (item.height ?? 0) >= required);
  const pool = adequate.length ? adequate : candidates;
  return [...pool].sort((a, b) => {
    const aWebp = a.mimeType === "image/webp" ? 0 : 1;
    const bWebp = b.mimeType === "image/webp" ? 0 : 1;
    if (aWebp !== bWebp) return aWebp - bWebp;
    if (adequate.length) return (a.bytes ?? renditionArea(a)) - (b.bytes ?? renditionArea(b));
    return renditionArea(b) - renditionArea(a);
  })[0];
}

export function preflightCatalogueExport(
  products: CatalogueProductCard[],
  profile: CatalogueExportProfile,
): CataloguePreflightResult {
  const issues: CataloguePreflightIssue[] = [];
  const selectedImages: Record<string, CatalogueMediaRendition | null> = {};
  const required = requiredImagePixels(profile);

  for (const product of products) {
    const image = product.imageStatus === "corrupt" ? null : selectCatalogueRendition(product, profile);
    selectedImages[product.productId] = image;
    if (!image) {
      issues.push({
        severity: "warning", code: product.imageStatus === "corrupt" ? "corrupt_image" : "missing_image",
        productId: product.productId, message: `${product.name}: no usable catalogue image.`,
      });
    } else if (image.width == null || image.height == null) {
      issues.push({
        severity: "warning", code: "unknown_image_dimensions", productId: product.productId,
        message: `${product.name}: source dimensions are unknown; print quality cannot be certified.`,
      });
    } else if (image.width < required || image.height < required) {
      issues.push({
        severity: "warning", code: "insufficient_print_resolution", productId: product.productId,
        message: `${product.name}: ${image.width}×${image.height}px is below the ${required}px target for this profile.`,
      });
    }
    const needsExtendedFont = Array.from(`${product.name}${product.description ?? ""}`)
      .some((character) => (character.codePointAt(0) ?? 0) > 255);
    if (needsExtendedFont) {
      issues.push({
        severity: "warning", code: "unicode_font_required", productId: product.productId,
        message: `${product.name}: verify glyphs in the exported PDF; the bundled PDF font has limited Unicode coverage.`,
      });
    }
    if (product.name.length > 80 || (product.description?.length ?? 0) > 320) {
      issues.push({
        severity: "info", code: "content_condensed", productId: product.productId,
        message: `${product.name}: long content will be condensed in card layout; verify the exported proof.`,
      });
    }
  }

  return { ready: !issues.some((issue) => issue.severity === "error"), issues, selectedImages };
}
