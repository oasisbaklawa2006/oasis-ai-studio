import { sanitizeAiFragments } from "@/features/fastCreate/aiOutputSanitizer";
import type { GovernedAiFieldSuggestion, GovernedAiProvenance } from "./types";

export type GovernedAliasExtraction = {
  aliases: string[];
  suggestions: GovernedAiFieldSuggestion[];
  provenance: GovernedAiProvenance;
};

/**
 * Parse alias fragments from oasis-ai-chat output. Fails closed when every fragment is
 * rejected as JSON/streaming artifact — no aliases are applied in that case.
 */
export function extractGovernedAliases(rawFragments: string[]): GovernedAliasExtraction {
  const aliases = sanitizeAiFragments(rawFragments);
  const invoked_at = new Date().toISOString();

  if (aliases.length === 0) {
    return {
      aliases: [],
      suggestions: [],
      provenance: {
        service: "oasis-ai-chat",
        provider_status: "failed",
        used_heuristic_fallback: false,
        fail_closed: true,
        uncertainty_reason: "No valid alias fragments after sanitization",
        invoked_at,
      },
    };
  }

  return {
    aliases,
    suggestions: aliases.map((alias) => ({
      field: "alias" as const,
      value: alias,
      confidence: "medium" as const,
      source: "oasis-ai-chat" as const,
      suggestion_only: true as const,
      approved: false as const,
    })),
    provenance: {
      service: "oasis-ai-chat",
      provider_status: "ok",
      used_heuristic_fallback: false,
      fail_closed: false,
      invoked_at,
    },
  };
}
