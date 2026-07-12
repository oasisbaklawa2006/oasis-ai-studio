/**
 * Which catalogue draft content fields belong in the Language / Messaging tab vs. the general
 * Content Draft Studio tab. A field renders in exactly one tab — never both.
 */
import type { CatalogueDraftContentKey } from "./catalogueDraftTypes";

export const LANGUAGE_MESSAGING_CONTENT_KEYS: readonly CatalogueDraftContentKey[] = [
  "hindi_description",
  "whatsapp_product_message",
] as const;

export function isLanguageMessagingField(key: CatalogueDraftContentKey): boolean {
  return (LANGUAGE_MESSAGING_CONTENT_KEYS as readonly string[]).includes(key);
}
