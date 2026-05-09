export type DraftType = "product" | "media" | "alias" | "bom" | "moq" | "pricing" | "tag";
export const draftTableMap: Record<DraftType, { table: string; permission: string; targetTable: string }> = {
  product: { table: "catalogue_product_drafts", permission: "catalogue.products.submit", targetTable: "products" },
  media: { table: "catalogue_media_submissions", permission: "catalogue.media.submit", targetTable: "products" },
  alias: { table: "catalogue_alias_drafts", permission: "catalogue.alias.submit", targetTable: "product_aliases" },
  bom: { table: "catalogue_bom_drafts", permission: "catalogue.bom.submit", targetTable: "product_bom" },
  moq: { table: "catalogue_moq_drafts", permission: "catalogue.moq.submit", targetTable: "moq_rules" },
  pricing: { table: "catalogue_pricing_drafts", permission: "catalogue.pricing.submit", targetTable: "pricing_slabs" },
  tag: { table: "catalogue_tag_drafts", permission: "catalogue.tags.submit", targetTable: "product_tag_mapping" },
};
