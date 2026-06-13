import { supabase } from "@/integrations/supabase/client";
import { submitCatalogueDraft } from "@/features/catalogueDrafts/draftService";
import { canWriteMasterDirectly } from "@/shared/auth/centralPermissions";
import type { Role } from "@/lib/permissions";
import type { PilotAliasSkuBundle, PilotAliasTermSuggestion } from "./pilotAliasTypes";
import { toDbAliasType, PILOT_ALIAS_DISCLAIMER } from "./pilotAliasTypes";

export type PilotAliasSaveResult = {
  ok: boolean;
  saved: number;
  skipped: number;
  errors: string[];
  mode: "direct" | "draft" | "none";
};

function buildDraftPayload(term: PilotAliasTermSuggestion) {
  return {
    scope: "product_alias",
    alias: term.alias_text,
    alias_text: term.alias_text,
    term_type: toDbAliasType(term.alias_type),
    alias_type: toDbAliasType(term.alias_type),
    channel_scope: [term.channel_scope],
    review_status: term.review_status,
    product_id: term.product_id,
    canonical_name: term.product_name,
    source: "pilot_alias_review",
    pilot_sku: term.sku,
    disclaimer: PILOT_ALIAS_DISCLAIMER,
  };
}

/** Persist only user-approved terms — never auto-save suggestions. */
export async function saveApprovedPilotAliases(
  bundle: PilotAliasSkuBundle,
  roles: Role[],
): Promise<PilotAliasSaveResult> {
  const approved = bundle.terms.filter((t) => t.review_status === "approved");
  const skipped = bundle.terms.length - approved.length;

  if (!approved.length) {
    return {
      ok: false,
      saved: 0,
      skipped,
      errors: ["No approved terms to save. Approve terms before saving."],
      mode: "none",
    };
  }

  const blocked = approved.filter((t) => t.collision.level === "block");
  if (blocked.length) {
    return {
      ok: false,
      saved: 0,
      skipped,
      errors: blocked.map((t) => `Blocked term cannot be saved: "${t.alias_text}" — ${t.collision.reason}`),
      mode: "none",
    };
  }

  const direct = await canWriteMasterDirectly(roles);
  const errors: string[] = [];
  let saved = 0;

  if (direct) {
    for (const term of approved) {
      const { error } = await supabase.from("product_aliases").insert({
        product_id: term.product_id,
        alias: term.alias_text,
        alias_type: toDbAliasType(term.alias_type),
        is_active: true,
        source: "pilot_alias_review",
        confidence_score: 0.9,
      });
      if (error) {
        errors.push(`${term.alias_text}: ${error.message}`);
      } else {
        saved += 1;
      }
    }
    return { ok: errors.length === 0, saved, skipped, errors, mode: "direct" };
  }

  for (const term of approved) {
    const res = await submitCatalogueDraft({
      draftType: "alias",
      operation: "create",
      payload: buildDraftPayload(term),
      targetRecordId: null,
    });
    if (!res.ok) errors.push(`${term.alias_text}: ${res.message}`);
    else saved += 1;
  }

  return { ok: errors.length === 0, saved, skipped, errors, mode: "draft" };
}
