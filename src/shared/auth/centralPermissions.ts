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
 * Core #474 product and product_media INSERT/UPDATE RLS uses
 * public.can_write_product_master(), including explicitly approved uppercase
 * SUPER_ADMIN Product Master authors. Do not use legacy is_admin() here:
 * it recognizes lowercase roles only and incorrectly traps approved Owners
 * in read-only mode. Never infer authority from frontend roles; fail closed.
 * Hard delete, pricing and publication remain separate Core authorities.
 */
export async function canWriteProductsDirectly(_rolesFromContext?: string[]): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("can_write_product_master");
    if (error) {
      if (import.meta.env.DEV) {
        console.error("[CentralPermissions] can_write_product_master authority probe failed:", error);
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
