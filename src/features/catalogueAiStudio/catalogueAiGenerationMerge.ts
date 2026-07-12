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

/**
 * Per-field AI provenance status, tracked across sessions (not just within one generation call):
 * - `watchedFields`: still exactly the last-known AI-generated text — safe to live-diff against
 *   `aiGeneratedBaseline` on every save to detect a fresh edit, and safe to overwrite on a new
 *   generation.
 * - `lockedHumanEditedFields` / `lockedPreservedFields`: their classification is sticky. Once a
 *   field is known to carry human-authored content (whether AI wrote it first and a human changed
 *   it, or AI never touched it because it was already edited), that fact must never be re-derived
 *   from a value diff — the original AI text isn't persisted, so a diff can only ever compare
 *   against the loaded (already human) value, which trivially looks "unchanged" and would silently
 *   erase the history (Bugbot regression: a load-and-save cycle with no new edit reclassified a
 *   `fields_human_edited_after_generation` field back into `fields_ai_generated`).
 */
export interface AiFieldTracking {
  watchedFields: CatalogueDraftContentKey[];
  lockedHumanEditedFields: CatalogueDraftContentKey[];
  lockedPreservedFields: CatalogueDraftContentKey[];
}

export interface AiGenerationMergeResult {
  content: CatalogueDraftContent;
  appliedFields: CatalogueDraftContentKey[];
  preservedCount: number;
}

/**
 * Any field already diverged from the active baseline (i.e. already edited by the operator before
 * this generation ran), or explicitly `lockedFields` (already known human-edited/preserved content
 * from a prior session — see `AiFieldTracking`), is preserved; every other field is overwritten
 * with the AI result. `appliedFields` records exactly which keys AI actually wrote this round, so
 * provenance can later classify a preserved field correctly instead of conflating it with an
 * AI-authored one.
 */
export function mergeAiGeneratedContent(
  currentContent: CatalogueDraftContent,
  aiContent: CatalogueDraftContent,
  activeBaselineContent: CatalogueDraftContent | null,
  lockedFields: ReadonlySet<CatalogueDraftContentKey> = new Set(),
): AiGenerationMergeResult {
  const nextContent = { ...currentContent };
  const appliedFields: CatalogueDraftContentKey[] = [];
  let preservedCount = 0;
  for (const key of CATALOGUE_DRAFT_CONTENT_KEYS) {
    const alreadyEdited =
      lockedFields.has(key) ||
      (activeBaselineContent ? isFieldEdited(currentContent[key], activeBaselineContent[key]) : false);
    if (alreadyEdited) {
      preservedCount += 1;
    } else {
      nextContent[key] = aiContent[key];
      appliedFields.push(key);
    }
  }
  return { content: nextContent, appliedFields, preservedCount };
}

/**
 * Advances per-field tracking after a generation round: fields AI just wrote become the new
 * `watchedFields` (their fresh content is now the AI baseline to diff future edits against).
 * Fields that were previously watched but got preserved this round (diverged from their AI
 * baseline) graduate into `lockedHumanEditedFields` — that divergence is a genuine human edit and
 * must stick. Fields with no prior tracking at all (first-ever generation) that got preserved this
 * round join `lockedPreservedFields`, matching the original semantics for a product that's never
 * been AI-generated before. Previously-locked fields are always carried forward unchanged, since
 * `mergeAiGeneratedContent`'s `lockedFields` guarantees they were never touched this round.
 */
export function advanceAiFieldTracking(
  priorTracking: AiFieldTracking | null,
  appliedFields: CatalogueDraftContentKey[],
): AiFieldTracking {
  const prior = priorTracking ?? { watchedFields: [], lockedHumanEditedFields: [], lockedPreservedFields: [] };
  const appliedSet = new Set(appliedFields);
  const trackedSet = new Set([
    ...prior.watchedFields,
    ...prior.lockedHumanEditedFields,
    ...prior.lockedPreservedFields,
  ]);
  const newlyHumanEdited = prior.watchedFields.filter((key) => !appliedSet.has(key));
  const newlyPreserved = CATALOGUE_DRAFT_CONTENT_KEYS.filter(
    (key) => !trackedSet.has(key) && !appliedSet.has(key),
  );
  return {
    watchedFields: [...appliedFields],
    lockedHumanEditedFields: [...prior.lockedHumanEditedFields, ...newlyHumanEdited],
    lockedPreservedFields: [...prior.lockedPreservedFields, ...newlyPreserved],
  };
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
 * a human edit made after generation, versus a field AI never touched at all. Only `watchedFields`
 * are re-diffed against `baselineContent` to detect a fresh edit since they were last confirmed
 * pure-AI text; `lockedHumanEditedFields`/`lockedPreservedFields` pass through unconditionally,
 * since their history is already established and the original AI text (needed to diff them
 * correctly) isn't persisted (Bugbot regression: reclassifying a locked field via a value diff
 * against the loaded — already human-edited — value always looked "unchanged" and silently
 * reverted it to `fields_ai_generated`).
 */
export function buildAiGenerationProvenance(
  finalContent: CatalogueDraftContent,
  baselineContent: CatalogueDraftContent,
  tracking: AiFieldTracking,
  tone: CatalogueAiTone | null,
): AiGenerationProvenance {
  const fieldsEditedAfterGeneration = tracking.watchedFields.filter((key) =>
    isFieldEdited(finalContent[key], baselineContent[key]),
  );
  return {
    service: "oasis-ai-chat",
    tone,
    fields_ai_generated: tracking.watchedFields.filter((key) => !fieldsEditedAfterGeneration.includes(key)),
    fields_human_edited_after_generation: [
      ...tracking.lockedHumanEditedFields,
      ...fieldsEditedAfterGeneration,
    ],
    fields_preserved_from_prior_edit: [...tracking.lockedPreservedFields],
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
 *
 * Presence is decided by the `service` marker, not by any field-array being non-empty — a run where
 * every field was already edited before generation (so nothing was applied) is still a real,
 * intentional record with a non-empty `fields_preserved_from_prior_edit` and empty
 * `fields_ai_generated`/`fields_human_edited_after_generation`; treating that as "absent" wiped a
 * genuine provenance record on the next save (Bugbot regression).
 */
export function readPersistedAiGenerationProvenance(sourceSnapshot: unknown): AiGenerationProvenance | null {
  const blob = extractAiGenerationBlob(sourceSnapshot);
  if (!blob || blob.service !== "oasis-ai-chat") return null;
  return {
    service: "oasis-ai-chat",
    tone: readTone(blob.tone),
    fields_ai_generated: readContentKeyArray(blob.fields_ai_generated),
    fields_human_edited_after_generation: readContentKeyArray(blob.fields_human_edited_after_generation),
    fields_preserved_from_prior_edit: readContentKeyArray(blob.fields_preserved_from_prior_edit),
  };
}

export interface RestoredAiGeneration {
  baseline: { productId: string; content: CatalogueDraftContent; prompts: CatalogueDraftPrompts };
  tracking: AiFieldTracking;
  tone: CatalogueAiTone | null;
}

/**
 * Reconstructs in-memory AI-generation state (baseline/tracking/tone) from a draft row's persisted
 * `source_snapshot.ai_generation`, so reopening a previously AI-generated draft doesn't show
 * untouched AI fields as falsely "Edited" against the raw template (Bugbot regression), and a
 * load-and-save cycle with no new edit never reclassifies a `fields_human_edited_after_generation`
 * field back into `fields_ai_generated` (Bugbot regression — see `buildAiGenerationProvenance`).
 *
 * The exact original AI-generated text isn't persisted (only which fields it touched), so the
 * baseline content for `watchedFields` (still-untouched-since-generation fields only) is taken from
 * the freshly loaded row itself — that's still valid because, by definition, nothing has changed
 * those fields since they were saved as pure AI text. `lockedHumanEditedFields`/
 * `lockedPreservedFields` never need a baseline at all, since their classification never gets
 * re-derived from a diff.
 */
export function restoreAiGenerationState(
  productId: string,
  loadedContent: CatalogueDraftContent,
  loadedPrompts: CatalogueDraftPrompts,
  sourceSnapshot: unknown,
): RestoredAiGeneration | null {
  const blob = extractAiGenerationBlob(sourceSnapshot);
  if (!blob || blob.service !== "oasis-ai-chat") return null;
  return {
    baseline: { productId, content: loadedContent, prompts: loadedPrompts },
    tracking: {
      watchedFields: readContentKeyArray(blob.fields_ai_generated),
      lockedHumanEditedFields: readContentKeyArray(blob.fields_human_edited_after_generation),
      lockedPreservedFields: readContentKeyArray(blob.fields_preserved_from_prior_edit),
    },
    tone: readTone(blob.tone),
  };
}
