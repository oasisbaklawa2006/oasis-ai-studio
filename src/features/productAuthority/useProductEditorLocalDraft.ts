import { type Dispatch, type SetStateAction, useEffect, useState } from "react";
import {
  mergeDraftOverAuthorityForm,
  stripAuthorityFieldsFromDraft,
} from "@/lib/formDraftAuthority";

/** Hydrate each product identity's local draft *before* allowing autosave.
 * The hydrated key is state (not a mutable boolean) so a same-commit hydrate
 * cannot cause autosave to write an old render's form into a new draft key.
 */
export function useProductEditorLocalDraft(
  draftKey: string,
  form: Record<string, unknown>,
  setForm: Dispatch<SetStateAction<Record<string, unknown>>>,
): void {
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const draft = JSON.parse(raw) as Record<string, unknown>;
        setForm((current) => mergeDraftOverAuthorityForm(current, draft));
      }
    } catch {
      // Corrupt or inaccessible storage must not prevent editing.
    }
    setHydratedKey(draftKey);
  }, [draftKey, setForm]);

  useEffect(() => {
    if (hydratedKey !== draftKey) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify(stripAuthorityFieldsFromDraft(form)));
    } catch {
      // Autosave is best effort; avoid exposing Storage errors in the editor.
    }
  }, [draftKey, hydratedKey, form]);
}
