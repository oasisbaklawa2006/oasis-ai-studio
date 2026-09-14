export {
  buildHeuristicNamingSuggestions,
  detectUnsafeNamingClaims,
  GOVERNED_NAMING_DISCLAIMER,
  GOVERNED_NAMING_PROMPT_VERSION,
  governedNamingSuggestionsToFields,
  validateGovernedCatalogueCopy,
  validateNamingText,
  validateProductIdentity,
  validateProviderReviewEnvelope,
} from "./governedProductNamingContract";
export {
  extractFastCreateNamingFromGoverned,
  type MockCatalogueCopyScenario,
  mockCatalogueAiCopyProvider,
} from "./governedProductNamingProvider";
export type {
  AuthoritativeProductFacts,
  GovernedCatalogueCopyValidationResult,
  GovernedNamingDescriptionField,
  GovernedNamingDescriptionResult,
  GovernedNamingDescriptionSuggestions,
  GovernedNamingFieldSuggestion,
  GovernedNamingProvenance,
  GovernedNamingProviderStatus,
  GovernedNamingService,
} from "./types";
