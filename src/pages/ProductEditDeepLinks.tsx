import { Navigate, useParams } from "react-router-dom";
import { resolveFullEditorIdentity } from "@/features/productAuthority/fullEditorArchitecture";
import {
  productAliasesDeepLink,
  productMediaDeepLink,
} from "@/features/productAuthority/productEditDeepLinks";

function requireProductId(id: string | undefined): string | null {
  const identity = resolveFullEditorIdentity(id);
  return identity.kind === "edit" ? identity.productId : null;
}

/** SCREEN #29 — canonical media deep link redirects to the Full Editor media tab. */
export function ProductMediaDeepLink() {
  const { id } = useParams<{ id: string }>();
  const productId = requireProductId(id);
  if (!productId) return <Navigate to="/products" replace />;
  return <Navigate to={productMediaDeepLink(productId)} replace />;
}

/** SCREEN #30 — canonical aliases deep link redirects to AliasManager on the identity tab. */
export function ProductAliasesDeepLink() {
  const { id } = useParams<{ id: string }>();
  const productId = requireProductId(id);
  if (!productId) return <Navigate to="/products" replace />;
  return <Navigate to={productAliasesDeepLink(productId)} replace />;
}
