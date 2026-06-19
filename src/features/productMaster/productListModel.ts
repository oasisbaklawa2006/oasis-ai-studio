export type ProductListRow = {
  id: string;
  name?: string | null;
  product_name?: string | null;
  short_name?: string | null;
  sku?: string | null;
  is_active?: boolean | null;
  archived_at?: string | null;
};

/** Active list view: not archived and is_active is true or unset (Central default). */
export function productVisibleInActiveView(p: ProductListRow): boolean {
  if (p.archived_at) return false;
  return p.is_active !== false;
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
