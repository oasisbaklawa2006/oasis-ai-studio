/**
 * Maps a Catalogue Product AI Studio readiness category to the Full Editor tab that owns that
 * field, so a missing-field chip can deep-link to the right place. Tab ownership is defined in
 * fullEditorArchitecture.ts (Point 31 contract).
 */
import { fullEditorTabForReadinessCategory } from "@/features/productAuthority/fullEditorArchitecture";

/** Full Editor tab for a readiness category key — falls back to "identity" for any unknown key. */
export function fullEditorTabForCategory(categoryKey: string): string {
  return fullEditorTabForReadinessCategory(categoryKey);
}

/** Deep-link URL into the Full Editor, pre-selecting the tab that owns the given category. */
export function fullEditorDeepLink(productId: string, categoryKey: string): string {
  return `/products/${productId}?tab=${fullEditorTabForCategory(categoryKey)}`;
}
