import { LIVE_CENTRAL_WRITE_ENABLED, buildCentralSyncPreviewBundle } from "./centralSyncPayload";
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
import { generateCatalogueSnapshot } from "./snapshotGenerator";
import { validateSnapshotGate } from "./snapshotValidation";
import type { CentralSyncPreviewBundle, SnapshotGeneratorInput } from "./types";

export type PreviewCentralSyncResult = {
  bundle: CentralSyncPreviewBundle;
  versionId: string;
  liveWriteAttempted: false;
};

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
  const validation = validateSnapshotGate(snapshot.readiness, {
    complianceManuallyApproved: !!input.complianceApproved && !input.complianceMetaPending,
  });

  const versions = await listCatalogueVersions(input.productId);
  const head = getHeadVersion(versions);

  let versionRow =
    head && !isImmutableVersion(head.status) ? head : null;

  if (!versionRow) {
    versionRow = await createCatalogueVersionDraft({
      productId: input.productId,
      snapshot,
    });
  } else {
    await updateCatalogueVersionSnapshot({
      productId: input.productId,
      versionId: versionRow.id,
      snapshot,
    });
    versionRow = {
      ...versionRow,
      snapshot_json: snapshot,
      updated_at: new Date().toISOString(),
    };
  }

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
  const gate = validateSnapshotGate(
    generateCatalogueSnapshot(input).readiness,
    {
      complianceManuallyApproved: !!input.complianceApproved && !input.complianceMetaPending,
    },
  );

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

export { listCatalogueVersions, listSyncPreviewEvents, LIVE_CENTRAL_WRITE_ENABLED };
