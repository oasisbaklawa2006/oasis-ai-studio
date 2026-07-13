export const PRODUCT_DRAFT_SCHEMA_VERSION = 1 as const;

export type ProductDraftEnvelope<T extends Record<string, unknown> = Record<string, unknown>> = {
  schemaVersion: typeof PRODUCT_DRAFT_SCHEMA_VERSION;
  routeKey: string;
  savedAt: string;
  idempotencyKey: string;
  data: T;
};

export type ProductDraftReadResult<T extends Record<string, unknown> = Record<string, unknown>> =
  | { ok: true; envelope: ProductDraftEnvelope<T>; legacy: boolean }
  | { ok: false; reason: "corrupt" | "schema_mismatch" | "route_mismatch"; message: string };

export type ProductDraftWriteResult =
  | { ok: true }
  | { ok: false; message: string; error: unknown };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function createProductDraftIdempotencyKey(
  generator: () => string = () => crypto.randomUUID(),
): string {
  return generator();
}

export function createProductDraftEnvelope<T extends Record<string, unknown>>(
  routeKey: string,
  data: T,
  idempotencyKey: string,
  now: () => Date = () => new Date(),
): ProductDraftEnvelope<T> {
  return {
    schemaVersion: PRODUCT_DRAFT_SCHEMA_VERSION,
    routeKey,
    savedAt: now().toISOString(),
    idempotencyKey,
    data,
  };
}

export function parseProductDraft<T extends Record<string, unknown> = Record<string, unknown>>(
  raw: string,
  expectedRouteKey: string,
  legacyIdempotencyKey: string,
): ProductDraftReadResult<T> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "corrupt", message: "The saved browser draft is corrupted and was not restored." };
  }

  if (!isRecord(parsed)) {
    return { ok: false, reason: "corrupt", message: "The saved browser draft has an invalid shape and was not restored." };
  }

  // Backward compatibility: before the versioned envelope the stored value was the form itself.
  if (!("schemaVersion" in parsed)) {
    return {
      ok: true,
      legacy: true,
      envelope: createProductDraftEnvelope(expectedRouteKey, parsed as T, legacyIdempotencyKey),
    };
  }

  if (parsed.schemaVersion !== PRODUCT_DRAFT_SCHEMA_VERSION || !isRecord(parsed.data)) {
    return {
      ok: false,
      reason: "schema_mismatch",
      message: "This browser draft was created by an incompatible editor version and was not merged.",
    };
  }

  if (parsed.routeKey !== expectedRouteKey) {
    return {
      ok: false,
      reason: "route_mismatch",
      message: "A browser draft belonging to another product was blocked from loading.",
    };
  }

  if (typeof parsed.idempotencyKey !== "string" || !parsed.idempotencyKey.trim()) {
    return {
      ok: false,
      reason: "corrupt",
      message: "The saved browser draft is missing its submission identity and was not restored.",
    };
  }

  return {
    ok: true,
    legacy: false,
    envelope: parsed as ProductDraftEnvelope<T>,
  };
}

export function writeProductDraft(
  storage: Pick<Storage, "setItem">,
  key: string,
  envelope: ProductDraftEnvelope,
): ProductDraftWriteResult {
  try {
    storage.setItem(key, JSON.stringify(envelope));
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: "Browser recovery draft could not be saved. Keep this page open and save to the server before leaving.",
      error,
    };
  }
}

/** Autosave is allowed only for unsaved work after this exact route has restored. */
export const canAutosaveProductDraft = (
  restoredRouteKey: string | null,
  routeKey: string,
  dirty: boolean,
) => dirty && restoredRouteKey === routeKey;
