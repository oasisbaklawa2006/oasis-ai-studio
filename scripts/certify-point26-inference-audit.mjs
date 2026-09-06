/**
 * Point 26 — inference audit / safety closure certification workstation.
 * Runs unit census tests and emits durable audit evidence JSON.
 * No production data mutation.
 */

import { spawnSync } from "node:child_process";
import { join } from "node:path";

const EVIDENCE_OUT_PATH = join(
  process.cwd(),
  "audit-artifacts",
  "point26-inference-audit",
  "census-evidence.json",
);

const results = [];

function record(name, passed, detail) {
  results.push({ name, passed, detail });
  console.log(`${passed ? "PASS" : "FAIL"} ${name}: ${detail}`);
}

function runUnitTests() {
  const proc = spawnSync(
    "npx",
    [
      "vitest",
      "run",
      "--config",
      "vitest.config.ts",
      "src/shared/ai/inferenceCensus.test.ts",
      "src/shared/ai/inferenceProvenance.test.ts",
      "src/shared/ai/point26EvidenceArtifact.test.ts",
      "src/features/catalogueAiStudio/catalogueAiGateway.test.ts",
      "src/features/catalogueAiStudio/catalogueAiGenerationMerge.test.ts",
    ],
    { encoding: "utf8", cwd: process.cwd() },
  );
  const passed = proc.status === 0;
  record(
    "unit: inference census + provenance + catalogue gateway",
    passed,
    passed ? "all targeted tests passed" : (proc.stdout + proc.stderr).slice(-600),
  );
  return passed;
}

function runTypecheck() {
  const proc = spawnSync("npm", ["run", "typecheck"], { encoding: "utf8", cwd: process.cwd() });
  const passed = proc.status === 0;
  record(
    "typecheck",
    passed,
    passed ? "tsc --noEmit PASS" : (proc.stdout + proc.stderr).slice(-400),
  );
  return passed;
}

function runBoundaries() {
  const proc = spawnSync("npm", ["run", "check:boundaries"], {
    encoding: "utf8",
    cwd: process.cwd(),
  });
  const passed = proc.status === 0;
  record(
    "repo boundaries",
    passed,
    passed ? "0 violations" : (proc.stdout + proc.stderr).slice(-400),
  );
  return passed;
}

async function emitEvidence() {
  const proc = spawnSync("npx", ["vite-node", "scripts/emit-point26-census-evidence.ts"], {
    encoding: "utf8",
    cwd: process.cwd(),
  });

  if (proc.status !== 0) {
    record("emit census evidence", false, (proc.stdout + proc.stderr).slice(-400));
    throw new Error("Failed to emit census evidence");
  }

  const finalize = spawnSync("npx", ["vite-node", "scripts/finalize-point26-census-evidence.ts"], {
    encoding: "utf8",
    cwd: process.cwd(),
    env: {
      ...process.env,
      POINT26_CERTIFICATION_CHECKS: JSON.stringify(results),
    },
  });

  if (finalize.status !== 0) {
    record(
      "persist certification evidence",
      false,
      (finalize.stdout + finalize.stderr).slice(-400),
    );
    throw new Error("Failed to persist certification evidence");
  }

  console.log(`\nEvidence written: ${EVIDENCE_OUT_PATH}`);
  return { certification_checks: results };
}

async function main() {
  console.log("Point 26 — inference audit closure certification");
  console.log("");

  runUnitTests();
  runTypecheck();
  runBoundaries();

  await emitEvidence();
  const failed = results.filter((r) => !r.passed);

  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  console.log(
    `Evidence artifact includes ${results.length} certification_checks at ${EVIDENCE_OUT_PATH}`,
  );

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
