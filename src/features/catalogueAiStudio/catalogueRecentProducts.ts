/**
 * "Continue Last Product" / "Recently Worked On" for the Catalogue Studio work queue. Client-side
 * only (localStorage) — no new schema, no server round-trip. The transform functions are pure and
 * unit-tested; the page only supplies the actual localStorage read/write.
 */
const MAX_ENTRIES = 20;

export interface RecentProductEntry {
  productId: string;
  lastOpenedAt: string;
}

/** Moves productId to the front (most recent) and trims to MAX_ENTRIES — never mutates the input. */
export function recordRecentProduct(
  entries: RecentProductEntry[],
  productId: string,
  now: string = new Date().toISOString(),
): RecentProductEntry[] {
  const withoutProduct = entries.filter((e) => e.productId !== productId);
  return [{ productId, lastOpenedAt: now }, ...withoutProduct].slice(0, MAX_ENTRIES);
}

/** Most-recently-opened product, or null if nothing has been opened yet. */
export function lastOpenedProduct(entries: RecentProductEntry[]): RecentProductEntry | null {
  return entries[0] ?? null;
}

/** Defensive parse — a corrupted/foreign localStorage value must never crash the page. */
export function parseRecentProductEntries(raw: string | null): RecentProductEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is RecentProductEntry =>
        !!e && typeof e === "object" && typeof e.productId === "string" && typeof e.lastOpenedAt === "string",
    );
  } catch {
    return [];
  }
}
