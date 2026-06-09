/**
 * Local catalogue persistence is never authoritative in production.
 * Writes to localStorage for catalogue collections/versions are opt-in dev-only.
 */

export class LocalCatalogueFallbackDisabledError extends Error {
  constructor(context: string) {
    super(
      `${context}: Supabase is required for catalogue authority data. ` +
        "Local fallback writes are disabled (set VITE_ALLOW_LOCAL_CATALOGUE_FALLBACK=true in dev only).",
    );
    this.name = "LocalCatalogueFallbackDisabledError";
  }
}

/** Dev-only explicit opt-in for local catalogue persistence writes. */
export function isLocalCatalogueFallbackWriteEnabled(): boolean {
  return (
    import.meta.env.DEV === true &&
    import.meta.env.VITE_ALLOW_LOCAL_CATALOGUE_FALLBACK === "true"
  );
}

/** Whether reads from local catalogue fallback storage are permitted. */
export function isLocalCatalogueFallbackReadEnabled(): boolean {
  return isLocalCatalogueFallbackWriteEnabled();
}

export function assertLocalCatalogueFallbackWrite(context: string): void {
  if (!isLocalCatalogueFallbackWriteEnabled()) {
    throw new LocalCatalogueFallbackDisabledError(context);
  }
}
