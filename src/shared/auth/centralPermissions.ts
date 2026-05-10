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

export async function canSubmitDraft(permissionKey: string): Promise<boolean> {
  const contributor = await isCatalogueContributor();

  if (!contributor) {
    return false;
  }

  return hasPermission(permissionKey);
}
