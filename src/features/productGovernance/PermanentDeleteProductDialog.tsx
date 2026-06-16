import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  assessProductDeleteEligibility,
  permanentDeleteConfirmationPhrase,
  permanentlyDeleteProduct,
} from "@/features/productGovernance/productGovernanceService";
import type { ProductGovernanceRow } from "@/features/productGovernance/types";
import { productGovernanceLabel } from "@/features/productGovernance/duplicateDetection";
import { toast } from "sonner";

type Props = {
  product: ProductGovernanceRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
};

export function PermanentDeleteProductDialog({
  product,
  open,
  onOpenChange,
  onDeleted,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [blockers, setBlockers] = useState<string[]>([]);
  const [eligible, setEligible] = useState(false);

  const sku = product?.sku?.trim() ?? "";
  const phrase = sku ? permanentDeleteConfirmationPhrase(sku) : "";

  useEffect(() => {
    if (!open || !product?.id) {
      setConfirmText("");
      setBlockers([]);
      setEligible(false);
      return;
    }

    let cancelled = false;
    setChecking(true);
    void assessProductDeleteEligibility(product.id).then((assessment) => {
      if (cancelled) return;
      setBlockers(assessment.blockers);
      setEligible(assessment.eligible);
      setChecking(false);
    });

    return () => {
      cancelled = true;
    };
  }, [open, product?.id]);

  const canConfirm = eligible && confirmText === phrase && !loading;

  const handleDelete = async () => {
    if (!product?.id || !canConfirm) return;
    setLoading(true);
    const res = await permanentlyDeleteProduct(product.id);
    setLoading(false);

    if (!res.ok) {
      if (res.blockers?.length) setBlockers(res.blockers);
      toast.error(res.message);
      return;
    }

    toast.success(`Permanently deleted ${product.sku ?? "product"}`);
    onOpenChange(false);
    onDeleted?.();
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete permanently</AlertDialogTitle>
          <AlertDialogDescription>
            This removes <span className="font-medium">{product ? productGovernanceLabel(product) : "this product"}</span> from Product Master. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            SUPER_ADMIN only. Allowed when the product is draft, never synced to Central, and has no catalogue, label, inventory, or order references.
          </p>

          {checking ? (
            <p className="text-muted-foreground">Checking delete safeguards…</p>
          ) : blockers.length > 0 ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
              <p className="font-medium text-destructive mb-1">Blocked</p>
              <ul className="list-disc pl-4 space-y-0.5 text-destructive/90">
                {blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-success">All delete safeguards passed.</p>
          )}

          {eligible && sku && (
            <div className="space-y-2">
              <Label htmlFor="delete-confirm">
                Type <span className="font-mono font-medium">{phrase}</span> to confirm
              </Label>
              <Input
                id="delete-confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={phrase}
                autoComplete="off"
                className="font-mono"
              />
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={!canConfirm}
            onClick={() => void handleDelete()}
          >
            {loading ? "Deleting…" : "Delete permanently"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
