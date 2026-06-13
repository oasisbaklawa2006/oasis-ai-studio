import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  Trash2,
  Wand2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { submitCatalogueDraft } from "@/features/catalogueDrafts/draftService";
import { draftTableMap } from "@/features/catalogueDrafts/draftTableMap";
import {
  canSubmitDraft,
  canWriteMasterDirectly,
  isCatalogueContributor,
} from "@/shared/auth/centralPermissions";
import type { Role } from "@/lib/permissions";

const CHANNELS = [
  "retail",
  "b2c",
  "b2b",
  "horeca",
  "distributor",
  "export",
  "private_label",
  "internal_sales",
  "wedding",
  "corporate_gifting",
  "modern_trade",
];

const UOMS = [
  "kg",
  "grams",
  "pcs",
  "box",
  "carton",
  "master_carton",
  "tray",
  "pack",
  "bundle",
  "jar",
  "packet",
  "tub",
];

const TEMPLATE_OPTIONS = [
  "bulk_wholesale",
  "ready_pack_retail",
  "premium_gift_pack",
  "horeca_flexible",
  "export_carton",
  "packaging_material",
  "frozen_semi_processed",
] as const;

type TemplateKey = (typeof TEMPLATE_OPTIONS)[number];

type WriteMode = "direct" | "draft" | "readonly";

type MoqRuleRow = Record<string, any>;

const DIRECT_MOQ_ROLES: Role[] = ["owner", "admin", "product_manager"];

const templateLabel = (v: TemplateKey) =>
  ({
    bulk_wholesale: "Bulk Wholesale",
    ready_pack_retail: "Ready Pack Retail",
    premium_gift_pack: "Premium Gift Pack",
    horeca_flexible: "HoReCa Flexible",
    export_carton: "Export Carton",
    packaging_material: "Packaging Material",
    frozen_semi_processed: "Frozen / Semi Processed",
  })[v];

const channelLabel = (v?: string | null) =>
  String(v ?? "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase()) || "Unnamed";

const uomLabel = (v?: string | null) =>
  String(v ?? "").replace(/_/g, " ").trim() || "—";

const isLocalRowId = (id: string) => id.startsWith("local-");

const Sel = ({
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  value: string | null | undefined;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
}) => (
  <select
    className="h-9 px-2 rounded border bg-background text-xs w-full disabled:opacity-50"
    value={value ?? ""}
    onChange={(e) => onChange(e.target.value)}
    disabled={disabled}
  >
    <option value="">{placeholder ?? "—"}</option>
    {options.map((o) => (
      <option key={o} value={o}>
        {o.replace(/_/g, " ")}
      </option>
    ))}
  </select>
);

const asNumberOrNull = (value: unknown) => {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const normalizeText = (value: unknown) => String(value ?? "").trim().toLowerCase();

const rowSummary = (r: MoqRuleRow) => {
  if (!r?.moq_applicable) return "Disabled";

  const moq =
    r.moq_value != null && r.moq_uom
      ? `${r.moq_value} ${uomLabel(r.moq_uom)}`
      : "Not set";

  const increment =
    r.increment_value != null && r.increment_uom
      ? `${r.increment_value} ${uomLabel(r.increment_uom)}`
      : "Not set";

  return `MOQ ${moq} • Increment ${increment}`;
};

const isDuplicateChannel = (
  rows: MoqRuleRow[],
  rowId: string,
  channel: string | null | undefined,
  customerType?: string | null
) => {
  const c = normalizeText(channel);
  const ct = normalizeText(customerType);
  if (!c) return false;

  return rows.some(
    (r) =>
      r.id !== rowId &&
      normalizeText(r.channel) === c &&
      normalizeText(r.customer_type) === ct
  );
};

const normalizeMoqPatch = (current: MoqRuleRow, patch: Record<string, any>) => {
  const normalizedPatch: Record<string, any> = { ...patch };

  if ("moq_value" in normalizedPatch) {
    normalizedPatch.moq_value = asNumberOrNull(normalizedPatch.moq_value);
  }
  if ("increment_value" in normalizedPatch) {
    normalizedPatch.increment_value = asNumberOrNull(normalizedPatch.increment_value);
  }
  if ("min_carton_qty" in normalizedPatch) {
    normalizedPatch.min_carton_qty = asNumberOrNull(normalizedPatch.min_carton_qty);
  }

  const merged = { ...current, ...normalizedPatch };

  if (merged.moq_applicable === false) {
    normalizedPatch.moq_value = null;
    normalizedPatch.moq_uom = null;
    normalizedPatch.increment_value = null;
    normalizedPatch.increment_uom = null;
    normalizedPatch.min_carton_qty = null;
    normalizedPatch.carton_logic = null;
  }

  return { normalizedPatch, merged };
};

const buildCatalogueMoqDraftPayload = (productId: string, row: MoqRuleRow) => ({
  scope: "product_moq_rule" as const,
  product_id: productId,
  channel: row.channel ?? null,
  customer_type: row.customer_type ?? null,
  min_order_quantity: row.moq_value ?? null,
  increment_quantity: row.increment_value ?? null,
  is_active: row.moq_applicable !== false,
  moq_applicable: row.moq_applicable !== false,
  moq_value: row.moq_value ?? null,
  moq_uom: row.moq_uom ?? null,
  increment_value: row.increment_value ?? null,
  increment_uom: row.increment_uom ?? null,
  allow_override: row.allow_override ?? false,
  min_carton_qty: row.min_carton_qty ?? null,
  carton_logic: row.carton_logic ?? null,
  notes: row.notes ?? null,
});

const buildTemplateDefaults = (template: TemplateKey, product: any): MoqRuleRow[] => {
  const defaults: MoqRuleRow[] = [];
  const push = (r: Record<string, any>) =>
    defaults.push({ customer_type: null, moq_applicable: false, ...r });

  if (template === "bulk_wholesale") {
    push({
      channel: "distributor",
      moq_applicable: true,
      moq_value: 5,
      moq_uom: product?.primary_uom || "kg",
      increment_value: 1,
      increment_uom: product?.primary_uom || "kg",
    });
    push({
      channel: "export",
      moq_applicable: true,
      moq_value: 25,
      moq_uom: product?.primary_uom || "kg",
      increment_value: 5,
      increment_uom: product?.primary_uom || "kg",
    });
  }

  if (template === "ready_pack_retail") {
    push({
      channel: "distributor",
      moq_applicable: true,
      moq_value: 1,
      moq_uom: "master_carton",
      increment_value: 1,
      increment_uom: "carton",
    });
    push({
      channel: "modern_trade",
      moq_applicable: true,
      moq_value: 2,
      moq_uom: "master_carton",
      increment_value: 1,
      increment_uom: "master_carton",
    });
    push({ channel: "retail", moq_applicable: false });
  }

  if (template === "premium_gift_pack") {
    push({
      channel: "distributor",
      moq_applicable: true,
      moq_value: 6,
      moq_uom: "pcs",
      increment_value: 1,
      increment_uom: "pcs",
    });
    push({
      channel: "corporate_gifting",
      moq_applicable: true,
      moq_value: 25,
      moq_uom: "pcs",
      increment_value: 5,
      increment_uom: "pcs",
    });
    push({
      channel: "export",
      moq_applicable: true,
      moq_value: 50,
      moq_uom: "pcs",
      increment_value: 10,
      increment_uom: "pcs",
    });
  }

  if (template === "horeca_flexible") {
    push({
      channel: "horeca",
      moq_applicable: true,
      allow_override: true,
      moq_value: 1,
      moq_uom: product?.primary_uom || "kg",
      increment_value: 1,
      increment_uom: product?.primary_uom || "kg",
    });
  }

  if (template === "export_carton") {
    push({
      channel: "export",
      moq_applicable: true,
      moq_value: 10,
      moq_uom: "carton",
      increment_value: 1,
      increment_uom: "carton",
    });
  }

  if (template === "packaging_material") {
    push({
      channel: "distributor",
      moq_applicable: true,
      moq_value: 1,
      moq_uom: product?.carton_uom || "carton",
      increment_value: 1,
      increment_uom: product?.carton_uom || "carton",
    });
    push({ channel: "retail", moq_applicable: false });
  }

  if (template === "frozen_semi_processed") {
    push({
      channel: "distributor",
      moq_applicable: true,
      moq_value: 1,
      moq_uom: "carton",
      increment_value: 1,
      increment_uom: "carton",
    });
    push({
      channel: "export",
      moq_applicable: true,
      moq_value: 10,
      moq_uom: "carton",
      increment_value: 5,
      increment_uom: "carton",
    });
  }

  return defaults.filter((row, index, arr) => {
    return (
      arr.findIndex(
        (x) =>
          normalizeText(x.channel) === normalizeText(row.channel) &&
          normalizeText(x.customer_type) === normalizeText(row.customer_type)
      ) === index
    );
  });
};

export const ChannelMoqRules = ({
  productId,
  product,
  onRulesChange,
}: {
  productId: string;
  product: any;
  onRulesChange?: () => void;
}) => {
  const { roles } = useAuth();
  const [rows, setRows] = useState<MoqRuleRow[]>([]);
  const [localNewRows, setLocalNewRows] = useState<MoqRuleRow[]>([]);
  const [stagedEdits, setStagedEdits] = useState<Record<string, MoqRuleRow>>({});
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const [advanced, setAdvanced] = useState<Record<string, boolean>>({});
  const [writeMode, setWriteMode] = useState<WriteMode>("readonly");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from("product_moq_rules")
      .select("*")
      .eq("product_id", productId)
      .order("channel");

    if (error) {
      toast.error(error.message);
      return;
    }

    setRows(data ?? []);
    setStagedEdits({});
    setLocalNewRows([]);
    onRulesChange?.();
  };

  useEffect(() => {
    load();
  }, [productId]);

  useEffect(() => {
    (async () => {
      const roleList = roles as Role[];
      const hasDirect =
        roleList.some((r) => DIRECT_MOQ_ROLES.includes(r)) || (await canWriteMasterDirectly());
      if (hasDirect) {
        setWriteMode("direct");
        return;
      }
      if (await isCatalogueContributor()) {
        const canSubmit = await canSubmitDraft(draftTableMap.moq.permission);
        setWriteMode(canSubmit ? "draft" : "readonly");
        return;
      }
      setWriteMode("readonly");
    })();
  }, [roles]);

  const canMutate = writeMode === "direct" || writeMode === "draft";

  const allDisplayRows = useMemo(() => {
    const mergedMaster = rows.map((row) => ({
      ...row,
      ...(stagedEdits[row.id] ?? {}),
    }));
    return [...mergedMaster, ...localNewRows].sort((a, b) =>
      String(a.channel).localeCompare(String(b.channel))
    );
  }, [rows, stagedEdits, localNewRows]);

  const baselineRow = (id: string) => {
    if (isLocalRowId(id)) {
      return localNewRows.find((r) => r.id === id);
    }
    return rows.find((r) => r.id === id);
  };

  const hasStagedChanges = (id: string) => {
    if (isLocalRowId(id)) return true;
    const staged = stagedEdits[id];
    if (!staged) return false;
    const base = rows.find((r) => r.id === id);
    if (!base) return false;
    return JSON.stringify({ ...base, ...staged }) !== JSON.stringify(base);
  };

  const suggestedTemplate = useMemo<TemplateKey>(() => {
    if (product?.product_class === "gift_hamper") return "premium_gift_pack";
    if (product?.product_class === "ready_pack") return "ready_pack_retail";
    if (product?.product_class === "semi_prepared_frozen") return "frozen_semi_processed";
    if (product?.product_class === "packaging_decoration_material") {
      return "packaging_material";
    }
    if (product?.main_department === "third_party_goods_store") {
      return "packaging_material";
    }
    return "bulk_wholesale";
  }, [product]);

  const businessSummary = useMemo(() => {
    if (!allDisplayRows.length) return [];

    return allDisplayRows.map((r) => ({
      id: r.id,
      title: channelLabel(r.channel),
      summary: rowSummary(r),
    }));
  }, [allDisplayRows]);

  const submitMoqDraft = async (
    operation: "create" | "update" | "delete_request",
    row: MoqRuleRow,
    targetRecordId?: string | null
  ) => {
    return submitCatalogueDraft({
      draftType: "moq",
      operation,
      payload: buildCatalogueMoqDraftPayload(productId, row),
      targetRecordId: targetRecordId ?? null,
    });
  };

  const persistPatch = async (id: string, patch: Record<string, any>) => {
    const current = allDisplayRows.find((r) => r.id === id) ?? baselineRow(id);
    if (!current) return;

    const next = { ...current, ...patch };

    if (isDuplicateChannel(allDisplayRows, id, next.channel, next.customer_type)) {
      toast.error("A rule for this channel already exists.");
      return;
    }

    const { normalizedPatch } = normalizeMoqPatch(current, patch);

    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...normalizedPatch } : r)));

    const { error } = await supabase
      .from("product_moq_rules")
      .update(normalizedPatch)
      .eq("id", id);

    if (error) {
      toast.error(error.message);
      load();
    }
  };

  const stagePatch = (id: string, patch: Record<string, any>) => {
    const current = allDisplayRows.find((r) => r.id === id) ?? baselineRow(id);
    if (!current) return;

    const next = { ...current, ...patch };

    if (isDuplicateChannel(allDisplayRows, id, next.channel, next.customer_type)) {
      toast.error("A rule for this channel already exists.");
      return;
    }

    const { normalizedPatch, merged } = normalizeMoqPatch(current, patch);

    if (isLocalRowId(id)) {
      setLocalNewRows((prev) => prev.map((r) => (r.id === id ? merged : r)));
      return;
    }

    setStagedEdits((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? {}), ...normalizedPatch },
    }));
  };

  const applyFieldChange = (id: string, patch: Record<string, any>) => {
    if (writeMode === "direct") {
      void persistPatch(id, patch);
      return;
    }
    if (writeMode === "draft") {
      stagePatch(id, patch);
    }
  };

  const submitStagedChange = async (id: string) => {
    if (submitting || writeMode !== "draft") return;

    const row = allDisplayRows.find((r) => r.id === id);
    if (!row) return;

    if (isDuplicateChannel(allDisplayRows, id, row.channel, row.customer_type)) {
      toast.error("A rule for this channel already exists.");
      return;
    }

    setSubmitting(true);
    try {
      if (isLocalRowId(id)) {
        const res = await submitMoqDraft("create", row, null);
        if (!res.ok) {
          toast.error(res.message);
          return;
        }
        setLocalNewRows((prev) => prev.filter((r) => r.id !== id));
        setEditing((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        toast.success(
          "MOQ rule submitted for approval. Approved MOQ changes will appear here after review."
        );
        return;
      }

      const res = await submitMoqDraft("update", row, id);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }

      setStagedEdits((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setEditing((prev) => ({ ...prev, [id]: false }));
      toast.success("MOQ rule change submitted for approval.");
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id: string) => {
    if (!canMutate || submitting) return;

    if (isLocalRowId(id)) {
      setLocalNewRows((prev) => prev.filter((r) => r.id !== id));
      setEditing((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return;
    }

    const row = rows.find((r) => r.id === id);
    if (!row) return;

    if (writeMode === "direct") {
      const { error } = await supabase.from("product_moq_rules").delete().eq("id", id);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Rule removed");
      await load();
      return;
    }

    setSubmitting(true);
    try {
      const displayRow = allDisplayRows.find((r) => r.id === id) ?? row;
      const res = await submitMoqDraft("delete_request", displayRow, id);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(
        "Delete request submitted for approval. This MOQ rule stays visible until review."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const add = async () => {
    if (!canMutate || submitting) return;

    if (allDisplayRows.some((r) => normalizeText(r.channel) === "retail")) {
      toast.error("Retail rule already exists.");
      return;
    }

    if (writeMode === "draft") {
      const tempId = `local-${crypto.randomUUID()}`;
      const newRule: MoqRuleRow = {
        id: tempId,
        product_id: productId,
        channel: "retail",
        moq_applicable: false,
        customer_type: null,
      };
      setLocalNewRows((prev) => [...prev, newRule]);
      setEditing((prev) => ({ ...prev, [tempId]: true }));
      return;
    }

    const { data, error } = await supabase
      .from("product_moq_rules")
      .insert({
        product_id: productId,
        channel: "retail",
        moq_applicable: false,
      })
      .select("*")
      .single();

    if (error) {
      toast.error(error.message);
      return;
    }

    setRows((prev) =>
      [...prev, data].sort((a, b) => String(a.channel).localeCompare(String(b.channel)))
    );
    setEditing((prev) => ({ ...prev, [data.id]: true }));
  };

  const disableRule = async (id: string) => {
    if (!canMutate || submitting) return;

    const disablePatch = {
      moq_applicable: false,
      moq_value: null,
      moq_uom: null,
      increment_value: null,
      increment_uom: null,
      min_carton_qty: null,
      carton_logic: null,
    };

    if (writeMode === "direct") {
      await persistPatch(id, disablePatch);
      return;
    }

    const row = allDisplayRows.find((r) => r.id === id);
    if (!row) return;

    const disabledRow = { ...row, ...disablePatch };

    setSubmitting(true);
    try {
      const operation = isLocalRowId(id) ? "create" : "update";
      const res = await submitMoqDraft(
        operation,
        disabledRow,
        isLocalRowId(id) ? null : id
      );
      if (!res.ok) {
        toast.error(res.message);
        return;
      }

      if (isLocalRowId(id)) {
        setLocalNewRows((prev) => prev.filter((r) => r.id !== id));
      } else {
        setStagedEdits((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }

      toast.success("MOQ disable submitted for approval.");
    } finally {
      setSubmitting(false);
    }
  };

  const generateBusinessRules = async (template: TemplateKey) => {
    if (!canMutate || submitting) return;

    const deduped = buildTemplateDefaults(template, product);

    if (!deduped.length) {
      toast.error("No rules generated.");
      return;
    }

    if (writeMode === "draft") {
      setSubmitting(true);
      try {
        let submitted = 0;
        for (const row of deduped) {
          if (
            allDisplayRows.some(
              (r) =>
                normalizeText(r.channel) === normalizeText(row.channel) &&
                normalizeText(r.customer_type) === normalizeText(row.customer_type)
            )
          ) {
            continue;
          }

          const res = await submitMoqDraft(
            "create",
            { ...row, product_id: productId },
            null
          );
          if (res.ok) submitted += 1;
          else toast.error(res.message);
        }

        if (submitted > 0) {
          toast.success(
            `Submitted ${submitted} MOQ rule draft${submitted === 1 ? "" : "s"} for approval. Approved MOQ changes will appear here after review.`
          );
        } else {
          toast.info("No new MOQ rules to submit — channels may already exist.");
        }
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const payload = deduped.map((row) => ({ product_id: productId, customer_type: null, ...row }));

    const { error } = await supabase.from("product_moq_rules").upsert(payload, {
      onConflict: "product_id,channel,customer_type",
      ignoreDuplicates: false,
    } as any);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(`${templateLabel(template)} rules generated`);
    load();
  };

  return (
    <div className="card-elevated p-6 space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="font-display text-xl">Sales MOQ Rules</h3>
          <p className="text-xs text-muted-foreground">
            Business-first MOQ setup with summary cards and edit-on-demand controls.
          </p>
          {writeMode === "draft" && (
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              MOQ rule changes are submitted for approval. Approved MOQ changes will appear here
              after review.
            </p>
          )}
        </div>

        {canMutate && (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => generateBusinessRules(suggestedTemplate)}
              disabled={submitting}
            >
              <Wand2 className="h-3.5 w-3.5 mr-1" />
              Generate Business Rules
            </Button>
            <Button size="sm" onClick={add} disabled={submitting}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Rule
            </Button>
          </div>
        )}
      </div>

      {writeMode === "draft" && (
        <div className="rounded-md border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          Edit fields below, then use <span className="font-medium text-foreground">Submit change</span>{" "}
          on each rule. Changes are not sent until you submit.
        </div>
      )}

      <div className="rounded-xl border bg-muted/20 p-4 space-y-2">
        <div className="text-xs font-medium text-muted-foreground">Recommended Template</div>
        <div className="flex flex-wrap gap-2">
          {TEMPLATE_OPTIONS.map((template) => {
            const active = template === suggestedTemplate;
            return (
              <Button
                key={template}
                size="sm"
                variant={active ? "default" : "outline"}
                onClick={() => generateBusinessRules(template)}
                disabled={!canMutate || submitting}
              >
                {templateLabel(template)}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border bg-muted/20 p-4 space-y-2">
        <div className="text-sm font-medium">Business Summary</div>
        {businessSummary.length ? (
          <div className="space-y-2">
            {businessSummary.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-lg border bg-background px-3 py-2 text-sm"
              >
                <span className="font-medium">{item.title}</span>
                <span className="text-muted-foreground">{item.summary}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            No MOQ rules yet. Generate Business Rules or add one manually.
          </div>
        )}
      </div>

      <div className="space-y-3">
        {allDisplayRows.map((r) => {
          const isEditing = !!editing[r.id];
          const showAdvanced = !!advanced[r.id];
          const staged = hasStagedChanges(r.id);
          const isNewLocal = isLocalRowId(r.id);

          return (
            <div key={r.id} className="rounded-xl border bg-background p-4 space-y-3 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="text-base font-semibold">{channelLabel(r.channel)}</div>
                    {isNewLocal && (
                      <Badge variant="outline" className="text-[10px]">
                        New — not submitted
                      </Badge>
                    )}
                    {writeMode === "draft" && staged && !isNewLocal && (
                      <Badge variant="secondary" className="text-[10px]">
                        Unsaved edits
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">{rowSummary(r)}</div>
                  {r.allow_override ? (
                    <div className="text-xs text-muted-foreground">Overrides allowed</div>
                  ) : null}
                </div>

                {canMutate && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setEditing((prev) => ({ ...prev, [r.id]: !prev[r.id] }))
                      }
                      disabled={submitting}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      {isEditing ? "Close" : "Edit"}
                    </Button>

                    {writeMode === "draft" && isEditing && staged && (
                      <Button
                        size="sm"
                        onClick={() => submitStagedChange(r.id)}
                        disabled={submitting}
                      >
                        Submit change
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => disableRule(r.id)}
                      disabled={submitting}
                    >
                      Disable
                    </Button>

                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => remove(r.id)}
                      disabled={submitting}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              {isEditing && canMutate && (
                <div className="space-y-3 border-t pt-3">
                  <div className="grid sm:grid-cols-4 gap-3">
                    <div>
                      <Label className="text-xs">Channel</Label>
                      <Sel
                        value={r.channel}
                        onChange={(v) => applyFieldChange(r.id, { channel: v || null })}
                        options={CHANNELS}
                        disabled={submitting}
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-md border px-3 py-2">
                      <Label className="text-xs">MOQ Applicable</Label>
                      <Switch
                        checked={!!r.moq_applicable}
                        disabled={submitting}
                        onCheckedChange={(v) => applyFieldChange(r.id, { moq_applicable: v })}
                      />
                    </div>

                    <div>
                      <Label className="text-xs">MOQ Value</Label>
                      <Input
                        className="h-9"
                        type="number"
                        value={r.moq_value ?? ""}
                        disabled={submitting}
                        onChange={(e) =>
                          applyFieldChange(r.id, { moq_value: e.target.value })
                        }
                      />
                    </div>

                    <div>
                      <Label className="text-xs">MOQ UOM</Label>
                      <Sel
                        value={r.moq_uom}
                        onChange={(v) => applyFieldChange(r.id, { moq_uom: v || null })}
                        options={UOMS}
                        disabled={submitting}
                      />
                    </div>

                    <div>
                      <Label className="text-xs">Increment Value</Label>
                      <Input
                        className="h-9"
                        type="number"
                        value={r.increment_value ?? ""}
                        disabled={submitting}
                        onChange={(e) =>
                          applyFieldChange(r.id, { increment_value: e.target.value })
                        }
                      />
                    </div>

                    <div>
                      <Label className="text-xs">Increment UOM</Label>
                      <Sel
                        value={r.increment_uom}
                        onChange={(v) => applyFieldChange(r.id, { increment_uom: v || null })}
                        options={UOMS}
                        disabled={submitting}
                      />
                    </div>

                    <div className="sm:col-span-2 flex items-center justify-between rounded-md border px-3 py-2">
                      <Label className="text-xs">Allow Override</Label>
                      <Switch
                        checked={!!r.allow_override}
                        disabled={submitting}
                        onCheckedChange={(v) => applyFieldChange(r.id, { allow_override: v })}
                      />
                    </div>
                  </div>

                  <div className="flex justify-between flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setAdvanced((prev) => ({ ...prev, [r.id]: !prev[r.id] }))
                      }
                      disabled={submitting}
                    >
                      {showAdvanced ? (
                        <ChevronUp className="h-4 w-4 mr-1" />
                      ) : (
                        <ChevronDown className="h-4 w-4 mr-1" />
                      )}
                      Advanced Settings
                    </Button>

                    {writeMode === "draft" && staged && (
                      <Button
                        size="sm"
                        onClick={() => submitStagedChange(r.id)}
                        disabled={submitting}
                      >
                        Submit change
                      </Button>
                    )}
                  </div>

                  {showAdvanced && (
                    <div className="grid sm:grid-cols-4 gap-3 rounded-lg border bg-muted/20 p-3">
                      <div>
                        <Label className="text-xs">Customer Type</Label>
                        <Input
                          className="h-9"
                          value={r.customer_type ?? ""}
                          disabled={submitting}
                          onChange={(e) =>
                            applyFieldChange(r.id, {
                              customer_type: e.target.value || null,
                            })
                          }
                        />
                      </div>

                      <div>
                        <Label className="text-xs">Min Carton Qty</Label>
                        <Input
                          className="h-9"
                          type="number"
                          value={r.min_carton_qty ?? ""}
                          disabled={submitting}
                          onChange={(e) =>
                            applyFieldChange(r.id, { min_carton_qty: e.target.value })
                          }
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <Label className="text-xs">Carton Logic</Label>
                        <Input
                          className="h-9"
                          value={r.carton_logic ?? ""}
                          disabled={submitting}
                          onChange={(e) =>
                            applyFieldChange(r.id, { carton_logic: e.target.value || null })
                          }
                        />
                      </div>

                      <div className="sm:col-span-4">
                        <Label className="text-xs">Notes</Label>
                        <Textarea
                          rows={2}
                          value={r.notes ?? ""}
                          disabled={submitting}
                          onChange={(e) =>
                            applyFieldChange(r.id, { notes: e.target.value || null })
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {allDisplayRows.length === 0 && (
          <div className="text-sm text-muted-foreground py-4 text-center">
            No MOQ rules yet. Generate Business Rules or add one manually.
          </div>
        )}
      </div>
    </div>
  );
};
