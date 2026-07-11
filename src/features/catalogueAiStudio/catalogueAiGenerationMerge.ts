/**
 * Pure logic for the "Generate Complete Catalogue Draft" action, extracted out of
 * CatalogueProductStudio.tsx so it can be unit-tested directly (this repo has no RTL/.test.tsx
 * convention — page-level hook/closure logic is otherwise untestable). The caller applies
 * `mergeAiGeneratedContent` inside a React functional state update to stay race-safe against
 * concurrent typing while the AI request is in flight (see handleGenerateAiDraft).
 */
import type { CatalogueDraftContent, CatalogueDraftContentKey, CatalogueDraftPrompts } from "./catalogueDraftTypes";
import { CATALOGUE_DRAFT_CONTENT_KEYS } from "./catalogueDraftTypes";
import { isFieldEdited } from "./catalogueFieldEditedState";
import type { ReadinessResult } from "./catalogueProductReadiness";
import { CATALOGUE_AI_TONES, type CatalogueAiTone } from "./catalogueAiGateway";

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

function extractAiGenerationBlob(sourceSnapshot: unknown): Record<string, unknown> | null {
  if (!sourceSnapshot || typeof sourceSnapshot !== "object" || Array.isArray(sourceSnapshot)) return null;
  const aiGeneration = (sourceSnapshot as Record<string, unknown>).ai_generation;
  if (!aiGeneration || typeof aiGeneration !== "object" || Array.isArray(aiGeneration)) return null;
  return aiGeneration as Record<string, unknown>;
}

function readContentKeyArray(value: unknown): CatalogueDraftContentKey[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (key): key is CatalogueDraftContentKey =>
      typeof key === "string" && (CATALOGUE_DRAFT_CONTENT_KEYS as readonly string[]).includes(key),
  );
}

function readTone(value: unknown): CatalogueAiTone | null {
  return typeof value === "string" && (CATALOGUE_AI_TONES as readonly string[]).includes(value)
    ? (value as CatalogueAiTone)
    : null;
}

/**
 * Reads a previously saved `source_snapshot.ai_generation` blob back out unchanged, so a save that
 * doesn't involve a fresh AI generation this session (e.g. the studio was reopened and no new
 * "Generate Complete Catalogue Draft" run happened yet) preserves prior provenance history instead
 * of silently overwriting it with null (Bugbot regression).
 */
export function readPersistedAiGenerationProvenance(sourceSnapshot: unknown): AiGenerationProvenance | null {
  const blob = extractAiGenerationBlob(sourceSnapshot);
  if (!blob) return null;
  const fieldsAiGenerated = readContentKeyArray(blob.fields_ai_generated);
  const fieldsHumanEdited = readContentKeyArray(blob.fields_human_edited_after_generation);
  if (fieldsAiGenerated.length === 0 && fieldsHumanEdited.length === 0) return null;
  return {
    service: "oasis-ai-chat",
    tone: readTone(blob.tone),
    fields_ai_generated: fieldsAiGenerated,
    fields_human_edited_after_generation: fieldsHumanEdited,
    fields_preserved_from_prior_edit: readContentKeyArray(blob.fields_preserved_from_prior_edit),
  };
}

export interface RestoredAiGeneration {
  baseline: { productId: string; content: CatalogueDraftContent; prompts: CatalogueDraftPrompts };
  appliedFields: CatalogueDraftContentKey[];
  tone: CatalogueAiTone | null;
}

/**
 * Reconstructs in-memory AI-generation state (baseline/appliedFields/tone) from a draft row's
 * persisted `source_snapshot.ai_generation`, so reopening a previously AI-generated draft doesn't
 * show untouched AI fields as falsely "Edited" against the raw template (Bugbot regression).
 *
 * The exact original AI-generated text isn't persisted (only which fields it touched), so the
 * baseline content for AI-touched fields is taken from the freshly loaded row itself — meaning the
 * "Edited" badge reflects changes made from this point forward, the same "compare against what was
 * last loaded" approximation `hasUnsavedChanges` already uses elsewhere on this page.
 */
export function restoreAiGenerationState(
  productId: string,
  loadedContent: CatalogueDraftContent,
  loadedPrompts: CatalogueDraftPrompts,
  sourceSnapshot: unknown,
): RestoredAiGeneration | null {
  const blob = extractAiGenerationBlob(sourceSnapshot);
  if (!blob) return null;
  const appliedFields = [
    ...readContentKeyArray(blob.fields_ai_generated),
    ...readContentKeyArray(blob.fields_human_edited_after_generation),
  ];
  if (appliedFields.length === 0) return null;
  return {
    baseline: { productId, content: loadedContent, prompts: loadedPrompts },
    appliedFields,
    tone: readTone(blob.tone),
  };
}
