import type { CatalogueProductCard } from "./types";
import type { CatalogueExportProfile } from "./exportProfiles";

export type CataloguePlannedPage =
  | { kind: "cover"; pageNumber: number }
  | { kind: "products"; pageNumber: number; section: string; products: CatalogueProductCard[] }
  | { kind: "terms"; pageNumber: number }
  | { kind: "back"; pageNumber: number };

export type CatalogueLayoutPlan = {
  pages: CataloguePlannedPage[];
  productCount: number;
  sections: string[];
};

function sectionName(product: CatalogueProductCard) {
  return product.category?.trim() || "Other products";
}

export function planCatalogueLayout(
  products: CatalogueProductCard[],
  profile: CatalogueExportProfile,
): CatalogueLayoutPlan {
  const grouped = new Map<string, CatalogueProductCard[]>();
  for (const product of products) {
    const section = sectionName(product);
    const current = grouped.get(section) ?? [];
    current.push(product);
    grouped.set(section, current);
  }

  const sections = [...grouped.keys()].sort((a, b) => a.localeCompare(b));
  const pages: CataloguePlannedPage[] = [{ kind: "cover", pageNumber: 1 }];
  for (const section of sections) {
    const sectionProducts = grouped.get(section) ?? [];
    for (let index = 0; index < sectionProducts.length; index += profile.cardsPerPage) {
      pages.push({
        kind: "products",
        pageNumber: pages.length + 1,
        section,
        products: sectionProducts.slice(index, index + profile.cardsPerPage),
      });
    }
  }
  pages.push({ kind: "terms", pageNumber: pages.length + 1 });
  pages.push({ kind: "back", pageNumber: pages.length + 1 });
  return { pages, productCount: products.length, sections };
}
