import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Sparkles, CheckCircle2 } from "lucide-react";
import {
  AI_COMPLIANCE_UI_DISCLAIMER,
  type ComplianceSensitiveField,
} from "@/shared/ai/complianceConstants";
import {
  approveComplianceFieldMeta,
  canApproveComplianceFields,
  createAiSuggestionFieldMeta,
  type ComplianceFieldMetaMap,
} from "@/shared/ai/complianceApproval";
import {
  PERSISTED_COMPLIANCE_PRODUCT_COLUMNS,
  UI_ONLY_COMPLIANCE_FIELDS,
} from "@/shared/ai/compliancePersistence";
import type { AiComplianceResponse } from "@/shared/ai/complianceSuggestions";
import { resolveAiComplianceResponse } from "@/shared/ai/complianceSuggestions";
import { toast } from "sonner";
import { invokeGovernedAi } from "@/shared/ai/governedAiClient";

type Props = {
  form: Record<string, unknown>;
  set: (key: string, value: unknown) => void;
  roles: string[];
  metaMap: ComplianceFieldMetaMap;
  setMetaMap: React.Dispatch<React.SetStateAction<ComplianceFieldMetaMap>>;
  onManualEdit: (field: ComplianceSensitiveField) => void;
};

const FIELD_LABELS: Record<string, string> = {
  hsn_code: "HSN",
  gst_rate: "GST %",
  shelf_life_days: "Shelf life (days)",
  ingredients: "Ingredients",
  allergen_warnings: "Allergen warnings",
  nutritional_info: "Nutritional information",
  storage_instructions: "Storage instructions",
};

export function ComplianceAiPanel({ form, set, roles, metaMap, setMetaMap, onManualEdit }: Props) {
  const [loading, setLoading] = useState(false);
  const canApprove = canApproveComplianceFields(roles);

  const applyAiResponse = (response: AiComplianceResponse) => {
    const { suggestions } = response;
    const updates: Array<[ComplianceSensitiveField, unknown]> = [];

    if (suggestions.hsn_code != null) updates.push(["hsn_code", String(suggestions.hsn_code)]);
    if (suggestions.gst_rate != null) updates.push(["gst_rate", String(suggestions.gst_rate)]);
    if (suggestions.shelf_life_days != null) {
      updates.push(["shelf_life_days", String(suggestions.shelf_life_days)]);
    }
    if (suggestions.ingredients != null) updates.push(["ingredients", suggestions.ingredients]);
    if (suggestions.allergen_warnings != null) {
      updates.push(["allergen_warnings", suggestions.allergen_warnings]);
    }
    if (suggestions.nutritional_info != null) {
      updates.push(["nutritional_info", suggestions.nutritional_info]);
    }
    if (suggestions.storage_instructions != null) {
      updates.push(["storage_instructions", suggestions.storage_instructions]);
    }

    setMetaMap((prev) => {
      const next = { ...prev };
      for (const [field] of updates) {
        next[field] = createAiSuggestionFieldMeta();
      }
      return next;
    });

    for (const [field, value] of updates) {
      set(field, value);
    }

    toast.message("AI suggestions applied to form — not approved for save until authorized user approves.");
  };

  const generateSuggestions = async () => {
    setLoading(true);
    try {
      const result = await invokeGovernedAi<unknown>("generate-product-attributes", {
        product_name: form.product_name,
        category: form.category,
        description: form.description,
      });

      const { response, usedHeuristic } = resolveAiComplianceResponse(result.ok ? result.data : null, {
        product_name: String(form.product_name ?? ""),
        category: String(form.category ?? ""),
      });

      if (!result.ok && usedHeuristic) {
        if (import.meta.env.DEV) {
          console.warn("[ComplianceAiPanel] governed AI unavailable, using heuristic:", result.reason);
        }
      }

      applyAiResponse(response);
      toast.message(
        usedHeuristic
          ? "Offline compliance suggestions applied — review and approve before save."
          : "AI suggestions applied to form — not approved for save until authorized user approves.",
      );
    } catch (e) {
      const { response } = resolveAiComplianceResponse(null, {
        product_name: String(form.product_name ?? ""),
        category: String(form.category ?? ""),
      });
      applyAiResponse(response);
      if (import.meta.env.DEV) {
        console.warn("[ComplianceAiPanel] fallback after error:", e);
      }
      toast.message("Offline compliance suggestions applied — review and approve before save.");
    } finally {
      setLoading(false);
    }
  };

  const approveField = (field: ComplianceSensitiveField) => {
    if (!canApprove) {
      toast.error("Only owner, admin, or product manager can approve compliance fields.");
      return;
    }
    setMetaMap((prev) => ({
      ...prev,
      [field]: approveComplianceFieldMeta(prev[field], roles[0] ?? "admin"),
    }));
    toast.success(`${FIELD_LABELS[field] ?? field} approved for save.`);
  };

  const pendingFields = Object.entries(metaMap).filter(
    ([, meta]) => meta?.source === "ai_suggestion" && !meta.approved,
  );

  const authorityFields = [
    ...PERSISTED_COMPLIANCE_PRODUCT_COLUMNS,
    ...UI_ONLY_COMPLIANCE_FIELDS,
  ] as const;

  const authorityStatus = (field: string) => {
    const value = form[field];
    const hasValue = value !== null && value !== undefined && String(value).trim() !== "";
    const meta = metaMap[field as ComplianceSensitiveField];
    if (!hasValue) return { label: "Missing", className: "text-destructive" };
    if (meta?.source === "ai_suggestion" && !meta.approved) {
      return { label: "AI pending approval", className: "text-warning" };
    }
    if (meta?.approved) return { label: "Approved for save", className: "text-success" };
    if (PERSISTED_COMPLIANCE_PRODUCT_COLUMNS.includes(field as (typeof PERSISTED_COMPLIANCE_PRODUCT_COLUMNS)[number])) {
      return { label: "Saved on product", className: "text-success" };
    }
    return { label: "Draft (form only)", className: "text-muted-foreground" };
  };

  return (
    <div className="space-y-4">
      <Alert variant="default" className="border-amber-500/40 bg-amber-500/5">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Compliance safety</AlertTitle>
        <AlertDescription>{AI_COMPLIANCE_UI_DISCLAIMER}</AlertDescription>
      </Alert>

      <div className="rounded-md border p-3 space-y-2">
        <p className="text-sm font-medium">Authority status (persisted fields)</p>
        <ul className="text-xs space-y-1">
          {authorityFields.map((field) => {
            const status = authorityStatus(field);
            return (
              <li key={field} className="flex items-center justify-between gap-2">
                <span>{FIELD_LABELS[field] ?? field}</span>
                <span className={status.className}>{status.label}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <Button type="button" variant="secondary" size="sm" disabled={loading} onClick={generateSuggestions}>
          <Sparkles className="h-4 w-4 mr-1" />
          {loading ? "Generating…" : "Generate AI compliance suggestions"}
        </Button>
        <span className="text-xs text-muted-foreground">Apply fills the form only — does not approve for catalogue truth.</span>
      </div>

      {pendingFields.length > 0 && (
        <div className="rounded-md border p-3 space-y-2">
          <p className="text-sm font-medium">Pending AI suggestions (require approval before save)</p>
          <ul className="space-y-1">
            {pendingFields.map(([field]) => (
              <li key={field} className="flex items-center justify-between gap-2 text-sm">
                <span>{FIELD_LABELS[field] ?? field}</span>
                {canApprove ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => approveField(field as ComplianceSensitiveField)}>
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Approve for save
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">Awaiting approver</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        Manual edits to compliance fields are tracked separately. Contributors may suggest; only authorized roles may approve GST/HSN and related compliance fields.
      </p>
    </div>
  );
}

export function trackManualComplianceEdit(
  field: ComplianceSensitiveField,
  setMetaMap: React.Dispatch<React.SetStateAction<ComplianceFieldMetaMap>>,
  onManualEdit: (field: ComplianceSensitiveField) => void,
) {
  onManualEdit(field);
  setMetaMap((prev) => ({
    ...prev,
    [field]: { source: "manual", approved: false, suggestion_only: false },
  }));
}
