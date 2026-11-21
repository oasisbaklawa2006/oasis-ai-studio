/**
 * WO-TB-02 — build-time runtime attestation manifest.
 *
 * Generated during `vite build` from the exact resolved SPA build inputs
 * (Vite's resolved `import.meta.env` + the compiled-in Central write constant).
 * The output is gitignored, lives OUTSIDE dist/ and public/, and is packaged
 * with api/runtime-attestation.ts via vercel.json `includeFiles`.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

export const ATTESTATION_MANIFEST_DIR = ".torch-attestation";
export const ATTESTATION_MANIFEST_FILE = "runtime-attestation.json";
export const ATTESTATION_MANIFEST_RELATIVE_PATH = `${ATTESTATION_MANIFEST_DIR}/${ATTESTATION_MANIFEST_FILE}`;

const SUPABASE_URL_PATTERN = /^https:\/\/([a-z0-9-]+)\.supabase\.co$/i;
const GIT_SHA_PATTERN = /^[0-9a-f]{40}$/;
const CENTRAL_WRITE_SOURCE = "src/features/catalogueSnapshot/centralSyncPayload.ts";

export const ENVIRONMENTS = ["production", "preview", "development"] as const;
export type AttestationEnvironment = (typeof ENVIRONMENTS)[number];

/** Explicit allowlist. Adding a flag here is the only way it appears in the contract. */
export const FLAG_ALLOWLIST = [
  "central_live_write_enabled",
  "catalogue_ai_enabled",
  "product_language_terms_schema_deployed",
  "phase2c_test_seed_enabled",
  "allow_local_catalogue_fallback",
  "media_governance_production",
] as const;
export type AttestationFlagName = (typeof FLAG_ALLOWLIST)[number];

export interface AttestationManifest {
  app: "ai-studio";
  gitSha: string;
  environment: AttestationEnvironment;
  supabaseProjectRef: string | null;
  activeFeatureFlags: Record<AttestationFlagName, boolean>;
  demoMode: boolean;
}

export interface AttestationInputs {
  /** Vite's resolved env (`ResolvedConfig.env`): VITE_* vars plus MODE/DEV/PROD. */
  viteEnv: Record<string, unknown>;
  /** Build process env (Vercel/GitHub provenance only — never SPA config). */
  processEnv: Record<string, string | undefined>;
  /** Source text of the module that defines LIVE_CENTRAL_WRITE_ENABLED. */
  centralWriteSource: string;
  /** Fallback SHA resolver (local builds). */
  resolveLocalGitSha?: () => string | undefined;
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Reads the compiled-in constant; throws if it is not an explicit boolean literal. */
export function parseCentralWriteFlag(source: string): boolean {
  const match =
    /export\s+const\s+LIVE_CENTRAL_WRITE_ENABLED\s*(?::\s*boolean\s*)?=\s*(true|false)\s*;/.exec(
      source,
    );
  if (!match) {
    throw new Error(
      "LIVE_CENTRAL_WRITE_ENABLED is not an explicit boolean literal; refusing to guess",
    );
  }
  return match[1] === "true";
}

function resolveEnvironment(processEnv: AttestationInputs["processEnv"]): AttestationEnvironment {
  const vercelEnv = str(processEnv.VERCEL_ENV);
  if (vercelEnv) {
    if ((ENVIRONMENTS as readonly string[]).includes(vercelEnv)) {
      return vercelEnv as AttestationEnvironment;
    }
    throw new Error(`Unrecognised VERCEL_ENV "${vercelEnv}"`);
  }
  // A build outside Vercel is never production.
  return "development";
}

function resolveSupabase(viteEnv: Record<string, unknown>): {
  supabaseProjectRef: string | null;
  demoMode: boolean;
} {
  const url = str(viteEnv.VITE_SUPABASE_URL);
  const key = str(viteEnv.VITE_SUPABASE_PUBLISHABLE_KEY);
  if (!url && !key) return { supabaseProjectRef: null, demoMode: true };
  if (!url || !key) {
    throw new Error(
      "Supabase config is partial: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY must both be set or both absent",
    );
  }
  const match = SUPABASE_URL_PATTERN.exec(url);
  if (!match || /lovable/i.test(url)) {
    throw new Error("VITE_SUPABASE_URL is not a valid https://<project-ref>.supabase.co URL");
  }
  return { supabaseProjectRef: match[1].toLowerCase(), demoMode: false };
}

export function buildAttestationManifest(inputs: AttestationInputs): AttestationManifest {
  const { viteEnv, processEnv } = inputs;
  const gitSha = (
    str(processEnv.VERCEL_GIT_COMMIT_SHA) ||
    str(processEnv.GITHUB_SHA) ||
    inputs.resolveLocalGitSha?.() ||
    ""
  ).toLowerCase();
  if (!GIT_SHA_PATTERN.test(gitSha)) {
    throw new Error("No valid 40-char Git commit SHA available for attestation");
  }

  const { supabaseProjectRef, demoMode } = resolveSupabase(viteEnv);
  const isDev = viteEnv.DEV === true;
  const governance = str(viteEnv.VITE_MEDIA_GOVERNANCE_MODE).toLowerCase();

  return {
    app: "ai-studio",
    gitSha,
    environment: resolveEnvironment(processEnv),
    supabaseProjectRef,
    activeFeatureFlags: {
      central_live_write_enabled: parseCentralWriteFlag(inputs.centralWriteSource),
      catalogue_ai_enabled: viteEnv.VITE_CATALOGUE_AI_ENABLED === "true",
      product_language_terms_schema_deployed:
        viteEnv.VITE_PRODUCT_LANGUAGE_TERMS_SCHEMA === "deployed",
      phase2c_test_seed_enabled: isDev || viteEnv.VITE_ENABLE_PHASE2C_TEST_SEED === "true",
      allow_local_catalogue_fallback:
        isDev && viteEnv.VITE_ALLOW_LOCAL_CATALOGUE_FALLBACK === "true",
      media_governance_production: governance === "production",
    },
    demoMode,
  };
}

function localGitSha(root: string): string | undefined {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return undefined;
  }
}

/**
 * Writes the manifest, or removes any stale one and logs why. A missing manifest
 * makes the Function fail closed with 503, so a bad build never attests stale data.
 */
export function writeAttestationManifest(
  root: string,
  viteEnv: Record<string, unknown>,
  processEnv: Record<string, string | undefined> = process.env,
): AttestationManifest | null {
  const dir = path.join(root, ATTESTATION_MANIFEST_DIR);
  const file = path.join(root, ATTESTATION_MANIFEST_RELATIVE_PATH);
  try {
    const manifest = buildAttestationManifest({
      viteEnv,
      processEnv,
      centralWriteSource: readFileSync(path.join(root, CENTRAL_WRITE_SOURCE), "utf8"),
      resolveLocalGitSha: () => localGitSha(root),
    });
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    return manifest;
  } catch (error) {
    rmSync(file, { force: true });
    console.warn(
      `[torch-attestation] manifest NOT written (endpoint will return 503): ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return null;
  }
}
