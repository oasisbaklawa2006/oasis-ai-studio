import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type BasisProductCandidate,
  changeProductVariantBasis,
  createProductVariantRelationship,
  loadBasisProductSummary,
  loadProductVariantRelationship,
  type ProductVariantRow,
  removeProductVariantRelationship,
  searchBasisProductCandidates,
  updateProductVariantKey,
} from "@/features/productAuthority/productVariantRelationshipStore";

type Props = {
  /** null before the product itself has been saved — product_variants.product_id needs a real row. */
  productId: string | null;
  productSku: string | null;
  /** Called after every successful mutation so the surrounding form/read-only panel stay in sync. */
  onRelationshipChange?: (patch: {
    basis_product_id: string | null;
    variant_key: string | null;
  }) => void;
};

type Mode = "idle" | "picking_basis";

/**
 * Point 32 follow-up (#229) — the live editing surface for `product_variants`. Renders alongside
 * the read-only `ProductVariantHierarchyPanel`. Every write goes through
 * `productVariantRelationshipStore`, which is the only place Core's RLS/trigger contract is
 * exercised — never bypassed or shadowed here.
 */
export function ProductVariantRelationshipEditor({
  productId,
  productSku,
  onRelationshipChange,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [relationship, setRelationship] = useState<ProductVariantRow | null>(null);
  const [basisSummary, setBasisSummary] = useState<BasisProductCandidate | null>(null);

  const [mode, setMode] = useState<Mode>("idle");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<BasisProductCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [pendingBasis, setPendingBasis] = useState<BasisProductCandidate | null>(null);
  const [variantKeyDraft, setVariantKeyDraft] = useState("");
  const [inFlight, setInFlight] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const refresh = async (id: string) => {
    setLoading(true);
    setLoadError(null);
    const rel = await loadProductVariantRelationship(id);
    if (!rel.ok) {
      setLoadError(rel.message);
      setLoading(false);
      return;
    }
    setRelationship(rel.data);
    setVariantKeyDraft(rel.data?.variant_key ?? "");
    if (rel.data) {
      const basis = await loadBasisProductSummary(rel.data.basis_product_id);
      setBasisSummary(basis.ok ? basis.data : null);
    } else {
      setBasisSummary(null);
    }
    onRelationshipChange?.({
      basis_product_id: rel.data?.basis_product_id ?? null,
      variant_key: rel.data?.variant_key ?? null,
    });
    setLoading(false);
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: refresh() identity is stable in intent; only productId should retrigger the load
  useEffect(() => {
    if (!productId) {
      setRelationship(null);
      setBasisSummary(null);
      return;
    }
    void refresh(productId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const runSearch = async () => {
    setSearching(true);
    const res = await searchBasisProductCandidates(search, productId);
    setSearching(false);
    if (!res.ok) {
      toast.error(res.message);
      setSearchResults([]);
      return;
    }
    setSearchResults(res.data);
  };

  const startPicking = () => {
    setActionError(null);
    setSearch("");
    setSearchResults([]);
    setPendingBasis(null);
    setVariantKeyDraft(relationship?.variant_key ?? "");
    setMode("picking_basis");
  };

  const cancelPicking = () => {
    setMode("idle");
    setPendingBasis(null);
    setActionError(null);
  };

  const confirmBasisSelection = async () => {
    if (!productId || !productSku || !pendingBasis || inFlight) return;
    const variantKey = variantKeyDraft.trim();
    if (!variantKey) {
      setActionError("Variant key is required.");
      return;
    }
    setInFlight(true);
    setActionError(null);

    const result = relationship
      ? await changeProductVariantBasis({
          productId,
          productSku,
          newBasisProductId: pendingBasis.id,
          basisSku: pendingBasis.sku,
          variantKey,
        })
      : await createProductVariantRelationship({
          productId,
          productSku,
          basisProductId: pendingBasis.id,
          basisSku: pendingBasis.sku,
          variantKey,
        });

    setInFlight(false);

    if (!result.ok) {
      setActionError(result.message);
      toast.error(result.message);
      return;
    }

    toast.success("Variant relationship saved.");
    setMode("idle");
    setPendingBasis(null);
    await refresh(productId);
  };

  const saveVariantKeyOnly = async () => {
    if (!productId || !relationship || inFlight) return;
    const variantKey = variantKeyDraft.trim();
    if (!variantKey) {
      setActionError("Variant key is required.");
      return;
    }
    if (variantKey === relationship.variant_key) return;

    setInFlight(true);
    setActionError(null);
    const result = await updateProductVariantKey({
      productId,
      variantKey,
      expectedUpdatedAt: relationship.updated_at,
    });
    setInFlight(false);

    if (!result.ok) {
      setActionError(result.message);
      toast.error(result.message);
      return;
    }
    toast.success("Variant key updated.");
    await refresh(productId);
  };

  const removeRelationship = async () => {
    if (!productId || inFlight) return;
    setInFlight(true);
    setActionError(null);
    const result = await removeProductVariantRelationship(productId);
    setInFlight(false);

    if (!result.ok) {
      setActionError(result.message);
      toast.error(result.message);
      return;
    }
    toast.success("Variant relationship removed.");
    await refresh(productId);
  };

  if (!productId) {
    return (
      <div className="card-elevated p-4 text-xs text-muted-foreground">
        Save this product before linking it to a basis product — the relationship needs a saved
        product row.
      </div>
    );
  }

  return (
    <div className="card-elevated p-4 space-y-3">
      <h4 className="font-medium">Variant relationship (edit)</h4>

      {loading && <p className="text-xs text-muted-foreground">Loading relationship…</p>}

      {!loading && loadError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive space-y-2">
          <p>{loadError}</p>
          <Button size="sm" variant="outline" onClick={() => refresh(productId)}>
            Retry
          </Button>
        </div>
      )}

      {!loading && !loadError && mode === "idle" && (
        <div className="space-y-2 text-sm">
          {relationship ? (
            <>
              <div>
                <span className="font-medium text-foreground">Basis product:</span>{" "}
                {basisSummary
                  ? `${basisSummary.product_name} (${basisSummary.sku})`
                  : relationship.basis_product_id}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-foreground">Variant key:</span>
                <Input
                  className="h-8 w-48"
                  value={variantKeyDraft}
                  onChange={(e) => setVariantKeyDraft(e.target.value)}
                  disabled={inFlight}
                  aria-label="Variant key"
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={inFlight || !variantKeyDraft.trim()}
                  onClick={saveVariantKeyOnly}
                >
                  Save key
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button size="sm" variant="outline" disabled={inFlight} onClick={startPicking}>
                  Change basis product
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive"
                  disabled={inFlight}
                  onClick={removeRelationship}
                >
                  Remove relationship
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-muted-foreground">
                This product is not linked as a variant of another product.
              </p>
              <Button size="sm" disabled={inFlight || !productSku} onClick={startPicking}>
                Link to basis product
              </Button>
              {!productSku && (
                <p className="text-xs text-muted-foreground">
                  Assign a SKU to this product before creating a variant relationship.
                </p>
              )}
            </>
          )}
        </div>
      )}

      {mode === "picking_basis" && (
        <div className="space-y-2 text-sm">
          <div className="flex gap-2">
            <Input
              className="flex-1"
              placeholder="Search basis product by SKU or name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") runSearch();
              }}
              aria-label="Search basis product"
            />
            <Button size="sm" variant="outline" disabled={searching} onClick={runSearch}>
              {searching ? "Searching…" : "Search"}
            </Button>
          </div>

          {searchResults.length > 0 && (
            <ul className="max-h-40 overflow-auto rounded-md border border-border/60 divide-y divide-border/40">
              {searchResults.map((candidate) => (
                <li key={candidate.id}>
                  <button
                    type="button"
                    className={`w-full text-left px-2 py-1.5 text-xs hover:bg-accent/10 ${
                      pendingBasis?.id === candidate.id ? "bg-accent/15" : ""
                    }`}
                    onClick={() => setPendingBasis(candidate)}
                  >
                    {candidate.product_name}{" "}
                    <span className="text-muted-foreground">({candidate.sku})</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {pendingBasis && (
            <div className="rounded-md border border-border/60 p-2 space-y-2">
              <div>
                Selected basis: <span className="font-medium">{pendingBasis.product_name}</span>{" "}
                <span className="text-muted-foreground">({pendingBasis.sku})</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">Variant key:</span>
                <Input
                  className="h-8 w-48"
                  value={variantKeyDraft}
                  onChange={(e) => setVariantKeyDraft(e.target.value)}
                  aria-label="Variant key"
                  placeholder="e.g. size_500g"
                />
              </div>
            </div>
          )}

          {actionError && <p className="text-xs text-destructive">{actionError}</p>}

          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={!pendingBasis || !variantKeyDraft.trim() || inFlight}
              onClick={confirmBasisSelection}
            >
              {inFlight ? "Saving…" : relationship ? "Save new basis" : "Create relationship"}
            </Button>
            <Button size="sm" variant="ghost" disabled={inFlight} onClick={cancelPicking}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {mode === "idle" && actionError && <p className="text-xs text-destructive">{actionError}</p>}
    </div>
  );
}
