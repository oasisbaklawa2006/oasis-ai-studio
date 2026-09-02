import type { ProductDuplicateSignal, ProductGovernanceRow, ProductLabelBarcodeRow } from "./types";

const SIMILAR_NAME_THRESHOLD = 0.82;

export function productGovernanceLabel(p: ProductGovernanceRow): string {
  const name = p.product_name ?? p.name ?? "Unnamed product";
  return p.sku ? `${name} (${p.sku})` : name;
}

function normSku(sku: string | null | undefined): string | null {
  const v = sku?.trim().toLowerCase();
  return v || null;
}

function normName(name: string | null | undefined): string | null {
  const v = name?.trim().toLowerCase();
  return v || null;
}

function normBarcode(barcode: string | null | undefined): string | null {
  const v = barcode?.trim();
  return v || null;
}

function similarityTokens(name: string): string[] {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

function tokenJaccard(a: string[], b: string[]): number {
  const left = new Set(a);
  const right = new Set(b);
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

function trigrams(value: string): Set<string> {
  const out = new Set<string>();
  if (value.length < 3) return out;
  for (let i = 0; i <= value.length - 3; i += 1) out.add(value.slice(i, i + 3));
  return out;
}

function trigramDice(a: string, b: string): number {
  const left = trigrams(a);
  const right = trigrams(b);
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  for (const gram of left) if (right.has(gram)) intersection += 1;
  return (2 * intersection) / (left.size + right.size);
}

/**
 * Deterministic, read-only similarity score for product names.
 *
 * The comparison deliberately uses a high threshold at the call site: this is a
 * review signal, never an automatic merge/delete decision. Token overlap catches
 * reordered names while trigram Dice catches small spelling and spacing changes.
 */
export function productNameSimilarity(
  leftName: string | null | undefined,
  rightName: string | null | undefined,
): number {
  if (!leftName || !rightName) return 0;
  const leftTokens = similarityTokens(leftName);
  const rightTokens = similarityTokens(rightName);
  const leftCompact = leftTokens.join("");
  const rightCompact = rightTokens.join("");
  if (leftCompact.length < 6 || rightCompact.length < 6) return 0;
  if (leftCompact === rightCompact) return 1;
  return Math.max(tokenJaccard(leftTokens, rightTokens), trigramDice(leftCompact, rightCompact));
}

/**
 * Read-only duplicate and similar-product detection for Product Master list.
 * Exact signals cover same SKU, product name, or barcode. Similar-name signals
 * are high-confidence review hints only and never mutate or merge product data.
 */
export function detectProductMasterDuplicates(
  products: ProductGovernanceRow[],
  labelRows: ProductLabelBarcodeRow[] = [],
): Map<string, ProductDuplicateSignal[]> {
  const byId = new Map<string, ProductDuplicateSignal[]>();
  const add = (productId: string, signal: ProductDuplicateSignal) => {
    const list = byId.get(productId) ?? [];
    if (list.some((s) => s.kind === signal.kind && s.otherProductId === signal.otherProductId)) {
      return;
    }
    list.push(signal);
    byId.set(productId, list);
  };

  const skuIndex = new Map<string, ProductGovernanceRow>();
  const nameIndex = new Map<string, ProductGovernanceRow[]>();
  const barcodeIndex = new Map<string, { productId: string; barcode: string }>();

  for (const row of labelRows) {
    const barcode = normBarcode(row.barcode);
    if (!barcode || !row.product_id) continue;
    if (!barcodeIndex.has(barcode)) {
      barcodeIndex.set(barcode, { productId: row.product_id, barcode });
    }
  }

  for (const p of products) {
    const sku = normSku(p.sku);
    if (sku) {
      const existing = skuIndex.get(sku);
      if (existing) {
        add(p.id, {
          kind: "same_sku",
          matchedValue: p.sku ?? sku,
          otherProductId: existing.id,
          otherLabel: productGovernanceLabel(existing),
        });
        add(existing.id, {
          kind: "same_sku",
          matchedValue: existing.sku ?? sku,
          otherProductId: p.id,
          otherLabel: productGovernanceLabel(p),
        });
      } else {
        skuIndex.set(sku, p);
      }
    }

    const name = normName(p.product_name ?? p.name);
    if (name) {
      const matches = nameIndex.get(name) ?? [];
      for (const other of matches) {
        add(p.id, {
          kind: "same_name",
          matchedValue: p.product_name ?? p.name ?? name,
          otherProductId: other.id,
          otherLabel: productGovernanceLabel(other),
        });
        add(other.id, {
          kind: "same_name",
          matchedValue: other.product_name ?? other.name ?? name,
          otherProductId: p.id,
          otherLabel: productGovernanceLabel(p),
        });
      }
      matches.push(p);
      nameIndex.set(name, matches);
    }
  }

  for (const [i, left] of products.entries()) {
    const leftName = left.product_name ?? left.name;
    const leftExact = normName(leftName);
    if (!leftExact) continue;

    for (const right of products.slice(i + 1)) {
      const rightName = right.product_name ?? right.name;
      const rightExact = normName(rightName);
      if (!rightExact || leftExact === rightExact) continue;

      const similarity = productNameSimilarity(leftName, rightName);
      if (similarity < SIMILAR_NAME_THRESHOLD) continue;

      add(left.id, {
        kind: "similar_name",
        matchedValue: leftName ?? leftExact,
        otherProductId: right.id,
        otherLabel: productGovernanceLabel(right),
      });
      add(right.id, {
        kind: "similar_name",
        matchedValue: rightName ?? rightExact,
        otherProductId: left.id,
        otherLabel: productGovernanceLabel(left),
      });
    }
  }

  for (const p of products) {
    const label = labelRows.find((r) => r.product_id === p.id);
    const barcode = normBarcode(label?.barcode);
    if (!barcode) continue;
    const hit = barcodeIndex.get(barcode);
    if (!hit || hit.productId === p.id) continue;
    const other = products.find((row) => row.id === hit.productId);
    if (!other) continue;
    add(p.id, {
      kind: "same_barcode",
      matchedValue: barcode,
      otherProductId: other.id,
      otherLabel: productGovernanceLabel(other),
    });
    add(other.id, {
      kind: "same_barcode",
      matchedValue: barcode,
      otherProductId: p.id,
      otherLabel: productGovernanceLabel(p),
    });
  }

  return byId;
}

export function duplicateKindLabel(kind: ProductDuplicateSignal["kind"]): string {
  switch (kind) {
    case "same_sku":
      return "Duplicate SKU";
    case "same_name":
      return "Duplicate name";
    case "same_barcode":
      return "Duplicate barcode";
    case "similar_name":
      return "Similar product";
    default:
      return "Duplicate";
  }
}
