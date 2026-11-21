// @vitest-environment node
/**
 * WO-TB-02 — runtime attestation contract tests.
 * Exercises api/runtime-attestation.ts against a manifest produced by the real
 * build-time generator, plus a fresh `vite build` for packaging/isolation checks.
 */
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  existsSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import handler from "../../api/runtime-attestation";
import {
  ATTESTATION_MANIFEST_DIR,
  ATTESTATION_MANIFEST_FILE,
  ATTESTATION_MANIFEST_RELATIVE_PATH,
  FLAG_ALLOWLIST,
  writeAttestationManifest,
} from "../../scripts/torch-attestation-manifest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const manifestDir = path.join(root, ATTESTATION_MANIFEST_DIR);
const manifestFile = path.join(root, ATTESTATION_MANIFEST_RELATIVE_PATH);
const backupFile = `${manifestFile}.test-backup`;

// Generated per run so no credential-shaped literal lives in source.
const TOKEN = randomBytes(24).toString("hex");
const ROTATED_TOKEN = randomBytes(24).toString("hex");
const FAKE_PUBLISHABLE_KEY = randomBytes(24).toString("hex");
const SHA = "0123456789abcdef0123456789abcdef01234567";
const SIX_KEYS = [
  "activeFeatureFlags",
  "app",
  "demoMode",
  "environment",
  "gitSha",
  "supabaseProjectRef",
];
const LIVE_ENV = {
  VITE_SUPABASE_URL: "https://abcdefghij.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: FAKE_PUBLISHABLE_KEY,
};
const PROD_PROCESS_ENV = { VERCEL_ENV: "production", VERCEL_GIT_COMMIT_SHA: SHA };

interface Result {
  status: number;
  headers: Record<string, string>;
  body: string;
}

function call(method: string, token?: string): Result {
  const headers: Record<string, string> = {};
  let body = "";
  const res = {
    statusCode: 0,
    setHeader(k: string, v: string) {
      headers[k.toLowerCase()] = v;
    },
    end(b?: string) {
      body = b ?? "";
    },
  };
  const req = {
    method,
    headers: token === undefined ? {} : { "x-torch-attest-token": token },
  };
  handler(req as unknown as IncomingMessage, res as unknown as ServerResponse);
  return { status: res.statusCode, headers, body };
}

function buildManifest(
  viteEnv: Record<string, unknown>,
  processEnv: Record<string, string | undefined> = PROD_PROCESS_ENV,
) {
  const written = writeAttestationManifest(
    root,
    { DEV: false, PROD: true, MODE: "production", ...viteEnv },
    processEnv,
  );
  expect(written).not.toBeNull();
  return written;
}

function assertNoMetadata(r: Result) {
  for (const needle of [SHA, "abcdefghij", "ai-studio", "activeFeatureFlags", "supabase"]) {
    expect(r.body).not.toContain(needle);
  }
}

const ENV_KEYS = [
  "TORCH_ATTEST_TOKEN",
  "VERCEL_ENV",
  "VERCEL_GIT_COMMIT_SHA",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "VITE_CATALOGUE_AI_ENABLED",
] as const;
const savedEnv: Record<string, string | undefined> = {};
let hadManifest = false;

beforeAll(() => {
  hadManifest = existsSync(manifestFile);
  if (hadManifest) renameSync(manifestFile, backupFile);
});

afterAll(() => {
  rmSync(manifestFile, { force: true });
  if (hadManifest) renameSync(backupFile, manifestFile);
});

beforeEach(() => {
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
  process.env.TORCH_ATTEST_TOKEN = TOKEN;
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

describe("live 200 contract", () => {
  it("returns exactly the six frozen keys, no extras, no secrets", () => {
    buildManifest(LIVE_ENV);
    const r = call("GET", TOKEN);
    expect(r.status).toBe(200);
    const json = JSON.parse(r.body);
    expect(Object.keys(json).sort()).toEqual(SIX_KEYS);
    expect(json).toMatchObject({
      app: "ai-studio",
      gitSha: SHA,
      environment: "production",
      supabaseProjectRef: "abcdefghij",
      demoMode: false,
    });
    expect(Object.keys(json.activeFeatureFlags).sort()).toEqual([...FLAG_ALLOWLIST].sort());
    for (const v of Object.values(json.activeFeatureFlags)) expect(typeof v).toBe("boolean");
    expect(json.activeFeatureFlags.central_live_write_enabled).toBe(false);
    expect(r.body).not.toContain(TOKEN);
    expect(r.body).not.toContain(LIVE_ENV.VITE_SUPABASE_PUBLISHABLE_KEY);
    expect(r.body).not.toContain("supabase.co");
  });

  it("reflects explicit flag state from build inputs", () => {
    buildManifest({ ...LIVE_ENV, VITE_CATALOGUE_AI_ENABLED: "true" });
    const flags = JSON.parse(call("GET", TOKEN).body).activeFeatureFlags;
    expect(flags.catalogue_ai_enabled).toBe(true);
    expect(flags.central_live_write_enabled).toBe(false);
  });
});

describe("demo mode", () => {
  it("returns 200 with null project ref and demoMode true", () => {
    buildManifest({});
    const r = call("GET", TOKEN);
    expect(r.status).toBe(200);
    const json = JSON.parse(r.body);
    expect(Object.keys(json).sort()).toEqual(SIX_KEYS);
    expect(json.supabaseProjectRef).toBeNull();
    expect(json.demoMode).toBe(true);
  });
});

describe("rejections carry no metadata and are never cached", () => {
  beforeEach(() => {
    buildManifest(LIVE_ENV);
  });

  it.each(["POST", "PUT", "PATCH", "DELETE", "HEAD"])("%s -> 405 + Allow: GET", (method) => {
    const r = call(method, TOKEN);
    expect(r.status).toBe(405);
    expect(r.headers.allow).toBe("GET");
    expect(r.headers["cache-control"]).toBe("private, no-store");
    assertNoMetadata(r);
  });

  it("missing token -> 401", () => {
    const r = call("GET");
    expect(r.status).toBe(401);
    expect(r.headers["cache-control"]).toBe("private, no-store");
    assertNoMetadata(r);
  });

  it.each(["", "wrong", `${TOKEN}x`, TOKEN.slice(0, -1), TOKEN.toUpperCase()])(
    "invalid token %j -> 401",
    (bad) => {
      const r = call("GET", bad);
      expect(r.status).toBe(401);
      expect(r.headers["cache-control"]).toBe("private, no-store");
      assertNoMetadata(r);
    },
  );

  it("unset server token -> 503 even with a header", () => {
    delete process.env.TORCH_ATTEST_TOKEN;
    for (const t of [undefined, "", "anything"]) {
      const r = call("GET", t);
      expect(r.status).toBe(503);
      expect(r.headers["cache-control"]).toBe("private, no-store");
      assertNoMetadata(r);
    }
  });

  it("missing manifest -> 503", () => {
    rmSync(manifestFile, { force: true });
    const r = call("GET", TOKEN);
    expect(r.status).toBe(503);
    expect(r.headers["cache-control"]).toBe("private, no-store");
    assertNoMetadata(r);
  });

  it("wrong token is 401 (not 503) even when manifest is missing", () => {
    rmSync(manifestFile, { force: true });
    expect(call("GET", "wrong").status).toBe(401);
  });

  it.each([
    ["not json", "{nope"],
    ["empty object", "{}"],
    ["array", "[]"],
    ["null", "null"],
  ])("corrupt manifest (%s) -> 503", (_n, content) => {
    writeFileSync(manifestFile, content);
    const r = call("GET", TOKEN);
    expect(r.status).toBe(503);
    expect(r.headers["cache-control"]).toBe("private, no-store");
    assertNoMetadata(r);
  });

  it("manifest with an extra key or bad values -> 503", () => {
    const good = JSON.parse(readFileSync(manifestFile, "utf8"));
    const bad: Array<Record<string, unknown>> = [
      { ...good, extra: 1 },
      { ...good, gitSha: "ABC" },
      { ...good, gitSha: good.gitSha.toUpperCase() },
      { ...good, environment: "staging" },
      { ...good, app: "other" },
      { ...good, demoMode: "false" },
      { ...good, demoMode: true },
      { ...good, supabaseProjectRef: null },
      { ...good, activeFeatureFlags: { ...good.activeFeatureFlags, rogue: true } },
      { ...good, activeFeatureFlags: { ...good.activeFeatureFlags, catalogue_ai_enabled: null } },
      {
        ...good,
        activeFeatureFlags: Object.fromEntries(
          Object.entries(good.activeFeatureFlags).filter(([k]) => k !== "catalogue_ai_enabled"),
        ),
      },
    ];
    for (const m of bad) {
      writeFileSync(manifestFile, JSON.stringify(m));
      const r = call("GET", TOKEN);
      expect(r.status).toBe(503);
      assertNoMetadata(r);
    }
  });

  it("200 also sends Cache-Control: private, no-store", () => {
    expect(call("GET", TOKEN).headers["cache-control"]).toBe("private, no-store");
  });
});

describe("generator fails closed", () => {
  const cases: Array<[string, Record<string, unknown>, Record<string, string | undefined>]> = [
    ["partial supabase config", { VITE_SUPABASE_URL: LIVE_ENV.VITE_SUPABASE_URL }, PROD_PROCESS_ENV],
    ["non-supabase url", { ...LIVE_ENV, VITE_SUPABASE_URL: "https://example.com" }, PROD_PROCESS_ENV],
    ["lovable url", { ...LIVE_ENV, VITE_SUPABASE_URL: "https://lovable.supabase.co" }, PROD_PROCESS_ENV],
    ["invalid sha", LIVE_ENV, { VERCEL_ENV: "production", VERCEL_GIT_COMMIT_SHA: "local" }],
    ["unknown VERCEL_ENV", LIVE_ENV, { VERCEL_ENV: "qa", VERCEL_GIT_COMMIT_SHA: SHA }],
  ];
  it.each(cases)("%s -> no manifest, endpoint 503 (stale manifest removed)", (_n, vite, proc) => {
    buildManifest(LIVE_ENV); // stale good manifest
    expect(existsSync(manifestFile)).toBe(true);
    expect(writeAttestationManifest(root, { DEV: false, ...vite }, proc)).toBeNull();
    expect(existsSync(manifestFile)).toBe(false);
    expect(call("GET", TOKEN).status).toBe(503);
  });
});

describe("build-time isolation", () => {
  it("runtime env changes do not alter the baked response; token changes do", () => {
    buildManifest(LIVE_ENV);
    const baseline = call("GET", TOKEN);
    expect(baseline.status).toBe(200);

    process.env.VERCEL_ENV = "development";
    process.env.VERCEL_GIT_COMMIT_SHA = "f".repeat(40);
    process.env.VITE_SUPABASE_URL = "https://zzzzzzzzzz.supabase.co";
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY = randomBytes(8).toString("hex");
    process.env.VITE_CATALOGUE_AI_ENABLED = "true";
    const after = call("GET", TOKEN);
    expect(after.status).toBe(200);
    expect(after.body).toBe(baseline.body);

    process.env.TORCH_ATTEST_TOKEN = ROTATED_TOKEN;
    expect(call("GET", TOKEN).status).toBe(401);
    expect(call("GET", ROTATED_TOKEN).status).toBe(200);
    process.env.TORCH_ATTEST_TOKEN = TOKEN;
    expect(call("GET", TOKEN).status).toBe(200);
  });

  it("handler source never reads import.meta.env or VITE_/VERCEL_ vars", () => {
    const src = readFileSync(path.join(root, "api/runtime-attestation.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(src).not.toContain("import.meta.env");
    expect(src).not.toMatch(/process\.env\.(?!TORCH_ATTEST_TOKEN\b)/);
  });
});

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    return statSync(p).isDirectory() ? [p, ...listFiles(p)] : [p];
  });
}

describe("fresh build packaging", () => {
  it(
    "writes the manifest outside dist/ and public/ and never copies it into them",
    () => {
      rmSync(manifestDir, { recursive: true, force: true });
      rmSync(path.join(root, "dist"), { recursive: true, force: true });
      execFileSync("npx", ["vite", "build"], {
        cwd: root,
        stdio: "pipe",
        env: {
          ...process.env,
          ...LIVE_ENV,
          VERCEL_ENV: "preview",
          VERCEL_GIT_COMMIT_SHA: SHA,
        },
      });
      expect(existsSync(manifestFile)).toBe(true);
      const built = JSON.parse(readFileSync(manifestFile, "utf8"));
      expect(built).toMatchObject({ gitSha: SHA, environment: "preview", demoMode: false });

      for (const dir of ["dist", "public"]) {
        const offenders = listFiles(path.join(root, dir)).filter(
          (f) =>
            f.includes(ATTESTATION_MANIFEST_DIR) ||
            path.basename(f) === ATTESTATION_MANIFEST_FILE,
        );
        expect(offenders).toEqual([]);
      }
      // The built manifest is what the handler serves.
      expect(JSON.parse(call("GET", TOKEN).body)).toEqual(built);
    },
    180_000,
  );

  it("vercel.json packages the manifest with the function and excludes /api from the SPA rewrite", () => {
    const cfg = JSON.parse(readFileSync(path.join(root, "vercel.json"), "utf8"));
    const fn = cfg.functions["api/runtime-attestation.ts"];
    // Must cover the manifest path (exact file or the directory glob) and sit outside dist/ and public/.
    expect([ATTESTATION_MANIFEST_RELATIVE_PATH, `${ATTESTATION_MANIFEST_DIR}/**`]).toContain(
      fn.includeFiles,
    );
    expect(fn.includeFiles.startsWith("dist/")).toBe(false);
    expect(fn.includeFiles.startsWith("public/")).toBe(false);

    const rewrite = cfg.rewrites.find((r: { destination: string }) => r.destination === "/index.html");
    const re = new RegExp(`^${rewrite.source}$`);
    expect(re.test("/api/runtime-attestation")).toBe(false);
    expect(re.test("/api/anything/else")).toBe(false);
    expect(re.test("/")).toBe(true);
    expect(re.test("/products/123")).toBe(true);
  });
});
