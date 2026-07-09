/**
 * Derives a short, staff-friendly SKU for display/search convenience from the
 * structured (long) SKU. Purely computed — not persisted to any new column, since
 * `products` has no short-SKU field. If a stored short SKU is wanted later, that's
 * a schema decision for Central/Supabase Core, not something to fake here.
 */

/** Structured SKU segments look like OAS-<div>-<cat>-<sub>-<pack>-<seq>. Short SKU keeps the category + sequence. */
export function deriveShortSku(structuredSku: string): string {
  const trimmed = structuredSku.trim().toUpperCase();
  if (!trimmed) return "";

  const parts = trimmed.split("-").filter(Boolean);
  if (parts.length < 2) return trimmed;

  const sequence = parts[parts.length - 1];
  const category = parts.length >= 3 ? parts[2] : parts[1];
  return `${category}-${sequence}`;
}
