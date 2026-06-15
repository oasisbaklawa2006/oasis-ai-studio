import { supabase } from "@/integrations/supabase/client";
import type { ExtendedDatabase } from "@/integrations/supabase/types.extensions";
import {
  assertLocalCatalogueFallbackWrite,
  isLocalCatalogueFallbackReadEnabled,
  isLocalCatalogueFallbackWriteEnabled,
} from "@/lib/catalogueAuthority/localStoragePolicy";
import {
  supabaseAuthorityErrorMessage,
  throwSupabaseAuthorityError,
} from "@/lib/catalogueAuthority/supabaseAuthorityError";
import {
  getVersionsPersistenceSource,
  setVersionsLoadFailure,
  setVersionsPersistenceSource,
} from "@/lib/catalogueAuthority/dataSource";
import { diagnoseSupabaseFailure } from "@/lib/supabase/diagnostics";
import {
  IMMUTABLE_VERSION_STATUSES,
  type CatalogueSnapshotJson,
  type CatalogueSyncEventRow,
  type CatalogueVersionRow,
  type CatalogueVersionStatus,
  type CentralSyncPreviewBundle,
} from "./types";

const STORAGE_PREFIX = "oasis_catalogue_versions_";
const EVENTS_PREFIX = "oasis_catalogue_sync_events_";

const authorityDb = supabase as unknown as import("@supabase/supabase-js").SupabaseClient<ExtendedDatabase>;

function storageKey(productId: string) {
  return `${STORAGE_PREFIX}${productId}`;
}

function eventsKey(productId: string) {
  return `${EVENTS_PREFIX}${productId}`;
}

function readLocalVersions(productId: string): CatalogueVersionRow[] {
  try {
    const raw = localStorage.getItem(storageKey(productId));
    if (!raw) return [];
    return JSON.parse(raw) as CatalogueVersionRow[];
  } catch {
    return [];
  }
}

function writeLocalVersions(productId: string, rows: CatalogueVersionRow[]) {
  assertLocalCatalogueFallbackWrite("catalogue versions");
  localStorage.setItem(storageKey(productId), JSON.stringify(rows));
}

function readLocalEvents(productId: string): CatalogueSyncEventRow[] {
  try {
    const raw = localStorage.getItem(eventsKey(productId));
    if (!raw) return [];
    return JSON.parse(raw) as CatalogueSyncEventRow[];
  } catch {
    return [];
  }
}

function writeLocalEvents(productId: string, rows: CatalogueSyncEventRow[]) {
  assertLocalCatalogueFallbackWrite("catalogue sync events");
  localStorage.setItem(eventsKey(productId), JSON.stringify(rows));
}

function newId(): string {
  return crypto.randomUUID();
}

export { getVersionsPersistenceSource, getVersionsLoadFailure } from "@/lib/catalogueAuthority/dataSource";

export function nextVersionNumber(existing: CatalogueVersionRow[]): number {
  if (!existing.length) return 1;
  return Math.max(...existing.map((v) => v.version_number)) + 1;
}

export function versionCodeFor(productId: string, versionNumber: number): string {
  const short = productId.replace(/-/g, "").slice(0, 8);
  return `PT-${short}-v${versionNumber}`;
}

export function isImmutableVersion(status: CatalogueVersionStatus): boolean {
  return IMMUTABLE_VERSION_STATUSES.includes(status);
}

export async function listCatalogueVersions(
  productId: string,
): Promise<CatalogueVersionRow[]> {
  try {
    const { data, error } = await authorityDb
      .from("catalogue_versions")
      .select("*")
      .eq("product_id", productId)
      .order("version_number", { ascending: false });

    if (!error) {
      setVersionsPersistenceSource(productId, "supabase");
      setVersionsLoadFailure(productId, null);
      return (data ?? []) as CatalogueVersionRow[];
    }
    setVersionsLoadFailure(productId, diagnoseSupabaseFailure(error, "catalogue_versions"));
  } catch (err) {
    setVersionsLoadFailure(
      productId,
      diagnoseSupabaseFailure(
        err instanceof Error ? { message: err.message } : { message: String(err) },
        "catalogue_versions",
      ),
    );
  }

  if (isLocalCatalogueFallbackReadEnabled()) {
    setVersionsPersistenceSource(productId, "local_only");
    return readLocalVersions(productId).sort((a, b) => b.version_number - a.version_number);
  }

  setVersionsPersistenceSource(productId, "supabase_unavailable");
  return [];
}

export async function createCatalogueVersionDraft(args: {
  productId: string;
  skuId?: string | null;
  snapshot: CatalogueSnapshotJson;
}): Promise<CatalogueVersionRow> {
  const existing = await listCatalogueVersions(args.productId);
  const versionNumber = nextVersionNumber(existing);
  const now = new Date().toISOString();
  const row: CatalogueVersionRow = {
    id: newId(),
    product_id: args.productId,
    sku_id: args.skuId ?? args.snapshot.catalogue_sku_id,
    version_code: versionCodeFor(args.productId, versionNumber),
    version_number: versionNumber,
    snapshot_json: args.snapshot,
    status: "draft",
    approved_by: null,
    approved_at: null,
    published_at: null,
    synced_to_central_at: null,
    created_at: now,
    updated_at: now,
  };

  try {
    const { data, error } = await authorityDb
      .from("catalogue_versions")
      .insert({
        product_id: row.product_id,
        sku_id: row.sku_id,
        version_code: row.version_code,
        version_number: row.version_number,
        snapshot_json: row.snapshot_json,
        status: row.status,
      })
      .select("*")
      .single();

    if (!error && data) {
      setVersionsPersistenceSource(args.productId, "supabase");
      return data as CatalogueVersionRow;
    }
    if (error) {
      if (!isLocalCatalogueFallbackWriteEnabled()) {
        throwSupabaseAuthorityError("createCatalogueVersionDraft", error);
      }
    }
  } catch (err) {
    if (!isLocalCatalogueFallbackWriteEnabled()) {
      throw err instanceof Error && err.message.includes("createCatalogueVersionDraft")
        ? err
        : new Error(supabaseAuthorityErrorMessage("createCatalogueVersionDraft", err));
    }
  }

  assertLocalCatalogueFallbackWrite("createCatalogueVersionDraft");
  const local = readLocalVersions(args.productId);
  local.push(row);
  writeLocalVersions(args.productId, local);
  setVersionsPersistenceSource(args.productId, "local_only");
  return row;
}

export async function approveCatalogueVersion(args: {
  productId: string;
  versionId: string;
  approvedBy?: string | null;
}): Promise<{ ok: boolean; row?: CatalogueVersionRow; message: string }> {
  const versions = await listCatalogueVersions(args.productId);
  const current = versions.find((v) => v.id === args.versionId);
  if (!current) return { ok: false, message: "Version not found" };

  if (isImmutableVersion(current.status)) {
    return { ok: false, message: "Approved snapshots are immutable" };
  }

  const now = new Date().toISOString();
  const updated: CatalogueVersionRow = {
    ...current,
    status: "approved",
    approved_by: args.approvedBy ?? null,
    approved_at: now,
    published_at: now,
    updated_at: now,
  };

  try {
    const { data, error } = await authorityDb
      .from("catalogue_versions")
      .update({
        status: updated.status,
        approved_by: updated.approved_by,
        approved_at: updated.approved_at,
        published_at: updated.published_at,
        updated_at: updated.updated_at,
      })
      .eq("id", args.versionId)
      .select("*")
      .single();

    if (!error && data) {
      setVersionsPersistenceSource(args.productId, "supabase");
      return { ok: true, row: data as CatalogueVersionRow, message: "Version approved" };
    }
    if (error && !isLocalCatalogueFallbackWriteEnabled()) {
      return {
        ok: false,
        message: supabaseAuthorityErrorMessage("approveCatalogueVersion", error),
      };
    }
  } catch (err) {
    if (!isLocalCatalogueFallbackWriteEnabled()) {
      return {
        ok: false,
        message: supabaseAuthorityErrorMessage("approveCatalogueVersion", err),
      };
    }
  }

  try {
    assertLocalCatalogueFallbackWrite("approveCatalogueVersion");
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "Local catalogue fallback is disabled for this action.",
    };
  }

  const local = readLocalVersions(args.productId);
  const localIdx = local.findIndex((v) => v.id === args.versionId);
  if (localIdx < 0) return { ok: false, message: "Version not found locally" };
  local[localIdx] = updated;
  writeLocalVersions(args.productId, local);
  setVersionsPersistenceSource(args.productId, "local_only");
  return { ok: true, row: updated, message: "Version approved (local only — not authoritative)" };
}

/**
 * Mutating snapshot_json on immutable versions is forbidden.
 */
export async function updateCatalogueVersionSnapshot(args: {
  productId: string;
  versionId: string;
  snapshot: CatalogueSnapshotJson;
}): Promise<{ ok: boolean; message: string }> {
  const versions = await listCatalogueVersions(args.productId);
  const row = versions.find((v) => v.id === args.versionId);
  if (!row) return { ok: false, message: "Version not found" };
  if (isImmutableVersion(row.status)) {
    return { ok: false, message: "Cannot mutate an approved/published/synced snapshot" };
  }

  const updated: CatalogueVersionRow = {
    ...row,
    snapshot_json: args.snapshot,
    updated_at: new Date().toISOString(),
  };

  try {
    const { error } = await authorityDb
      .from("catalogue_versions")
      .update({
        snapshot_json: updated.snapshot_json,
        updated_at: updated.updated_at,
      })
      .eq("id", args.versionId);

    if (!error) {
      setVersionsPersistenceSource(args.productId, "supabase");
      return { ok: true, message: "Draft snapshot updated" };
    }
    if (error && !isLocalCatalogueFallbackWriteEnabled()) {
      return {
        ok: false,
        message: supabaseAuthorityErrorMessage("updateCatalogueVersionSnapshot", error),
      };
    }
  } catch (err) {
    if (!isLocalCatalogueFallbackWriteEnabled()) {
      return {
        ok: false,
        message: supabaseAuthorityErrorMessage("updateCatalogueVersionSnapshot", err),
      };
    }
  }

  try {
    assertLocalCatalogueFallbackWrite("updateCatalogueVersionSnapshot");
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "Local catalogue fallback is disabled for this action.",
    };
  }

  const local = readLocalVersions(args.productId);
  const localIdx = local.findIndex((v) => v.id === args.versionId);
  if (localIdx >= 0) {
    local[localIdx] = updated;
    writeLocalVersions(args.productId, local);
    setVersionsPersistenceSource(args.productId, "local_only");
  }

  return { ok: true, message: "Draft snapshot updated (local only — not authoritative)" };
}

export async function recordSyncPreviewEvent(args: {
  productId: string;
  catalogueVersionId: string;
  bundle: CentralSyncPreviewBundle;
  triggeredBy?: string | null;
}): Promise<CatalogueSyncEventRow> {
  const event: CatalogueSyncEventRow = {
    id: newId(),
    catalogue_version_id: args.catalogueVersionId,
    target_system: "oasis_central",
    sync_status: "preview_only",
    payload_json: args.bundle,
    error_message: null,
    triggered_by: args.triggeredBy ?? null,
    triggered_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await authorityDb
      .from("catalogue_sync_events")
      .insert({
        catalogue_version_id: event.catalogue_version_id,
        target_system: event.target_system,
        sync_status: event.sync_status,
        payload_json: event.payload_json,
        triggered_by: event.triggered_by,
      })
      .select("*")
      .single();

    if (!error && data) {
      setVersionsPersistenceSource(args.productId, "supabase");
      return data as CatalogueSyncEventRow;
    }
    if (error && !isLocalCatalogueFallbackWriteEnabled()) {
      throwSupabaseAuthorityError("recordSyncPreviewEvent", error);
    }
  } catch (err) {
    if (!isLocalCatalogueFallbackWriteEnabled()) {
      throw err instanceof Error && err.message.includes("recordSyncPreviewEvent")
        ? err
        : new Error(supabaseAuthorityErrorMessage("recordSyncPreviewEvent", err));
    }
  }

  try {
    assertLocalCatalogueFallbackWrite("recordSyncPreviewEvent");
  } catch {
    setVersionsPersistenceSource(args.productId, "supabase_unavailable");
    return event;
  }

  const events = readLocalEvents(args.productId);
  events.unshift(event);
  writeLocalEvents(args.productId, events.slice(0, 50));
  setVersionsPersistenceSource(args.productId, "local_only");
  return event;
}

export async function listSyncPreviewEvents(
  productId: string,
): Promise<CatalogueSyncEventRow[]> {
  try {
    const versions = await listCatalogueVersions(productId);
    const versionIds = versions.map((v) => v.id);
    if (!versionIds.length) {
      return isLocalCatalogueFallbackReadEnabled() ? readLocalEvents(productId) : [];
    }

    const { data, error } = await authorityDb
      .from("catalogue_sync_events")
      .select("*")
      .in("catalogue_version_id", versionIds)
      .order("triggered_at", { ascending: false });

    if (!error) {
      return (data ?? []) as CatalogueSyncEventRow[];
    }
  } catch {
    /* fall through */
  }

  return isLocalCatalogueFallbackReadEnabled() ? readLocalEvents(productId) : [];
}

export function getHeadVersion(versions: CatalogueVersionRow[]): CatalogueVersionRow | null {
  if (!versions.length) return null;
  return versions.reduce((a, b) => (a.version_number >= b.version_number ? a : b));
}
