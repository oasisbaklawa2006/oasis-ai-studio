export const CATALOGUE_COLLECTION_TYPES = [
  "b2b_catalogue",
  "retail_catalogue",
  "export_catalogue",
  "franchise_catalogue",
  "wedding_catalogue",
  "corporate_catalogue",
  "whatsapp_mini_catalogue",
  "qr_exhibition_catalogue",
  "seasonal_catalogue",
] as const;

export type CatalogueCollectionType = (typeof CATALOGUE_COLLECTION_TYPES)[number];

export type CatalogueCollectionStatus = "draft" | "internal_review" | "published" | "archived";

export type CatalogueCollectionRow = {
  id: string;
  title: string;
  slug: string;
  catalogue_type: CatalogueCollectionType;
  channel: string | null;
  status: CatalogueCollectionStatus;
  /** Monotonic optimistic-lock token owned by the collection transition RPC. */
  revision: number;
  description: string | null;
  theme: string | null;
  created_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  published_by: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CatalogueCollectionItemRow = {
  id: string;
  collection_id: string;
  product_id: string;
  catalogue_version_id: string | null;
  sort_order: number;
  display_name_override: string | null;
  description_override: string | null;
  price_visibility: "visible" | "hidden" | "inquiry";
  is_featured: boolean;
  created_at: string;
};

export type CatalogueShareLinkRow = {
  id: string;
  collection_id: string;
  collection_revision: number | null;
  share_token: string;
  share_type: "view" | "whatsapp" | "qr" | "pdf";
  status: "active" | "revoked" | "expired";
  expires_at: string | null;
  created_by: string | null;
  revoked_by: string | null;
  revoked_at: string | null;
  created_at: string;
};

export type CatalogueProductCard = {
  productId: string;
  name: string;
  sku: string | null;
  category: string | null;
  description: string | null;
  imageUrl: string | null;
  mrp: number | null;
  sellingPrice: number | null;
  moqLabel: string | null;
  isFeatured: boolean;
  publishable: boolean;
  blockers: string[];
  /** Optional rendition metadata. The export preflight never invents image quality. */
  imageRenditions?: CatalogueMediaRendition[];
  imageStatus?: "ready" | "missing" | "corrupt" | "processing";
};

export type CatalogueMediaRendition = {
  url: string;
  width: number | null;
  height: number | null;
  bytes?: number | null;
  mimeType?: "image/webp" | "image/jpeg" | "image/png" | string;
  role?: "print" | "web" | "thumbnail" | "source";
};
