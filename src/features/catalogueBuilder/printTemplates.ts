import type { CatalogueCollectionType } from "./types";

export const PRINT_VARIANTS = ["b2b", "exhibition", "custom_client"] as const;
export type PrintCatalogueVariant = (typeof PRINT_VARIANTS)[number];

export type PrintTemplateId =
  | "b2b_classic"
  | "b2b_grid"
  | "exhibition_hero"
  | "custom_client_elegant";

export type PrintTemplateConfig = {
  id: PrintTemplateId;
  variant: PrintCatalogueVariant;
  label: string;
  description: string;
  showCover: boolean;
  showCompanyIntro: boolean;
  showCategoryDividers: boolean;
  showContents: boolean;
  productsPerPage: number;
  defaultPriceVisibility: "visible" | "hidden" | "inquiry";
  cardLayout: "standard" | "hero" | "compact";
};

export const PRINT_TEMPLATES: Record<PrintTemplateId, PrintTemplateConfig> = {
  b2b_classic: {
    id: "b2b_classic",
    variant: "b2b",
    label: "B2B Classic",
    description: "Cover, contents, category dividers, and standard product cards with pricing.",
    showCover: true,
    showCompanyIntro: true,
    showCategoryDividers: true,
    showContents: true,
    productsPerPage: 4,
    defaultPriceVisibility: "visible",
    cardLayout: "standard",
  },
  b2b_grid: {
    id: "b2b_grid",
    variant: "b2b",
    label: "B2B Grid",
    description: "Dense grid layout for wholesale buyers.",
    showCover: true,
    showCompanyIntro: false,
    showCategoryDividers: true,
    showContents: true,
    productsPerPage: 6,
    defaultPriceVisibility: "visible",
    cardLayout: "compact",
  },
  exhibition_hero: {
    id: "exhibition_hero",
    variant: "exhibition",
    label: "Exhibition Hero",
    description: "Large hero images, minimal text, inquiry pricing by default.",
    showCover: true,
    showCompanyIntro: true,
    showCategoryDividers: false,
    showContents: false,
    productsPerPage: 2,
    defaultPriceVisibility: "inquiry",
    cardLayout: "hero",
  },
  custom_client_elegant: {
    id: "custom_client_elegant",
    variant: "custom_client",
    label: "Custom Client",
    description: "Branded cover and intro for bespoke client catalogues.",
    showCover: true,
    showCompanyIntro: true,
    showCategoryDividers: true,
    showContents: true,
    productsPerPage: 3,
    defaultPriceVisibility: "visible",
    cardLayout: "standard",
  },
};

const COLLECTION_TYPE_TEMPLATE: Partial<Record<CatalogueCollectionType, PrintTemplateId>> = {
  b2b_catalogue: "b2b_classic",
  retail_catalogue: "b2b_grid",
  export_catalogue: "b2b_classic",
  franchise_catalogue: "custom_client_elegant",
  wedding_catalogue: "custom_client_elegant",
  corporate_catalogue: "custom_client_elegant",
  whatsapp_mini_catalogue: "b2b_grid",
  qr_exhibition_catalogue: "exhibition_hero",
  seasonal_catalogue: "b2b_classic",
};

export function defaultTemplateForCollectionType(
  catalogueType: CatalogueCollectionType,
): PrintTemplateId {
  return COLLECTION_TYPE_TEMPLATE[catalogueType] ?? "b2b_classic";
}

export function templatesForVariant(variant: PrintCatalogueVariant): PrintTemplateConfig[] {
  return Object.values(PRINT_TEMPLATES).filter((t) => t.variant === variant);
}

export function getPrintTemplate(id: PrintTemplateId): PrintTemplateConfig {
  return PRINT_TEMPLATES[id];
}
