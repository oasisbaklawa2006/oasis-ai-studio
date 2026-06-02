import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductReadinessPanel } from "./panels/ProductReadinessPanel";
import { UomConversionPanel } from "./panels/UomConversionPanel";
import { PackagingHierarchyPanel } from "./panels/PackagingHierarchyPanel";
import { ChannelRulesPanel } from "./panels/ChannelRulesPanel";
import { PreviewCalculatorPanel } from "./panels/PreviewCalculatorPanel";
import { CentralSyncPreviewPanel } from "@/features/catalogueSnapshot/panels/CentralSyncPreviewPanel";
import { evaluateProductReadiness, productTruthInputFromForm } from "./productReadiness";
import type { ChannelMoqRule, ChannelPriceRecord } from "./types";

type Props = {
  form: Record<string, unknown>;
  productId?: string;
  complianceMetaPending?: boolean;
  complianceApproved?: boolean;
  prices?: ChannelPriceRecord[];
  moqRules?: ChannelMoqRule[];
};

export function ProductTruthAdminSection({
  form,
  productId,
  complianceMetaPending = false,
  complianceApproved = false,
  prices = [],
  moqRules = [],
}: Props) {
  const [subTab, setSubTab] = useState("readiness");

  const truthInput = useMemo(
    () =>
      productTruthInputFromForm(form, {
        complianceMetaPending,
        complianceApproved,
        isLegacy: !form.sku,
        prices,
        moqRules,
      }),
    [form, complianceMetaPending, complianceApproved, prices, moqRules],
  );

  const readiness = useMemo(() => evaluateProductReadiness(truthInput), [truthInput]);

  return (
    <div className="space-y-4">
      <div className="card-elevated p-4">
        <h3 className="font-display text-xl mb-1">Product Truth</h3>
        <p className="text-sm text-muted-foreground">
          Readiness, UOM/packaging rules, and channel pricing/MOQ validation for Catalogue master data.
        </p>
      </div>

      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/40 p-1">
          <TabsTrigger value="readiness" className="text-xs">Readiness</TabsTrigger>
          <TabsTrigger value="uom" className="text-xs">UOM</TabsTrigger>
          <TabsTrigger value="packaging" className="text-xs">Packaging</TabsTrigger>
          <TabsTrigger value="channels" className="text-xs">Channels</TabsTrigger>
          <TabsTrigger value="preview" className="text-xs">Preview</TabsTrigger>
          <TabsTrigger value="central_sync" className="text-xs">Central Sync</TabsTrigger>
        </TabsList>

        <TabsContent value="readiness" className="mt-4">
          <ProductReadinessPanel readiness={readiness} />
        </TabsContent>
        <TabsContent value="uom" className="mt-4">
          <UomConversionPanel form={form} truthInput={truthInput} />
        </TabsContent>
        <TabsContent value="packaging" className="mt-4">
          <PackagingHierarchyPanel form={form} truthInput={truthInput} />
        </TabsContent>
        <TabsContent value="channels" className="mt-4">
          <ChannelRulesPanel prices={prices} moqRules={moqRules} packaging={truthInput.packaging ?? {}} />
        </TabsContent>
        <TabsContent value="preview" className="mt-4">
          <PreviewCalculatorPanel packaging={truthInput.packaging ?? {}} moqRules={moqRules} />
        </TabsContent>
        {productId && (
          <TabsContent value="central_sync" className="mt-4">
            <CentralSyncPreviewPanel
              form={form}
              productId={productId}
              complianceApproved={complianceApproved}
              complianceMetaPending={complianceMetaPending}
              prices={prices}
              moqRules={moqRules}
            />
          </TabsContent>
        )}
      </Tabs>

      {!productId && (
        <p className="text-xs text-muted-foreground">Save product to persist channel rules from Channels tab.</p>
      )}
    </div>
  );
}
