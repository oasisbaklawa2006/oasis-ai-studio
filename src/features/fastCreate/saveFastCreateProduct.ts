import {
  readIntakeBarcode,
  submitFastCreateProductDraft,
  withReviewedIntakeBarcode,
} from "@/features/fastCreate/fastCreateIntakeBarcode";
import { getPersistableFastCreateAliases } from "@/features/governedAiExtraction/fastCreateEnrichment";
import { productClassForSaleType, type SaleType } from "@/features/productAuthority/saleType";
import {
  assertStructuredSkuForSave,
  skuPackagingSegment,
} from "@/features/productAuthority/skuGuard";
import type { FastCreateCategoryKey } from "@/features/productDefaults/categoryDefaults";
import { stripUnapprovedComplianceFields } from "@/lib/compliance/aiComplianceSafety";
import { canWriteProductsDirectly, isCatalogueContributor } from "@/shared/auth/centralPermissions";
import { type FastCreateSkuCodeSet, resolveFastCreateSkuCodes } from "./fastCreateSkuCodes";
import { type FastCreateSuggestions, generateFastCreateSku } from "./fastCreateSuggestions";

export const FAST_CREATE_SKU_BLOCK_MESSAGE =
  "Structured SKU could not be generated. Ensure sku_code_rules are configured and generate_oasis_sku RPC is deployed. Placeholder SKUs (DRAFT-*, OAS-FC-*) are blocked.";

/** Resolve structured Oasis SKU for Fast Create — throws if RPC/rules unavailable. */
export async function requireFastCreateSku(
  categoryKey: FastCreateCategoryKey = "other",
  existing?: string | null,
  packagingCode?: string | null,
): Promise<{ sku: string; codes: FastCreateSkuCodeSet }> {
  const trimmed = existing?.trim();
  if (trimmed) {
    const existingCheck = assertStructuredSkuForSave(trimmed);
    if (existingCheck.ok) {
      const skuPackaging = skuPackagingSegment(existingCheck.sku);
      // Only reuse the existing SKU as-is when its own packaging segment still agrees with
      // the operator's current selection — otherwise it's stale (packaging changed after this
      // SKU was generated) and must be regenerated, not reused with mismatched preset codes.
      if (!packagingCode || skuPackaging === packagingCode) {
        return {
          sku: existingCheck.sku,
          codes: {
            ...resolveFastCreateSkuCodes(categoryKey),
            ...(skuPackaging ? { packaging_code: skuPackaging } : {}),
          },
        };
      }
    }
  }

  const generated = await generateFastCreateSku(
    categoryKey,
    packagingCode ? { packaging_code: packagingCode } : undefined,
  );
  if (!generated) {
    throw new Error(FAST_CREATE_SKU_BLOCK_MESSAGE);
  }

  const check = assertStructuredSkuForSave(generated.sku);
  // Explicit `=== false` (not `!check.ok`) — with strictNullChecks off in this project's
  // tsconfig, boolean-negation doesn't narrow discriminated unions reliably.
  if (check.ok === false) {
    throw new Error(check.reason || FAST_CREATE_SKU_BLOCK_MESSAGE);
  }
  return generated;
}

export const FAST_CREATE_UNSUPPORTED_CLASS_MESSAGE_PREFIX =
  "has no supported catalogue classification yet";

export type FastCreateSaveInput = {
  suggestions: FastCreateSuggestions;
  heroUrl: string | null;
  roles: string[];
  categoryKey: FastCreateCategoryKey;
  /** Pre-resolved SKU shown in UI before save (optional). */
  resolvedSku?: string | null;
  /** Extra form fields from the Fast Create draft (sale-type patch, pack data, packaging). */
  extraFormPatch?: Record<string, unknown>;
  /** Sale type selected in Fast Create — used to guard product_class defaulting. */
  saleType?: SaleType;
};

export type FastCreateSaveResult = {
  draft: true;
  draftId: string;
  alreadyPending: boolean;
};

/** Build the grouped catalogue_product_drafts payload for Fast Create. */
export function buildFastCreateGroupedDraftPayload(
  form: Record<string, unknown>,
  heroUrl: string | null,
  suggestions: FastCreateSuggestions,
  skuResult: { sku: string; codes: FastCreateSkuCodeSet },
): Record<string, unknown> {
  const persistableAliases = getPersistableFastCreateAliases(suggestions);
  return {
    identity: {
      product_name: form.product_name,
      product_class: form.product_class,
      product_type: form.product_type,
      category: form.category,
      subcategory: form.subcategory,
      description: form.description,
      short_description: form.short_description,
      main_department: form.main_department,
      production_department: form.production_department,
    },
    compliance: {
      hsn_code: form.hsn_code,
      gst_rate: form.gst_rate,
      shelf_life_days: form.shelf_life_days,
      ingredients: form.ingredients,
      allergen_warnings: form.allergen_warnings,
      storage_instructions: form.storage_instructions,
    },
    media: {
      hero_image_url: heroUrl,
    },
    search: {
      suggested_aliases: persistableAliases.aliases.map((a) => a.alias),
      whatsapp_keywords: persistableAliases.whatsappKeywords,
      search_keywords: persistableAliases.searchKeywords,
    },
    sku_draft: {
      sku: skuResult.sku,
      division_code: skuResult.codes.division_code,
      category_code: skuResult.codes.category_code,
      subcategory_code: skuResult.codes.subcategory_code,
      packaging_code: skuResult.codes.packaging_code,
      note: "Structured SKU proposed by Fast Create — finalized on catalogue approval.",
    },
    fast_create_meta: {
      source: "fast_create",
      is_catalogue_ready: false,
      is_active: true,
    },
  };
}

/**
 * Canonical Fast Create save — always submits a governed catalogue_product_drafts candidate.
 * Never writes master `products` directly; approval/publication remain in ApprovalInbox.
 */
export async function saveFastCreateProduct(
  input: FastCreateSaveInput,
): Promise<FastCreateSaveResult> {
  const form: Record<string, unknown> = {
    ...input.suggestions.formPatch,
    ...(input.extraFormPatch ?? {}),
    hero_image_url: input.heroUrl,
    is_active: true,
    is_catalogue_ready: false,
  };

  if (!form.product_name || !form.category) {
    throw new Error("Product name and category are required.");
  }

  const canSubmit =
    (await canWriteProductsDirectly(input.roles)) ||
    input.roles.includes("catalogue_contributor") ||
    (await isCatalogueContributor());

  if (!canSubmit) {
    throw new Error("You do not have permission to create products. Contact an administrator.");
  }

  if (input.saleType && !productClassForSaleType(input.saleType)) {
    throw new Error(
      `Sale type "${input.saleType}" ${FAST_CREATE_UNSUPPORTED_CLASS_MESSAGE_PREFIX}. ` +
        "Choose a sale type with a supported product class, or use the Full Editor for admin review.",
    );
  }
  if (!form.product_class) form.product_class = "bulk_loose_product";
  if (!form.main_department) form.main_department = "ready_goods_store";

  const skuResult = await requireFastCreateSku(
    input.categoryKey,
    input.resolvedSku ?? (form.sku as string | null),
    (input.extraFormPatch?.packaging_code as string | null) ?? null,
  );
  form.sku = skuResult.sku;
  form.division_code = skuResult.codes.division_code;
  form.category_code = skuResult.codes.category_code;
  form.subcategory_code = skuResult.codes.subcategory_code;
  form.packaging_code = skuResult.codes.packaging_code;

  const safeForm = stripUnapprovedComplianceFields(
    form,
    input.roles,
    {},
    input.suggestions.complianceFieldMeta ?? {},
  );

  const intakeBarcode = readIntakeBarcode(input.extraFormPatch);
  const groupedPayload = withReviewedIntakeBarcode(
    buildFastCreateGroupedDraftPayload(safeForm, input.heroUrl, input.suggestions, skuResult),
    intakeBarcode,
  );

  try {
    const draftRes = await submitFastCreateProductDraft(groupedPayload, "create", null);
    return {
      draft: true,
      draftId: draftRes.draftId,
      alreadyPending: draftRes.alreadyPending,
    };
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Product draft submit failed");
  }
}
