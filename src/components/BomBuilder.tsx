import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AlertTriangle, Boxes, Link2, Plus, Search, Trash2, X } from "lucide-react";

type BomItem = {
  id: string;
  product_id: string;
  component_product_id: string | null;
  component_name: string | null;
  quantity_per_unit: number | null;
  source_department: string | null;
  created_at: string | null;
};

type ProductOption = {
  id: string;
  name: string | null;
  sku: string | null;
  category: string | null;
};

interface Props {
  parentId: string;
  productClass?: string | null;
  bomRequired?: boolean;
}

const SOURCE_DEPARTMENTS = [
  { v: "ready_goods_store", label: "Ready Goods Store" },
  { v: "packing_assembly", label: "Packing & Assembly Store" },
  { v: "third_party_goods_store", label: "Third Party Goods Store" },
  { v: "external_vendor", label: "External Vendor" },
];

const emptyDraft = () => ({
  component_product_id: null as string | null,
  component_name: "",
  quantity_per_unit: "1",
  source_department: "",
});

const Select = ({ value, onChange, options, placeholder }: any) => (
  <select
    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
    value={value ?? ""}
    onChange={(e) => onChange(e.target.value || null)}
  >
    <option value="">{placeholder ?? "— Select —"}</option>
    {options.map((o: any) => (
      <option key={o.v} value={o.v}>
        {o.label}
      </option>
    ))}
  </select>
);

const formatDepartment = (value?: string | null) => {
  if (!value) return "—";

  const found = SOURCE_DEPARTMENTS.find((d) => d.v === value);
  return found?.label || value.replace(/_/g, " ");
};

const productDisplayName = (p: ProductOption) => p.name || p.sku || p.id;

export function BomBuilder({ parentId, productClass, bomRequired }: Props) {
  const [items, setItems] = useState<BomItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState(emptyDraft());

  const [productSearch, setProductSearch] = useState("");
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [productSearchLoading, setProductSearchLoading] = useState(false);

  const load = async () => {
    if (!parentId) return;

    setLoading(true);

    const { data, error } = await (supabase as any)
      .from("product_bom")
      .select(
        "id, product_id, component_product_id, component_name, quantity_per_unit, source_department, created_at"
      )
      .eq("product_id", parentId)
      .order("created_at", { ascending: true });

    if (error) {
      toast.error(error.message);
      setItems([]);
      setLoading(false);
      return;
    }

    setItems((data ?? []) as BomItem[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentId]);

  const searchProducts = async () => {
    const q = productSearch.trim();

    if (q.length < 2) {
      toast.error("Type at least 2 characters to search products.");
      return;
    }

    setProductSearchLoading(true);

    const safeQ = q.replaceAll("%", "").replaceAll(",", " ");

    const { data, error } = await (supabase as any)
      .from("products")
      .select("id, name, sku, category")
      .or(`name.ilike.%${safeQ}%,sku.ilike.%${safeQ}%,category.ilike.%${safeQ}%`)
      .neq("id", parentId)
      .order("name", { ascending: true })
      .limit(12);

    if (error) {
      toast.error(error.message);
      setProductOptions([]);
      setProductSearchLoading(false);
      return;
    }

    setProductOptions((data ?? []) as ProductOption[]);
    setProductSearchLoading(false);
  };

  const setD = (key: string, value: any) => {
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const pickProduct = (p: ProductOption) => {
    setDraft((d) => ({
      ...d,
      component_product_id: p.id,
      component_name: productDisplayName(p),
    }));
    setProductSearch("");
    setProductOptions([]);
  };

  const clearPickedProduct = () => {
    setDraft((d) => ({
      ...d,
      component_product_id: null,
    }));
  };

  const startAdd = () => {
    setDraft(emptyDraft());
    setEditingId(null);
    setShowAdd(true);
    setProductSearch("");
    setProductOptions([]);
  };

  const startEdit = (item: BomItem) => {
    setDraft({
      component_product_id: item.component_product_id,
      component_name: item.component_name ?? "",
      quantity_per_unit:
        item.quantity_per_unit === null || item.quantity_per_unit === undefined
          ? "1"
          : String(item.quantity_per_unit),
      source_department: item.source_department ?? "",
    });
    setEditingId(item.id);
    setShowAdd(true);
    setProductSearch("");
    setProductOptions([]);
  };

  const cancel = () => {
    setDraft(emptyDraft());
    setEditingId(null);
    setShowAdd(false);
    setProductSearch("");
    setProductOptions([]);
  };

  const validateDraft = () => {
    if (!draft.component_product_id && !draft.component_name.trim()) {
      return "Component name or linked product is required.";
    }

    if (!draft.quantity_per_unit || Number(draft.quantity_per_unit) <= 0) {
      return "Quantity per unit must be greater than 0.";
    }

    if (!draft.source_department) {
      return "Source department is required.";
    }

    return null;
  };

  const buildPayload = () => ({
    product_id: parentId,
    component_product_id: draft.component_product_id || null,
    component_name: draft.component_name.trim() || null,
    quantity_per_unit: Number(draft.quantity_per_unit),
    source_department: draft.source_department || null,
  });

  const save = async () => {
    const validationError = validateDraft();

    if (validationError) {
      toast.error(validationError);
      return;
    }

    const payload = buildPayload();

    const result = editingId
      ? await (supabase as any)
          .from("product_bom")
          .update(payload)
          .eq("id", editingId)
      : await (supabase as any).from("product_bom").insert(payload);

    if (result.error) {
      toast.error(result.error.message);
      return;
    }

    toast.success(editingId ? "BOM component updated" : "BOM component added");
    cancel();
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this BOM component?")) return;

    const { error } = await (supabase as any)
      .from("product_bom")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("BOM component removed");
    load();
  };

  const warnings = useMemo(() => {
    const list: string[] = [];

    if (bomRequired && items.length === 0) {
      list.push("BOM is marked required but no components exist yet.");
    }

    if (productClass === "gift_hamper" && items.length === 0) {
      list.push("Gift hamper should have a BOM before approval.");
    }

    if (productClass === "ready_pack" && items.length === 0) {
      list.push("Ready pack usually needs food material and packing material components.");
    }

    return list;
  }, [bomRequired, productClass, items.length]);

  const groupedCounts = useMemo(() => {
    return items.reduce<Record<string, number>>((acc, item) => {
      const key = item.source_department || "unspecified";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }, [items]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-warning/10 border-warning/40 p-3 text-xs flex gap-2 items-start">
        <AlertTriangle className="h-4 w-4 mt-0.5 text-warning" />
        <div>
          Advanced BOM fields require schema expansion and are not active yet.
          Current live schema supports only component name, optional linked product,
          quantity per unit, and source department.
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs space-y-1">
          {warnings.map((warning, index) => (
            <div key={index}>⚠️ {warning}</div>
          ))}
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-3">
        <div className="card-elevated p-4">
          <div className="text-[11px] uppercase text-muted-foreground">
            Components
          </div>
          <div className="text-xl font-semibold">{items.length}</div>
        </div>

        <div className="card-elevated p-4 sm:col-span-2">
          <div className="text-[11px] uppercase text-muted-foreground mb-2">
            Source routing
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Object.keys(groupedCounts).length === 0 ? (
              <span className="text-xs text-muted-foreground">No routing yet</span>
            ) : (
              Object.entries(groupedCounts).map(([department, count]) => (
                <Badge key={department} variant="outline" className="text-[10px]">
                  <Boxes className="h-3 w-3 mr-1" />
                  {formatDepartment(department)}: {count}
                </Badge>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading BOM…</div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
            No BOM components yet.
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="card-elevated p-4 flex gap-3 items-start">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="font-medium truncate">
                    {item.component_name || "Unnamed component"}
                  </div>

                  {item.component_product_id && (
                    <Badge variant="secondary" className="text-[10px]">
                      <Link2 className="h-3 w-3 mr-1" />
                      linked product
                    </Badge>
                  )}
                </div>

                <div className="text-xs text-muted-foreground mt-1">
                  Qty per unit:{" "}
                  <span className="font-medium text-foreground">
                    {item.quantity_per_unit ?? "—"}
                  </span>
                </div>

                <div className="text-xs text-muted-foreground mt-1">
                  Source:{" "}
                  <span className="font-medium text-foreground">
                    {formatDepartment(item.source_department)}
                  </span>
                </div>

                {item.component_product_id && (
                  <div className="text-[10px] text-muted-foreground mt-1 font-mono">
                    Linked product ID: {item.component_product_id}
                  </div>
                )}
              </div>

              <div className="flex gap-1 shrink-0">
                <Button size="sm" variant="outline" onClick={() => startEdit(item)}>
                  Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(item.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {!showAdd && (
        <Button onClick={startAdd}>
          <Plus className="h-4 w-4 mr-1" />
          Add component
        </Button>
      )}

      {showAdd && (
        <div className="card-elevated p-5 space-y-4 border-primary/30">
          <div className="flex items-center justify-between">
            <h4 className="font-display text-lg">
              {editingId ? "Edit BOM component" : "Add BOM component"}
            </h4>
            <Button size="icon" variant="ghost" onClick={cancel}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
            This form writes only to <span className="font-mono">public.product_bom</span>.
            Supported columns: product_id, component_product_id, component_name,
            quantity_per_unit, source_department.
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2 space-y-2">
              <Label className="text-xs">Linked product optional</Label>

              {draft.component_product_id ? (
                <div className="flex items-center gap-2 rounded-md border p-2 text-sm">
                  <Link2 className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 truncate">{draft.component_name}</span>
                  <Button size="sm" variant="ghost" onClick={clearPickedProduct}>
                    Clear link
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <Input
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="Search product by name, SKU, or category…"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          searchProducts();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={searchProducts}
                      disabled={productSearchLoading}
                    >
                      <Search className="h-4 w-4 mr-1" />
                      {productSearchLoading ? "Searching…" : "Search"}
                    </Button>
                  </div>

                  {productOptions.length > 0 && (
                    <div className="rounded-md border divide-y max-h-64 overflow-auto">
                      {productOptions.map((product) => (
                        <button
                          key={product.id}
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-muted/60"
                          onClick={() => pickProduct(product)}
                        >
                          <div className="text-sm font-medium truncate">
                            {productDisplayName(product)}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {product.sku || "No SKU"}
                            {product.category ? ` · ${product.category}` : ""}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="sm:col-span-2 space-y-1">
              <Label className="text-xs">Component name</Label>
              <Input
                value={draft.component_name}
                onChange={(e) => setD("component_name", e.target.value)}
                placeholder="Example: Acrylic box, Pistachio Baklawa, Ribbon, Tray"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Quantity per unit</Label>
              <Input
                type="number"
                min="0"
                step="0.001"
                value={draft.quantity_per_unit}
                onChange={(e) => setD("quantity_per_unit", e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Source department</Label>
              <Select
                value={draft.source_department}
                onChange={(value: string) => setD("source_department", value)}
                options={SOURCE_DEPARTMENTS}
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={cancel}>
              Cancel
            </Button>
            <Button onClick={save}>
              {editingId ? "Update" : "Add"} component
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default BomBuilder;
