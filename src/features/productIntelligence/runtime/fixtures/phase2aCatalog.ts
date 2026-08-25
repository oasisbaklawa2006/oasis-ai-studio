import type { RuntimeCatalog, RuntimeCatalogAlias, RuntimeCatalogProduct } from "../types";

const BATCH001_PRODUCTS: RuntimeCatalogProduct[] = [
  { id: "c7c0c5aa-1d2f-4088-88f1-1e5aacd321a0", sku: "OAS-AS-BKL-0001", name: "Cashew Kitta", product_name: "Cashew Kitta", short_name: null, category: "Baklawa", subcategory: "Cashew" },
  { id: "90e0f9df-d4dc-4ec5-8238-d7a2624e759a", sku: "OAS-AS-BKL-0003", name: "Cashew Ring", product_name: "Cashew Ring", short_name: null, category: "Baklawa", subcategory: "Cashew" },
  { id: "2390ea3d-19ba-43bb-8624-d6b033153c2f", sku: "OAS-AS-BKL-0007", name: "Cashew Finger", product_name: "Cashew Finger", short_name: null, category: "Baklawa", subcategory: "Cashew" },
  { id: "7d66f253-a179-4a33-b8ba-7b94ec783a3e", sku: "OAS-AS-BKL-0010", name: "Pistachio Ring", product_name: "Pistachio Ring", short_name: null, category: "Baklawa", subcategory: "Pistachio" },
  { id: "4baff7d1-bf58-4d0f-b842-c53f99caac61", sku: "OAS-AS-BKL-0012", name: "Chocolate Pistachio Asiyah", product_name: "Chocolate Pistachio Asiyah", short_name: null, category: "Baklawa", subcategory: "Pistachio" },
  { id: "c5e84d04-0d8b-4466-8690-a7e6267b44a8", sku: "OAS-AS-BKL-0013", name: "Chocolate Cashew Asiyah", product_name: "Chocolate Cashew Asiyah", short_name: null, category: "Baklawa", subcategory: "Cashew" },
  { id: "4af95ba1-ff0f-4740-8869-6a19a41e8c83", sku: "OAS-AS-BKL-0014", name: "Mor Cashew Asiyah", product_name: "Mor Cashew Asiyah", short_name: null, category: "Baklawa", subcategory: "Cashew" },
  { id: "73f91572-8844-4fa6-b267-56210d180468", sku: "OAS-AS-BKL-0015", name: "Mor Pistachio Asiyah", product_name: "Mor Pistachio Asiyah", short_name: null, category: "Baklawa", subcategory: "Pistachio" },
  { id: "f3f7a8fd-cea8-4ecb-a258-ef1ea86940b7", sku: "OAS-AS-BKL-0016", name: "Pistachio Asiyah", product_name: "Pistachio Asiyah", short_name: null, category: "Baklawa", subcategory: "Pistachio" },
  { id: "0cb6c64c-0529-4dfc-83cd-9b45ab7f9de6", sku: "OAS-AS-BKL-0017", name: "Cashew Asiyah", product_name: "Cashew Asiyah", short_name: null, category: "Baklawa", subcategory: "Cashew" },
  { id: "636b47cb-ea6f-4711-ae29-d6153e565ae3", sku: "OAS-AS-BKL-0019", name: "Pistachio Pyramid", product_name: "Pistachio Pyramid", short_name: null, category: "Baklawa", subcategory: "Pistachio" },
  { id: "b0aee1c4-4502-4a15-9880-e2c01378c0b5", sku: "OAS-AS-BKL-0020", name: "Tart Cashew", product_name: "Tart Cashew", short_name: null, category: "Baklawa", subcategory: "Cashew" },
  { id: "6b258e44-69dc-465a-b82a-cbb72f68d723", sku: "OAS-AS-BKL-0021", name: "Mix Nut Tart", product_name: "Mix Nut Tart", short_name: null, category: "Baklawa", subcategory: "Mixed" },
  { id: "8554f5d5-5e46-4ffe-b98a-0ed10ec522ae", sku: "OAS-AS-BKL-0022", name: "Almond Tart", product_name: "Almond Tart", short_name: null, category: "Baklawa", subcategory: "Almond" },
  { id: "43a25d30-f7d9-426b-b5af-cae7d477468e", sku: "OAS-AS-BKL-0023", name: "Pistachio Tart", product_name: "Pistachio Tart", short_name: null, category: "Baklawa", subcategory: "Pistachio" },
  { id: "cea65af8-129c-4838-988f-30955fa5bc22", sku: "OAS-AS-BKL-0024", name: "Mor Pistachio Durum", product_name: "Mor Pistachio Durum", short_name: null, category: "Baklawa", subcategory: "Pistachio" },
  { id: "f58e0a78-53a9-400b-8768-7af09b68ba38", sku: "OAS-AS-BKL-0025", name: "Coconut Durum", product_name: "Coconut Durum", short_name: null, category: "Baklawa", subcategory: "Coconut" },
];

const ACCEPTANCE_PRODUCTS: RuntimeCatalogProduct[] = [
  { id: "a0779373-d2a9-4fe5-bf25-0ca3486ea24b", sku: "OAS-AS-BKL-PST-BULK-0015", name: "Classic Pistachio Assiyah Bulk", product_name: "Classic Pistachio Assiyah Bulk", short_name: "Pista Assiyah Bulk", category: "Baklawa", subcategory: "Pistachio" },
  { id: "6b84bc23-db05-4fc8-9e0e-f48a0a340fbf", sku: "OAS-AS-BKL-PST-BULK-0016", name: "Classic Pistachio Midya Bulk", product_name: "Classic Pistachio Midya Bulk", short_name: "Midya Bulk", category: "Baklawa", subcategory: "Pistachio" },
  { id: "gift-midya-6", sku: "OAS-AS-BKL-PST-MAAPET-0003", name: "Classic Pistachio Midya Gift Pack 6 pcs", product_name: "Classic Pistachio Midya Gift Pack 6 pcs", short_name: "Midya Gift 6", category: "Baklawa", subcategory: "Pistachio" },
  { id: "cashew-tart-bulk", sku: "OAS-AS-BKL-CSH-BULK-0004", name: "Cashew Tart Bulk", product_name: "Cashew Tart Bulk", short_name: "Kaju Tart", category: "Baklawa", subcategory: "Cashew" },
  { id: "bulbul-bulk", sku: "OAS-AS-BKL-PST-BULK-0017", name: "Pistachio Bulbul Bulk", product_name: "Pistachio Bulbul Bulk", short_name: "Bulbul Pista", category: "Baklawa", subcategory: "Pistachio" },
  { id: "sarma-bulk", sku: "OAS-AS-BKL-PST-BULK-0018", name: "Double Pistachio Sarma Bulk", product_name: "Double Pistachio Sarma Bulk", short_name: "Double Sarma", category: "Baklawa", subcategory: "Pistachio" },
  { id: "frozen-kunafa", sku: "OAS-FR-KNF-KNF-MAAPET-0002", name: "Frozen Cheese Kunafa", product_name: "Frozen Cheese Kunafa", short_name: "Cheese Kunafa Frozen", category: "Kunafa", subcategory: "Kunafa" },
  { id: "roasted-kunafa", sku: "OAS-AS-KNF-KNF-TRAY1KG-0002", name: "Roasted Kunafa", product_name: "Roasted Kunafa", short_name: "Roasted KNA", category: "Kunafa", subcategory: "Kunafa" },
  { id: "dates-pista", sku: "OAS-CH-DAT-PST-LOOSE-0002", name: "Pistachio Stuffed Dates", product_name: "Pistachio Stuffed Dates", short_name: "Pista Dates", category: "Dates", subcategory: "Pistachio" },
  { id: "channa-barfi", sku: "OAS-FS-FUS-ASS-BULK-0002", name: "Channa Badam Barfi", product_name: "Channa Badam Barfi", short_name: "Channa Barfi", category: "Fusion Sweets", subcategory: "Assorted" },
];

const BATCH001_ALIASES: RuntimeCatalogAlias[] = [
  { alias_text: "mor cashew asiyah", canonical_name: "Mor Cashew Asiyah", product_id: "4af95ba1-ff0f-4740-8869-6a19a41e8c83" },
  { alias_text: "mor kaju asiyah", canonical_name: "Mor Cashew Asiyah", product_id: "4af95ba1-ff0f-4740-8869-6a19a41e8c83" },
  { alias_text: "chocolate cashew asiyah", canonical_name: "Chocolate Cashew Asiyah", product_id: "c5e84d04-0d8b-4466-8690-a7e6267b44a8" },
  { alias_text: "chocolate kaju asiyah", canonical_name: "Chocolate Cashew Asiyah", product_id: "c5e84d04-0d8b-4466-8690-a7e6267b44a8" },
  { alias_text: "tart cashew", canonical_name: "Tart Cashew", product_id: "b0aee1c4-4502-4a15-9880-e2c01378c0b5" },
  { alias_text: "tart kaju", canonical_name: "Tart Cashew", product_id: "b0aee1c4-4502-4a15-9880-e2c01378c0b5" },
  { alias_text: "mor pistachio durum", canonical_name: "Mor Pistachio Durum", product_id: "cea65af8-129c-4838-988f-30955fa5bc22" },
  { alias_text: "cashew kitta", canonical_name: "Cashew Kitta", product_id: "c7c0c5aa-1d2f-4088-88f1-1e5aacd321a0" },
  { alias_text: "pistachio pyramid", canonical_name: "Pistachio Pyramid", product_id: "636b47cb-ea6f-4711-ae29-d6153e565ae3" },
  { alias_text: "almond tart", canonical_name: "Almond Tart", product_id: "8554f5d5-5e46-4ffe-b98a-0ed10ec522ae" },
  { alias_text: "pistachio nut tart", canonical_name: "Pistachio Tart", product_id: "43a25d30-f7d9-426b-b5af-cae7d477468e" },
  { alias_text: "chocolate pistachio asiyah", canonical_name: "Chocolate Pistachio Asiyah", product_id: "4baff7d1-bf58-4d0f-b842-c53f99caac61" },
  { alias_text: "mor pistachio asiyah", canonical_name: "Mor Pistachio Asiyah", product_id: "73f91572-8844-4fa6-b267-56210d180468" },
  { alias_text: "beetroot pistachio asiyah", canonical_name: "Mor Pistachio Asiyah", product_id: "73f91572-8844-4fa6-b267-56210d180468" },
];

const ACCEPTANCE_ALIASES: RuntimeCatalogAlias[] = [
  { alias_text: "pista assiyah bulk", canonical_name: "Classic Pistachio Assiyah Bulk", product_id: "a0779373-d2a9-4fe5-bf25-0ca3486ea24b", alias_type: "whatsapp_keyword" },
  { alias_text: "assiyah pista", canonical_name: "Classic Pistachio Assiyah Bulk", product_id: "a0779373-d2a9-4fe5-bf25-0ca3486ea24b" },
  { alias_text: "midya bulk pista", canonical_name: "Classic Pistachio Midya Bulk", product_id: "6b84bc23-db05-4fc8-9e0e-f48a0a340fbf" },
  { alias_text: "midya", canonical_name: "Classic Pistachio Midya Bulk", product_id: "6b84bc23-db05-4fc8-9e0e-f48a0a340fbf" },
  { alias_text: "midya gift 6", canonical_name: "Classic Pistachio Midya Gift Pack 6 pcs", product_id: "gift-midya-6" },
  { alias_text: "6 pc midya", canonical_name: "Classic Pistachio Midya Gift Pack 6 pcs", product_id: "gift-midya-6" },
  { alias_text: "kaju tart bulk", canonical_name: "Cashew Tart Bulk", product_id: "cashew-tart-bulk" },
  { alias_text: "kaju tart", canonical_name: "Cashew Tart Bulk", product_id: "cashew-tart-bulk" },
  { alias_text: "bulbul pista", canonical_name: "Pistachio Bulbul Bulk", product_id: "bulbul-bulk" },
  { alias_text: "pista bulbul", canonical_name: "Pistachio Bulbul Bulk", product_id: "bulbul-bulk" },
  { alias_text: "double sarma", canonical_name: "Double Pistachio Sarma Bulk", product_id: "sarma-bulk" },
  { alias_text: "cheese kunafa frozen", canonical_name: "Frozen Cheese Kunafa", product_id: "frozen-kunafa" },
  { alias_text: "kunafa cheese", canonical_name: "Frozen Cheese Kunafa", product_id: "frozen-kunafa" },
  { alias_text: "frozen kunafa", canonical_name: "Frozen Cheese Kunafa", product_id: "frozen-kunafa" },
  { alias_text: "roasted kna", canonical_name: "Roasted Kunafa", product_id: "roasted-kunafa" },
  { alias_text: "pista dates", canonical_name: "Pistachio Stuffed Dates", product_id: "dates-pista" },
  { alias_text: "dates pista", canonical_name: "Pistachio Stuffed Dates", product_id: "dates-pista" },
  { alias_text: "stuffed dates", canonical_name: "Pistachio Stuffed Dates", product_id: "dates-pista" },
  { alias_text: "channa barfi", canonical_name: "Channa Badam Barfi", product_id: "channa-barfi" },
  { alias_text: "channa badam", canonical_name: "Channa Badam Barfi", product_id: "channa-barfi" },
];

export const PHASE2A_FIXTURE_CATALOG: RuntimeCatalog = {
  products: [...BATCH001_PRODUCTS, ...ACCEPTANCE_PRODUCTS],
  aliases: [...BATCH001_ALIASES, ...ACCEPTANCE_ALIASES],
};
