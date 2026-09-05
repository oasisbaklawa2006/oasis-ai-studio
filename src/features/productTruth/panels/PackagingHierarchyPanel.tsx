import { buildCanonicalPackagingHierarchy } from "../packagingHierarchyCanonical";
import type { ProductTruthInput } from "../types";
import { calculateDispatchPackagingQty } from "../uomPackagingEngine";

type Props = {
  form: Record<string, unknown>;
  truthInput: ProductTruthInput;
};

const PERSISTENCE_LABEL: Record<string, string> = {
  products_row: "products row",
  form_only: "form only",
  snapshot_only: "snapshot only",
  core_blocked: "Core dependency",
};

export function PackagingHierarchyPanel({ form, truthInput }: Props) {
  const h = truthInput.packaging ?? {};
  const canonical = buildCanonicalPackagingHierarchy(form);
  const baseKg = 3;
  const mc = calculateDispatchPackagingQty(baseKg, "master_carton", h);

  return (
    <div className="card-elevated p-4 space-y-3">
      <h4 className="font-medium">Packaging hierarchy (Point 33)</h4>
      <p className="text-xs text-muted-foreground">
        Product SKU → sellable pack → case/carton → master carton → pallet (optional). Dimensions/CBM
        remain Point 35 authority.
      </p>

      <ol className="space-y-2 text-sm">
        {canonical.nodes.map((node) => (
          <li
            key={node.level}
            className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-b border-border/50 pb-2 last:border-0"
          >
            <span className="font-medium">{node.label}</span>
            {node.present ? (
              <span>
                {node.qtyPerParent != null ? `${node.qtyPerParent} ` : ""}
                {node.uom ?? "—"}
              </span>
            ) : (
              <span className="text-muted-foreground">not set</span>
            )}
            <span className="text-[10px] uppercase text-muted-foreground">
              {PERSISTENCE_LABEL[node.persistence] ?? node.persistence}
            </span>
          </li>
        ))}
      </ol>

      {canonical.validation.errors.length > 0 && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
          {canonical.validation.errors.join(" · ")}
        </div>
      )}
      {canonical.validation.warnings.length > 0 && (
        <div className="rounded-md border border-amber-400/40 bg-amber-500/5 p-2 text-xs text-amber-800 dark:text-amber-300">
          {canonical.validation.warnings.join(" · ")}
        </div>
      )}

      {canonical.coreDependencies.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Core gap (pallet): {canonical.coreDependencies.join(", ")} — UI cannot persist pallet
          quantities until Core Point 20 #201 clears schema authority.
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        Partial packs: {h.allowPartialPack ? "allowed" : "blocked"} · Partial cartons:{" "}
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
          <dd>{String(h.traysPerMasterCarton ?? "—")}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Example dispatch (3 kg)</dt>
          <dd>{mc != null ? `${mc} master carton(s)` : "—"}</dd>
        </div>
      </dl>
    </div>
  );
}
