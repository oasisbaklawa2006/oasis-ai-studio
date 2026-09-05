/**
 * Runtime harness invoked by scripts/certify-point30-governed-ai.mjs.
 * Reads JSON payloads from env vars set by the parent script.
 */
import {
  applyGovernedComplianceToForm,
  extractGovernedCompliance,
} from "@/features/governedAiExtraction/governedComplianceAiExtraction";
import { extractGovernedAliases } from "@/features/governedAiExtraction/governedAliasExtraction";
import { parseChatCompletionStreamText } from "@/shared/ai/chatCompletionStream";
import {
  bumpComplianceManualEditGeneration,
  captureComplianceAiRequestGuard,
  complianceFormRevisionFingerprint,
  isStaleComplianceAiRequest,
  isStaleComplianceFormRevision,
} from "@/features/compliance/complianceAiStaleGuard";
import { createManualFieldMeta } from "@/shared/ai/complianceApproval";

const compliancePayload = process.env.CERT_COMPLIANCE_PAYLOAD
  ? JSON.parse(process.env.CERT_COMPLIANCE_PAYLOAD)
  : null;
const aliasText = process.env.CERT_ALIAS_TEXT ?? "";

const compliance = extractGovernedCompliance({
  product_name: "Synthetic Pyramid Baklawa (Cert)",
  category: "baklawa",
  edgeData: compliancePayload,
  edgeError: null,
});

const complianceOk =
  compliance.provenance.provider_status === "ok" &&
  compliance.provenance.fail_closed === false &&
  compliance.suggestion_only === true &&
  compliance.approved === false &&
  compliance.suggestions.length > 0 &&
  compliance.suggestions.every((s) => s.suggestion_only && !s.approved);

const timeoutCase = extractGovernedCompliance({
  product_name: "x",
  edgeData: null,
  edgeError: { message: "Function timeout" },
});

const invalidCase = extractGovernedCompliance({
  product_name: "x",
  edgeData: { suggestion_only: true, approved: true, suggestions: { hsn_code: "1" } },
  edgeError: null,
});

const manualPreserve = applyGovernedComplianceToForm(
  { hsn_code: "11111111", ingredients: "Operator typed recipe" },
  extractGovernedCompliance({
    product_name: "x",
    edgeData: {
      suggestion_only: true,
      approved: false,
      disclaimer:
        "AI suggestion only. Final GST/HSN must be approved manually by authorized user.",
      suggestions: { hsn_code: "99999999", ingredients: "AI draft" },
    },
    edgeError: null,
  }),
  {
    hsn_code: createManualFieldMeta(),
    ingredients: { source: "manual", approved: false, suggestion_only: false },
  },
);

const assembled = parseChatCompletionStreamText(aliasText);
const rawFragments = assembled
  .split(/[,\n]/)
  .map((s) => s.trim().replace(/^[-*\d.]+\s*/, ""));
const aliasExtraction = extractGovernedAliases(rawFragments);

const baseSuggestions = {
  formPatch: { ingredients: "", allergen_warnings: "" },
  aliases: [{ alias: "heuristic alias", alias_type: "search_term" as const }],
  whatsappKeywords: ["heuristic"],
  searchKeywords: ["heuristic alias"],
  labelStarter: {
    product_name: "Synthetic Pyramid Baklawa (Cert)",
    ingredients_hint: "base",
    allergen_hint: "base",
    net_weight_hint: "500g",
  },
  productTruthStarters: {
    piecesPerKg: null,
    traysPerMasterCarton: null,
    primaryPackSummary: null,
  },
  sources: {
    defaults: true,
    heuristicAliases: true,
    aiCompliance: false,
    aiAliases: false,
  },
};

if (aliasExtraction.aliases.length > 0) {
  baseSuggestions.pendingAiAliases = aliasExtraction.aliases.map((a) => ({
    alias: a,
    alias_type: "search_term" as const,
  }));
  baseSuggestions.sources.aiAliases = aliasExtraction.provenance.provider_status === "ok";
}

function getPersistableFastCreateAliases(suggestions: typeof baseSuggestions) {
  const pendingKeys = new Set(
    (suggestions.pendingAiAliases ?? []).map((alias) => alias.alias.trim().toLowerCase()),
  );
  return {
    aliases: suggestions.aliases.filter(
      (alias) => !pendingKeys.has(alias.alias.trim().toLowerCase()),
    ),
  };
}

const persistable = getPersistableFastCreateAliases(baseSuggestions);

const guardAtStart = captureComplianceAiRequestGuard();
bumpComplianceManualEditGeneration();
const staleByEdit = isStaleComplianceAiRequest(guardAtStart);
const fpStart = complianceFormRevisionFingerprint({ ingredients: "Manual recipe" });
const staleByForm = isStaleComplianceFormRevision(fpStart, { ingredients: "Edited recipe" });

console.log(
  JSON.stringify({
    complianceOk,
    complianceProviderStatus: compliance.provenance.provider_status,
    complianceFailClosed: compliance.provenance.fail_closed,
    complianceSuggestionCount: compliance.suggestions.length,
    timeoutFailClosed:
      timeoutCase.provenance.fail_closed && timeoutCase.provenance.provider_status === "degraded",
    invalidFailClosed:
      invalidCase.provenance.fail_closed && invalidCase.provenance.provider_status === "failed",
    manualHsnPreserved: manualPreserve.form.hsn_code === "11111111",
    manualIngredientsPreserved: manualPreserve.form.ingredients === "Operator typed recipe",
    aliasProviderOk: aliasExtraction.provenance.provider_status === "ok",
    aliasCount: aliasExtraction.aliases.length,
    aliasAssembledLength: assembled.length,
    pendingAliasCount: baseSuggestions.pendingAiAliases?.length ?? 0,
    persistableAliasCount: persistable.aliases.length,
    pendingExcludedFromPersist: !persistable.aliases.some((a) =>
      (baseSuggestions.pendingAiAliases ?? []).some((p) => p.alias === a.alias),
    ),
    staleByEdit,
    staleByForm,
  }),
);
