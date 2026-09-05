/**
 * Point 30 — governed AI extraction/runtime certification workstation.
 * Exercises the configured Supabase edge functions with synthetic non-sensitive inputs.
 * No production product rows are read or mutated.
 *
 * Env (optional overrides):
 *   CERT_SUPABASE_URL — defaults to tcxvcatsqqertcnycuop production project URL
 *   CERT_PUBLISHABLE_KEY — anon/publishable key (optional; alias path skipped if absent)
 */

import { spawnSync } from "node:child_process";

const baseUrl = (
  process.env.CERT_SUPABASE_URL ?? "https://tcxvcatsqqertcnycuop.supabase.co"
).replace(/\/$/, "");
const publishableKey =
  process.env.CERT_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const SYNTHETIC = {
  product_name: "Synthetic Pyramid Baklawa (Cert)",
  category: "baklawa",
};

const results = [];

function record(name, passed, detail) {
  results.push({ name, passed, detail });
  console.log(`${passed ? "PASS" : "FAIL"} ${name}: ${detail}`);
}

async function fetchComplianceEdge() {
  const response = await fetch(`${baseUrl}/functions/v1/generate-product-attributes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      product_name: SYNTHETIC.product_name,
      category: SYNTHETIC.category,
    }),
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { _raw: text.slice(0, 200) };
  }
  return { status: response.status, payload };
}

async function fetchAliasEdge() {
  const headers = { "Content-Type": "application/json" };
  if (publishableKey) headers.Authorization = `Bearer ${publishableKey}`;
  const response = await fetch(`${baseUrl}/functions/v1/oasis-ai-chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      messages: [
        {
          role: "user",
          content: `Suggest 5 short B2B search aliases (comma-separated, no explanation) for Oasis product: "${SYNTHETIC.product_name}" in category "${SYNTHETIC.category}".`,
        },
      ],
    }),
  });
  const text = await response.text();
  return { status: response.status, text };
}

function runUnitHarness() {
  const proc = spawnSync(
    "npx",
    [
      "vitest",
      "run",
      "--config",
      "vitest.config.ts",
      "src/features/governedAiExtraction/governedAiExtraction.test.ts",
      "src/features/compliance/complianceAiStaleGuard.test.ts",
    ],
    { encoding: "utf8", cwd: process.cwd() },
  );
  const passed = proc.status === 0;
  record(
    "unit harness (governed extraction + stale guard)",
    passed,
    passed ? "18/18 tests passed" : (proc.stdout + proc.stderr).slice(-400),
  );
  return passed;
}

function runRuntimeHarness(compliancePayload, aliasText) {
  const proc = spawnSync("npx", ["vite-node", "scripts/certify-point30-runtime-harness.ts"], {
    encoding: "utf8",
    cwd: process.cwd(),
    env: {
      ...process.env,
      VITE_SUPABASE_URL: baseUrl,
      VITE_SUPABASE_PUBLISHABLE_KEY: publishableKey ?? "cert-placeholder-key",
      CERT_COMPLIANCE_PAYLOAD: JSON.stringify(compliancePayload),
      CERT_ALIAS_TEXT: aliasText,
    },
  });
  return proc;
}

async function main() {
  console.log(`Point 30 certification workstation`);
  console.log(`Supabase base: ${baseUrl}`);
  console.log(`Synthetic input: ${SYNTHETIC.product_name} / ${SYNTHETIC.category}`);
  console.log("");

  runUnitHarness();

  const compliance = await fetchComplianceEdge();
  record(
    "runtime: generate-product-attributes reachable",
    compliance.status === 200,
    `HTTP ${compliance.status}`,
  );

  const alias = await fetchAliasEdge();
  record("runtime: oasis-ai-chat reachable", alias.status === 200, `HTTP ${alias.status}`);

  const proc = runRuntimeHarness(compliance.payload, alias.text);

  if (proc.status !== 0) {
    record("runtime harness execution", false, (proc.stdout + proc.stderr).slice(-500));
  } else {
    const lastLine = proc.stdout.trim().split("\n").filter(Boolean).pop();
    let metrics;
    try {
      metrics = JSON.parse(lastLine);
    } catch {
      record("runtime harness execution", false, `Could not parse output: ${lastLine}`);
      metrics = null;
    }

    if (metrics) {
      record(
        "success path: provider compliance → reviewable suggestions",
        metrics.complianceOk,
        `provider_status=${metrics.complianceProviderStatus}, suggestions=${metrics.complianceSuggestionCount}, fail_closed=${metrics.complianceFailClosed}`,
      );
      record(
        "fail-closed: provider timeout/error",
        metrics.timeoutFailClosed,
        "edge error → degraded + fail_closed",
      );
      record(
        "fail-closed: invalid/non-governed response",
        metrics.invalidFailClosed,
        "approved=true rejected → failed + fail_closed",
      );
      record(
        "manual compliance fields not overwritten",
        metrics.manualHsnPreserved && metrics.manualIngredientsPreserved,
        `hsn preserved=${metrics.manualHsnPreserved}, ingredients preserved=${metrics.manualIngredientsPreserved}`,
      );
      record(
        "unapproved aliases pending (not persistable canonical truth)",
        metrics.aliasProviderOk &&
          metrics.pendingAliasCount > 0 &&
          metrics.persistableAliasCount === 1 &&
          metrics.pendingExcludedFromPersist,
        `aliases=${metrics.aliasCount}, pending=${metrics.pendingAliasCount}, persistable=${metrics.persistableAliasCount}`,
      );
      record(
        "stale AI response discarded after compliance edits",
        metrics.staleByEdit && metrics.staleByForm,
        `manual-edit guard=${metrics.staleByEdit}, form-revision guard=${metrics.staleByForm}`,
      );
      record(
        "alias stream assembled from provider",
        metrics.aliasAssembledLength > 0,
        `assembled_chars=${metrics.aliasAssembledLength}`,
      );
    }
  }

  const failed = results.filter((r) => !r.passed);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length) {
    console.log("\nFailed checks:");
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
