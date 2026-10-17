import { supabase } from "@/integrations/supabase/client";

async function getMyRoleKeys(): Promise<string[]> {
  try {
    const { data, error } = await supabase.rpc("get_my_role_keys");

    if (error) {
      if (import.meta.env.DEV) {
        console.error("[CentralPermissions] get_my_role_keys failed:", error);
      }
      return [];
    }

    return Array.isArray(data) ? data.map(String) : [];
  } catch {
    return [];
  }
}

export async function hasPermission(permissionKey: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("has_catalogue_permission", {
      p_permission_key: permissionKey,
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

    return data === true;
  } catch {
    return false;
  }
}

/**
 * The single governed resolver for catalogue-review authority (Core `is_catalogue_reviewer()`
 * RPC). Both approval-surface navigation and page access must consume this — never a
 * client-side role check — so they can't diverge (#228). Fails closed on any RPC error or
 * thrown/rejected call.
 */
export async function isCatalogueReviewer(): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("is_catalogue_reviewer");

    if (error) {
      if (import.meta.env.DEV) {
        console.error("[CentralPermissions] is_catalogue_reviewer failed:", error);
      }
      return false;
    }

    return !!data;
  } catch (error) {
    // Fail closed on network loss / thrown client errors, not just RPC-reported errors —
    // this resolver gates both approval-surface navigation and page access (#228).
    if (import.meta.env.DEV) {
      console.error("[CentralPermissions] is_catalogue_reviewer threw:", error);
    }
    return false;
  }
}

export async function isCatalogueContributor(): Promise<boolean> {
  const roles = await getMyRoleKeys();
  return roles.includes("catalogue_contributor");
}

export async function isSuperAdmin(): Promise<boolean> {
  const roles = await getMyRoleKeys();
  return roles.includes("super_admin");
}

/**
 * The production `products` and `product_media` write RLS policies use
 * `public.is_admin()`, which checks active `public.users.role` admin/super_admin.
 * A frontend role-map key, or the unrelated `products_write` permission, does
 * not prove that those RLS policies will accept a direct write.
 */
export async function canWriteProductsDirectly(_rolesFromContext?: string[]): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("is_admin");
    if (error) {
      if (import.meta.env.DEV) {
        console.error("[CentralPermissions] products is_admin authority probe failed:", error);
      }
      return false;
    }
    return data === true;
  } catch {
    return false;
  }
}

/** Direct media writes share the same production RLS authority as product writes. */
export async function canWriteMasterDirectly(): Promise<boolean> {
  return canWriteProductsDirectly();
}

export async function canSubmitDraft(permissionKey: string): Promise<boolean> {
  const contributor = await isCatalogueContributor();

  if (!contributor) {
    return false;
  }

  return hasPermission(permissionKey);
}
