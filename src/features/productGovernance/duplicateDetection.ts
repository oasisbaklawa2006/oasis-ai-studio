import type {
  ProductDuplicateSignal,
  ProductGovernanceRow,
  ProductLabelBarcodeRow,
} from "./types";

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

/**
 * Read-only duplicate detection for Product Master list.
 * Flags same SKU, same product name, or same barcode (from labels).
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
          matchedValue: p.sku!,
          otherProductId: existing.id,
          otherLabel: productGovernanceLabel(existing),
        });
        add(existing.id, {
          kind: "same_sku",
          matchedValue: existing.sku!,
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
    default:
      return "Duplicate";
  }
}
