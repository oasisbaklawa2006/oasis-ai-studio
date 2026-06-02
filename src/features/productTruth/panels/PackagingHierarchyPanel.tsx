import { Label } from "@/components/ui/label";
import type { ProductTruthInput } from "../types";
import { calculateDispatchPackagingQty } from "../uomPackagingEngine";

type Props = {
  form: Record<string, unknown>;
  truthInput: ProductTruthInput;
};

export function PackagingHierarchyPanel({ form, truthInput }: Props) {
  const h = truthInput.packaging ?? {};
  const baseKg = 3;
  const mc = calculateDispatchPackagingQty(baseKg, "master_carton", h);

  return (
    <div className="card-elevated p-4 space-y-3">
      <h4 className="font-medium">Packaging hierarchy</h4>
      <p className="text-xs text-muted-foreground">
        Tray/carton rules from pack fields. Partial packs:{" "}
        {h.allowPartialPack ? "allowed" : "blocked"} · Partial cartons:{" "}
        {h.allowPartialCarton ? "allowed" : "blocked"}
      </p>
      <dl className="grid sm:grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-muted-foreground text-xs">Primary pack</dt>
          <dd>{String(form.primary_pack_type ?? "—")}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Qty per pack</dt>
          <dd>{String(form.qty_per_pack ?? form.pcs_per_pack ?? "—")}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Trays / master carton</dt>
          <dd>{String(h.traysPerMasterCarton ?? 8)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Example dispatch (3 kg)</dt>
          <dd>{mc != null ? `${mc} master carton(s)` : "—"}</dd>
        </div>
      </dl>
    </div>
  );
}
