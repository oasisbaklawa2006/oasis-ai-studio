import type { PilotSkuCode } from "./skuGuard";
import type { PilotAliasType, PilotChannelScope } from "./pilotAliasTypes";

export const PILOT_PRODUCT_IDS: Record<PilotSkuCode, string> = {
  "OAS-AS-BKL-0024": "cea65af8-129c-4838-988f-30955fa5bc22",
  "OAS-AS-BKL-0020": "b0aee1c4-4502-4a15-9880-e2c01378c0b5",
  "OAS-AS-BKL-0001": "c7c0c5aa-1d2f-4088-88f1-1e5aacd321a0",
  "OAS-AS-BKL-0025": "f58e0a78-53a9-400b-8768-7af09b68ba38",
  "OAS-AS-BKL-0007": "2390ea3d-19ba-43bb-8624-d6b033153c2f",
};

type RawSeed = {
  alias_text: string;
  alias_type: PilotAliasType;
  channel_scope: PilotChannelScope;
};

type SkuSeedPack = {
  sku: PilotSkuCode;
  product_name: string;
  official_and_search: RawSeed[];
  whatsapp: RawSeed[];
  phonetic: RawSeed[];
  sales: RawSeed[];
};

/**
 * Curated from batch001_language_terms_preview + pilot collision hygiene.
 * 5 official/search + 5 WhatsApp + 3 phonetic + 3 sales per SKU.
 */
export const PILOT_ALIAS_SEED_PACKS: SkuSeedPack[] = [
  {
    sku: "OAS-AS-BKL-0001",
    product_name: "Cashew Kitta",
    official_and_search: [
      { alias_text: "Kaju Kitta", alias_type: "official", channel_scope: "catalogue" },
      { alias_text: "Cashew Nut Kitta", alias_type: "official", channel_scope: "catalogue" },
      { alias_text: "Cashew Kitta Baklawa", alias_type: "official", channel_scope: "both" },
      { alias_text: "Lebanese Cashew Kitta", alias_type: "search_keyword", channel_scope: "catalogue" },
      { alias_text: "Cashew Diamond Piece", alias_type: "search_keyword", channel_scope: "both" },
    ],
    whatsapp: [
      { alias_text: "cashew kitta", alias_type: "whatsapp_keyword", channel_scope: "whatsapp" },
      { alias_text: "kaju kitta", alias_type: "whatsapp_keyword", channel_scope: "whatsapp" },
      { alias_text: "need cashew kitta", alias_type: "whatsapp_keyword", channel_scope: "whatsapp" },
      { alias_text: "send cashew kitta", alias_type: "whatsapp_keyword", channel_scope: "whatsapp" },
      { alias_text: "cashew kitta kg", alias_type: "whatsapp_keyword", channel_scope: "whatsapp" },
    ],
    phonetic: [
      { alias_text: "cashoo kitta", alias_type: "phonetic", channel_scope: "both" },
      { alias_text: "cashew kita", alias_type: "phonetic", channel_scope: "both" },
      { alias_text: "kaju kita", alias_type: "phonetic", channel_scope: "both" },
    ],
    sales: [
      { alias_text: "Kitta cashew", alias_type: "sales_term", channel_scope: "internal" },
      { alias_text: "CK kitta loose", alias_type: "sales_term", channel_scope: "internal" },
      { alias_text: "Kitta bulk piece", alias_type: "sales_term", channel_scope: "internal" },
    ],
  },
  {
    sku: "OAS-AS-BKL-0007",
    product_name: "Cashew Finger",
    official_and_search: [
      { alias_text: "Kaju Finger", alias_type: "official", channel_scope: "catalogue" },
      { alias_text: "Cashew Asabi", alias_type: "official", channel_scope: "catalogue" },
      { alias_text: "Cashew Finger Baklawa", alias_type: "official", channel_scope: "both" },
      { alias_text: "Lebanese Cashew Finger", alias_type: "search_keyword", channel_scope: "catalogue" },
      { alias_text: "Cashew finger sweet", alias_type: "search_keyword", channel_scope: "both" },
    ],
    whatsapp: [
      { alias_text: "cashew finger", alias_type: "whatsapp_keyword", channel_scope: "whatsapp" },
      { alias_text: "kaju finger", alias_type: "whatsapp_keyword", channel_scope: "whatsapp" },
      { alias_text: "cashew asabi", alias_type: "whatsapp_keyword", channel_scope: "whatsapp" },
      { alias_text: "need cashew finger", alias_type: "whatsapp_keyword", channel_scope: "whatsapp" },
      { alias_text: "cashew finger kg", alias_type: "whatsapp_keyword", channel_scope: "whatsapp" },
    ],
    phonetic: [
      { alias_text: "cashew fingar", alias_type: "phonetic", channel_scope: "both" },
      { alias_text: "kaju fingar", alias_type: "phonetic", channel_scope: "both" },
      { alias_text: "cashew asabeh", alias_type: "phonetic", channel_scope: "both" },
    ],
    sales: [
      { alias_text: "Finger cashew", alias_type: "sales_term", channel_scope: "internal" },
      { alias_text: "CF finger loose", alias_type: "sales_term", channel_scope: "internal" },
      { alias_text: "Asabi piece", alias_type: "sales_term", channel_scope: "internal" },
    ],
  },
  {
    sku: "OAS-AS-BKL-0020",
    product_name: "Tart Cashew",
    official_and_search: [
      { alias_text: "Tart Kaju", alias_type: "official", channel_scope: "catalogue" },
      { alias_text: "Cashew Baklawa Tart", alias_type: "official", channel_scope: "catalogue" },
      { alias_text: "Tart Cashew Baklawa", alias_type: "official", channel_scope: "both" },
      { alias_text: "Cashew katori tart", alias_type: "search_keyword", channel_scope: "both" },
      { alias_text: "Lebanese tart cashew", alias_type: "search_keyword", channel_scope: "catalogue" },
    ],
    whatsapp: [
      { alias_text: "tart cashew", alias_type: "whatsapp_keyword", channel_scope: "whatsapp" },
      { alias_text: "tart kaju", alias_type: "whatsapp_keyword", channel_scope: "whatsapp" },
      { alias_text: "cashew tart baklawa", alias_type: "whatsapp_keyword", channel_scope: "whatsapp" },
      { alias_text: "need tart cashew", alias_type: "whatsapp_keyword", channel_scope: "whatsapp" },
      { alias_text: "tart cashew kg", alias_type: "whatsapp_keyword", channel_scope: "whatsapp" },
    ],
    phonetic: [
      { alias_text: "tart cashoo", alias_type: "phonetic", channel_scope: "both" },
      { alias_text: "tart kajoo", alias_type: "phonetic", channel_scope: "both" },
      { alias_text: "cashew tartt", alias_type: "phonetic", channel_scope: "both" },
    ],
    sales: [
      { alias_text: "TC tart", alias_type: "sales_term", channel_scope: "internal" },
      { alias_text: "Tart cashew loose", alias_type: "sales_term", channel_scope: "internal" },
      { alias_text: "Katori tart cashew", alias_type: "sales_term", channel_scope: "internal" },
    ],
  },
  {
    sku: "OAS-AS-BKL-0024",
    product_name: "Mor Pistachio Durum",
    official_and_search: [
      { alias_text: "Mor Pista Durum", alias_type: "official", channel_scope: "catalogue" },
      { alias_text: "Beetroot Pistachio Durum", alias_type: "official", channel_scope: "catalogue" },
      { alias_text: "Mor Pistachio Durum Baklawa", alias_type: "official", channel_scope: "both" },
      { alias_text: "Turkish mor pistachio roll", alias_type: "search_keyword", channel_scope: "catalogue" },
      { alias_text: "Purple pistachio durum", alias_type: "search_keyword", channel_scope: "both" },
    ],
    whatsapp: [
      { alias_text: "mor pistachio durum", alias_type: "whatsapp_keyword", channel_scope: "whatsapp" },
      { alias_text: "mor pista durum", alias_type: "whatsapp_keyword", channel_scope: "whatsapp" },
      { alias_text: "beetroot pistachio durum", alias_type: "whatsapp_keyword", channel_scope: "whatsapp" },
      { alias_text: "need mor pistachio durum", alias_type: "whatsapp_keyword", channel_scope: "whatsapp" },
      { alias_text: "mor pistachio durum kg", alias_type: "whatsapp_keyword", channel_scope: "whatsapp" },
    ],
    phonetic: [
      { alias_text: "mor pista duram", alias_type: "phonetic", channel_scope: "both" },
      { alias_text: "mor pistashio durum", alias_type: "phonetic", channel_scope: "both" },
      { alias_text: "mor pista dorum", alias_type: "phonetic", channel_scope: "both" },
    ],
    sales: [
      { alias_text: "MPD durum", alias_type: "sales_term", channel_scope: "internal" },
      { alias_text: "Mor pista roll", alias_type: "sales_term", channel_scope: "internal" },
      { alias_text: "Beetroot durum", alias_type: "sales_term", channel_scope: "internal" },
    ],
  },
  {
    sku: "OAS-AS-BKL-0025",
    product_name: "Coconut Durum",
    official_and_search: [
      { alias_text: "Nariyal Durum", alias_type: "official", channel_scope: "catalogue" },
      { alias_text: "Coconut Roll Baklava", alias_type: "official", channel_scope: "catalogue" },
      { alias_text: "Coconut Durum Baklawa", alias_type: "official", channel_scope: "both" },
      { alias_text: "Turkish coconut durum", alias_type: "search_keyword", channel_scope: "catalogue" },
      { alias_text: "Nariyal roll baklawa", alias_type: "search_keyword", channel_scope: "both" },
    ],
    whatsapp: [
      { alias_text: "coconut durum", alias_type: "whatsapp_keyword", channel_scope: "whatsapp" },
      { alias_text: "nariyal durum", alias_type: "whatsapp_keyword", channel_scope: "whatsapp" },
      { alias_text: "coconut durum baklawa", alias_type: "whatsapp_keyword", channel_scope: "whatsapp" },
      { alias_text: "need coconut durum", alias_type: "whatsapp_keyword", channel_scope: "whatsapp" },
      { alias_text: "coconut durum kg", alias_type: "whatsapp_keyword", channel_scope: "whatsapp" },
    ],
    phonetic: [
      { alias_text: "cocunut durum", alias_type: "phonetic", channel_scope: "both" },
      { alias_text: "nariyal duram", alias_type: "phonetic", channel_scope: "both" },
      { alias_text: "coconut dorum", alias_type: "phonetic", channel_scope: "both" },
    ],
    sales: [
      { alias_text: "CD coconut durum", alias_type: "sales_term", channel_scope: "internal" },
      { alias_text: "Nariyal durum loose", alias_type: "sales_term", channel_scope: "internal" },
      { alias_text: "Coco durum roll", alias_type: "sales_term", channel_scope: "internal" },
    ],
  },
];
