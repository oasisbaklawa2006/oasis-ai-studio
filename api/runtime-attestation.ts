/**
 * WO-TB-02 — GET /api/runtime-attestation
 *
 * Serves the manifest generated during `vite build` (see
 * scripts/torch-attestation-manifest.ts). It never reads import.meta.env and
 * never recomputes SPA config from Function runtime env vars; the only runtime
 * env var is the bearer secret TORCH_ATTEST_TOKEN.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MANIFEST_RELATIVE_PATH = ".torch-attestation/runtime-attestation.json";
const TOKEN_HEADER = "x-torch-attest-token";
const GIT_SHA_PATTERN = /^[0-9a-f]{40}$/;
const ENVIRONMENTS = ["production", "preview", "development"];
const FLAGS = [
  "central_live_write_enabled",
  "catalogue_ai_enabled",
  "product_language_terms_schema_deployed",
  "phase2c_test_seed_enabled",
  "allow_local_catalogue_fallback",
  "media_governance_production",
];
const KEYS = ["app", "gitSha", "environment", "supabaseProjectRef", "activeFeatureFlags", "demoMode"];

function send(res: ServerResponse, status: number, body?: unknown, headers: Record<string, string> = {}) {
  res.statusCode = status;
  res.setHeader("Cache-Control", "private, no-store");
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  if (body === undefined) {
    res.end();
    return;
  }
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function tokenMatches(provided: string, expected: string): boolean {
  // Hash first so timingSafeEqual always compares equal-length buffers.
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sameKeys(obj: Record<string, unknown>, expected: string[]): boolean {
  const actual = Object.keys(obj).sort();
  const want = [...expected].sort();
  return actual.length === want.length && actual.every((k, i) => k === want[i]);
}

/** Returns a re-built object with exactly the six contract keys, or null if invalid. */
function validateManifest(raw: unknown): Record<string, unknown> | null {
  if (!isPlainObject(raw) || !sameKeys(raw, KEYS)) return null;
  const { app, gitSha, environment, supabaseProjectRef, activeFeatureFlags, demoMode } = raw;
  if (app !== "ai-studio") return null;
  if (typeof gitSha !== "string" || !GIT_SHA_PATTERN.test(gitSha)) return null;
  if (typeof environment !== "string" || !ENVIRONMENTS.includes(environment)) return null;
  // The SPA has no non-throwing demo boot path, so a bootable build always has a
  // project ref and demoMode false. Anything else is treated as broken.
  if (typeof supabaseProjectRef !== "string" || !supabaseProjectRef) return null;
  if (demoMode !== false) return null;
  if (!isPlainObject(activeFeatureFlags) || !sameKeys(activeFeatureFlags, FLAGS)) return null;
  if (!FLAGS.every((f) => typeof activeFeatureFlags[f] === "boolean")) return null;
  return { app, gitSha, environment, supabaseProjectRef, activeFeatureFlags, demoMode };
}

function loadManifest(): Record<string, unknown> | null {
  const candidates = [path.join(process.cwd(), MANIFEST_RELATIVE_PATH)];
  try {
    candidates.push(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", MANIFEST_RELATIVE_PATH),
    );
  } catch {
    // import.meta.url unavailable in this bundle format; cwd candidate only.
  }
  for (const file of candidates) {
    try {
      return validateManifest(JSON.parse(readFileSync(file, "utf8")));
    } catch {
      // try next candidate
    }
  }
  return null;
}

export default function handler(req: IncomingMessage, res: ServerResponse): void {
  if (req.method !== "GET") {
    send(res, 405, { error: "method_not_allowed" }, { Allow: "GET" });
    return;
  }

  const expected = process.env.TORCH_ATTEST_TOKEN;
  if (!expected) {
    send(res, 503);
    return;
  }

  const header = req.headers[TOKEN_HEADER];
  const provided = typeof header === "string" ? header : "";
  if (!provided || !tokenMatches(provided, expected)) {
    send(res, 401, { error: "unauthorized" });
    return;
  }

  const manifest = loadManifest();
  if (!manifest) {
    send(res, 503);
    return;
  }
  send(res, 200, manifest);
}
