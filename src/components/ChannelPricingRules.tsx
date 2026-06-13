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
  Archive,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  Trash2,
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

const PRICE_CHANNELS = [
  "mrp",
  "retail",
  "bulk",
  "wholesale",
  "horeca",
  "b2b",
  "distributor",
  "franchisee",
  "own_outlet",
  "export",
  "private_label",
  "promotional",
  "special_customer",
  "corporate_gifting",
  "modern_trade",
];

const PRICE_TYPES = [
  "fixed_price",
  "discount_from_mrp",
  "margin_based",
  "quotation_based",
];

const STATUSES = ["draft", "needs_review", "approved", "archived"];

const SOURCES = [
  "catalogue_local",
  "oasis_central_synced",
  "manual_override",
  "promotional",
  "customer_special",
];

type WriteMode = "direct" | "draft" | "readonly";

type PricingRuleRow = Record<string, any>;

const DIRECT_PRICING_ROLES: Role[] = ["owner", "admin", "product_manager"];

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

const pricingLabel = (channel?: string | null) =>
  String(channel ?? "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase()) || "Unnamed";

const computeCalculated = (row: PricingRuleRow, mrp?: number | null) => {
  const basePrice = asNumberOrNull(row.base_price);
  const discountPercent = asNumberOrNull(row.discount_percent);

  if (row.price_type === "quotation_based") return null;
  if (row.price_type === "fixed_price") return basePrice;
  if (row.price_type === "discount_from_mrp" && mrp != null && discountPercent != null) {
    return Math.round(Number(mrp) * (1 - discountPercent / 100) * 100) / 100;
  }

  return asNumberOrNull(row.calculated_price);
};

const isDuplicateChannel = (
  rows: PricingRuleRow[],
  rowId: string,
  channel: string | null | undefined
) => {
  const c = normalizeText(channel);
  if (!c) return false;
  return rows.some((r) => r.id !== rowId && normalizeText(r.price_channel) === c);
};

const priceSummary = (r: PricingRuleRow) => {
  if (r.price_type === "quotation_based") return "Quotation based";

  const calc =
    r.calculated_price != null ? `${r.calculated_price} ${r.currency || "INR"}` : "Not set";
  const uom = r.uom ? ` / ${r.uom}` : "";
  return `${calc}${uom}`;
};

const normalizePricingPatch = (
  current: PricingRuleRow,
  patch: Record<string, any>,
  mrp?: number | null
) => {
  const normalizedPatch: Record<string, any> = { ...patch };

  if ("base_price" in normalizedPatch) {
    normalizedPatch.base_price = asNumberOrNull(normalizedPatch.base_price);
  }
  if ("discount_percent" in normalizedPatch) {
    normalizedPatch.discount_percent = asNumberOrNull(normalizedPatch.discount_percent);
  }
  if ("calculated_price" in normalizedPatch) {
    normalizedPatch.calculated_price = asNumberOrNull(normalizedPatch.calculated_price);
  }
  if ("gst_rate" in normalizedPatch) {
    normalizedPatch.gst_rate = asNumberOrNull(normalizedPatch.gst_rate);
  }

  const merged = { ...current, ...normalizedPatch };

  if (merged.price_type === "quotation_based") {
    normalizedPatch.base_price = null;
    normalizedPatch.discount_percent = null;
    normalizedPatch.calculated_price = null;
  } else {
    normalizedPatch.calculated_price = computeCalculated(merged, mrp);
  }

  return { normalizedPatch, merged };
};

const buildCataloguePricingDraftPayload = (productId: string, row: PricingRuleRow) => ({
  scope: "product_pricing_rule" as const,
  product_id: productId,
  price_channel: row.price_channel ?? null,
  price_type: row.price_type ?? null,
  base_price: row.base_price ?? null,
  discount_percent: row.discount_percent ?? null,
  calculated_price: row.calculated_price ?? null,
  currency: row.currency ?? "INR",
  uom: row.uom ?? null,
  tax_inclusive: row.tax_inclusive ?? false,
  gst_rate: row.gst_rate ?? null,
  valid_from: row.valid_from ?? null,
  valid_until: row.valid_until ?? null,
  notes: row.notes ?? null,
  source: row.source ?? null,
  approval_status: row.approval_status ?? "draft",
});

export const ChannelPricingRules = ({
  productId,
  product,
  onRulesChange,
}: {
  productId: string;
  product: any;
  onRulesChange?: () => void;
}) => {
  const { roles } = useAuth();
  const [rows, setRows] = useState<PricingRuleRow[]>([]);
  const [localNewRows, setLocalNewRows] = useState<PricingRuleRow[]>([]);
  const [stagedEdits, setStagedEdits] = useState<Record<string, PricingRuleRow>>({});
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const [advanced, setAdvanced] = useState<Record<string, boolean>>({});
  const [writeMode, setWriteMode] = useState<WriteMode>("readonly");
  const [submitting, setSubmitting] = useState(false);
  const [canDirectPricing, setCanDirectPricing] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from("product_pricing_rules")
      .select("*")
      .eq("product_id", productId)
      .order("price_channel");

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
        roleList.some((r) => DIRECT_PRICING_ROLES.includes(r)) ||
        (await canWriteMasterDirectly());
      setCanDirectPricing(hasDirect);
      if (hasDirect) {
        setWriteMode("direct");
        return;
      }
      if (await isCatalogueContributor()) {
        const canSubmit = await canSubmitDraft(draftTableMap.pricing.permission);
        setWriteMode(canSubmit ? "draft" : "readonly");
        return;
      }
      setWriteMode("readonly");
    })();
  }, [roles]);

  const canMutate = writeMode === "direct" || writeMode === "draft";
  const showMasterApproveArchive = writeMode === "direct" && canDirectPricing;

  const allDisplayRows = useMemo(() => {
    const mergedMaster = rows.map((row) => ({
      ...row,
      ...(stagedEdits[row.id] ?? {}),
    }));
    return [...mergedMaster, ...localNewRows].sort((a, b) =>
      String(a.price_channel).localeCompare(String(b.price_channel))
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

  const businessSummary = useMemo(() => {
    if (!allDisplayRows.length) return [];

    return allDisplayRows.map((r) => ({
      id: r.id,
      title: pricingLabel(r.price_channel),
      summary: priceSummary(r),
    }));
  }, [allDisplayRows]);

  const submitPricingDraft = async (
    operation: "create" | "update" | "delete_request",
    row: PricingRuleRow,
    targetRecordId?: string | null
  ) => {
    const payloadRow = {
      ...row,
      calculated_price: computeCalculated(row, product?.mrp),
    };
    return submitCatalogueDraft({
      draftType: "pricing",
      operation,
      payload: buildCataloguePricingDraftPayload(productId, payloadRow),
      targetRecordId: targetRecordId ?? null,
    });
  };

  const persistPatch = async (id: string, patch: Record<string, any>) => {
    const current = rows.find((r) => r.id === id);
    if (!current) return;

    const next = { ...current, ...patch };

    if (isDuplicateChannel(allDisplayRows, id, next.price_channel)) {
      toast.error("A pricing rule for this channel already exists.");
      return;
    }

    const { normalizedPatch } = normalizePricingPatch(current, patch, product?.mrp);

    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...normalizedPatch } : r)));

    const { error } = await supabase
      .from("product_pricing_rules")
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

    if (isDuplicateChannel(allDisplayRows, id, next.price_channel)) {
      toast.error("A pricing rule for this channel already exists.");
      return;
    }

    const { normalizedPatch, merged } = normalizePricingPatch(current, patch, product?.mrp);

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

    if (isDuplicateChannel(allDisplayRows, id, row.price_channel)) {
      toast.error("A pricing rule for this channel already exists.");
      return;
    }

    setSubmitting(true);
    try {
      if (isLocalRowId(id)) {
        const res = await submitPricingDraft("create", row, null);
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
          "Pricing rule submitted for approval. Approved pricing changes will appear here after review."
        );
        return;
      }

      const res = await submitPricingDraft("update", row, id);
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
      toast.success("Pricing rule change submitted for approval.");
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
      const { error } = await supabase.from("product_pricing_rules").delete().eq("id", id);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Pricing rule removed");
      await load();
      return;
    }

    setSubmitting(true);
    try {
      const displayRow = allDisplayRows.find((r) => r.id === id) ?? row;
      const res = await submitPricingDraft("delete_request", displayRow, id);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(
        "Delete request submitted for approval. This pricing rule stays visible until review."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const add = async () => {
    if (!canMutate || submitting) return;

    if (allDisplayRows.some((r) => normalizeText(r.price_channel) === "retail")) {
      toast.error("Retail pricing rule already exists.");
      return;
    }

    if (writeMode === "draft") {
      const tempId = `local-${crypto.randomUUID()}`;
      const newRule: PricingRuleRow = {
        id: tempId,
        product_id: productId,
        price_channel: "retail",
        price_type: "quotation_based",
        currency: "INR",
        approval_status: "draft",
        source: "catalogue_local",
      };
      setLocalNewRows((prev) => [...prev, newRule]);
      setEditing((prev) => ({ ...prev, [tempId]: true }));
      return;
    }

    const { data, error } = await supabase
      .from("product_pricing_rules")
      .upsert(
        {
          product_id: productId,
          price_channel: "retail",
          price_type: "quotation_based",
          currency: "INR",
          approval_status: "draft",
          source: "catalogue_local",
        },
        { onConflict: "product_id,price_channel" },
      )
      .select("*")
      .single();

    if (error) {
      toast.error(error.message);
      return;
    }

    setRows((prev) =>
      [...prev, data].sort((a, b) =>
        String(a.price_channel).localeCompare(String(b.price_channel))
      )
    );
    setEditing((prev) => ({ ...prev, [data.id]: true }));
  };

  const approve = async (id: string) => {
    if (!showMasterApproveArchive || submitting) return;

    const { data: authData } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("product_pricing_rules")
      .update({
        approval_status: "approved",
        approved_by: authData.user?.id ?? null,
        approved_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Pricing approved");
    load();
  };

  const archive = async (id: string) => {
    if (!showMasterApproveArchive || submitting) return;

    const { error } = await supabase
      .from("product_pricing_rules")
      .update({ approval_status: "archived" })
      .eq("id", id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Pricing archived");
    load();
  };

  return (
    <div className="card-elevated p-6 space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="font-display text-xl">Sales Pricing Rules</h3>
          <p className="text-xs text-muted-foreground">
            Card-first pricing setup with summary view by default.
          </p>
          {writeMode === "draft" && (
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              Pricing rule changes are submitted for approval. Approved pricing changes will appear
              here after review.
            </p>
          )}
        </div>

        {canMutate && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={add} disabled={submitting}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Price
            </Button>
          </div>
        )}
      </div>

      {writeMode === "draft" && (
        <div className="rounded-md border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          Edit fields below, then use <span className="font-medium text-foreground">Submit change</span>{" "}
          on each rule. Changes are not sent until you submit. To retire a price, use Remove
          (submits a delete request for approval).
        </div>
      )}

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
            No pricing rules yet. Add one to begin.
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
                    <div className="text-base font-semibold">{pricingLabel(r.price_channel)}</div>
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
                  <div className="text-sm text-muted-foreground">{priceSummary(r)}</div>
                  <div className="text-xs text-muted-foreground">
                    Status: {String(r.approval_status ?? "draft").replace(/_/g, " ")}
                  </div>
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

                    {showMasterApproveArchive && r.approval_status !== "approved" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => approve(r.id)}
                        disabled={submitting}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                        Approve
                      </Button>
                    )}

                    {showMasterApproveArchive && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => archive(r.id)}
                        disabled={submitting}
                      >
                        <Archive className="h-3.5 w-3.5 mr-1" />
                        Archive
                      </Button>
                    )}

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
                      <Label className="text-xs">Pricing Label / Channel</Label>
                      <Sel
                        value={r.price_channel}
                        onChange={(v) => applyFieldChange(r.id, { price_channel: v || null })}
                        options={PRICE_CHANNELS}
                        disabled={submitting}
                      />
                    </div>

                    <div>
                      <Label className="text-xs">Price Type</Label>
                      <Sel
                        value={r.price_type}
                        onChange={(v) => applyFieldChange(r.id, { price_type: v || null })}
                        options={PRICE_TYPES}
                        disabled={submitting}
                      />
                    </div>

                    <div>
                      <Label className="text-xs">Base Price</Label>
                      <Input
                        className="h-9"
                        type="number"
                        value={r.base_price ?? ""}
                        disabled={r.price_type === "quotation_based" || submitting}
                        onChange={(e) =>
                          applyFieldChange(r.id, { base_price: e.target.value })
                        }
                      />
                    </div>

                    <div>
                      <Label className="text-xs">Discount %</Label>
                      <Input
                        className="h-9"
                        type="number"
                        value={r.discount_percent ?? ""}
                        disabled={r.price_type !== "discount_from_mrp" || submitting}
                        onChange={(e) =>
                          applyFieldChange(r.id, { discount_percent: e.target.value })
                        }
                      />
                    </div>

                    <div>
                      <Label className="text-xs">Calculated Price</Label>
                      <Input
                        className="h-9"
                        type="number"
                        value={r.calculated_price ?? ""}
                        disabled={
                          r.price_type === "fixed_price" ||
                          r.price_type === "discount_from_mrp" ||
                          submitting
                        }
                        onChange={(e) =>
                          applyFieldChange(r.id, { calculated_price: e.target.value })
                        }
                      />
                    </div>

                    <div>
                      <Label className="text-xs">Currency</Label>
                      <Input
                        className="h-9"
                        value={r.currency ?? "INR"}
                        disabled={submitting}
                        onChange={(e) =>
                          applyFieldChange(r.id, { currency: e.target.value || "INR" })
                        }
                      />
                    </div>

                    <div>
                      <Label className="text-xs">UOM</Label>
                      <Input
                        className="h-9"
                        value={r.uom ?? ""}
                        disabled={submitting}
                        onChange={(e) =>
                          applyFieldChange(r.id, { uom: e.target.value || null })
                        }
                        placeholder="per pc / kg"
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-md border px-3 py-2">
                      <Label className="text-xs">Tax Inclusive</Label>
                      <Switch
                        checked={!!r.tax_inclusive}
                        disabled={submitting}
                        onCheckedChange={(v) => applyFieldChange(r.id, { tax_inclusive: v })}
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
                      {writeMode === "direct" && (
                        <div>
                          <Label className="text-xs">Status</Label>
                          <Sel
                            value={r.approval_status}
                            onChange={(v) =>
                              applyFieldChange(r.id, { approval_status: v || "draft" })
                            }
                            options={STATUSES}
                            disabled={submitting}
                          />
                        </div>
                      )}

                      {writeMode === "draft" && (
                        <div>
                          <Label className="text-xs">Status</Label>
                          <Input
                            className="h-9"
                            value={String(r.approval_status ?? "draft").replace(/_/g, " ")}
                            disabled
                            readOnly
                          />
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Approval status is set by reviewers after catalogue approval.
                          </p>
                        </div>
                      )}

                      <div>
                        <Label className="text-xs">Source</Label>
                        <Sel
                          value={r.source}
                          onChange={(v) => applyFieldChange(r.id, { source: v || null })}
                          options={SOURCES}
                          disabled={submitting}
                        />
                      </div>

                      <div>
                        <Label className="text-xs">GST %</Label>
                        <Input
                          className="h-9"
                          type="number"
                          value={r.gst_rate ?? ""}
                          disabled={submitting}
                          onChange={(e) =>
                            applyFieldChange(r.id, { gst_rate: e.target.value })
                          }
                        />
                      </div>

                      <div>
                        <Label className="text-xs">Valid From</Label>
                        <Input
                          className="h-9"
                          type="date"
                          value={r.valid_from ?? ""}
                          disabled={submitting}
                          onChange={(e) =>
                            applyFieldChange(r.id, { valid_from: e.target.value || null })
                          }
                        />
                      </div>

                      <div>
                        <Label className="text-xs">Valid Until</Label>
                        <Input
                          className="h-9"
                          type="date"
                          value={r.valid_until ?? ""}
                          disabled={submitting}
                          onChange={(e) =>
                            applyFieldChange(r.id, { valid_until: e.target.value || null })
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
            No pricing rules yet. Add one to begin.
          </div>
        )}
      </div>
    </div>
  );
};
