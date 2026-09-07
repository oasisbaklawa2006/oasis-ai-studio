import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatPriceForExport } from "./priceVisibility";
import { contentBoxMm, PRINT_PAGE } from "./printLayout";
import { getPrintTemplate, type PrintTemplateId } from "./printTemplates";
import type { PrintCatalogueSnapshot } from "./printSnapshot";
import type { CatalogueProductCard, PrintComposition } from "./types";

export type PdfExportInput = {
  title: string;
  subtitle?: string;
  products: CatalogueProductCard[];
};

export type PrintPdfExportInput = {
  composition: PrintComposition;
  templateId: PrintTemplateId;
  snapshot?: Pick<PrintCatalogueSnapshot, "contentHash" | "versionNumber" | "createdAt">;
  companyName?: string;
};

function addPageFooter(doc: jsPDF, page: number, total: number, hash?: string) {
  const h = doc.internal.pageSize.getHeight();
  doc.setFontSize(7);
  doc.setTextColor(120);
  const hashSuffix = hash ? ` · ${hash}` : "";
  doc.text(
    `Oasis Baklawa · Print Catalogue · Page ${page} of ${total}${hashSuffix}`,
    PRINT_PAGE.bleedMm + PRINT_PAGE.safeMarginMm,
    h - PRINT_PAGE.bleedMm - 4,
  );
  doc.setTextColor(0);
}

function renderCover(doc: jsPDF, title: string, subtitle?: string) {
  const box = contentBoxMm();
  doc.setFillColor(245, 240, 230);
  doc.rect(0, 0, PRINT_PAGE.widthMm + 2 * PRINT_PAGE.bleedMm, PRINT_PAGE.heightMm + 2 * PRINT_PAGE.bleedMm, "F");
  doc.setFontSize(28);
  doc.setTextColor(40, 30, 20);
  doc.text(title, box.left, box.top + 60, { maxWidth: box.width });
  if (subtitle) {
    doc.setFontSize(12);
    doc.setTextColor(80, 70, 60);
    doc.text(subtitle, box.left, box.top + 80, { maxWidth: box.width });
  }
  doc.setFontSize(10);
  doc.text("Oasis Baklawa", box.left, box.bottom - 20);
  doc.setTextColor(0);
}

function renderCompanyIntro(doc: jsPDF, text: string) {
  const box = contentBoxMm();
  doc.setFontSize(16);
  doc.text("Company Introduction", box.left, box.top + 10);
  doc.setFontSize(10);
  const lines = doc.splitTextToSize(text, box.width);
  doc.text(lines, box.left, box.top + 24);
}

function renderContents(
  doc: jsPDF,
  entries: Array<{ title: string; page: number }>,
) {
  const box = contentBoxMm();
  doc.setFontSize(16);
  doc.text("Contents", box.left, box.top + 10);
  doc.setFontSize(10);
  let y = box.top + 22;
  for (const entry of entries) {
    if (y > box.bottom - 10) break;
    doc.text(entry.title, box.left, y);
    doc.text(String(entry.page), box.right - 10, y, { align: "right" });
    y += 7;
  }
}

function renderCategoryDivider(doc: jsPDF, category: string) {
  const box = contentBoxMm();
  doc.setFillColor(230, 220, 200);
  doc.rect(box.left, box.top + 20, box.width, 14, "F");
  doc.setFontSize(14);
  doc.setTextColor(50, 40, 30);
  doc.text(category, box.left + 4, box.top + 30);
  doc.setTextColor(0);
}

function renderProductCard(
  doc: jsPDF,
  product: CatalogueProductCard,
  x: number,
  y: number,
  w: number,
  layout: "standard" | "hero" | "compact",
) {
  const imgSize = layout === "hero" ? 50 : layout === "compact" ? 22 : 32;
  if (product.imageUrl) {
    try {
      doc.addImage(product.imageUrl, "JPEG", x, y, imgSize, imgSize);
    } catch {
      /* CORS or missing image */
    }
  }

  const textX = product.imageUrl ? x + imgSize + 4 : x;
  const textW = w - (product.imageUrl ? imgSize + 4 : 0);
  doc.setFontSize(layout === "compact" ? 9 : 11);
  doc.text(product.name.slice(0, 50), textX, y + 5, { maxWidth: textW });
  doc.setFontSize(8);
  const price = formatPriceForExport(product);
  const meta = [
    product.sku ? `SKU: ${product.sku}` : null,
    price !== "—" ? price : null,
    product.moqLabel ? `MOQ: ${product.moqLabel}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  if (meta) doc.text(meta, textX, y + 11, { maxWidth: textW });
  if (product.description && layout !== "compact") {
    const desc = doc.splitTextToSize(product.description.slice(0, 120), textW);
    doc.text(desc, textX, y + 16);
  }
}

function renderProductPage(
  doc: jsPDF,
  products: CatalogueProductCard[],
  layout: "standard" | "hero" | "compact",
) {
  const box = contentBoxMm();
  const cols = layout === "hero" ? 1 : layout === "compact" ? 2 : 1;
  const cardH = layout === "hero" ? 70 : layout === "compact" ? 36 : 48;
  const cardW = box.width / cols - 4;

  products.forEach((product, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = box.left + col * (cardW + 4);
    const y = box.top + 10 + row * (cardH + 6);
    renderProductCard(doc, product, x, y, cardW, layout);
  });
}

/**
 * Deterministic production PDF from a frozen print composition.
 * Uses snapshot metadata when provided for reproducible regeneration.
 */
export async function exportPrintCataloguePdf(input: PrintPdfExportInput): Promise<Blob> {
  const template = getPrintTemplate(input.templateId);
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: PRINT_PAGE.format,
  });

  for (let idx = 0; idx < input.composition.sections.length; idx++) {
    const section = input.composition.sections[idx];
    if (idx > 0) doc.addPage();

    switch (section.kind) {
      case "cover":
        renderCover(doc, input.composition.collectionTitle, input.composition.variant);
        break;
      case "company_intro":
        renderCompanyIntro(doc, section.title ?? "");
        break;
      case "contents":
        renderContents(doc, input.composition.contentsEntries);
        break;
      case "category_divider":
        renderCategoryDivider(doc, section.title ?? section.category ?? "");
        break;
      case "product":
        renderProductPage(doc, section.products ?? [], template.cardLayout);
        break;
    }
  }

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    addPageFooter(doc, i, total, input.snapshot?.contentHash);
  }

  // Deterministic metadata — creation date from snapshot, not wall clock
  doc.setProperties({
    title: input.composition.collectionTitle,
    subject: "Oasis Baklawa Print Catalogue",
    creator: "Oasis Catalogue AI Studio",
    keywords: `snapshot:${input.snapshot?.contentHash ?? "preview"};v${input.snapshot?.versionNumber ?? 0}`,
  });

  return doc.output("blob", { filename: `${input.composition.collectionTitle}.pdf` });
}

/**
 * Basic stable PDF catalogue — legacy list export for quick previews.
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
      formatPriceForExport(product) !== "—" ? formatPriceForExport(product) : null,
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
      formatPriceForExport(p),
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
