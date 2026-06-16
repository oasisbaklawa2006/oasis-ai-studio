import { useState } from "react";
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
import { archiveProduct } from "@/features/productGovernance/productGovernanceService";
import { productGovernanceLabel } from "@/features/productGovernance/duplicateDetection";
import type { ProductGovernanceRow } from "@/features/productGovernance/types";
import { toast } from "sonner";

type Props = {
  product: ProductGovernanceRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onArchived?: () => void;
};

export function ArchiveProductDialog({
  product,
  open,
  onOpenChange,
  onArchived,
}: Props) {
  const [loading, setLoading] = useState(false);

  const handleArchive = async () => {
    if (!product?.id) return;
    setLoading(true);
    const res = await archiveProduct(product.id);
    setLoading(false);

    if (!res.ok) {
      toast.error(res.message);
      return;
    }

    toast.success("Product archived");
    onOpenChange(false);
    onArchived?.();
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Archive product</AlertDialogTitle>
          <AlertDialogDescription>
            Archive <span className="font-medium">{product ? productGovernanceLabel(product) : "this product"}</span>? It will become inactive and hidden from default Product Master searches.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <Button onClick={() => void handleArchive()} disabled={loading}>
            {loading ? "Archiving…" : "Archive product"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
