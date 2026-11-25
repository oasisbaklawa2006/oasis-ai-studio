import { useLayoutEffect, useRef } from "react";

/** Reset product-specific state only when the editor's PRODUCT identity changes.
 * A different location key, tab or query string for the same product must not
 * erase unsaved edits. A -> New is a new identity even if React reuses the page.
 */
export function useProductEditorIdentityReset(identity: string, reset: () => void): void {
  const previousIdentity = useRef(identity);
  const resetRef = useRef(reset);
  useLayoutEffect(() => {
    resetRef.current = reset;
  });
  useLayoutEffect(() => {
    if (previousIdentity.current === identity) return;
    previousIdentity.current = identity;
    resetRef.current();
  }, [identity]);
}
