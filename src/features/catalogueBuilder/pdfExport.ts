import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { CatalogueProductCard } from "./types";

export type PdfExportInput = {
  title: string;
  subtitle?: string;
  products: CatalogueProductCard[];
};

/**
 * Basic stable PDF catalogue — no advanced brochure layout yet.
 */
export async function exportCataloguePdf(input: PdfExportInput): Promise<Blob> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(18);
  doc.text(input.title, 14, 20);
  if (input.subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(input.subtitle, 14, 28);
    doc.setTextColor(0);
  }

  let y = 36;

  for (const product of input.products) {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }

    if (product.imageUrl) {
      try {
        doc.addImage(product.imageUrl, "JPEG", 14, y, 28, 28);
      } catch {
        /* missing or CORS image — skip gracefully */
      }
    }

    const textX = product.imageUrl ? 46 : 14;
    doc.setFontSize(12);
    doc.text(product.name.slice(0, 60), textX, y + 6);
    doc.setFontSize(9);
    const meta = [
      product.sku ? `SKU: ${product.sku}` : null,
      product.category ? product.category : null,
      product.sellingPrice != null ? `Price: ₹${product.sellingPrice}` : null,
      product.moqLabel ? `MOQ: ${product.moqLabel}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    if (meta) doc.text(meta, textX, y + 12);
    if (product.description) {
      const desc = doc.splitTextToSize(product.description.slice(0, 200), pageWidth - textX - 14);
      doc.text(desc, textX, y + 18);
    }

    y += 36;
  }

  autoTable(doc, {
    startY: Math.min(y + 4, 260),
    head: [["Product", "SKU", "Category", "Price", "MOQ"]],
    body: input.products.map((p) => [
      p.name,
      p.sku ?? "—",
      p.category ?? "—",
      p.sellingPrice != null ? `₹${p.sellingPrice}` : p.mrp != null ? `MRP ₹${p.mrp}` : "—",
      p.moqLabel ?? "—",
    ]),
    styles: { fontSize: 8 },
    margin: { left: 14, right: 14 },
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(
      "Oasis Baklawa · Catalogue AI Studio · Preview export",
      14,
      doc.internal.pageSize.getHeight() - 8,
    );
  }

  return doc.output("blob");
}

export function downloadCataloguePdf(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
