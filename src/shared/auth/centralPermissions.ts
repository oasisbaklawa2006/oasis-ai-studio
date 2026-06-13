import { supabase } from "@/integrations/supabase/client";

export async function getMyRoleKeys(): Promise<string[]> {
  const { data, error } = await supabase.rpc("get_my_role_keys");

  if (error) {
    if (import.meta.env.DEV) {
      console.error("[CentralPermissions] get_my_role_keys failed:", error);
    }
    return [];
  }

  return Array.isArray(data) ? data.map(String) : [];
}

export async function hasPermission(permissionKey: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_catalogue_permission", {
    permission_key: permissionKey,
  });

  if (error) {
    if (import.meta.env.DEV) {
      console.error("[CentralPermissions] has_catalogue_permission failed:", {
        permissionKey,
        error,
      });
    }
    return false;
  }

  return !!data;
}

export async function isCatalogueReviewer(): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_catalogue_reviewer");

  if (error) {
    if (import.meta.env.DEV) {
      console.error("[CentralPermissions] is_catalogue_reviewer failed:", error);
    }
    return false;
  }

  return !!data;
}

export async function isCatalogueContributor(): Promise<boolean> {
  const roles = await getMyRoleKeys();
  return roles.includes("catalogue_contributor");
}

export async function isSuperAdmin(): Promise<boolean> {
  const roles = await getMyRoleKeys();
  return roles.includes("super_admin");
}

export async function canWriteMasterDirectly(): Promise<boolean> {
  return isSuperAdmin();
}

const PRODUCTS_DIRECT_WRITE_ROLES = ["super_admin", "owner", "admin", "product_manager"] as const;

/** Owner/admin/PM direct product master writes (permissions.ts products_write parity). */
export async function canWriteProductsDirectly(rolesFromContext?: string[]): Promise<boolean> {
  const roles = rolesFromContext ?? (await getMyRoleKeys());
  if (PRODUCTS_DIRECT_WRITE_ROLES.some((r) => roles.includes(r))) return true;
  return hasPermission("products_write");
}

export async function canSubmitDraft(permissionKey: string): Promise<boolean> {
  const contributor = await isCatalogueContributor();

  if (!contributor) {
    return false;
  }

  return hasPermission(permissionKey);
}
