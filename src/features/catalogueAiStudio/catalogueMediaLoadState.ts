/**
 * Distinguishes the four real states of the Catalogue Studio media fetch: loading, a genuine
 * error, and — once loaded — media present vs. a genuine empty result. A prior implementation
 * silently converted a Supabase error into an empty-media state; this makes that impossible by
 * construction (an "error" status never carries rows, and rows are only ever set on "loaded").
 */
import type { CatalogueMediaRow } from "./catalogueMediaSummary";

export type MediaLoadStatus = "loading" | "error" | "loaded";

export interface MediaLoadState {
  status: MediaLoadStatus;
  rows: CatalogueMediaRow[];
  /** Truthful, non-sensitive message only — never the raw backend error string. */
  errorMessage: string | null;
}

/** Generic, non-sensitive message shown for any media-fetch failure. */
export const MEDIA_LOAD_ERROR_MESSAGE = "Could not load media for this product. Please retry.";

export const INITIAL_MEDIA_LOAD_STATE: MediaLoadState = { status: "loading", rows: [], errorMessage: null };

export function mediaLoadStarted(): MediaLoadState {
  return { status: "loading", rows: [], errorMessage: null };
}

export function mediaLoadSucceeded(rows: CatalogueMediaRow[]): MediaLoadState {
  return { status: "loaded", rows, errorMessage: null };
}

export function mediaLoadFailed(): MediaLoadState {
  return { status: "error", rows: [], errorMessage: MEDIA_LOAD_ERROR_MESSAGE };
}

/** True only once loaded with zero rows — a genuine empty result, distinct from an error. */
export function isMediaResultEmpty(state: MediaLoadState): boolean {
  return state.status === "loaded" && state.rows.length === 0;
}
