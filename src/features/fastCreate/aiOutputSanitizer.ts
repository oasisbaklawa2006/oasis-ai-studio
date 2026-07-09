/**
 * Guards against raw LLM/streaming-response JSON leaking into alias/keyword lists.
 * The oasis-ai-chat edge function is a streaming chat-completion proxy; if a caller
 * naively splits its raw response text on commas, JSON-shaped chunks like
 * {"object":"chat.completion.chunk","choices":[{"delta":{"content":"..."}}]}
 * get treated as candidate aliases. This filters those out before they reach the UI.
 */

const JSON_ARTIFACT_TOKENS = [
  "object",
  "chat.completion.chunk",
  "choices",
  "delta",
  "model",
  "created",
  "finish_reason",
  "role",
  "usage",
];

const JSON_ARTIFACT_PATTERN = new RegExp(`\\b(${JSON_ARTIFACT_TOKENS.join("|")})\\b`, "i");

/** True if the fragment looks like a JSON key/value pair, brace, or stream artifact rather than a real alias. */
export function isJsonLikeFragment(fragment: string): boolean {
  const trimmed = fragment.trim();
  if (!trimmed) return true;
  if (/[{}[\]]/.test(trimmed)) return true;
  if (/"\s*:\s*/.test(trimmed)) return true;
  if (JSON_ARTIFACT_PATTERN.test(trimmed)) return true;
  return false;
}

export type SanitizeAiFragmentsOptions = {
  minLength?: number;
  maxLength?: number;
  limit?: number;
};

/** Filters raw candidate strings down to clean, deduped, length-bounded aliases/keywords. */
export function sanitizeAiFragments(
  fragments: string[],
  options: SanitizeAiFragmentsOptions = {},
): string[] {
  const { minLength = 2, maxLength = 40, limit = 12 } = options;
  const seen = new Set<string>();
  const clean: string[] = [];

  for (const raw of fragments) {
    const trimmed = raw.trim().replace(/^["'\s]+|["'\s]+$/g, "");
    if (trimmed.length < minLength || trimmed.length > maxLength) continue;
    if (isJsonLikeFragment(trimmed)) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    clean.push(trimmed);
    if (clean.length >= limit) break;
  }

  return clean;
}
