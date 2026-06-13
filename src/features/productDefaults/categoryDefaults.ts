/** Oasis category presets — mirrors Central EMPTY_FORM defaults where applicable. */

export type FastCreateCategoryKey =
  | "baklawa"
  | "dragees"
  | "dates_chocolate"
  | "fusion_sweets"
  | "nuts"
  | "ready_packs"
  | "gift_hampers"
  | "packaging"
  | "bakery"
  | "other";

export type CategoryDefaultPatch = {
  category: string;
  subcategory?: string;
  product_class: string;
  product_type: string;
  main_department: string;
  production_department?: string;
  hsn_code: string;
  gst_rate: string;
  shelf_life_days: string;
  primary_uom: string;
  b2b_uom: string;
  retail_uom: string;
  storage_instructions: string;
  primary_pack_type?: string;
  primary_pack_uom?: string;
  moq_rule_type?: string;
  moq_value?: string;
  moq_uom?: string;
  pieces_per_kg?: string;
  approximate_piece_weight_g?: string;
  pack_size?: string;
  storage_type?: string;
};

export const FAST_CREATE_CATEGORIES: {
  key: FastCreateCategoryKey;
  label: string;
  defaults: CategoryDefaultPatch;
}[] = [
  {
    key: "baklawa",
    label: "Baklawa / Arabic Sweets",
    defaults: {
      category: "Bulk Sweets",
      subcategory: "Baklawa",
      product_class: "bulk_loose_product",
      product_type: "Baklawa",
      main_department: "ready_goods_store",
      production_department: "arabic_sweets",
      hsn_code: "19059090",
      gst_rate: "18",
      shelf_life_days: "90",
      primary_uom: "kg",
      b2b_uom: "kg",
      retail_uom: "kg",
      storage_instructions: "Store in a cool, dry place away from direct sunlight.",
      primary_pack_type: "Tray",
      primary_pack_uom: "tray",
      moq_rule_type: "fixed_min",
      moq_value: "1",
      moq_uom: "kg",
      pieces_per_kg: "40",
      approximate_piece_weight_g: "25",
      pack_size: "Per kg",
      storage_type: "ambient",
    },
  },
  {
    key: "dragees",
    label: "Dragees",
    defaults: {
      category: "Bulk Sweets",
      subcategory: "Dragees",
      product_class: "bulk_loose_product",
      product_type: "Dragees",
      main_department: "ready_goods_store",
      production_department: "dragees",
      hsn_code: "18069010",
      gst_rate: "18",
      shelf_life_days: "180",
      primary_uom: "kg",
      b2b_uom: "kg",
      retail_uom: "kg",
      storage_instructions: "Store below 22°C in a dry area.",
      moq_rule_type: "fixed_min",
      moq_value: "1",
      moq_uom: "kg",
      pack_size: "Per kg",
      storage_type: "ambient",
    },
  },
  {
    key: "dates_chocolate",
    label: "Dates & Chocolate",
    defaults: {
      category: "Bulk Sweets",
      subcategory: "Dates",
      product_class: "bulk_loose_product",
      product_type: "Dates",
      main_department: "ready_goods_store",
      production_department: "chocolates_confectionery",
      hsn_code: "18069010",
      gst_rate: "18",
      shelf_life_days: "120",
      primary_uom: "kg",
      b2b_uom: "kg",
      retail_uom: "kg",
      storage_instructions: "Store in a cool, dry place.",
      moq_value: "1",
      moq_uom: "kg",
      pack_size: "Per kg",
      storage_type: "ambient",
    },
  },
  {
    key: "fusion_sweets",
    label: "Fusion Sweets",
    defaults: {
      category: "Bulk Sweets",
      subcategory: "Fusion",
      product_class: "bulk_loose_product",
      product_type: "Fusion",
      main_department: "ready_goods_store",
      production_department: "fusion_sweets",
      hsn_code: "19059090",
      gst_rate: "18",
      shelf_life_days: "90",
      primary_uom: "kg",
      b2b_uom: "kg",
      retail_uom: "kg",
      storage_instructions: "Store in a cool, dry place.",
      moq_value: "1",
      moq_uom: "kg",
      pack_size: "Per kg",
      storage_type: "ambient",
    },
  },
  {
    key: "nuts",
    label: "Seasoned Nuts & Mixes",
    defaults: {
      category: "Bulk Sweets",
      subcategory: "Nuts",
      product_class: "bulk_loose_product",
      product_type: "Nuts",
      main_department: "ready_goods_store",
      production_department: "seasoned_nuts_mixes",
      hsn_code: "20081990",
      gst_rate: "12",
      shelf_life_days: "90",
      primary_uom: "kg",
      b2b_uom: "kg",
      retail_uom: "kg",
      storage_instructions: "Store airtight in a cool, dry place.",
      moq_value: "1",
      moq_uom: "kg",
      pack_size: "Per kg",
      storage_type: "ambient",
    },
  },
  {
    key: "ready_packs",
    label: "Ready Packs",
    defaults: {
      category: "Ready Packs",
      subcategory: "Retail Pack",
      product_class: "ready_pack",
      product_type: "Ready Pack",
      main_department: "packing_assembly",
      hsn_code: "19059090",
      gst_rate: "18",
      shelf_life_days: "90",
      primary_uom: "box",
      b2b_uom: "box",
      retail_uom: "box",
      storage_instructions: "Store in a cool, dry place.",
      primary_pack_type: "Box",
      primary_pack_uom: "box",
      moq_rule_type: "carton_based",
      moq_value: "1",
      moq_uom: "box",
      pack_size: "6 pcs box",
      storage_type: "ambient",
    },
  },
  {
    key: "gift_hampers",
    label: "Gift / Hamper",
    defaults: {
      category: "Gifts & Hampers",
      subcategory: "Hamper",
      product_class: "gift_hamper",
      product_type: "Hamper",
      main_department: "packing_assembly",
      hsn_code: "19059090",
      gst_rate: "18",
      shelf_life_days: "60",
      primary_uom: "box",
      b2b_uom: "box",
      retail_uom: "box",
      storage_instructions: "Store in a cool, dry place. Handle with care.",
      primary_pack_type: "Basket",
      primary_pack_uom: "basket",
      moq_rule_type: "quotation",
      pack_size: "Assorted hamper",
      storage_type: "ambient",
    },
  },
  {
    key: "packaging",
    label: "Packaging / Decoration",
    defaults: {
      category: "Packaging & Decoration",
      subcategory: "Packaging accessories",
      product_class: "packaging_decoration_material",
      product_type: "Packaging",
      main_department: "third_party_goods_store",
      hsn_code: "39239090",
      gst_rate: "18",
      shelf_life_days: "365",
      primary_uom: "pcs",
      b2b_uom: "pcs",
      retail_uom: "pcs",
      storage_instructions: "Store flat, dry, away from moisture.",
      primary_pack_type: "NA",
      moq_rule_type: "fixed_min",
      moq_value: "1",
      moq_uom: "pcs",
      storage_type: "ambient",
    },
  },
  {
    key: "bakery",
    label: "Bakery",
    defaults: {
      category: "Bakery",
      subcategory: "Bakery",
      product_class: "semi_prepared_frozen",
      product_type: "Bakery",
      main_department: "ready_goods_store",
      production_department: "bakery",
      hsn_code: "19059090",
      gst_rate: "18",
      shelf_life_days: "30",
      primary_uom: "pcs",
      b2b_uom: "pcs",
      retail_uom: "pcs",
      storage_instructions: "Store frozen below -18°C or as labelled.",
      moq_value: "1",
      moq_uom: "pcs",
      storage_type: "frozen",
    },
  },
  {
    key: "other",
    label: "Other / General",
    defaults: {
      category: "Bulk Sweets",
      product_class: "bulk_loose_product",
      product_type: "Sweets",
      main_department: "ready_goods_store",
      production_department: "arabic_sweets",
      hsn_code: "19059090",
      gst_rate: "18",
      shelf_life_days: "90",
      primary_uom: "kg",
      b2b_uom: "kg",
      retail_uom: "kg",
      storage_instructions: "Store in a cool, dry place away from direct sunlight.",
      moq_value: "1",
      moq_uom: "kg",
      pack_size: "Per kg",
      storage_type: "ambient",
    },
  },
];

export function getCategoryDefaults(key: FastCreateCategoryKey): CategoryDefaultPatch {
  return (
    FAST_CREATE_CATEGORIES.find((c) => c.key === key)?.defaults ??
    FAST_CREATE_CATEGORIES.find((c) => c.key === "other")!.defaults
  );
}

/** Baseline defaults applied to every new product (Central parity). */
export const CREATION_BASELINE_DEFAULTS: Record<string, unknown> = {
  currency: "INR",
  is_active: true,
  is_catalogue_ready: false,
  sku_locked: true,
  hsn_code: "19059090",
  gst_rate: "18",
  shelf_life_days: "90",
  primary_uom: "kg",
  b2b_uom: "kg",
  retail_uom: "kg",
  moq_rule_type: "fixed_min",
  moq_value: "1",
  moq_uom: "kg",
  storage_instructions: "Store in a cool, dry place away from direct sunlight.",
  storage_type: "ambient",
};
