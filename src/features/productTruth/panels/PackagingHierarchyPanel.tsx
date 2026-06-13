import type { ProductTruthInput } from "../types";
import { calculateDispatchPackagingQty } from "../uomPackagingEngine";
import {
  formatPackagingValue,
  NOT_CONFIGURED,
  packagingFieldsFromForm,
} from "../packagingTruth";

type Props = {
  form: Record<string, unknown>;
  truthInput: ProductTruthInput;
};

export function PackagingHierarchyPanel({ form, truthInput }: Props) {
  const h = truthInput.packaging ?? {};
  const fields = packagingFieldsFromForm(form);
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
            {fields.moq.moqValue != null && fields.moq.moqUom
              ? `${fields.moq.moqValue} ${fields.moq.moqUom}`
              : NOT_CONFIGURED}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">MOQ increment</dt>
          <dd>
            {fields.moq.incrementValue != null && fields.moq.incrementUom
              ? `${fields.moq.incrementValue} ${fields.moq.incrementUom}`
              : NOT_CONFIGURED}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">MOQ rule type</dt>
          <dd>{formatPackagingValue(fields.moq.moqRuleType)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Carton type / UOM</dt>
          <dd>{formatPackagingValue(fields.cartonType)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Pcs per pack</dt>
          <dd>{formatPackagingValue(fields.pcsPerPack)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Pcs per carton</dt>
          <dd>{formatPackagingValue(fields.pcsPerCarton)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Packs per carton</dt>
          <dd>{formatPackagingValue(fields.packsPerCarton)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Pcs per master carton</dt>
          <dd>{formatPackagingValue(fields.pcsPerMasterCarton)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Packs / trays per master carton</dt>
          <dd>{formatPackagingValue(fields.packsPerMasterCarton)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Grams per piece</dt>
          <dd>{formatPackagingValue(fields.gramsPerPiece)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Pcs per kg</dt>
          <dd>{formatPackagingValue(fields.piecesPerKg)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Primary pack weight (kg)</dt>
          <dd>{formatPackagingValue(fields.primaryPackWeightKg)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Example dispatch (3 kg)</dt>
          <dd>{mc != null ? `${mc} master carton(s)` : NOT_CONFIGURED}</dd>
        </div>
      </dl>
    </div>
  );
}
