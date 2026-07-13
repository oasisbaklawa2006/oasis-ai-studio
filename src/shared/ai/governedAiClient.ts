import { supabase } from "@/integrations/supabase/client";

const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_CACHE_TTL_MS = 5 * 60_000;
const MAX_REQUEST_BYTES = 32 * 1024;
const MAX_RESPONSE_BYTES = 512 * 1024;

type CacheEntry = {
  expiresAt: number;
  value: unknown;
};

const responseCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<GovernedAiResult<unknown>>>();

export type GovernedAiFailureCode =
  | "not_configured"
  | "unauthenticated"
  | "invalid_request"
  | "timeout"
  | "network"
  | "rate_limited"
  | "credits_exhausted"
  | "in_progress"
  | "service_error"
  | "malformed_response";

export type GovernedAiResult<T> =
  | { ok: true; data: T; cached: boolean }
  | { ok: false; code: GovernedAiFailureCode; reason: string; retryable: boolean };

type GovernedAiRequestOptions = {
  timeoutMs?: number;
  cacheTtlMs?: number;
};

function stableJson(value: unknown): string {
  if (value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function failureForStatus(status: number): GovernedAiResult<never> {
  if (status === 401 || status === 403) {
    return { ok: false, code: "unauthenticated", reason: "Sign in again to use AI suggestions.", retryable: false };
  }
  if (status === 409) {
    return { ok: false, code: "in_progress", reason: "An identical AI request is already running. Retry shortly.", retryable: true };
  }
  if (status === 429) {
    return { ok: false, code: "rate_limited", reason: "AI request limit reached. Retry shortly.", retryable: true };
  }
  if (status === 402) {
    return { ok: false, code: "credits_exhausted", reason: "AI provider credits are unavailable.", retryable: false };
  }
  return {
    ok: false,
    code: "service_error",
    reason: `AI suggestion service returned an error (status ${status}).`,
    retryable: status >= 500,
  };
}

/**
 * Authenticated, bounded client for governed AI suggestion Edge Functions.
 *
 * Identical requests share one in-flight promise and successful responses are cached briefly. The
 * cache is deliberately memory-only: it reduces accidental double-click/provider spend without
 * persisting product facts or model output in browser storage.
 */
export async function invokeGovernedAi<T>(
  functionName: "oasis-ai-chat" | "generate-product-attributes",
  body: Record<string, unknown>,
  options: GovernedAiRequestOptions = {},
): Promise<GovernedAiResult<T>> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !anonKey) {
    return { ok: false, code: "not_configured", reason: "AI suggestions are not configured in this environment.", retryable: false };
  }

  const serializedBody = stableJson(body);
  if (byteLength(serializedBody) > MAX_REQUEST_BYTES) {
    return { ok: false, code: "invalid_request", reason: "AI suggestion input is too large.", retryable: false };
  }

  let sessionData: Awaited<ReturnType<typeof supabase.auth.getSession>>["data"];
  try {
    ({ data: sessionData } = await supabase.auth.getSession());
  } catch {
    return { ok: false, code: "unauthenticated", reason: "Could not verify your session for AI suggestions.", retryable: true };
  }
  const session = sessionData.session;
  if (!session?.access_token || !session.user?.id) {
    return { ok: false, code: "unauthenticated", reason: "Sign in to use AI suggestions.", retryable: false };
  }

  const requestKey = `${session.user.id}:${functionName}:${serializedBody}`;
  const now = Date.now();
  const cached = responseCache.get(requestKey);
  if (cached && cached.expiresAt > now) {
    return { ok: true, data: cached.value as T, cached: true };
  }
  if (cached) responseCache.delete(requestKey);

  const existing = inFlight.get(requestKey);
  if (existing) return existing as Promise<GovernedAiResult<T>>;

  const request = (async (): Promise<GovernedAiResult<T>> => {
    const controller = new AbortController();
    const timeoutId = globalThis.setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anonKey,
          Authorization: `Bearer ${session.access_token}`,
        },
        body: serializedBody,
        signal: controller.signal,
      });
      if (!response.ok) return failureForStatus(response.status);

      const raw = await response.text();
      if (byteLength(raw) > MAX_RESPONSE_BYTES) {
        return { ok: false, code: "malformed_response", reason: "AI response exceeded the safe size limit.", retryable: false };
      }

      let data: T;
      try {
        data = JSON.parse(raw) as T;
      } catch {
        return { ok: false, code: "malformed_response", reason: "AI service returned malformed structured data.", retryable: true };
      }

      responseCache.set(requestKey, {
        expiresAt: Date.now() + (options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS),
        value: data,
      });
      return { ok: true, data, cached: false };
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return { ok: false, code: "timeout", reason: "AI suggestion request timed out. Retry when connectivity is stable.", retryable: true };
      }
      return { ok: false, code: "network", reason: "Could not reach the AI suggestion service.", retryable: true };
    } finally {
      globalThis.clearTimeout(timeoutId);
    }
  })();

  inFlight.set(requestKey, request as Promise<GovernedAiResult<unknown>>);
  try {
    return await request;
  } finally {
    inFlight.delete(requestKey);
  }
}

/** Test-only reset for deterministic cache/deduplication coverage. */
export function resetGovernedAiClientState(): void {
  responseCache.clear();
  inFlight.clear();
}
