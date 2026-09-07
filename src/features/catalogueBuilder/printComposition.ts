import { validatePrintImageQuality, validatePrintLayout } from "./printLayout";
import type { PrintTemplateId } from "./printTemplates";
import { getPrintTemplate } from "./printTemplates";
import type {
  CatalogueCollectionItemRow,
  CatalogueCollectionRow,
  CatalogueProductCard,
  PrintComposition,
  PrintCompositionSection,
} from "./types";

const COMPANY_INTRO =
  "Oasis Baklawa crafts premium Arabic sweets, dragees, and confectionery for discerning buyers worldwide. " +
  "This catalogue presents our curated selection with governed product data and approved imagery.";

function groupByCategory(
  cards: Array<{ card: CatalogueProductCard; item: CatalogueCollectionItemRow }>,
): Map<string, Array<{ card: CatalogueProductCard; item: CatalogueCollectionItemRow }>> {
  const map = new Map<
    string,
    Array<{ card: CatalogueProductCard; item: CatalogueCollectionItemRow }>
  >();
  for (const entry of cards) {
    const cat = entry.card.category?.trim() || "Uncategorised";
    const list = map.get(cat) ?? [];
    list.push(entry);
    map.set(cat, list);
  }
  return map;
}

export function buildPrintComposition(args: {
  collection: CatalogueCollectionRow;
  items: CatalogueCollectionItemRow[];
  cards: CatalogueProductCard[];
  templateId: PrintTemplateId;
}): PrintComposition {
  const template = getPrintTemplate(args.templateId);
  const itemByProduct = new Map(args.items.map((i) => [i.product_id, i]));
  const ordered = args.cards
    .flatMap((card) => {
      const item = itemByProduct.get(card.productId);
      return item ? [{ card, item }] : [];
    })
    .sort((a, b) => a.item.sort_order - b.item.sort_order);

  const sections: PrintCompositionSection[] = [];
  let page = 1;
  const contentsEntries: Array<{ title: string; page: number }> = [];

  if (template.showCover) {
    sections.push({ kind: "cover", title: args.collection.title, pageNumber: page });
    contentsEntries.push({ title: "Cover", page });
    page += 1;
  }

  if (template.showCompanyIntro) {
    sections.push({ kind: "company_intro", title: COMPANY_INTRO, pageNumber: page });
    contentsEntries.push({ title: "Company Introduction", page });
    page += 1;
  }

  const contentsPage = page;
  if (template.showContents) {
    sections.push({ kind: "contents", title: "Contents", pageNumber: page });
    page += 1;
  }

  const grouped = groupByCategory(ordered);
  const categories = Array.from(grouped.keys()).sort((a, b) => a.localeCompare(b));

  for (const category of categories) {
    const entries = grouped.get(category) ?? [];
    if (template.showCategoryDividers) {
      sections.push({
        kind: "category_divider",
        title: category,
        category,
        pageNumber: page,
      });
      contentsEntries.push({ title: category, page });
      page += 1;
    }

    const products = entries.map((e) => e.card);
    const pagesNeeded = Math.max(1, Math.ceil(products.length / template.productsPerPage));
    for (let p = 0; p < pagesNeeded; p++) {
      const slice = products.slice(
        p * template.productsPerPage,
        (p + 1) * template.productsPerPage,
      );
      sections.push({
        kind: "product",
        category,
        products: slice,
        pageNumber: page,
      });
      page += 1;
    }
  }

  // Patch contents section with final entries (excluding cover if duplicated)
  const contentsSection = sections.find((s) => s.kind === "contents");
  if (contentsSection) {
    contentsSection.products = contentsEntries
      .filter((e) => e.page !== contentsPage)
      .map((e) => ({
        productId: `contents-${e.page}`,
        name: e.title,
        sku: null,
        category: null,
        description: `Page ${e.page}`,
        imageUrl: null,
        mrp: null,
        sellingPrice: null,
        moqLabel: null,
        isFeatured: false,
        publishable: true,
        blockers: [],
      }));
  }

  return {
    collectionId: args.collection.id,
    collectionTitle: args.collection.title,
    templateId: args.templateId,
    variant: template.variant,
    sections,
    productCount: ordered.length,
    contentsEntries,
  };
}

export function validateCompositionForPrint(
  composition: PrintComposition,
  cards: CatalogueProductCard[],
): ReturnType<typeof validatePrintLayout> & { imageIssues: string[] } {
  let imagesWithIssues = 0;
  const imageIssues: string[] = [];

  for (const card of cards) {
    const result = validatePrintImageQuality({
      imageUrl: card.imageUrl,
      widthPx: card.imageWidthPx,
      heightPx: card.imageHeightPx,
      approved: card.imageApproved ?? false,
    });
    if (!result.ok) {
      imagesWithIssues += 1;
      imageIssues.push(`${card.name}: ${result.issues.join("; ")}`);
    }
  }

  const layout = validatePrintLayout({
    productCount: composition.productCount,
    imagesWithIssues,
    hasCover: composition.sections.some((s) => s.kind === "cover"),
  });

  return { ...layout, imageIssues };
}
