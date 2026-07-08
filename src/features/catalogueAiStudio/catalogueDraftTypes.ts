/**
 * Shared types for the Catalogue Product AI Studio draft workflow.
 * Mirrors the `catalogue_ai_studio_drafts` / `catalogue_ai_studio_draft_audit_log` tables
 * owned by oasis-supabase-core. Ported from the wrong-repo reference implementation
 * (Oasis-Baklawa-Central PR #225) — this app owns the frontend only.
 */
import type { Database } from "@/integrations/supabase/types";

export type CatalogueDraftRow = Database["public"]["Tables"]["catalogue_ai_studio_drafts"]["Row"];
export type CatalogueDraftInsert = Database["public"]["Tables"]["catalogue_ai_studio_drafts"]["Insert"];
export type CatalogueDraftAuditRow =
  Database["public"]["Tables"]["catalogue_ai_studio_draft_audit_log"]["Row"];

export const CATALOGUE_DRAFT_STATUSES = ["DRAFT", "UNDER_REVIEW", "APPROVED", "REJECTED"] as const;
export type CatalogueDraftStatus = (typeof CATALOGUE_DRAFT_STATUSES)[number];

/** The catalogue copy fields an operator edits in the Content Draft Studio. */
export const CATALOGUE_DRAFT_CONTENT_KEYS = [
  "catalogue_title",
  "short_description",
  "long_description",
  "b2b_sales_copy",
  "export_catalogue_copy",
  "whatsapp_product_message",
  "hindi_description",
  "storage_shelf_life_copy",
] as const;

export type CatalogueDraftContentKey = (typeof CATALOGUE_DRAFT_CONTENT_KEYS)[number];

export type CatalogueDraftContent = Record<CatalogueDraftContentKey, string>;

/** The image-prompt fields an operator edits in the Media / Hero Image Prompt Studio. */
export const CATALOGUE_DRAFT_PROMPT_KEYS = [
  "hero_image_prompt",
  "square_image_prompt",
  "closeup_image_prompt",
  "packaging_image_prompt",
  "lifestyle_image_prompt",
] as const;

export type CatalogueDraftPromptKey = (typeof CATALOGUE_DRAFT_PROMPT_KEYS)[number];

export type CatalogueDraftPrompts = Record<CatalogueDraftPromptKey, string>;
