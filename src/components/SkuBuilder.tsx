import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchActiveSkuCodeRules } from "@/lib/skuCodeRules";
import {
  allowedPackagingCodes,
  allowedSubcategoryCodes,
  filterSkuCodeOptions,
  invalidSkuTaxonomyMessage,
  isValidSkuTaxonomyCombination,
} from "@/lib/skuTaxonomyMap";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Copy, Lock, Unlock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type Rule = { code: string; label: string; code_type: string };

interface Props {
  value: {
    sku?: string | null;
    sku_locked?: boolean;
    division_code?: string | null;
    category_code?: string | null;
    subcategory_code?: string | null;
    packaging_code?: string | null;
    legacy_sku?: string | null;
    product_class?: string | null;
  };
  canOverride: boolean;
  productClass?: string | null;
  onChange: (patch: Record<string, unknown>) => void;
}

const Sel = ({ label, value, options, onChange }: any) => (
  <div>
    <Label className="text-xs">{label}</Label>
    <select
      className="w-full h-10 px-2 rounded border bg-background text-sm"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
    >
      <option value="">— Select —</option>
      {options.map((o: Rule) => (
        <option key={o.code} value={o.code}>{o.code} · {o.label}</option>
      ))}
    </select>
  </div>
);

export function SkuBuilder({ value, canOverride, productClass, onChange }: Props) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [rulesLoaded, setRulesLoaded] = useState(false);
  const [rulesError, setRulesError] = useState<string | null>(null);
  const [overriding, setOverriding] = useState(false);
  const [overrideSku, setOverrideSku] = useState("");
  const [reason, setReason] = useState("");
  const [typingIn, setTypingIn] = useState(false);
  const [manualSku, setManualSku] = useState("");

  const effectiveProductClass = productClass ?? value.product_class ?? null;

  useEffect(() => {
    void fetchActiveSkuCodeRules().then(({ rules: rows, error }) => {
      setRules(rows);
      setRulesError(error);
      setRulesLoaded(true);
      if (error && import.meta.env.DEV) {
        console.warn("[SkuBuilder] sku_code_rules load:", error);
      }
    });
  }, []);

  const by = (t: string) => rules.filter((r) => r.code_type === t);

  const subcategoryOptions = useMemo(
    () =>
      filterSkuCodeOptions(
        by("subcategory"),
        allowedSubcategoryCodes(value.category_code, value.division_code),
      ),
    [rules, value.category_code, value.division_code],
  );

  const packagingOptions = useMemo(
    () =>
      filterSkuCodeOptions(
        by("packaging"),
        allowedPackagingCodes(value.category_code, effectiveProductClass, value.division_code),
      ),
    [rules, value.category_code, effectiveProductClass, value.division_code],
  );

  const taxonomyInvalid = invalidSkuTaxonomyMessage({
    category_code: value.category_code,
    subcategory_code: value.subcategory_code,
    packaging_code: value.packaging_code,
    division_code: value.division_code,
    product_class: effectiveProductClass,
  });

  const ready =
    value.division_code &&
    value.category_code &&
    value.subcategory_code &&
    value.packaging_code &&
    !taxonomyInvalid;

  const preview = ready
    ? `OAS-${value.division_code}-${value.category_code}-${value.subcategory_code}-${value.packaging_code}-XXXX`
    : "—";
  const rulesMissing = rulesLoaded && rules.length === 0;

  const patchCategory = (categoryCode: string | null) => {
    const patch: Record<string, unknown> = { category_code: categoryCode };
    if (
      value.subcategory_code &&
      !allowedSubcategoryCodes(categoryCode, value.division_code)?.includes(
        value.subcategory_code.toUpperCase(),
      )
    ) {
      patch.subcategory_code = null;
    }
    if (
      value.packaging_code &&
      !allowedPackagingCodes(categoryCode, effectiveProductClass, value.division_code)?.includes(
        value.packaging_code.toUpperCase(),
      )
    ) {
      patch.packaging_code = null;
    }
    onChange(patch);
  };

  const patchDivision = (divisionCode: string | null) => {
    const patch: Record<string, unknown> = { division_code: divisionCode };
    if (
      value.subcategory_code &&
      !allowedSubcategoryCodes(value.category_code, divisionCode)?.includes(
        value.subcategory_code.toUpperCase(),
      )
    ) {
      patch.subcategory_code = null;
    }
    onChange(patch);
  };

  const generate = async () => {
    if (rulesMissing) {
      return toast.error("sku_code_rules has no active rows — use Type SKU below or ask admin to seed rules.");
    }
    if (!value.division_code || !value.category_code || !value.subcategory_code || !value.packaging_code) {
      return toast.error("Pick all four codes first.");
    }
    const combo = isValidSkuTaxonomyCombination({
      category_code: value.category_code,
      subcategory_code: value.subcategory_code,
      packaging_code: value.packaging_code,
      division_code: value.division_code,
      product_class: effectiveProductClass,
    });
    if (!combo.valid) {
      return toast.error(combo.message ?? "Invalid SKU taxonomy combination.");
    }
    const { data, error } = await supabase.rpc("generate_oasis_sku", {
      _division_code: value.division_code,
      _category_code: value.category_code,
      _subcategory_code: value.subcategory_code,
      _packaging_code: value.packaging_code,
    });
    if (error) return toast.error(error.message);
    onChange({
      sku: data,
      sku_locked: true,
      sku_generated_at: new Date().toISOString(),
      serial_no: data ? Number(String(data).slice(-4)) : null,
    });
    toast.success("SKU generated");
  };

  const applyOverride = () => {
    if (!overrideSku.trim()) return toast.error("Enter the override SKU.");
    if (!reason.trim()) return toast.error("Reason required.");
    onChange({
      legacy_sku: value.sku ?? value.legacy_sku ?? null,
      sku: overrideSku.trim(),
      sku_locked: true,
      external_reference_code: reason.trim(),
    });
    setOverriding(false);
    setOverrideSku("");
    setReason("");
    toast.success("SKU overridden — remember to save.");
  };

  const applyManualSku = () => {
    const sku = manualSku.trim();
    if (!sku) return toast.error("Enter a SKU code.");
    onChange({
      sku,
      sku_locked: true,
      sku_generated_at: null,
    });
    setTypingIn(false);
    setManualSku("");
    toast.success("SKU set — remember to save.");
  };

  return (
    <div className="card-elevated p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-xl">SKU · System identity</h3>
        {value.sku_locked ? <Lock className="h-4 w-4 text-muted-foreground" /> : <Unlock className="h-4 w-4 text-warning" />}
      </div>

      <div className="rounded-lg bg-muted/50 p-3">
        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Current SKU</div>
        <div className="flex items-center gap-2">
          <code className="text-base font-mono flex-1 truncate">{value.sku ?? "Not generated yet"}</code>
          {value.sku && (
            <Button size="icon" variant="ghost" onClick={() => { navigator.clipboard.writeText(value.sku!); toast.success("Copied"); }}>
              <Copy className="h-4 w-4" />
            </Button>
          )}
        </div>
        {value.legacy_sku && <div className="text-[11px] text-muted-foreground mt-1">Legacy: <code>{value.legacy_sku}</code></div>}
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <Sel label="Division" value={value.division_code} options={by("division")} onChange={patchDivision} />
        <Sel label="Category" value={value.category_code} options={by("category")} onChange={patchCategory} />
        <Sel label="Subcategory" value={value.subcategory_code} options={subcategoryOptions} onChange={(v: string | null) => onChange({ subcategory_code: v })} />
        <Sel label="Packaging" value={value.packaging_code} options={packagingOptions} onChange={(v: string | null) => onChange({ packaging_code: v })} />
      </div>

      {taxonomyInvalid && (
        <p className="text-xs text-warning border border-warning/30 bg-warning/5 rounded-md px-2 py-1.5">
          {taxonomyInvalid}
        </p>
      )}

      <div className="text-xs text-muted-foreground">Preview: <code className="font-mono">{preview}</code></div>

      {rulesMissing && (
        <p className="text-xs text-warning border border-warning/30 bg-warning/5 rounded-md px-2 py-1.5">
          sku_code_rules table has no active rows — Generate SKU is disabled. You can still type a SKU manually below.
          {rulesError && (
            <span className="block mt-1 font-mono text-[10px] text-muted-foreground break-all">{rulesError}</span>
          )}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={generate} disabled={!ready || rulesMissing}>Generate SKU</Button>
        {!value.sku_locked && !typingIn && (
          <Button variant="outline" onClick={() => setTypingIn(true)}>Type SKU</Button>
        )}
        {canOverride && !overriding && value.sku_locked && (
          <Button variant="outline" onClick={() => setOverriding(true)}>Override SKU</Button>
        )}
      </div>

      {typingIn && (
        <div className="border rounded-lg p-3 space-y-2 bg-muted/20">
          <Input placeholder="Enter SKU code" value={manualSku} onChange={(e) => setManualSku(e.target.value)} />
          <div className="flex gap-2">
            <Button size="sm" onClick={applyManualSku}>Save SKU to form</Button>
            <Button size="sm" variant="ghost" onClick={() => { setTypingIn(false); setManualSku(""); }}>Cancel</Button>
          </div>
        </div>
      )}

      {overriding && (
        <div className="border rounded-lg p-3 space-y-2 bg-warning/5">
          <div className="flex gap-2 text-warning text-xs items-start">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>SKU is used across catalogue, labels, barcode, inventory and future integrations. Changing it may break external references.</span>
          </div>
          <Input placeholder="New SKU" value={overrideSku} onChange={(e) => setOverrideSku(e.target.value)} />
          <Input placeholder="Reason for override" value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="flex gap-2">
            <Button size="sm" onClick={applyOverride}>Apply override</Button>
            <Button size="sm" variant="ghost" onClick={() => setOverriding(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}
