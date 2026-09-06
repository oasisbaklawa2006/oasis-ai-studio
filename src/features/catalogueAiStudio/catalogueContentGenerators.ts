/**
 * Deterministic, template-based catalogue copy / image-prompt / export-bundle generation for the
 * Catalogue Product AI Studio. Pure function of existing selected-product fields — no external AI
 * call, no network I/O, no product mutation. Output is a first-pass draft only; operators edit,
 * save, and copy it manually.
 */
import type {
  CatalogueDraftContent,
  CatalogueDraftContentKey,
  CatalogueDraftPrompts,
  CatalogueDraftPromptKey,
} from "./catalogueDraftTypes";
import {
  GOVERNED_NAMING_PROMPT_VERSION,
} from "@/features/governedProductNaming";
import {
  resolveTemplateHindiDescription,
} from "@/features/governedMultilingual";
import {
  buildHeuristicChannelSuggestions,
  buildAuthoritativeChannelSource,
  channelSuggestionsToContent,
} from "@/features/governedChannelCopy";
import { hasNumber, hasText } from "./catalogueFieldUtils";
import { isMissingFieldOnlyMessage } from "./missingFieldMessage";

export interface DraftBlockMeta {
  key: CatalogueDraftContentKey;
  label: string;
  hint: string;
}

export const DRAFT_BLOCK_META: DraftBlockMeta[] = [
  { key: "catalogue_title", label: "Catalogue title", hint: "Short buyer-facing title for listings." },
  { key: "short_description", label: "Short description", hint: "One-line summary for cards/search results." },
  { key: "long_description", label: "Long description", hint: "Fuller catalogue detail copy." },
  { key: "b2b_sales_copy", label: "B2B sales copy", hint: "Wholesale-facing pitch with pricing/MOQ context." },
  { key: "export_catalogue_copy", label: "Export catalogue copy", hint: "HSN/GST/weight-oriented copy for export documentation." },
  { key: "whatsapp_product_message", label: "WhatsApp product message", hint: "Draft message text only — this studio never sends WhatsApp messages." },
  { key: "hindi_description", label: "Hindi product description", hint: "Genuine Hindi-language copy (Devanagari script) — not Hinglish, not a certified translation; review before use." },
  { key: "storage_shelf_life_copy", label: "Storage / shelf-life copy", hint: "Handling and shelf-life note." },
];

export interface PromptBlockMeta {
  key: CatalogueDraftPromptKey;
  label: string;
  hint: string;
}

export const IMAGE_PROMPT_BLOCK_META: PromptBlockMeta[] = [
  { key: "hero_image_prompt", label: "Hero image prompt", hint: "Primary catalogue hero shot." },
  { key: "square_image_prompt", label: "Square image prompt", hint: "1:1 crop for grid/listing thumbnails." },
  { key: "closeup_image_prompt", label: "Close-up image prompt", hint: "Texture/detail close-up shot." },
  { key: "packaging_image_prompt", label: "Packaging image prompt", hint: "Retail/export packaging shot." },
  { key: "lifestyle_image_prompt", label: "Lifestyle image prompt", hint: "In-context / serving-suggestion shot." },
];

export interface DraftProductInput {
  product_name?: string | null;
  sku?: string | null;
  category?: string | null;
  subcategory?: string | null;
  description?: string | null;
  short_description?: string | null;
  pack_size?: string | null;
  mrp?: number | null;
  b2b_price?: number | null;
  b2b_uom?: string | null;
  moq_text?: string | null;
  moq_value?: number | null;
  moq_uom?: string | null;
  shelf_life_days?: number | null;
  storage_instructions?: string | null;
  temperature_requirement?: string | null;
  hsn_code?: string | null;
  gst_rate?: number | null;
  net_weight_g?: number | null;
  carton_qty?: number | null;
  master_carton_qty?: number | null;
  pcs_per_carton?: number | null;
  carton_dimensions_cm?: string | null;
}

const MISSING_FIELD = (field: string) => `Add missing field first: ${field}.`;

function catalogueTitle(p: DraftProductInput): string {
  if (!hasText(p.product_name)) return MISSING_FIELD("Product Name");
  const packSuffix = hasText(p.pack_size) ? ` (${p.pack_size})` : "";
  return `${p.product_name}${packSuffix}`;
}

function shortDescription(p: DraftProductInput): string {
  if (!hasText(p.product_name)) return MISSING_FIELD("Product Name");
  const category = hasText(p.category) ? p.category : "product";
  if (hasText(p.short_description)) return p.short_description!.trim();
  if (hasText(p.description)) {
    const firstSentence = p.description!.split(/(?<=[.!?])\s/)[0].trim();
    return firstSentence || `${p.product_name} — ${category}.`;
  }
  return `${p.product_name} — ${category}. Add a product description for richer catalogue copy.`;
}

function longDescription(p: DraftProductInput): string {
  if (!hasText(p.product_name)) return MISSING_FIELD("Product Name");
  const lines: string[] = [];
  lines.push(
    hasText(p.description)
      ? p.description!.trim()
      : `${p.product_name} is listed under ${hasText(p.category) ? p.category : "the catalogue"}. Add a product description for full detail copy.`,
  );
  if (hasText(p.pack_size) || hasNumber(p.net_weight_g)) {
    const weightPart = hasNumber(p.net_weight_g) ? `${p.net_weight_g}g` : "";
    const packPart = hasText(p.pack_size) ? p.pack_size! : "";
    lines.push(`Pack: ${[packPart, weightPart].filter(Boolean).join(" · ") || "not set"}.`);
  }
  if (hasText(p.subcategory)) lines.push(`Subcategory: ${p.subcategory}.`);
  return lines.join("\n");
}

function b2bSalesCopy(p: DraftProductInput): string {
  return resolveGovernedChannelField(p, "b2b_sales_copy");
}

function exportCatalogueCopy(p: DraftProductInput): string {
  return resolveGovernedChannelField(p, "export_catalogue_copy");
}

function whatsappProductMessage(p: DraftProductInput): string {
  return resolveGovernedChannelField(p, "whatsapp_product_message");
}

function resolveGovernedChannelField(
  p: DraftProductInput,
  key: "b2b_sales_copy" | "export_catalogue_copy" | "whatsapp_product_message" | "storage_shelf_life_copy",
): string {
  const source = draftProductInputToChannelSource(p);
  const result = buildHeuristicChannelSuggestions(source);
  if (!result.ok) {
    if (!hasText(p.product_name)) return MISSING_FIELD("Product Name");
    return result.reason;
  }
  const content = channelSuggestionsToContent(result.suggestions);
  return content[key];
}

function draftProductInputToChannelSource(p: DraftProductInput) {
  return buildAuthoritativeChannelSource({
    product_name: p.product_name?.trim() ?? "",
    category: p.category ?? null,
    subcategory: p.subcategory ?? null,
    description: p.description ?? null,
    short_description: p.short_description ?? null,
    pack_size: p.pack_size ?? null,
    source_version: GOVERNED_NAMING_PROMPT_VERSION,
    b2b_price: p.b2b_price ?? null,
    mrp: p.mrp ?? null,
    b2b_uom: p.b2b_uom ?? null,
    moq_text: p.moq_text ?? null,
    moq_value: p.moq_value ?? null,
    moq_uom: p.moq_uom ?? null,
    hsn_code: p.hsn_code ?? null,
    gst_rate: p.gst_rate ?? null,
    net_weight_g: p.net_weight_g ?? null,
    shelf_life_days: p.shelf_life_days ?? null,
    storage_instructions: p.storage_instructions ?? null,
    temperature_requirement: p.temperature_requirement ?? null,
  });
}

function hindiDescription(p: DraftProductInput): string {
  if (!hasText(p.product_name)) return MISSING_FIELD("Product Name");
  return resolveTemplateHindiDescription({
    product_name: p.product_name!.trim(),
    category: p.category ?? null,
    subcategory: p.subcategory ?? null,
    description: p.description ?? null,
    short_description: p.short_description ?? null,
    pack_size: p.pack_size ?? null,
    source_version: GOVERNED_NAMING_PROMPT_VERSION,
    approved_hindi_description: null,
  }).value;
}

function storageShelfLifeCopy(p: DraftProductInput): string {
  return resolveGovernedChannelField(p, "storage_shelf_life_copy");
}

export function generateCatalogueDraftContent(product: DraftProductInput): CatalogueDraftContent {
  return {
    catalogue_title: catalogueTitle(product),
    short_description: shortDescription(product),
    long_description: longDescription(product),
    b2b_sales_copy: b2bSalesCopy(product),
    export_catalogue_copy: exportCatalogueCopy(product),
    whatsapp_product_message: whatsappProductMessage(product),
    hindi_description: hindiDescription(product),
    storage_shelf_life_copy: storageShelfLifeCopy(product),
  };
}

function packagingFragment(p: DraftProductInput): string {
  const parts: string[] = [];
  if (hasText(p.pack_size)) parts.push(p.pack_size!);
  if (hasNumber(p.net_weight_g)) parts.push(`${p.net_weight_g}g net`);
  return parts.length > 0 ? parts.join(", ") : "packaging not yet set";
}

function heroImagePrompt(p: DraftProductInput): string {
  if (!hasText(p.product_name)) return MISSING_FIELD("Product Name");
  return `Studio product photo of ${p.product_name}, ${hasText(p.category) ? p.category!.toLowerCase() : "product"}, centered on a clean neutral background, soft even lighting, catalogue hero shot, high detail, no text overlay.`;
}

function squareImagePrompt(p: DraftProductInput): string {
  if (!hasText(p.product_name)) return MISSING_FIELD("Product Name");
  return `Square 1:1 crop product photo of ${p.product_name}, centered composition, neutral background, e-commerce thumbnail style, evenly lit, no text overlay.`;
}

function closeupImagePrompt(p: DraftProductInput): string {
  if (!hasText(p.product_name)) return MISSING_FIELD("Product Name");
  return `Macro close-up shot of ${p.product_name} showing texture and detail, shallow depth of field, natural lighting, no text overlay.`;
}

function packagingImagePrompt(p: DraftProductInput): string {
  if (!hasText(p.product_name)) return MISSING_FIELD("Product Name");
  return `Product packaging shot of ${p.product_name} (${packagingFragment(p)}), showing retail packaging on a clean surface, soft studio lighting, no text overlay added by the model.`;
}

function lifestyleImagePrompt(p: DraftProductInput): string {
  if (!hasText(p.product_name)) return MISSING_FIELD("Product Name");
  const category = hasText(p.category) ? p.category!.toLowerCase() : "product";
  return `Lifestyle serving-suggestion photo of ${p.product_name}, styled as a ${category} on a table setting, natural daylight, warm inviting tone, no text overlay.`;
}

export function generateCatalogueImagePrompts(product: DraftProductInput): CatalogueDraftPrompts {
  return {
    hero_image_prompt: heroImagePrompt(product),
    square_image_prompt: squareImagePrompt(product),
    closeup_image_prompt: closeupImagePrompt(product),
    packaging_image_prompt: packagingImagePrompt(product),
    lifestyle_image_prompt: lifestyleImagePrompt(product),
  };
}

const IMAGE_PROMPT_GENERATORS: Record<CatalogueDraftPromptKey, (p: DraftProductInput) => string> = {
  hero_image_prompt: heroImagePrompt,
  square_image_prompt: squareImagePrompt,
  closeup_image_prompt: closeupImagePrompt,
  packaging_image_prompt: packagingImagePrompt,
  lifestyle_image_prompt: lifestyleImagePrompt,
};

/**
 * A4: recomposes a single image prompt from the same governed per-slot template
 * (product truth + a consistent style standard) as generateCatalogueImagePrompts, with an
 * optional operator instruction appended as a clearly labeled addendum. Still 100% local text
 * composition — no AI call, no image generation; this only changes what text ends up in the
 * existing, already-persisted prompt field. A missing-field placeholder is returned as-is (an
 * instruction has nothing real to attach to yet).
 */
export function composeCatalogueImagePrompt(
  product: DraftProductInput,
  key: CatalogueDraftPromptKey,
  operatorInstruction?: string,
): string {
  const base = IMAGE_PROMPT_GENERATORS[key](product);
  const instruction = operatorInstruction?.trim();
  if (!instruction || isMissingFieldOnlyMessage(base)) return base;
  return `${base} Additional instruction: ${instruction}`;
}

/**
 * Owner-smoke-test finding: a rejected/incomplete draft's Export tab let "Copy bundle" hand out
 * buyer-facing text still containing a raw "Add missing field first: X." fragment (e.g. embedded
 * inside b2bSalesCopy's "wholesale" sentence) with no adjacent warning. `isMissingFieldOnlyMessage`
 * only catches a block that IS *nothing but* that fragment (used to gate prompt-instruction
 * attachment); it deliberately doesn't flag the fragment embedded inline in otherwise-real copy, so
 * a separate substring check is needed here to decide whether a bundle is safe to hand out.
 */
const MISSING_FIELD_FRAGMENT = "Add missing field first:";

export function exportBundleHasMissingFieldPlaceholder(content: CatalogueDraftContent): boolean {
  return Object.values(content).some(
    (text) => typeof text === "string" && text.includes(MISSING_FIELD_FRAGMENT),
  );
}

/** Plain-text preview of the full catalogue copy bundle — copy/paste only, no PDF generation here. */
export function buildExportBundlePreview(
  product: DraftProductInput,
  content: CatalogueDraftContent,
): string {
  const lines: string[] = [];
  lines.push(`# ${content.catalogue_title}`);
  if (hasText(product.sku)) lines.push(`SKU: ${product.sku}`);
  lines.push("");
  lines.push(content.short_description);
  lines.push("");
  lines.push(content.long_description);
  lines.push("");
  lines.push("-- B2B --");
  lines.push(content.b2b_sales_copy);
  lines.push("");
  lines.push("-- Export --");
  lines.push(content.export_catalogue_copy);
  lines.push("");
  lines.push("-- Storage / shelf life --");
  lines.push(content.storage_shelf_life_copy);
  lines.push("");
  lines.push("-- WhatsApp draft (copy only, not sent) --");
  lines.push(content.whatsapp_product_message);
  lines.push("");
  lines.push("-- Hindi --");
  lines.push(content.hindi_description);
  return lines.join("\n");
}
