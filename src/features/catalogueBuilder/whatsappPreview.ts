import { formatPriceSegmentForShare } from "./priceVisibility";
import type { CatalogueProductCard } from "./types";

export function generateWhatsAppMiniCatalogueText(args: {
  title: string;
  products: CatalogueProductCard[];
  shareUrl?: string | null;
}): string {
  const lines: string[] = [`*${args.title}*`, "Oasis Baklawa — curated catalogue", ""];

  for (const p of args.products.slice(0, 12)) {
    const segment = formatPriceSegmentForShare(p);
    lines.push(`• *${p.name}*${p.sku ? ` (${p.sku})` : ""}`);
    if (segment) lines.push(`  ${segment}`);
    if (p.imageUrl) lines.push(`  ${p.imageUrl}`);
    lines.push("");
  }

  if (args.products.length > 12) {
    lines.push(`_+${args.products.length - 12} more products in full catalogue_`);
    lines.push("");
  }

  if (args.shareUrl) {
    lines.push(`View full catalogue: ${args.shareUrl}`);
  } else {
    lines.push("_Share link will be available after publish (placeholder)._");
  }

  return lines.join("\n").trim();
}
