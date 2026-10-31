import { BookOpen, Image, Wand2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { canAccessPage } from "@/lib/permissions";
import {
  canLeaveProductEditor,
  catalogueBuilderRoute,
  productCatalogueCopyRoute,
  productMediaRoute,
  UNSAVED_PRODUCT_LEAVE_MESSAGE,
} from "./productJourneyRoutes";

type Props = {
  productId: string;
  hasUnsavedChanges?: boolean;
};

/** Short, explicit product → photography → copy → collection journey. */
export function ProductJourneyActions({ productId, hasUnsavedChanges = false }: Props) {
  const { roles } = useAuth();
  const canOpenMedia = canAccessPage(roles, "media");
  const canOpenCatalogues = canAccessPage(roles, "catalogues");
  if (!canOpenMedia && !canOpenCatalogues) return null;

  const guardNavigation = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (
      !canLeaveProductEditor(hasUnsavedChanges, () => window.confirm(UNSAVED_PRODUCT_LEAVE_MESSAGE))
    ) {
      event.preventDefault();
    }
  };

  return (
    <div className="card-elevated p-6 space-y-3">
      <div>
        <h3 className="font-display text-xl">Next catalogue steps</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Keep this product identity while completing its images, catalogue copy and collection.
        </p>
      </div>
      <div className="grid gap-2">
        {canOpenMedia && (
          <Button asChild variant="outline" className="justify-start">
            <Link to={productMediaRoute(productId)} onClick={guardNavigation}>
              <Image className="mr-2 h-4 w-4" /> Manage product images
            </Link>
          </Button>
        )}
        {canOpenCatalogues && (
          <>
            <Button asChild variant="outline" className="justify-start">
              <Link to={productCatalogueCopyRoute(productId)} onClick={guardNavigation}>
                <Wand2 className="mr-2 h-4 w-4" /> Prepare catalogue copy
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link to={catalogueBuilderRoute(productId)} onClick={guardNavigation}>
                <BookOpen className="mr-2 h-4 w-4" /> Build a catalogue
              </Link>
            </Button>
          </>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Copy and collections remain approval-governed; these links do not publish or invent
        commercial facts.
      </p>
    </div>
  );
}
