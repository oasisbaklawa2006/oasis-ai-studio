import { useEffect, useState } from "react";
import { draftTableMap } from "@/features/catalogueDrafts/draftTableMap";
import type { Role } from "@/lib/permissions";
import {
  canSubmitDraft,
  canWriteMasterDirectly,
  isCatalogueContributor,
} from "@/shared/auth/centralPermissions";

export type BomWriteMode = "direct" | "draft" | "readonly";

export type BomPermissionChecks = {
  canWriteMasterDirectly: () => Promise<boolean>;
  isCatalogueContributor: () => Promise<boolean>;
  canSubmitDraft: (permission: string) => Promise<boolean>;
};

const DIRECT_BOM_ROLES: readonly Role[] = ["owner", "admin", "product_manager"];

/** UI projection only. Core row security and governed RPCs still authorize all BOM writes. */
export async function resolveBomWriteMode(
  roles: readonly Role[],
  checks: BomPermissionChecks = {
    canWriteMasterDirectly,
    isCatalogueContributor,
    canSubmitDraft,
  },
): Promise<BomWriteMode> {
  try {
    if (roles.some((role) => DIRECT_BOM_ROLES.includes(role))) return "direct";
    if (await checks.canWriteMasterDirectly()) return "direct";
    if (!(await checks.isCatalogueContributor())) return "readonly";
    return (await checks.canSubmitDraft(draftTableMap.bom.permission)) ? "draft" : "readonly";
  } catch {
    return "readonly";
  }
}

/** A previous identity or permission promise must never preserve or re-grant BOM edit UI. */
export function useBomWriteMode(userId: string | null, roles: readonly Role[]) {
  const identityKey = userId ? JSON.stringify([userId, ...roles]) : null;
  const [permission, setPermission] = useState<{
    identityKey: string | null;
    mode: BomWriteMode;
  }>({ identityKey: null, mode: "readonly" });

  useEffect(() => {
    let active = true;
    setPermission({ identityKey, mode: "readonly" });
    if (identityKey !== null) {
      void resolveBomWriteMode(roles).then((mode) => {
        if (active) setPermission({ identityKey, mode });
      });
    }
    return () => {
      active = false;
    };
  }, [identityKey]);

  const writeMode =
    identityKey !== null && permission.identityKey === identityKey
      ? permission.mode
      : "readonly";
  return { writeMode, canMutate: writeMode !== "readonly" };
}
