import type { LanguageTermCounts, ProductLanguageReadinessResult } from "./types";

const DISCOVERABILITY_DIMENSIONS = [
  { key: "has_aliases", label: "Official aliases", termType: "official_alias" as const, minCount: 1 },
  { key: "has_customer_terms", label: "Customer terms", termType: "customer_term" as const, minCount: 1 },
  { key: "has_whatsapp_keywords", label: "WhatsApp keywords", termType: "whatsapp_keyword" as const, minCount: 1 },
  { key: "has_search_keywords", label: "Search keywords", termType: "search_keyword" as const, minCount: 1 },
  { key: "has_regional_terms", label: "Regional terms", termType: "regional_term" as const, minCount: 1 },
] as const;

export function evaluateProductLanguageReadiness(
  counts: LanguageTermCounts,
  opts?: { hasOfficialName?: boolean },
): ProductLanguageReadinessResult {
  const hasOfficialName = opts?.hasOfficialName ?? true;

  const dimensions = DISCOVERABILITY_DIMENSIONS.map((d) => {
    const count = counts[d.termType] ?? 0;
    const complete = count >= d.minCount;
    return {
      key: d.key,
      label: d.label,
      complete,
      count,
      note: complete ? undefined : `Add at least ${d.minCount} ${d.label.toLowerCase()}`,
    };
  });

  const gaps: string[] = [];
  if (!hasOfficialName) gaps.push("Official name missing on products.name");
  for (const d of dimensions) {
    if (!d.complete && d.note) gaps.push(d.note);
  }

  const score = dimensions.filter((d) => d.complete).length;
  const maxScore = dimensions.length;
  const percent = Math.round((score / maxScore) * 100);
  const readyForDiscoverability = hasOfficialName && score === maxScore;

  let nextAction = "Add customer terms and WhatsApp keywords for sales discovery";
  if (!hasOfficialName) nextAction = "Set official name on Identity tab";
  else if ((counts.whatsapp_keyword ?? 0) === 0) nextAction = "Add WhatsApp keywords for chat order matching";
  else if ((counts.customer_term ?? 0) === 0) nextAction = "Add customer terms for natural-language search";
  else if ((counts.search_keyword ?? 0) === 0) nextAction = "Add broad search keywords for catalogue discovery";
  else if ((counts.regional_term ?? 0) === 0) nextAction = "Add regional terms for locale-specific sales";
  else if (readyForDiscoverability) nextAction = "Language discoverability baseline complete — queue typed schema migration";

  return {
    score,
    maxScore,
    percent,
    readyForDiscoverability,
    dimensions,
    gaps,
    nextAction,
  };
}

export function capabilityReadinessScore(
  languageReadiness: ProductLanguageReadinessResult,
  opts?: {
    productTruthWired?: boolean;
    snapshotWired?: boolean;
    searchWired?: boolean;
  },
): { score: number; maxScore: number; percent: number; label: string } {
  const layers = [
    languageReadiness.percent >= 40,
    opts?.productTruthWired ?? true,
    opts?.snapshotWired ?? true,
    opts?.searchWired ?? true,
  ];
  const score = layers.filter(Boolean).length;
  const maxScore = layers.length;
  const percent = Math.round((score / maxScore) * 100);
  const label =
    percent >= 75 ? "capable_with_gaps" : percent >= 50 ? "foundation_ready" : "early_foundation";

  return { score, maxScore, percent, label };
}
