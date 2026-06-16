import type { ProductMediaContext, ProductMediaProfile } from "./types";

function norm(s: string | null | undefined): string {
  return String(s ?? "").trim().toLowerCase();
}

export function detectProductMediaProfile(product: ProductMediaContext): ProductMediaProfile {
  const cat = norm(product.category);
  const sub = norm(product.subcategory);
  const pc = norm(product.productClass);
  const pt = norm(product.productType);

  if (pc.includes("gift_hamper") || cat.includes("hamper") || pt.includes("hamper")) {
    return "hamper";
  }
  if (pc.includes("export") || cat.includes("export") || pt.includes("export")) {
    return "export_pack";
  }
  if (
    pc.includes("gift") ||
    pc.includes("ready_pack") ||
    sub.includes("box") ||
    sub.includes("acrylic") ||
    pt.includes("box") ||
    pt.includes("pack")
  ) {
    return "gift_box";
  }
  if (
    cat.includes("baklawa") ||
    sub.includes("pyramid") ||
    sub.includes("roll") ||
    pt.includes("baklawa") ||
    sub.includes("baklawa")
  ) {
    return "baklawa_small_sweets";
  }
  return "general";
}
