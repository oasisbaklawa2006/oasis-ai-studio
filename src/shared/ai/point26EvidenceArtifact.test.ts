import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertPoint26EvidenceHasCertificationChecks,
  augmentPoint26EvidenceWithCertificationChecks,
  type Point26CertificationCheck,
  persistPoint26CertificationEvidence,
} from "./point26EvidenceArtifact";

describe("point26EvidenceArtifact", () => {
  let tempDir: string | undefined;

  afterEach(() => {
    tempDir = undefined;
  });

  function tempEvidencePath(): string {
    tempDir = mkdtempSync(join(tmpdir(), "point26-evidence-"));
    return join(tempDir, "census-evidence.json");
  }

  it("merges certification_checks into the durable evidence object", () => {
    const checks: Point26CertificationCheck[] = [
      { name: "typecheck", passed: true, detail: "tsc --noEmit PASS" },
      { name: "repo boundaries", passed: true, detail: "0 violations" },
    ];
    const merged = augmentPoint26EvidenceWithCertificationChecks(
      { point: 26, baseline_sha: "abc123" },
      checks,
    );
    assertPoint26EvidenceHasCertificationChecks(merged);
    expect(merged.certification_checks).toEqual(checks);
    expect(merged.point).toBe(26);
  });

  it("persists failed certification_checks into written JSON", () => {
    const path = tempEvidencePath();
    writeFileSync(
      path,
      `${JSON.stringify({ point: 26, census_summary: { llm_boundaries: 2 } }, null, 2)}\n`,
      "utf8",
    );

    const checks: Point26CertificationCheck[] = [
      { name: "typecheck", passed: true, detail: "tsc --noEmit PASS" },
      { name: "unit: inference census", passed: false, detail: "2 tests failed" },
    ];

    persistPoint26CertificationEvidence(checks, path);

    const onDisk = JSON.parse(readFileSync(path, "utf8"));
    assertPoint26EvidenceHasCertificationChecks(onDisk);
    expect(onDisk.certification_checks).toHaveLength(2);
    expect(onDisk.certification_checks[1]).toEqual({
      name: "unit: inference census",
      passed: false,
      detail: "2 tests failed",
    });
  });

  it("rejects evidence missing certification_checks", () => {
    expect(() => assertPoint26EvidenceHasCertificationChecks({ point: 26 })).toThrow(
      /missing certification_checks/,
    );
  });
});
