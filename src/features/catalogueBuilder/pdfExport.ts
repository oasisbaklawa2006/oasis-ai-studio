import { jsPDF } from "jspdf";
import type { CatalogueMediaRendition, CatalogueProductCard } from "./types";
import { getCatalogueExportProfile } from "./exportProfiles";
import type { CataloguePlannedPage } from "./catalogueLayout";
import {
  buildProvenanceLine,
} from "./catalogueMetadata";
import { DEFAULT_CATALOGUE_THEME } from "./catalogueTheme";
import { prepareCatalogueExport, type CatalogueExportInput } from "./catalogueExport";

export type PdfExportInput = CatalogueExportInput;
export { prepareCatalogueExport } from "./catalogueExport";

function setColour(doc: jsPDF, colour: readonly [number, number, number], fill = false) {
  if (fill) doc.setFillColor(...colour);
  else doc.setTextColor(...colour);
}

function imageFormat(dataUrl: string) {
  if (dataUrl.startsWith("data:image/png")) return "PNG";
  if (dataUrl.startsWith("data:image/webp")) return "WEBP";
  return "JPEG";
}

async function imageAsDataUrl(url: string): Promise<string | null> {
  if (url.startsWith("data:image/")) return url;
  if (typeof fetch !== "function") return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4_000);
  try {
    const response = await fetch(url, { signal: controller.signal, credentials: "omit" });
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.type.startsWith("image/")) return null;
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function renderCover(doc: jsPDF, input: PdfExportInput, profileLabel: string, productCount: number) {
  const { colors, print } = DEFAULT_CATALOGUE_THEME;
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  setColour(doc, colors.paper, true);
  doc.rect(0, 0, width, height, "F");
  setColour(doc, colors.accent, true);
  doc.rect(print.marginMm, 34, 2, 84, "F");
  setColour(doc, colors.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  const title = doc.splitTextToSize(input.title, width - print.marginMm * 2 - 10);
  doc.text(title, print.marginMm + 10, 56);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  setColour(doc, colors.muted);
  doc.text(input.subtitle || `${profileLabel} product catalogue`, print.marginMm + 10, 88);
  doc.setFontSize(10);
  doc.text(`${productCount} curated products`, print.marginMm + 10, 101);
  doc.setFontSize(9);
  doc.text("Oasis Baklawa", print.marginMm + 10, height - 28);
}

function productMeta(product: CatalogueProductCard, input: PdfExportInput) {
  const fields = getCatalogueExportProfile(input.audience ?? "b2b").fields;
  const values: string[] = [];
  if (fields.sku && product.sku) values.push(`SKU ${product.sku}`);
  if (fields.category && product.category) values.push(product.category);
  if (fields.price === "selling" && product.sellingPrice != null) values.push(`INR ${product.sellingPrice}`);
  if (fields.price === "mrp" && product.mrp != null) values.push(`MRP INR ${product.mrp}`);
  if (fields.price === "inquiry") values.push("Price on request");
  if (fields.moq && product.moqLabel) values.push(`MOQ ${product.moqLabel}`);
  return values;
}

async function renderProductPage(
  doc: jsPDF,
  page: Extract<CataloguePlannedPage, { kind: "products" }>,
  input: PdfExportInput,
  selectedImages: Record<string, CatalogueMediaRendition | null>,
  imageCache: Map<string, Promise<string | null>>,
) {
  const profile = getCatalogueExportProfile(input.audience ?? "b2b");
  const { colors, print } = DEFAULT_CATALOGUE_THEME;
  const width = doc.internal.pageSize.getWidth();
  const columns = 2;
  const gap = 7;
  const cardWidth = (width - print.marginMm * 2 - gap) / columns;
  const rows = Math.ceil(profile.cardsPerPage / columns);
  const cardHeight = (242 - gap * (rows - 1)) / rows;

  setColour(doc, colors.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(page.section, print.marginMm, 20);
  setColour(doc, colors.rule, true);
  doc.rect(print.marginMm, 24, width - print.marginMm * 2, 0.5, "F");

  for (let index = 0; index < page.products.length; index += 1) {
    const product = page.products[index];
    const col = index % columns;
    const row = Math.floor(index / columns);
    const x = print.marginMm + col * (cardWidth + gap);
    const y = 31 + row * (cardHeight + gap);
    doc.setDrawColor(...colors.rule);
    doc.roundedRect(x, y, cardWidth, cardHeight, 2, 2, "S");

    const imageHeight = profile.document === "compact_a4" ? 39 : 50;
    const selectedImage = selectedImages[product.productId];
    const url = selectedImage?.url;
    const data = url ? await imageCache.get(url) : null;
    if (data) {
      try {
        const properties = doc.getImageProperties(data);
        const sourceWidth = selectedImage?.width || properties.width;
        const sourceHeight = selectedImage?.height || properties.height;
        const maxWidth = cardWidth - 4;
        const scale = Math.min(maxWidth / sourceWidth, imageHeight / sourceHeight);
        const drawWidth = sourceWidth * scale;
        const drawHeight = sourceHeight * scale;
        const imageX = x + 2 + (maxWidth - drawWidth) / 2;
        const imageY = y + 2 + (imageHeight - drawHeight) / 2;
        doc.addImage(data, imageFormat(data), imageX, imageY, drawWidth, drawHeight, undefined, "FAST");
      } catch {
        setColour(doc, colors.muted);
        doc.setFontSize(8);
        doc.text("Image unavailable", x + 4, y + imageHeight / 2);
      }
    } else {
      setColour(doc, colors.muted);
      doc.setFontSize(8);
      doc.text("Image unavailable", x + 4, y + imageHeight / 2);
    }

    let textY = y + imageHeight + 8;
    setColour(doc, colors.ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(profile.document === "compact_a4" ? 10 : 11);
    const name = doc.splitTextToSize(product.name, cardWidth - 8).slice(0, 2);
    doc.text(name, x + 4, textY);
    textY += name.length * 5 + 1;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setColour(doc, colors.muted);
    const meta = doc.splitTextToSize(productMeta(product, input).join(" · "), cardWidth - 8).slice(0, 2);
    if (meta.length) doc.text(meta, x + 4, textY);
    textY += meta.length * 4 + 1;
    if (profile.fields.description && product.description) {
      const maxLines = profile.document === "compact_a4" ? 2 : 4;
      const description = doc.splitTextToSize(product.description, cardWidth - 8).slice(0, maxLines);
      doc.text(description, x + 4, textY);
    }
  }
}

function renderTerms(doc: jsPDF, input: PdfExportInput) {
  const { colors, print } = DEFAULT_CATALOGUE_THEME;
  setColour(doc, colors.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Terms and ordering", print.marginMm, 24);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const terms = input.terms?.length ? input.terms : [
    "Prices and availability are subject to confirmation at the time of order.",
    "Minimum order quantities and lead times may vary by product and destination.",
    "Product imagery is representative; packaging may vary by approved market specification.",
  ];
  let y = 42;
  for (const term of terms) {
    const lines = doc.splitTextToSize(`• ${term}`, 176);
    doc.text(lines, print.marginMm, y);
    y += lines.length * 5 + 5;
  }
}

function renderBack(doc: jsPDF, input: PdfExportInput) {
  const { colors, print } = DEFAULT_CATALOGUE_THEME;
  const height = doc.internal.pageSize.getHeight();
  setColour(doc, colors.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text(input.contact?.organisation || "Oasis Baklawa", print.marginMm, 70);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const contact = [input.contact?.phone, input.contact?.email, input.contact?.website, input.contact?.address].filter(Boolean) as string[];
  doc.text(contact.length ? contact : ["Contact the Oasis team for orders and current availability."], print.marginMm, 88);
  setColour(doc, colors.accent, true);
  doc.rect(print.marginMm, height - 44, 50, 1.5, "F");
}

/**
 * Profile-driven catalogue PDF. Source quality is assessed by prepareCatalogueExport;
 * the renderer never labels an unknown/undersized image as print-quality or UHD.
 */
export async function exportCataloguePdf(input: PdfExportInput): Promise<Blob> {
  const prepared = prepareCatalogueExport(input);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  const imageCache = new Map<string, Promise<string | null>>();
  for (const image of Object.values(prepared.preflight.selectedImages)) {
    const url = image?.url;
    if (url && !imageCache.has(url)) imageCache.set(url, imageAsDataUrl(url));
  }

  for (let index = 0; index < prepared.plan.pages.length; index += 1) {
    const page = prepared.plan.pages[index];
    if (index > 0) doc.addPage();
    if (page.kind === "cover") renderCover(doc, input, prepared.profile.label, prepared.plan.productCount);
    if (page.kind === "products") await renderProductPage(doc, page, input, prepared.preflight.selectedImages, imageCache);
    if (page.kind === "terms") renderTerms(doc, input);
    if (page.kind === "back") renderBack(doc, input);
  }

  const provenance = buildProvenanceLine(prepared.metadata);
  for (let pageNumber = 1; pageNumber <= doc.getNumberOfPages(); pageNumber += 1) {
    doc.setPage(pageNumber);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    setColour(doc, DEFAULT_CATALOGUE_THEME.colors.muted);
    doc.text(provenance, DEFAULT_CATALOGUE_THEME.print.marginMm, doc.internal.pageSize.getHeight() - 7);
    doc.text(`${pageNumber} / ${doc.getNumberOfPages()}`, doc.internal.pageSize.getWidth() - 14, doc.internal.pageSize.getHeight() - 7, { align: "right" });
  }

  doc.setProperties({
    title: input.title,
    subject: `${prepared.profile.label} catalogue ${prepared.metadata.version}`,
    author: input.metadata?.generatedBy || "Oasis Catalogue AI Studio",
    creator: "Oasis Catalogue AI Studio",
    keywords: `catalogue,${prepared.profile.id},${prepared.metadata.version}`,
  });
  return doc.output("blob");
}

export function downloadCataloguePdf(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
