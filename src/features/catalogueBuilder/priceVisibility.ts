import type { CatalogueCollectionItemRow, CatalogueProductCard } from "./types";

export type PriceVisibilityMode = CatalogueCollectionItemRow["price_visibility"];

export type PriceDisplay = {
  showPrice: boolean;
  priceLabel: string | null;
  inquiryLabel: string | null;
};

export function resolvePriceDisplay(
  card: Pick<CatalogueProductCard, "mrp" | "sellingPrice">,
  mode: PriceVisibilityMode,
): PriceDisplay {
  if (mode === "hidden") {
    return { showPrice: false, priceLabel: null, inquiryLabel: null };
  }

  if (mode === "inquiry") {
    return { showPrice: false, priceLabel: null, inquiryLabel: "Price on inquiry" };
  }

  const price =
    card.sellingPrice != null
      ? `₹${card.sellingPrice}`
      : card.mrp != null
        ? `MRP ₹${card.mrp}`
        : null;

  return {
    showPrice: price != null,
    priceLabel: price,
    inquiryLabel: price == null ? "Price on request" : null,
  };
}

/** Apply collection item price visibility without mutating source product truth. */
export function applyPriceVisibilityToCard(
  card: CatalogueProductCard,
  mode: PriceVisibilityMode,
): CatalogueProductCard {
  const display = resolvePriceDisplay(card, mode);
  return {
    ...card,
    sellingPrice: display.showPrice ? card.sellingPrice : null,
    mrp: display.showPrice ? card.mrp : null,
    priceVisibilityMode: mode,
    priceLabel: display.priceLabel ?? display.inquiryLabel,
  };
}

export function formatPriceForExport(
  card: CatalogueProductCard & { priceVisibilityMode?: PriceVisibilityMode; priceLabel?: string | null },
  mode?: PriceVisibilityMode,
): string {
  const effectiveMode = mode ?? card.priceVisibilityMode ?? "visible";
  const display = resolvePriceDisplay(card, effectiveMode);
  if (display.priceLabel) return display.priceLabel;
  if (display.inquiryLabel) return display.inquiryLabel;
  return "—";
}
