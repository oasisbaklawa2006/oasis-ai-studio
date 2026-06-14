import { lazy, Suspense, startTransition, useDeferredValue, useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ProductMediaRow } from "@/features/mediaReadiness/mediaAssetsFromForm";
import { AuthorityStatusBadges } from "@/components/catalogueAuthority/AuthorityStatusBadges";
import { evaluateProductReadiness, productTruthInputFromForm } from "./productReadiness";
import type { ProductReadinessResult } from "./productReadiness";
import type { ChannelMoqRule, ChannelPriceRecord, ProductTruthInput } from "./types";
import { ProductTruthPanelSkeleton } from "./ProductTruthTabSkeleton";

const ProductReadinessPanel = lazy(() =>
  import("./panels/ProductReadinessPanel").then((m) => ({ default: m.ProductReadinessPanel })),
);
const ProductLanguageTermsPanel = lazy(() =>
  import("./panels/ProductLanguageTermsPanel").then((m) => ({ default: m.ProductLanguageTermsPanel })),
);
const MediaReadinessPanel = lazy(() =>
  import("@/features/mediaReadiness/panels/MediaReadinessPanel").then((m) => ({
    default: m.MediaReadinessPanel,
  })),
);
const UomConversionPanel = lazy(() =>
  import("./panels/UomConversionPanel").then((m) => ({ default: m.UomConversionPanel })),
);
const PackagingHierarchyPanel = lazy(() =>
  import("./panels/PackagingHierarchyPanel").then((m) => ({ default: m.PackagingHierarchyPanel })),
);
const ChannelRulesPanel = lazy(() =>
  import("./panels/ChannelRulesPanel").then((m) => ({ default: m.ChannelRulesPanel })),
);
const PreviewCalculatorPanel = lazy(() =>
  import("./panels/PreviewCalculatorPanel").then((m) => ({ default: m.PreviewCalculatorPanel })),
);
const CentralSyncPreviewPanel = lazy(() =>
  import("@/features/catalogueSnapshot/panels/CentralSyncPreviewPanel").then((m) => ({
    default: m.CentralSyncPreviewPanel,
  })),
);

type Props = {
  form: Record<string, unknown>;
  productId?: string;
  productName?: string;
  onOpenAliasManager?: () => void;
  complianceMetaPending?: boolean;
  complianceApproved?: boolean;
  prices?: ChannelPriceRecord[];
  moqRules?: ChannelMoqRule[];
  productMediaRows?: ProductMediaRow[];
};

type TruthBundle = {
  truthInput: ProductTruthInput;
  readiness: ProductReadinessResult;
};

export function ProductTruthAdminSection({
  form,
  productId,
  productName = "",
  onOpenAliasManager,
  complianceMetaPending = false,
  complianceApproved = false,
  prices = [],
  moqRules = [],
  productMediaRows = [],
}: Props) {
  const [subTab, setSubTab] = useState("readiness");
  const [truthBundle, setTruthBundle] = useState<TruthBundle | null>(null);

  const deferredForm = useDeferredValue(form);
  const deferredPrices = useDeferredValue(prices);
  const deferredMoqRules = useDeferredValue(moqRules);
  const deferredProductMediaRows = useDeferredValue(productMediaRows);

  const inputsPending =
    deferredForm !== form ||
    deferredPrices !== prices ||
    deferredMoqRules !== moqRules ||
    deferredProductMediaRows !== productMediaRows;

  useEffect(() => {
    const input = productTruthInputFromForm(deferredForm, {
      complianceMetaPending,
      complianceApproved,
      isLegacy: !deferredForm.sku,
      prices: deferredPrices,
      moqRules: deferredMoqRules,
      productMediaRows: deferredProductMediaRows,
    });
    setTruthBundle({
      truthInput: input,
      readiness: evaluateProductReadiness(input),
    });
  }, [
    deferredForm,
    deferredPrices,
    deferredMoqRules,
    deferredProductMediaRows,
    complianceMetaPending,
    complianceApproved,
  ]);

  const handleSubTabChange = (value: string) => {
    startTransition(() => setSubTab(value));
  };

  const resolvedProductName = productName || String(form.product_name ?? form.name ?? "");
  const packaging = truthBundle?.truthInput.packaging ?? {};

  return (
    <div className="space-y-4">
      <div className="card-elevated p-4 space-y-2">
        <h3 className="font-display text-xl mb-1">Product Truth</h3>
        <p className="text-sm text-muted-foreground">
          Readiness, UOM/packaging rules, and channel pricing/MOQ validation for Catalogue master data.
        </p>
        <AuthorityStatusBadges
          show={{
            not_synced_to_central: true,
            central_live_write_disabled: true,
          }}
        />
      </div>

      <Tabs value={subTab} onValueChange={handleSubTabChange}>
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/40 p-1">
          <TabsTrigger value="readiness" className="text-xs">
            Readiness
          </TabsTrigger>
          <TabsTrigger value="language_terms" className="text-xs">
            Language
          </TabsTrigger>
          <TabsTrigger value="media_readiness" className="text-xs">
            Media
          </TabsTrigger>
          <TabsTrigger value="uom" className="text-xs">
            UOM
          </TabsTrigger>
          <TabsTrigger value="packaging" className="text-xs">
            Packaging
          </TabsTrigger>
          <TabsTrigger value="channels" className="text-xs">
            Channels
          </TabsTrigger>
          <TabsTrigger value="preview" className="text-xs">
            Preview
          </TabsTrigger>
          <TabsTrigger value="central_sync" className="text-xs">
            Central Sync
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mt-4">
        {subTab === "readiness" && (
          <Suspense fallback={<ProductTruthPanelSkeleton />}>
            {!truthBundle || inputsPending ? (
              <ProductTruthPanelSkeleton />
            ) : (
              <ProductReadinessPanel readiness={truthBundle.readiness} />
            )}
          </Suspense>
        )}

        {subTab === "language_terms" && productId && (
          <Suspense fallback={<ProductTruthPanelSkeleton />}>
            <ProductLanguageTermsPanel
              productId={productId}
              productName={resolvedProductName}
              onOpenAliasManager={onOpenAliasManager}
            />
          </Suspense>
        )}

        {subTab === "media_readiness" && (
          <Suspense fallback={<ProductTruthPanelSkeleton />}>
            <MediaReadinessPanel form={form} productMediaRows={productMediaRows} />
          </Suspense>
        )}

        {subTab === "uom" && (
          <Suspense fallback={<ProductTruthPanelSkeleton />}>
            {!truthBundle || inputsPending ? (
              <ProductTruthPanelSkeleton />
            ) : (
              <UomConversionPanel form={form} truthInput={truthBundle.truthInput} />
            )}
          </Suspense>
        )}

        {subTab === "packaging" && (
          <Suspense fallback={<ProductTruthPanelSkeleton />}>
            {!truthBundle || inputsPending ? (
              <ProductTruthPanelSkeleton />
            ) : (
              <PackagingHierarchyPanel form={form} truthInput={truthBundle.truthInput} />
            )}
          </Suspense>
        )}

        {subTab === "channels" && (
          <Suspense fallback={<ProductTruthPanelSkeleton />}>
            {!truthBundle || inputsPending ? (
              <ProductTruthPanelSkeleton />
            ) : (
              <ChannelRulesPanel prices={prices} moqRules={moqRules} packaging={packaging} />
            )}
          </Suspense>
        )}

        {subTab === "preview" && (
          <Suspense fallback={<ProductTruthPanelSkeleton />}>
            {!truthBundle || inputsPending ? (
              <ProductTruthPanelSkeleton />
            ) : (
              <PreviewCalculatorPanel packaging={packaging} moqRules={moqRules} />
            )}
          </Suspense>
        )}

        {subTab === "central_sync" && productId && (
          <Suspense fallback={<ProductTruthPanelSkeleton />}>
            <CentralSyncPreviewPanel
              form={form}
              productId={productId}
              complianceApproved={complianceApproved}
              complianceMetaPending={complianceMetaPending}
              prices={prices}
              moqRules={moqRules}
              productMediaRows={productMediaRows}
            />
          </Suspense>
        )}
      </div>

      {!productId && (
        <p className="text-xs text-muted-foreground">
          Save product to persist channel rules from Channels tab.
        </p>
      )}
    </div>
  );
}
