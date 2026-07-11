/**
 * Pure logic for the "Generate Complete Catalogue Draft" action, extracted out of
 * CatalogueProductStudio.tsx so it can be unit-tested directly (this repo has no RTL/.test.tsx
 * convention — page-level hook/closure logic is otherwise untestable). The caller applies
 * `mergeAiGeneratedContent` inside a React functional state update to stay race-safe against
 * concurrent typing while the AI request is in flight (see handleGenerateAiDraft).
 */
import type { CatalogueDraftContent, CatalogueDraftContentKey } from "./catalogueDraftTypes";
import { CATALOGUE_DRAFT_CONTENT_KEYS } from "./catalogueDraftTypes";
import { isFieldEdited } from "./catalogueFieldEditedState";
import type { ReadinessResult } from "./catalogueProductReadiness";
import type { CatalogueAiTone } from "./catalogueAiGateway";

/**
 * Bugbot-caught: the gate used to key off `readiness.overallLabel`, which is "Not ready" the
 * moment ANY category is missing (hero image, pricing, HSN/GST, ...), not just core identity —
 * blocking generation for products the UI copy claimed were only missing "core identity".
 * Marketing copy doesn't depend on price/packaging/media being complete, and the prompt itself
 * (catalogueAiGateway.ts) already refuses to invent facts the product data doesn't supply, so only
 * the identity category (product name) should gate this.
 */
export function isAiGenerationBlockedByIdentity(readiness: ReadinessResult | null): boolean {
  if (!readiness) return true;
  const identity = readiness.categories.find((c) => c.key === "identity");
  return identity?.state === "missing";
}

export interface AiGenerationMergeResult {
  content: CatalogueDraftContent;
  appliedFields: CatalogueDraftContentKey[];
  preservedCount: number;
}

/**
 * Any field already diverged from the active baseline (i.e. already edited by the operator before
 * this generation ran) is preserved; every other field is overwritten with the AI result.
 * `appliedFields` records exactly which keys AI actually wrote this round, so provenance can later
 * classify a preserved field correctly instead of conflating it with an AI-authored one.
 */
export function mergeAiGeneratedContent(
  currentContent: CatalogueDraftContent,
  aiContent: CatalogueDraftContent,
  activeBaselineContent: CatalogueDraftContent | null,
): AiGenerationMergeResult {
  const nextContent = { ...currentContent };
  const appliedFields: CatalogueDraftContentKey[] = [];
  let preservedCount = 0;
  for (const key of CATALOGUE_DRAFT_CONTENT_KEYS) {
    const alreadyEdited = activeBaselineContent
      ? isFieldEdited(currentContent[key], activeBaselineContent[key])
      : false;
    if (alreadyEdited) {
      preservedCount += 1;
    } else {
      nextContent[key] = aiContent[key];
      appliedFields.push(key);
    }
  }
  return { content: nextContent, appliedFields, preservedCount };
}

export interface AiGenerationProvenance {
  service: "oasis-ai-chat";
  tone: CatalogueAiTone | null;
  fields_ai_generated: CatalogueDraftContentKey[];
  fields_human_edited_after_generation: CatalogueDraftContentKey[];
  fields_preserved_from_prior_edit: CatalogueDraftContentKey[];
}

/**
 * A3 AI safety/provenance: records which content fields came from the governed AI gateway versus
 * a human edit made after generation, versus a field AI never touched because it was already
 * edited before generation ran. `appliedFields` (from `mergeAiGeneratedContent`, or restored from
 * a saved draft) is the authoritative set of AI-authored keys — classification never guesses this
 * from a value diff alone, which is what previously mislabeled preserved fields as
 * "human_edited_after_generation" (Bugbot regression).
 */
export function buildAiGenerationProvenance(
  finalContent: CatalogueDraftContent,
  aiBaselineContent: CatalogueDraftContent,
  appliedFields: CatalogueDraftContentKey[],
  tone: CatalogueAiTone | null,
): AiGenerationProvenance {
  const fieldsEditedAfterGeneration = appliedFields.filter((key) =>
    isFieldEdited(finalContent[key], aiBaselineContent[key]),
  );
  return {
    service: "oasis-ai-chat",
    tone,
    fields_ai_generated: appliedFields.filter((key) => !fieldsEditedAfterGeneration.includes(key)),
    fields_human_edited_after_generation: fieldsEditedAfterGeneration,
    fields_preserved_from_prior_edit: CATALOGUE_DRAFT_CONTENT_KEYS.filter(
      (key) => !appliedFields.includes(key),
    ),
  };
}
