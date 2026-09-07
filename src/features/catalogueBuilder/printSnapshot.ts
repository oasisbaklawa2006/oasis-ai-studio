import type { PrintTemplateId } from "./printTemplates";
import type {
  CatalogueCollectionItemRow,
  CatalogueCollectionRow,
  CatalogueProductCard,
  PrintComposition,
} from "./types";

export const PRINT_SNAPSHOT_SCHEMA = "print_catalogue_snapshot_v1" as const;

export type PrintCatalogueSnapshot = {
  schema: typeof PRINT_SNAPSHOT_SCHEMA;
  snapshotId: string;
  collectionId: string;
  versionNumber: number;
  createdAt: string;
  collection: CatalogueCollectionRow;
  items: CatalogueCollectionItemRow[];
  cards: CatalogueProductCard[];
  templateId: PrintTemplateId;
  composition: PrintComposition;
  contentHash: string;
};

const SNAPSHOT_STORAGE_KEY = "oasis_print_catalogue_snapshots";

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

/** Deterministic FNV-1a hash for reproducibility checks. */
export function hashPrintSnapshotContent(input: {
  collection: CatalogueCollectionRow;
  items: CatalogueCollectionItemRow[];
  cards: CatalogueProductCard[];
  templateId: PrintTemplateId;
}): string {
  const payload = stableStringify({
    collection: {
      id: input.collection.id,
      title: input.collection.title,
      catalogue_type: input.collection.catalogue_type,
      theme: input.collection.theme,
    },
    items: input.items.map((i) => ({
      product_id: i.product_id,
      sort_order: i.sort_order,
      price_visibility: i.price_visibility,
      display_name_override: i.display_name_override,
      description_override: i.description_override,
      is_featured: i.is_featured,
      catalogue_version_id: i.catalogue_version_id,
    })),
    cards: input.cards.map((c) => ({
      productId: c.productId,
      name: c.name,
      sku: c.sku,
      category: c.category,
      mrp: c.mrp,
      sellingPrice: c.sellingPrice,
      priceVisibilityMode: c.priceVisibilityMode,
      imageUrl: c.imageUrl,
    })),
    templateId: input.templateId,
  });

  let hash = 0x811c9dc5;
  for (let i = 0; i < payload.length; i++) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function createPrintCatalogueSnapshot(args: {
  collection: CatalogueCollectionRow;
  items: CatalogueCollectionItemRow[];
  cards: CatalogueProductCard[];
  templateId: PrintTemplateId;
  composition: PrintComposition;
  existingVersions?: PrintCatalogueSnapshot[];
  /** Fixed timestamp for deterministic regeneration tests. */
  createdAt?: string;
  snapshotId?: string;
}): PrintCatalogueSnapshot {
  const versions = args.existingVersions ?? [];
  const versionNumber =
    versions.length === 0 ? 1 : Math.max(...versions.map((v) => v.versionNumber)) + 1;

  const contentHash = hashPrintSnapshotContent({
    collection: args.collection,
    items: args.items,
    cards: args.cards,
    templateId: args.templateId,
  });

  return {
    schema: PRINT_SNAPSHOT_SCHEMA,
    snapshotId: args.snapshotId ?? crypto.randomUUID(),
    collectionId: args.collection.id,
    versionNumber,
    createdAt: args.createdAt ?? new Date().toISOString(),
    collection: args.collection,
    items: args.items,
    cards: args.cards,
    templateId: args.templateId,
    composition: args.composition,
    contentHash,
  };
}

/** Recompute hash from frozen snapshot payload — detects drift before regeneration. */
export function verifySnapshotIntegrity(snapshot: PrintCatalogueSnapshot): boolean {
  const expected = hashPrintSnapshotContent({
    collection: snapshot.collection,
    items: snapshot.items,
    cards: snapshot.cards,
    templateId: snapshot.templateId,
  });
  return expected === snapshot.contentHash;
}

/** Regenerate export inputs from a frozen authoritative snapshot. */
export function regenerateFromSnapshot(snapshot: PrintCatalogueSnapshot): {
  composition: PrintComposition;
  cards: CatalogueProductCard[];
  templateId: PrintTemplateId;
  contentHash: string;
} {
  if (!verifySnapshotIntegrity(snapshot)) {
    throw new Error("Snapshot integrity check failed — source data has drifted");
  }
  return {
    composition: snapshot.composition,
    cards: snapshot.cards,
    templateId: snapshot.templateId,
    contentHash: snapshot.contentHash,
  };
}

function readAllSnapshots(): PrintCatalogueSnapshot[] {
  try {
    const raw = localStorage.getItem(SNAPSHOT_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PrintCatalogueSnapshot[]) : [];
  } catch {
    return [];
  }
}

function writeAllSnapshots(rows: PrintCatalogueSnapshot[]) {
  localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(rows));
}

export function listPrintSnapshots(collectionId: string): PrintCatalogueSnapshot[] {
  return readAllSnapshots()
    .filter((s) => s.collectionId === collectionId)
    .sort((a, b) => b.versionNumber - a.versionNumber);
}

export function savePrintSnapshot(snapshot: PrintCatalogueSnapshot): void {
  const all = readAllSnapshots();
  all.push(snapshot);
  writeAllSnapshots(all);
}

export function getPrintSnapshot(snapshotId: string): PrintCatalogueSnapshot | null {
  return readAllSnapshots().find((s) => s.snapshotId === snapshotId) ?? null;
}

/** Verify two snapshots with the same inputs produce the same content hash. */
export function snapshotsAreReproducible(
  a: PrintCatalogueSnapshot,
  b: PrintCatalogueSnapshot,
): boolean {
  return a.contentHash === b.contentHash && a.templateId === b.templateId;
}
