/**
 * Governed AI content-generation gateway for the Catalogue Product AI Studio.
 *
 * Preflight finding (A3): no dedicated catalogue-content model endpoint exists, but a real,
 * existing governed `oasis-ai-chat` Supabase Edge Function does. The browser sends a bounded task
 * and source facts, never an arbitrary model prompt; the Edge Function owns the provider prompt,
 * authentication, rate limit, durable deduplication, and cache. The UI never calls a model directly.
 * Legacy stream parsers remain below only to safely read historical response fixtures.
 */
import type { CatalogueDraftContent, CatalogueDraftContentKey } from "./catalogueDraftTypes";
import { CATALOGUE_DRAFT_CONTENT_KEYS } from "./catalogueDraftTypes";
import { invokeGovernedAi } from "@/shared/ai/governedAiClient";

export interface CatalogueAiSourceFacts {
  productName: string;
  category?: string | null;
  subcategory?: string | null;
  packSize?: string | null;
  saleTypeLabel?: string | null;
  storageInstructions?: string | null;
  shelfLifeDays?: number | null;
}

/**
 * Tone steers HOW the existing per-channel fields are written; it does not add new fields or
 * channels — the schema has one column per channel already (b2b_sales_copy, export_catalogue_copy,
 * whatsapp_product_message, catalogue_title/short/long_description), so a full channel/audience/tone
 * matrix would need new columns per variant, which is a schema change out of this PR's scope.
 */
export const CATALOGUE_AI_TONES = [
  "Premium",
  "Informational",
  "Concise",
  "Sales-focused",
  "Technical",
] as const;
export type CatalogueAiTone = (typeof CATALOGUE_AI_TONES)[number];

const DEFAULT_TONE: CatalogueAiTone = "Informational";

/**
 * Structured-only prompt: the model is told exactly which facts it may use and instructed never to
 * invent price, ingredients, allergens, nutrition, tax/compliance, or shelf-life/storage specifics
 * beyond what's given here — those are separate, human-owned fields this studio never lets AI set.
 */
export function buildCatalogueContentPrompt(
  facts: CatalogueAiSourceFacts,
  tone: CatalogueAiTone = DEFAULT_TONE,
): string {
  const factLines = [
    `product_name: ${facts.productName}`,
    `category: ${facts.category ?? "(not set)"}`,
    `subcategory: ${facts.subcategory ?? "(not set)"}`,
    `pack_size: ${facts.packSize ?? "(not set)"}`,
    `sale_type: ${facts.saleTypeLabel ?? "(not set)"}`,
    `storage_instructions: ${facts.storageInstructions ?? "(not set)"}`,
    `shelf_life_days: ${facts.shelfLifeDays ?? "(not set)"}`,
  ].join("\n");

  return [
    "You are writing wholesale/retail catalogue marketing copy for a bakery/confectionery brand called Oasis.",
    `Write in a ${tone} tone throughout.`,
    "Base every statement strictly on the facts given below. Do not invent or imply price, ingredients,",
    "allergens, nutrition values, tax/HSN/GST information, or any compliance/legal claim — those are set",
    "elsewhere by a human and are not part of this task.",
    "",
    "Facts:",
    factLines,
    "",
    "Respond with ONLY a single JSON object, no markdown fences, no explanation, with exactly these string keys:",
    CATALOGUE_DRAFT_CONTENT_KEYS.join(", "),
    "",
    "- catalogue_title: short retail catalogue title, under 80 characters.",
    "- short_description: one to two sentence retail summary.",
    "- long_description: a fuller retail description, three to five sentences.",
    "- b2b_sales_copy: wholesale/HoReCa-focused copy emphasizing bulk/business value.",
    "- export_catalogue_copy: export-buyer-focused copy.",
    "- whatsapp_product_message: a short WhatsApp-style draft message (this tool never sends it).",
    "- hindi_description: a genuine Hindi-language description (Devanagari script, not Hinglish or transliteration).",
    "- storage_shelf_life_copy: presentation of storage/shelf-life guidance using ONLY the storage_instructions",
    "  and shelf_life_days facts above; if either is \"(not set)\", write only",
    "  \"Refer to product label for storage and shelf-life details.\" and nothing more specific.",
  ].join("\n");
}

/**
 * Extracts assembled text from an oasis-ai-chat response. Handles the real streamed-chunk shape
 * (one `data: {...}` JSON object per line, terminated by `data: [DONE]`) and falls back to treating
 * the raw text as already-assembled content if no such lines are found — never throws.
 */
export function parseChatCompletionStreamText(raw: string): string {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const dataLines = lines.filter((l) => l.startsWith("data:"));
  if (dataLines.length === 0) return raw.trim();

  let assembled = "";
  for (const line of dataLines) {
    const payload = line.slice("data:".length).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      const parsed = JSON.parse(payload);
      const delta = parsed?.choices?.[0]?.delta?.content;
      if (typeof delta === "string") assembled += delta;
    } catch {
      // Malformed chunk — skip it rather than let a parse error abort the whole response.
    }
  }
  return assembled.trim();
}

/** Strips markdown code fences and extracts the first top-level JSON object, if any. */
export function extractJsonObject(text: string): unknown | null {
  const withoutFences = text.replace(/```(?:json)?/gi, "").trim();
  const start = withoutFences.indexOf("{");
  const end = withoutFences.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(withoutFences.slice(start, end + 1));
  } catch {
    return null;
  }
}

export type CatalogueAiValidationResult =
  | { ok: true; content: CatalogueDraftContent }
  | { ok: false; reason: string };

/**
 * Structured-schema validation (A3 requirement: AI output must pass validation before entering
 * editor state; raw/malformed output must never be displayed as if it were genuine content).
 */
export function validateAiCatalogueContent(parsed: unknown): CatalogueAiValidationResult {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, reason: "AI response was not a JSON object." };
  }
  const row = parsed as Record<string, unknown>;
  const content = {} as CatalogueDraftContent;
  const missingOrInvalid: string[] = [];
  for (const key of CATALOGUE_DRAFT_CONTENT_KEYS) {
    const value = row[key];
    if (typeof value !== "string" || !value.trim()) {
      missingOrInvalid.push(key);
      continue;
    }
    content[key as CatalogueDraftContentKey] = value.trim();
  }
  if (missingOrInvalid.length > 0) {
    return { ok: false, reason: `AI response was missing or had an invalid value for: ${missingOrInvalid.join(", ")}.` };
  }
  return { ok: true, content };
}

export type CatalogueAiGenerationResult =
  | { ok: true; content: CatalogueDraftContent }
  | { ok: false; reason: string };

/**
 * Calls the governed oasis-ai-chat task endpoint and returns validated suggestion-only catalogue
 * content, or a truthful failure reason. Never exposes provider output until schema validation.
 */
export async function generateCatalogueContentDraft(
  facts: CatalogueAiSourceFacts,
  tone: CatalogueAiTone = DEFAULT_TONE,
): Promise<CatalogueAiGenerationResult> {
  const result = await invokeGovernedAi<{
    suggestion_only?: unknown;
    approved?: unknown;
    content?: unknown;
  }>("oasis-ai-chat", {
    task: "catalogue_copy",
    facts,
    tone,
  });
  if (!result.ok) return { ok: false, reason: result.reason };
  if (result.data?.suggestion_only !== true || result.data?.approved !== false) {
    return { ok: false, reason: "AI service did not mark its output as an unapproved suggestion." };
  }
  return validateAiCatalogueContent(result.data.content);
}
