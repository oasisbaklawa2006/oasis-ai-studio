import {
  approveCatalogueVersion,
  createCatalogueVersionDraft,
  getHeadVersion,
  isImmutableVersion,
  listCatalogueVersions,
  listSyncPreviewEvents,
  recordSyncPreviewEvent,
  updateCatalogueVersionSnapshot,
} from "./catalogueVersionStore";
import { buildCentralSyncPreviewBundle, LIVE_CENTRAL_WRITE_ENABLED } from "./centralSyncPayload";
import { generateCatalogueSnapshot } from "./snapshotGenerator";
import { validateSnapshotGateWithMedia } from "./snapshotValidation";
import type {
  CatalogueSnapshotJson,
  CatalogueVersionRow,
  CentralSyncPreviewBundle,
  SnapshotGeneratorInput,
} from "./types";

export type PreviewCentralSyncResult = {
  bundle: CentralSyncPreviewBundle;
  versionId: string;
  liveWriteAttempted: false;
};

async function persistCatalogueDraftSnapshot(args: {
  productId: string;
  snapshot: CatalogueSnapshotJson;
}): Promise<CatalogueVersionRow> {
  const versions = await listCatalogueVersions(args.productId);
  const head = getHeadVersion(versions);
  const mutableHead = head && !isImmutableVersion(head.status) ? head : null;

  if (!mutableHead) {
    return await createCatalogueVersionDraft({
      productId: args.productId,
      snapshot: args.snapshot,
    });
  }

  const updated = await updateCatalogueVersionSnapshot({
    productId: args.productId,
    versionId: mutableHead.id,
    snapshot: args.snapshot,
  });
  if (!updated.ok) {
    throw new Error(updated.message);
  }

  return {
    ...mutableHead,
    snapshot_json: args.snapshot,
    updated_at: new Date().toISOString(),
  };
}

export async function prepareCatalogueVersionDraft(
  input: SnapshotGeneratorInput,
): Promise<{ versionId: string; snapshot: CatalogueSnapshotJson }> {
  const snapshot = generateCatalogueSnapshot(input);
  const versionRow = await persistCatalogueDraftSnapshot({
    productId: input.productId,
    snapshot,
  });
  return { versionId: versionRow.id, snapshot };
}

/**
 * Builds Central 25B/25C preview payload only — never POSTs to Oasis Central.
 */
export async function previewCentralSync(
  input: SnapshotGeneratorInput,
): Promise<PreviewCentralSyncResult> {
  if (LIVE_CENTRAL_WRITE_ENABLED) {
    throw new Error("Live Central sync is disabled in AI Studio preview mode");
  }

  const snapshot = generateCatalogueSnapshot(input);
  const validation = validateSnapshotGateWithMedia(snapshot.readiness, snapshot, {
    complianceManuallyApproved: !!input.complianceApproved && !input.complianceMetaPending,
  });

  const versionRow = await persistCatalogueDraftSnapshot({
    productId: input.productId,
    snapshot,
  });

  const bundle = buildCentralSyncPreviewBundle({
    snapshot,
    catalogueVersionId: versionRow.id,
    versionCode: versionRow.version_code,
    versionNumber: versionRow.version_number,
    validation,
  });

  await recordSyncPreviewEvent({
    productId: input.productId,
    catalogueVersionId: versionRow.id,
    bundle,
    triggeredBy: input.approvedBy ?? null,
  });

  return {
    bundle,
    versionId: versionRow.id,
    liveWriteAttempted: false,
  };
}

export async function approveAndPreviewCentralSync(
  input: SnapshotGeneratorInput,
): Promise<{ preview: PreviewCentralSyncResult; approveMessage: string }> {
  const snapForGate = generateCatalogueSnapshot(input);
  const gate = validateSnapshotGateWithMedia(snapForGate.readiness, snapForGate, {
    complianceManuallyApproved: !!input.complianceApproved && !input.complianceMetaPending,
  });

  if (!gate.allowed) {
    const snapshot = generateCatalogueSnapshot(input);
    const versions = await listCatalogueVersions(input.productId);
    const head = getHeadVersion(versions);
    const versionRow =
      head ??
      (await createCatalogueVersionDraft({
        productId: input.productId,
        snapshot,
      }));

    const bundle = buildCentralSyncPreviewBundle({
      snapshot,
      catalogueVersionId: versionRow.id,
      versionCode: versionRow.version_code,
      versionNumber: versionRow.version_number,
      validation: gate,
    });

    await recordSyncPreviewEvent({
      productId: input.productId,
      catalogueVersionId: versionRow.id,
      bundle,
      triggeredBy: input.approvedBy ?? null,
    });

    return {
      preview: {
        bundle,
        versionId: versionRow.id,
        liveWriteAttempted: false,
      },
      approveMessage: "Snapshot blocked — resolve validation blockers before approval",
    };
  }

  const preview = await previewCentralSync(input);
  const approved = await approveCatalogueVersion({
    productId: input.productId,
    versionId: preview.versionId,
    approvedBy: input.approvedBy ?? null,
  });

  return {
    preview,
    approveMessage: approved.message,
  };
}

export { LIVE_CENTRAL_WRITE_ENABLED, listCatalogueVersions, listSyncPreviewEvents };
