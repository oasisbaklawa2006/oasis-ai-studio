import type { Batch001SkuAssessment } from "./types";

/** Authority sheet anchor cohort — Category 1 Batch 001 (Lebanese/Turkish Baklawa). */
export const BATCH_001_SKUS = [
  "OAS-AS-BKL-0001",
  "OAS-AS-BKL-0002",
  "OAS-AS-BKL-0003",
  "OAS-AS-BKL-0004",
  "OAS-AS-BKL-0005",
  "OAS-AS-BKL-0006",
  "OAS-AS-BKL-0007",
  "OAS-AS-BKL-0008",
  "OAS-AS-BKL-0009",
  "OAS-AS-BKL-0010",
  "OAS-AS-BKL-0011",
  "OAS-AS-BKL-0012",
  "OAS-AS-BKL-0013",
  "OAS-AS-BKL-0014",
  "OAS-AS-BKL-0015",
  "OAS-AS-BKL-0016",
  "OAS-AS-BKL-0017",
  "OAS-AS-BKL-0018",
  "OAS-AS-BKL-0019",
  "OAS-AS-BKL-0020",
  "OAS-AS-BKL-0021",
  "OAS-AS-BKL-0022",
  "OAS-AS-BKL-0023",
  "OAS-AS-BKL-0024",
  "OAS-AS-BKL-0025",
] as const;

type AuthorityRow = {
  sku: string;
  official_name: string;
  aliases_expected: number;
  whatsapp_expected: number;
  disambiguation_note?: string;
};

const AUTHORITY_COHORT: AuthorityRow[] = [
  { sku: "OAS-AS-BKL-0001", official_name: "Cashew Kitta", aliases_expected: 8, whatsapp_expected: 10 },
  { sku: "OAS-AS-BKL-0002", official_name: "Square Baklawa", aliases_expected: 3, whatsapp_expected: 6 },
  { sku: "OAS-AS-BKL-0003", official_name: "Cashew Ring", aliases_expected: 7, whatsapp_expected: 9 },
  { sku: "OAS-AS-BKL-0004", official_name: "Cashew Rosebud", aliases_expected: 7, whatsapp_expected: 9 },
  { sku: "OAS-AS-BKL-0005", official_name: "Almond Crosole", aliases_expected: 7, whatsapp_expected: 9 },
  { sku: "OAS-AS-BKL-0006", official_name: "Cashew Pyramid", aliases_expected: 7, whatsapp_expected: 9 },
  { sku: "OAS-AS-BKL-0007", official_name: "Cashew Finger", aliases_expected: 8, whatsapp_expected: 10 },
  { sku: "OAS-AS-BKL-0008", official_name: "Date Baklawa", aliases_expected: 5, whatsapp_expected: 8 },
  { sku: "OAS-AS-BKL-0009", official_name: "Special Square Baklawa", aliases_expected: 3, whatsapp_expected: 6 },
  { sku: "OAS-AS-BKL-0010", official_name: "Pistachio Ring", aliases_expected: 6, whatsapp_expected: 9 },
  {
    sku: "OAS-AS-BKL-0011",
    official_name: "Pistachio Pyramid(Topping)",
    aliases_expected: 10,
    whatsapp_expected: 13,
    disambiguation_note: "Ambiguous vs OAS-AS-BKL-0019 — legacy names need SKU anchor",
  },
  { sku: "OAS-AS-BKL-0012", official_name: "Chocolate Pistachio Asiyah", aliases_expected: 9, whatsapp_expected: 12 },
  { sku: "OAS-AS-BKL-0013", official_name: "Chocolate Cashew Asiyah", aliases_expected: 9, whatsapp_expected: 12 },
  { sku: "OAS-AS-BKL-0014", official_name: "Mor Cashew Asiyah", aliases_expected: 11, whatsapp_expected: 13 },
  { sku: "OAS-AS-BKL-0015", official_name: "Mor Pistachio Asiyah", aliases_expected: 11, whatsapp_expected: 13 },
  { sku: "OAS-AS-BKL-0016", official_name: "Pistachio Asiyah", aliases_expected: 9, whatsapp_expected: 12 },
  { sku: "OAS-AS-BKL-0017", official_name: "Cashew Asiyah", aliases_expected: 9, whatsapp_expected: 12 },
  { sku: "OAS-AS-BKL-0018", official_name: "Diamond Pistachio", aliases_expected: 8, whatsapp_expected: 11 },
  {
    sku: "OAS-AS-BKL-0019",
    official_name: "Pistachio Pyramid",
    aliases_expected: 7,
    whatsapp_expected: 10,
    disambiguation_note: "Shares pyramid/boukaj vocabulary with 0006 and 0011",
  },
  { sku: "OAS-AS-BKL-0020", official_name: "Tart Cashew", aliases_expected: 8, whatsapp_expected: 11 },
  { sku: "OAS-AS-BKL-0021", official_name: "Mix Nut Tart", aliases_expected: 5, whatsapp_expected: 8 },
  { sku: "OAS-AS-BKL-0022", official_name: "Almond Tart", aliases_expected: 6, whatsapp_expected: 9 },
  { sku: "OAS-AS-BKL-0023", official_name: "Pistachio Tart", aliases_expected: 7, whatsapp_expected: 10 },
  { sku: "OAS-AS-BKL-0024", official_name: "Mor Pistachio Durum", aliases_expected: 10, whatsapp_expected: 13 },
  { sku: "OAS-AS-BKL-0025", official_name: "Coconut Durum", aliases_expected: 8, whatsapp_expected: 11 },
];

export function assessBatch001Sku(row: AuthorityRow): Batch001SkuAssessment {
  const language_gaps = [
    "No typed product_language_terms rows in Central",
    "Authority aliases/WhatsApp columns not imported (Category 2 batch pending)",
    `${row.aliases_expected} official aliases expected from authority sheet`,
    `${row.whatsapp_expected} WhatsApp keywords expected from authority sheet`,
  ];

  const search_gaps = [
    "search_products_with_aliases RPC absent on Central — client fallback only",
    "Flat product_aliases rows lack term_type for channel-scoped ranking",
    row.disambiguation_note ?? "No SKU-anchored disambiguation rules deployed",
  ];

  const discoverability_gaps = [
    "Product Language Readiness score 0/5 until terms imported and typed",
    "WhatsApp automation cannot consume untyped alias_text alone",
    "Regional Hindi/Arabic terms not staged for Batch 001 cohort",
  ];

  return {
    sku: row.sku,
    official_name: row.official_name,
    authority_aliases_expected: row.aliases_expected,
    authority_whatsapp_expected: row.whatsapp_expected,
    central_status: "no_language_terms",
    language_gaps,
    search_gaps,
    discoverability_gaps,
  };
}

export function assessBatch001Cohort(): Batch001SkuAssessment[] {
  return AUTHORITY_COHORT.map(assessBatch001Sku);
}

export function summarizeBatch001Gaps(assessments: Batch001SkuAssessment[]) {
  const totalAliasesExpected = assessments.reduce((n, a) => n + a.authority_aliases_expected, 0);
  const totalWhatsappExpected = assessments.reduce((n, a) => n + a.authority_whatsapp_expected, 0);

  return {
    sku_count: assessments.length,
    total_aliases_expected: totalAliasesExpected,
    total_whatsapp_expected: totalWhatsappExpected,
    skus_with_disambiguation_risk: assessments.filter((a) =>
      a.search_gaps.some((g) => g.includes("disambiguation") || g.includes("Ambiguous")),
    ).length,
    all_central_status: "no_language_terms" as const,
  };
}
