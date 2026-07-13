export const CATALOGUE_AUDIENCES = ["b2b", "b2c", "horeca", "export", "whatsapp"] as const;

export type CatalogueAudience = (typeof CATALOGUE_AUDIENCES)[number];

export type CatalogueFieldPolicy = {
  sku: boolean;
  price: "selling" | "mrp" | "inquiry";
  moq: boolean;
  category: boolean;
  description: boolean;
};

export type CatalogueExportProfile = {
  id: CatalogueAudience;
  label: string;
  document: "print_a4" | "compact_a4";
  dpi: 300 | 150;
  cardsPerPage: number;
  imageWidthMm: number;
  fields: CatalogueFieldPolicy;
};

export const CATALOGUE_EXPORT_PROFILES: Record<CatalogueAudience, CatalogueExportProfile> = {
  b2b: {
    id: "b2b", label: "B2B", document: "print_a4", dpi: 300, cardsPerPage: 4,
    imageWidthMm: 58, fields: { sku: true, price: "selling", moq: true, category: true, description: true },
  },
  b2c: {
    id: "b2c", label: "B2C / Retail", document: "print_a4", dpi: 300, cardsPerPage: 4,
    imageWidthMm: 58, fields: { sku: false, price: "mrp", moq: false, category: true, description: true },
  },
  horeca: {
    id: "horeca", label: "HoReCa", document: "print_a4", dpi: 300, cardsPerPage: 4,
    imageWidthMm: 58, fields: { sku: true, price: "selling", moq: true, category: true, description: true },
  },
  export: {
    id: "export", label: "Export", document: "print_a4", dpi: 300, cardsPerPage: 4,
    imageWidthMm: 58, fields: { sku: true, price: "inquiry", moq: true, category: true, description: true },
  },
  whatsapp: {
    id: "whatsapp", label: "WhatsApp compact", document: "compact_a4", dpi: 150, cardsPerPage: 6,
    imageWidthMm: 44, fields: { sku: false, price: "selling", moq: false, category: true, description: false },
  },
};

export function getCatalogueExportProfile(audience: CatalogueAudience = "b2b") {
  return CATALOGUE_EXPORT_PROFILES[audience];
}
