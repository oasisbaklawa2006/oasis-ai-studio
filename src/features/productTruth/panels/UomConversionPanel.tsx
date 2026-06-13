import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProductTruthInput } from "../types";
import { describeConversion, validateConversionRuleChain } from "../uomPackagingEngine";

type Props = {
  form: Record<string, unknown>;
  truthInput: ProductTruthInput;
};

export function UomConversionPanel({ form, truthInput }: Props) {
  const hierarchy = truthInput.packaging ?? {};
  const chain = validateConversionRuleChain(hierarchy);

  return (
    <div className="card-elevated p-4 space-y-4">
      <div>
        <h4 className="font-medium">UOM conversion</h4>
        <p className="text-xs text-muted-foreground">
          Derived from product form (pieces/kg, pack fields). Edit on UOM tab.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 text-sm">
        <div>
          <Label className="text-xs">Primary UOM</Label>
          <Input readOnly value={String(form.primary_uom ?? "—")} className="h-8 text-xs" />
        </div>
        <div>
          <Label className="text-xs">Retail / B2B UOM</Label>
          <Input
            readOnly
            value={`${form.retail_uom ?? "—"} / ${form.b2b_uom ?? "—"}`}
            className="h-8 text-xs"
          />
        </div>
        <div>
          <Label className="text-xs">Pieces per kg</Label>
          <Input readOnly value={String(hierarchy.piecesPerKg ?? "—")} className="h-8 text-xs" />
        </div>
        <div>
          <Label className="text-xs">Kg per tray</Label>
          <Input readOnly value={String(hierarchy.kgPerTray ?? 1)} className="h-8 text-xs" />
        </div>
      </div>

      {!chain.valid && (
        <p className="text-xs text-destructive">{chain.messages.join(" · ")}</p>
      )}

      <div className="rounded border p-3 bg-muted/20 text-xs space-y-1">
        <div className="font-medium">Quick examples</div>
        <p>{describeConversion(40, "pcs", hierarchy)}</p>
        <p>{describeConversion(120, "pcs", hierarchy)}</p>
        <p>{describeConversion(3, "kg", hierarchy)}</p>
      </div>
    </div>
  );
}
