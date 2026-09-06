import { lookupBarcodeInCatalog } from "@/features/fastCreate/intake/barcodeLookup";
import { supabase } from "@/integrations/supabase/client";
import type { DuplicateKind } from "./types";

/** Canonical normalization for SKU identity — trim + lowercase. */
export function normalizeProductSku(sku: string | null | undefined): string | null {
  const v = sku?.trim().toLowerCase();
  return v || null;
}

/** Canonical normalization for barcode/EAN identity — trim only (digits are caseless). */
export function normalizeProductBarcode(barcode: string | null | undefined): string | null {
  const v = barcode?.trim();
  return v || null;
}

/** Canonical normalization for product display name identity. */
export function normalizeProductName(name: string | null | undefined): string | null {
  const v = name?.trim().toLowerCase();
  return v || null;
}

/** Variant/pack identity key for import and review signals. */
export function normalizeNamePackKey(
  name: string | null | undefined,
  packSize: string | null | undefined,
): string | null {
  const normalizedName = normalizeProductName(name);
  if (!normalizedName) return null;
  return `${normalizedName}|${(packSize ?? "").trim().toLowerCase()}`;
}

export type ProductDuplicateSeverity = "blocking" | "review";

const BLOCKING_KINDS = new Set<DuplicateKind>(["same_sku", "same_barcode"]);

export function duplicateCollisionSeverity(kind: DuplicateKind): ProductDuplicateSeverity {
  return BLOCKING_KINDS.has(kind) ? "blocking" : "review";
}

export function isBlockingDuplicateKind(kind: DuplicateKind): boolean {
  return duplicateCollisionSeverity(kind) === "blocking";
}

export type ProductIdentityCollision = {
  kind: DuplicateKind;
  severity: ProductDuplicateSeverity;
  matchedValue: string;
  existingProductId: string;
  existingLabel: string;
};

export type ProductIdentityProbe = {
  sku?: string | null;
  barcode?: string | null;
  excludeProductId?: string | null;
};

type CatalogProductRow = {
  id: string;
  sku?: string | null;
  product_name?: string | null;
  name?: string | null;
};

export function productCollisionLabel(product: CatalogProductRow): string {
  const name = product.product_name ?? product.name ?? "Unnamed product";
  return product.sku ? `${name} (${product.sku})` : name;
}

function isExcluded(productId: string, excludeProductId?: string | null): boolean {
  return Boolean(excludeProductId && productId === excludeProductId);
}

/**
 * Read-only pre-save probe for exact identity collisions.
 * Exact SKU and barcode conflicts are blocking; Core DB uniqueness remains authoritative
 * for race-safe handoff when a concurrent write slips past this read.
 */
export async function lookupBlockingProductCollisions(
  probe: ProductIdentityProbe,
): Promise<ProductIdentityCollision[]> {
  const collisions: ProductIdentityCollision[] = [];
  const trimmedSku = probe.sku?.trim();
  const normalizedSku = normalizeProductSku(probe.sku);
  const normalizedBarcode = normalizeProductBarcode(probe.barcode);

  if (normalizedSku && trimmedSku) {
    const { data, error } = await supabase
      .from("products")
      .select("id, sku, product_name, name")
      .eq("sku", trimmedSku)
      .limit(2);

    if (!error) {
      for (const row of data ?? []) {
        if (normalizeProductSku(row.sku) !== normalizedSku) continue;
        if (isExcluded(row.id, probe.excludeProductId)) continue;
        collisions.push({
          kind: "same_sku",
          severity: "blocking",
          matchedValue: row.sku ?? trimmedSku,
          existingProductId: row.id,
          existingLabel: productCollisionLabel(row),
        });
        break;
      }
    }
  }

  if (normalizedBarcode) {
    const lookup = await lookupBarcodeInCatalog(normalizedBarcode);
    if (lookup.outcome === "found" && !isExcluded(lookup.hit.productId, probe.excludeProductId)) {
      collisions.push({
        kind: "same_barcode",
        severity: "blocking",
        matchedValue: normalizedBarcode,
        existingProductId: lookup.hit.productId,
        existingLabel: lookup.hit.sku
          ? `${lookup.hit.productName} (${lookup.hit.sku})`
          : lookup.hit.productName,
      });
    }
  }

  return collisions;
}

export function formatBlockingCollisionMessage(collisions: ProductIdentityCollision[]): string {
  const blocking = collisions.filter((c) => c.severity === "blocking");
  if (!blocking.length) return "Product identity collision detected.";
  if (blocking.length === 1) {
    const hit = blocking[0];
    switch (hit.kind) {
      case "same_sku":
        return `SKU already exists: ${hit.existingLabel}. Use a different SKU or open the existing product.`;
      case "same_barcode":
        return `Barcode ${hit.matchedValue} already belongs to ${hit.existingLabel}. Use a different barcode or open the existing product.`;
      default:
        return `Identity collision (${hit.kind}): ${hit.existingLabel}.`;
    }
  }
  return `Multiple identity collisions detected (${blocking.map((c) => c.kind).join(", ")}). Resolve before saving.`;
}

/** Fail closed on exact SKU/barcode identity conflicts before product writes. */
export async function assertNoBlockingProductCollisions(
  probe: ProductIdentityProbe,
): Promise<void> {
  const collisions = await lookupBlockingProductCollisions(probe);
  const blocking = collisions.filter((c) => c.severity === "blocking");
  if (blocking.length) {
    throw new Error(formatBlockingCollisionMessage(blocking));
  }
}
