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
import { hasNumber, hasText } from "./catalogueFieldUtils";

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
  { key: "hindi_description", label: "Hindi product description", hint: "Simple Hindi/Hinglish business copy — not a certified translation." },
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

interface DisplayPrice {
  /** Clearly distinguishes an actual B2B price from an MRP fallback — never conflate the two. */
  label: "B2B price" | "MRP";
  amount: number;
}

function getDisplayPrice(p: DraftProductInput): DisplayPrice | null {
  if (hasNumber(p.b2b_price)) return { label: "B2B price", amount: p.b2b_price! };
  if (hasNumber(p.mrp)) return { label: "MRP", amount: p.mrp! };
  return null;
}

function moqLabel(p: DraftProductInput): string | null {
  if (hasText(p.moq_text)) return p.moq_text!.trim();
  if (hasNumber(p.moq_value)) return `${p.moq_value}${hasText(p.moq_uom) ? ` ${p.moq_uom}` : ""}`;
  return null;
}

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
  if (!hasText(p.product_name)) return MISSING_FIELD("Product Name");
  if (!hasNumber(p.b2b_price)) {
    return `${p.product_name} is available for wholesale. ${MISSING_FIELD("B2B price")}`;
  }
  const moq = moqLabel(p);
  const moqPart = moq ? ` MOQ: ${moq}.` : " Add MOQ for a complete pitch.";
  const uomPart = hasText(p.b2b_uom) ? `/${p.b2b_uom}` : "";
  return `${p.product_name} — B2B base ₹${p.b2b_price}${uomPart}.${moqPart}`;
}

function exportCatalogueCopy(p: DraftProductInput): string {
  if (!hasText(p.product_name)) return MISSING_FIELD("Product Name");
  const parts: string[] = [p.product_name!];
  parts.push(hasText(p.hsn_code) ? `HSN ${p.hsn_code}` : MISSING_FIELD("HSN Code"));
  parts.push(typeof p.gst_rate === "number" ? `GST ${p.gst_rate}%` : MISSING_FIELD("GST Rate"));
  if (hasNumber(p.net_weight_g)) parts.push(`Net wt ${p.net_weight_g}g`);
  return parts.join(" · ");
}

function whatsappProductMessage(p: DraftProductInput): string {
  if (!hasText(p.product_name)) return MISSING_FIELD("Product Name");
  const price = getDisplayPrice(p);
  if (!price) {
    return `Hi! We have *${p.product_name}* available. ${MISSING_FIELD("a price (MRP or B2B price)")} Reply to know more.`;
  }
  const uomPart = price.label === "B2B price" && hasText(p.b2b_uom) ? `/${p.b2b_uom}` : "";
  return `Hi! We have *${p.product_name}* available — ${price.label} ₹${price.amount}${uomPart}. Reply to know more.`;
}

function hindiDescription(p: DraftProductInput): string {
  if (!hasText(p.product_name)) return MISSING_FIELD("Product Name");
  const category = hasText(p.category) ? p.category : "उत्पाद";
  const price = getDisplayPrice(p);
  const priceLine = price ? ` ${price.label === "B2B price" ? "B2B कीमत" : "MRP"} ₹${price.amount} है।` : "";
  return `${p.product_name} अब उपलब्ध है (${category})।${priceLine} अधिक जानकारी के लिए संपर्क करें।\n(सरल हिंदी ड्राफ्ट — प्रमाणित अनुवाद नहीं है, भेजने से पहले जाँच लें।)`;
}

/**
 * shelf_life_days is a plain number in this schema (unlike Central's free-text shelf_life) —
 * still guarded so a zero/blank value never silently renders as "0 days".
 */
function storageShelfLifeCopy(p: DraftProductInput): string {
  const hasShelf = hasNumber(p.shelf_life_days);
  const hasStorage = hasText(p.storage_instructions) || hasText(p.temperature_requirement);
  if (!hasShelf && !hasStorage) return MISSING_FIELD("Shelf Life and Storage Instructions");
  const shelf = hasShelf ? `Shelf life: ${p.shelf_life_days} days.` : MISSING_FIELD("Shelf Life");
  const storageText = [p.storage_instructions, p.temperature_requirement].filter(hasText).join(" · ");
  const storage = hasStorage ? `Store: ${storageText}.` : MISSING_FIELD("Storage Instructions");
  return `${shelf} ${storage}`;
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
