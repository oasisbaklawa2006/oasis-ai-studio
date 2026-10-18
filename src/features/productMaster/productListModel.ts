export type ProductListRow = {
  id: string;
  moq_rule_type?: string | null;
  private_label_moq?: number | null;
  private_label_moq_uom?: string | null;
  carton_qty?: number | null;
  carton_uom?: string | null;
  moq_value?: number | null;
  moq_uom?: string | null;
  moq_text?: string | null;
  b2b_uom?: string | null;
  retail_uom?: string | null;
  product_type?: string | null;
  is_sample?: boolean | null;
  pack_size?: string | null;
  shelf_life_days?: number | null;
  private_label_allowed?: boolean | null;
  bom_required?: boolean | null;
  fixed_carton_required?: boolean | null;
  product_class?: string | null;
  main_department?: string | null;
  production_department?: string | null;
  category?: string | null;
  hero_image_url?: string | null;
  image_url?: string | null;
  packaging_code?: string | null;
  division_code?: string | null;
  category_code?: string | null;
  label_status?: string | null;
  primary_uom?: string | null;
  name?: string | null;
  product_name?: string | null;
  short_name?: string | null;
  sku?: string | null;
  is_active?: boolean | null;
  archived_at?: string | null;
};

/** Active list view: not archived and is_active is true or unset (Central default). */
export function productVisibleInActiveView(
  p: Pick<ProductListRow, "is_active" | "archived_at"> | { id: string },
): boolean {
  if ("archived_at" in p && p.archived_at) return false;
  return !("is_active" in p) || p.is_active !== false;
}

export function matchesProductListView(p: ProductListRow, showArchived: boolean): boolean {
  if (!showArchived) return productVisibleInActiveView(p);
  return true;
}

export function productDisplayName(p: ProductListRow): string {
  return p.product_name ?? p.name ?? "Unnamed product";
}

export type ProductListClientFilters = {
  showArchived: boolean;
  searchIds: Set<string> | null;
  div: string;
  cat: string;
  pack: string;
  pclass: string;
  mainDept: string;
  prodDept: string;
  uom: string;
  pl: string;
  bom: string;
  carton: string;
  ready: string;
  labelStatus: string;
};

export function filterProductsForMasterList(
  items: Array<ProductListRow & Record<string, unknown>>,
  filters: ProductListClientFilters,
): Array<ProductListRow & Record<string, unknown>> {
  return items.filter((p) => {
    if (!matchesProductListView(p, filters.showArchived)) return false;
    if (filters.searchIds && !filters.searchIds.has(p.id)) return false;
    if (filters.div && p.division_code !== filters.div) return false;
    if (filters.cat && p.category_code !== filters.cat) return false;
    if (filters.pack && p.packaging_code !== filters.pack) return false;
    if (filters.pclass && p.product_class !== filters.pclass) return false;
    if (filters.mainDept && p.main_department !== filters.mainDept) return false;
    if (filters.prodDept && p.production_department !== filters.prodDept) return false;
    if (filters.uom && p.primary_uom !== filters.uom) return false;
    if (filters.pl === "yes" && !p.private_label_allowed) return false;
    if (filters.pl === "no" && p.private_label_allowed) return false;
    if (filters.bom === "yes" && !p.bom_required) return false;
    if (filters.bom === "no" && p.bom_required) return false;
    if (filters.carton === "yes" && !p.fixed_carton_required) return false;
    if (filters.carton === "no" && p.fixed_carton_required) return false;
    if (filters.ready === "yes" && !p.is_catalogue_ready) return false;
    if (filters.ready === "no" && p.is_catalogue_ready) return false;
    if (filters.labelStatus && p.label_status !== filters.labelStatus) return false;
    return true;
  });
}
