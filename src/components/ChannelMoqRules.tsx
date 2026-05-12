import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  RefreshCcw,
  Trash2,
  Wand2,
} from "lucide-react";

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

const Sel = ({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string | null | undefined;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
}) => (
  <select
    className="h-9 px-2 rounded border bg-background text-xs w-full"
    value={value ?? ""}
    onChange={(e) => onChange(e.target.value)}
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

const rowSummary = (r: any) => {
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
  rows: any[],
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

export const ChannelMoqRules = ({
  productId,
  product,
}: {
  productId: string;
  product: any;
}) => {
  const [rows, setRows] = useState<any[]>([]);
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const [advanced, setAdvanced] = useState<Record<string, boolean>>({});

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
  };

  useEffect(() => {
    load();
  }, [productId]);

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
    if (!rows.length) return [];

    return rows.map((r) => ({
      id: r.id,
      title: channelLabel(r.channel),
      summary: rowSummary(r),
    }));
  }, [rows]);

  const persistPatch = async (id: string, patch: any) => {
    const current = rows.find((r) => r.id === id);
    if (!current) return;

    const next = { ...current, ...patch };

    if (isDuplicateChannel(rows, id, next.channel, next.customer_type)) {
      toast.error("A rule for this channel already exists.");
      return;
    }

    const normalizedPatch: any = { ...patch };

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

  const remove = async (id: string) => {
    const { error } = await supabase.from("product_moq_rules").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Rule removed");
    load();
  };

  const add = async () => {
    if (rows.some((r) => normalizeText(r.channel) === "retail")) {
      toast.error("Retail rule already exists.");
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

    setRows((prev) => [...prev, data].sort((a, b) => String(a.channel).localeCompare(String(b.channel))));
    setEditing((prev) => ({ ...prev, [data.id]: true }));
  };

  const disableRule = async (id: string) => {
    await persistPatch(id, {
      moq_applicable: false,
      moq_value: null,
      moq_uom: null,
      increment_value: null,
      increment_uom: null,
      min_carton_qty: null,
      carton_logic: null,
    });
  };

  const generateBusinessRules = async (template: TemplateKey) => {
    const defaults: any[] = [];
    const push = (r: any) => defaults.push({ product_id: productId, customer_type: null, ...r });

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
      push({
        channel: "retail",
        moq_applicable: false,
      });
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
      push({
        channel: "retail",
        moq_applicable: false,
      });
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

    if (!defaults.length) {
      toast.error("No rules generated.");
      return;
    }

    const deduped = defaults.filter((row, index, arr) => {
      return (
        arr.findIndex(
          (x) =>
            normalizeText(x.channel) === normalizeText(row.channel) &&
            normalizeText(x.customer_type) === normalizeText(row.customer_type)
        ) === index
      );
    });

    const { error } = await supabase.from("product_moq_rules").upsert(deduped, {
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
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => generateBusinessRules(suggestedTemplate)}
          >
            <Wand2 className="h-3.5 w-3.5 mr-1" />
            Generate Business Rules
          </Button>
          <Button size="sm" onClick={add}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Rule
          </Button>
        </div>
      </div>

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
        {rows.map((r) => {
          const isEditing = !!editing[r.id];
          const showAdvanced = !!advanced[r.id];

          return (
            <div key={r.id} className="rounded-xl border bg-background p-4 space-y-3 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1">
                  <div className="text-base font-semibold">{channelLabel(r.channel)}</div>
                  <div className="text-sm text-muted-foreground">{rowSummary(r)}</div>
                  {r.allow_override ? (
                    <div className="text-xs text-muted-foreground">Overrides allowed</div>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setEditing((prev) => ({ ...prev, [r.id]: !prev[r.id] }))
                    }
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    {isEditing ? "Close" : "Edit"}
                  </Button>

                  <Button size="sm" variant="outline" onClick={() => disableRule(r.id)}>
                    Disable
                  </Button>

                  <Button size="icon" variant="ghost" onClick={() => remove(r.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {isEditing && (
                <div className="space-y-3 border-t pt-3">
                  <div className="grid sm:grid-cols-4 gap-3">
                    <div>
                      <Label className="text-xs">Channel</Label>
                      <Sel
                        value={r.channel}
                        onChange={(v) => persistPatch(r.id, { channel: v || null })}
                        options={CHANNELS}
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-md border px-3 py-2">
                      <Label className="text-xs">MOQ Applicable</Label>
                      <Switch
                        checked={!!r.moq_applicable}
                        onCheckedChange={(v) => persistPatch(r.id, { moq_applicable: v })}
                      />
                    </div>

                    <div>
                      <Label className="text-xs">MOQ Value</Label>
                      <Input
                        className="h-9"
                        type="number"
                        value={r.moq_value ?? ""}
                        onChange={(e) =>
                          persistPatch(r.id, { moq_value: e.target.value })
                        }
                      />
                    </div>

                    <div>
                      <Label className="text-xs">MOQ UOM</Label>
                      <Sel
                        value={r.moq_uom}
                        onChange={(v) => persistPatch(r.id, { moq_uom: v || null })}
                        options={UOMS}
                      />
                    </div>

                    <div>
                      <Label className="text-xs">Increment Value</Label>
                      <Input
                        className="h-9"
                        type="number"
                        value={r.increment_value ?? ""}
                        onChange={(e) =>
                          persistPatch(r.id, { increment_value: e.target.value })
                        }
                      />
                    </div>

                    <div>
                      <Label className="text-xs">Increment UOM</Label>
                      <Sel
                        value={r.increment_uom}
                        onChange={(v) => persistPatch(r.id, { increment_uom: v || null })}
                        options={UOMS}
                      />
                    </div>

                    <div className="sm:col-span-2 flex items-center justify-between rounded-md border px-3 py-2">
                      <Label className="text-xs">Allow Override</Label>
                      <Switch
                        checked={!!r.allow_override}
                        onCheckedChange={(v) => persistPatch(r.id, { allow_override: v })}
                      />
                    </div>
                  </div>

                  <div className="flex justify-between">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setAdvanced((prev) => ({ ...prev, [r.id]: !prev[r.id] }))
                      }
                    >
                      {showAdvanced ? (
                        <ChevronUp className="h-4 w-4 mr-1" />
                      ) : (
                        <ChevronDown className="h-4 w-4 mr-1" />
                      )}
                      Advanced Settings
                    </Button>
                  </div>

                  {showAdvanced && (
                    <div className="grid sm:grid-cols-4 gap-3 rounded-lg border bg-muted/20 p-3">
                      <div>
                        <Label className="text-xs">Customer Type</Label>
                        <Input
                          className="h-9"
                          value={r.customer_type ?? ""}
                          onChange={(e) =>
                            persistPatch(r.id, {
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
                          onChange={(e) =>
                            persistPatch(r.id, { min_carton_qty: e.target.value })
                          }
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <Label className="text-xs">Carton Logic</Label>
                        <Input
                          className="h-9"
                          value={r.carton_logic ?? ""}
                          onChange={(e) =>
                            persistPatch(r.id, { carton_logic: e.target.value || null })
                          }
                        />
                      </div>

                      <div className="sm:col-span-4">
                        <Label className="text-xs">Notes</Label>
                        <Textarea
                          rows={2}
                          value={r.notes ?? ""}
                          onChange={(e) =>
                            persistPatch(r.id, { notes: e.target.value || null })
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

        {rows.length === 0 && (
          <div className="text-sm text-muted-foreground py-4 text-center">
            No MOQ rules yet. Generate Business Rules or add one manually.
          </div>
        )}
      </div>
    </div>
  );
};
