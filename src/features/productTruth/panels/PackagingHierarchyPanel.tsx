import type { ProductTruthInput } from "../types";
import { calculateDispatchPackagingQty } from "../uomPackagingEngine";
import { formatPackagingValue, NOT_CONFIGURED, productMoqFromForm } from "../packagingTruth";

type Props = {
  form: Record<string, unknown>;
  truthInput: ProductTruthInput;
};

export function PackagingHierarchyPanel({ form, truthInput }: Props) {
  const h = truthInput.packaging ?? {};
  const moq = productMoqFromForm(form);
  const mc =
    h.traysPerMasterCarton != null && h.kgPerTray != null
      ? calculateDispatchPackagingQty(3, "master_carton", h)
      : null;

  return (
    <div className="card-elevated p-4 space-y-3">
      <h4 className="font-medium">Packaging hierarchy</h4>
      <p className="text-xs text-muted-foreground">
        Values from Product Edit UOM tab (persisted products row). Partial packs:{" "}
        {h.allowPartialPack ? "allowed" : "blocked"} · Partial cartons:{" "}
        {h.allowPartialCarton ? "allowed" : "blocked"}
      </p>
      <dl className="grid sm:grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-muted-foreground text-xs">Product MOQ</dt>
          <dd>
            {moq.moqValue != null && moq.moqUom
              ? `${moq.moqValue} ${moq.moqUom}`
              : NOT_CONFIGURED}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">MOQ increment</dt>
          <dd>
            {moq.incrementValue != null && moq.incrementUom
              ? `${moq.incrementValue} ${moq.incrementUom}`
              : NOT_CONFIGURED}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Primary pack</dt>
          <dd>{formatPackagingValue(form.primary_pack_type as string | null)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Qty per pack</dt>
          <dd>{formatPackagingValue((form.qty_per_pack ?? form.pcs_per_pack) as string | number | null)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Pieces per kg</dt>
          <dd>{formatPackagingValue(h.piecesPerKg)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Grams per piece</dt>
          <dd>{formatPackagingValue(h.gramsPerPiece)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Trays / master carton</dt>
          <dd>{formatPackagingValue(h.traysPerMasterCarton)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Kg per tray</dt>
          <dd>{formatPackagingValue(h.kgPerTray)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Example dispatch (3 kg)</dt>
          <dd>{mc != null ? `${mc} master carton(s)` : NOT_CONFIGURED}</dd>
        </div>
      </dl>
    </div>
  );
}
