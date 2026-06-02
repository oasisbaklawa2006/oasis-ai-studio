import type { CatalogueProductCard } from "./types";

export function generateWhatsAppMiniCatalogueText(args: {
  title: string;
  products: CatalogueProductCard[];
  shareUrl?: string | null;
}): string {
  const lines: string[] = [
    `*${args.title}*`,
    "Oasis Baklawa — curated catalogue",
    "",
  ];

  for (const p of args.products.slice(0, 12)) {
    const price =
      p.sellingPrice != null
        ? `₹${p.sellingPrice}`
        : p.mrp != null
          ? `MRP ₹${p.mrp}`
          : "Price on request";
    lines.push(`• *${p.name}*${p.sku ? ` (${p.sku})` : ""}`);
    lines.push(`  ${price}${p.moqLabel ? ` · MOQ ${p.moqLabel}` : ""}`);
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
