import { Archive, Copy, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isSuperAdmin } from "@/shared/auth/centralPermissions";
import { ArchiveProductDialog } from "./ArchiveProductDialog";
import { PermanentDeleteProductDialog } from "./PermanentDeleteProductDialog";
import { PRODUCT_ARCHIVE_AVAILABLE, PRODUCT_DELETE_AVAILABLE } from "./productGovernanceService";
import type { ProductGovernanceRow } from "./types";

type Props = {
  product: ProductGovernanceRow;
  onChanged?: () => void;
  className?: string;
};

export function ProductActionsMenu({ product, onChanged, className }: Props) {
  const navigate = useNavigate();
  const [superAdmin, setSuperAdmin] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    void isSuperAdmin().then((v) => {
      if (mounted) setSuperAdmin(v);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const isArchived = !!product.archived_at;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={className ?? "h-8 w-8 shrink-0"}
            aria-label="Product actions"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              navigate(`/products/${product.id}`);
            }}
          >
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              navigate(`/products/new?duplicateFrom=${product.id}`);
            }}
          >
            <Copy className="h-4 w-4 mr-2" />
            Duplicate
          </DropdownMenuItem>
          {!isArchived && (
            <DropdownMenuItem
              disabled={!PRODUCT_ARCHIVE_AVAILABLE}
              title="Core archive capability is not available"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setArchiveOpen(true);
              }}
            >
              <Archive className="h-4 w-4 mr-2" />
              Archive
            </DropdownMenuItem>
          )}
          {superAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                disabled={!PRODUCT_DELETE_AVAILABLE}
                title="Core deletion capability is not available"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDeleteOpen(true);
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete permanently
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ArchiveProductDialog
        product={product}
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        onArchived={onChanged}
      />
      <PermanentDeleteProductDialog
        product={product}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={onChanged}
      />
    </>
  );
}
