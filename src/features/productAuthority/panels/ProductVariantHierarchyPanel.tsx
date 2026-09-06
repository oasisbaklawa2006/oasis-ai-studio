import {
  buildCanonicalProductVariantHierarchy,
  POINT_32_CORE_DEPENDENCIES,
} from "../productVariantHierarchyCanonical";

type Props = {
  form: Record<string, unknown>;
};

const PERSISTENCE_LABEL: Record<string, string> = {
  products_row: "products row",
  composition_only: "composition only (BOM/hamper)",
  core_blocked: "Core dependency",
};

export function ProductVariantHierarchyPanel({ form }: Props) {
  const canonical = buildCanonicalProductVariantHierarchy(form);

  return (
    <div className="card-elevated p-4 space-y-3">
      <h4 className="font-medium">Product / variant hierarchy (Point 32)</h4>
      <p className="text-xs text-muted-foreground">
        One sellable SKU per <code>products</code> row until Core variant schema ships. Pack/carton
        logistics remain Point 33 authority — never modelled as product variants here.
      </p>

      <dl className="grid sm:grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-muted-foreground text-xs">Scope</dt>
          <dd className="font-mono text-xs">{canonical.scope}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">SKU</dt>
          <dd>{canonical.sku ?? "—"}</dd>
        </div>
      </dl>

      <ol className="space-y-2 text-sm">
        {canonical.nodes.map((node) => (
          <li
            key={node.level}
            className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-b border-border/50 pb-2 last:border-0"
          >
            <span className="font-medium">{node.label}</span>
            {node.present ? (
              <span className="text-muted-foreground">
                {node.sku ?? node.productId ?? "present"}
                {node.variantKey ? ` · key ${node.variantKey}` : ""}
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
          Core gap (variant graph): {canonical.coreDependencies.join("; ")} — UI cannot persist
          variant parentage until oasis-supabase-core ships{" "}
          <code>product_variants</code> and basis-product refs.
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        Composition refs ({POINT_32_CORE_DEPENDENCIES.compositionSemantics.join("; ")}) are not
        sellable variant parentage.
      </p>
    </div>
  );
}
