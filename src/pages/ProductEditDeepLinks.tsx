import { Navigate, useParams } from "react-router-dom";
import {
  productAliasesDeepLink,
  productMediaDeepLink,
} from "@/features/productAuthority/productEditDeepLinks";

function requireProductId(id: string | undefined): string | null {
  return id?.trim() ? id : null;
}

/** SCREEN #29 — `/products/:id/media` resolves to the Full Editor media tab. */
export function ProductMediaDeepLink() {
  const { id } = useParams<{ id: string }>();
  const productId = requireProductId(id);
  if (!productId) return <Navigate to="/products" replace />;
  return <Navigate to={productMediaDeepLink(productId)} replace />;
}

/** SCREEN #30 — `/products/:id/aliases` resolves to AliasManager on the identity tab. */
export function ProductAliasesDeepLink() {
  const { id } = useParams<{ id: string }>();
  const productId = requireProductId(id);
  if (!productId) return <Navigate to="/products" replace />;
  return <Navigate to={productAliasesDeepLink(productId)} replace />;
}
