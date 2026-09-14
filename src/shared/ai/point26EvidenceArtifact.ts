import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const POINT26_EVIDENCE_OUT_PATH = join(
  process.cwd(),
  "audit-artifacts",
  "point26-inference-audit",
  "census-evidence.json",
);

export type Point26CertificationCheck = {
  name: string;
  passed: boolean;
  detail: string;
};

export type Point26EvidenceArtifact = Record<string, unknown> & {
  certification_checks: Point26CertificationCheck[];
};

/** Merge certification workstation results into the durable Point 26 evidence artifact. */
export function augmentPoint26EvidenceWithCertificationChecks(
  baseEvidence: Record<string, unknown>,
  certificationChecks: Point26CertificationCheck[],
): Point26EvidenceArtifact {
  return {
    ...baseEvidence,
    certification_checks: certificationChecks,
  };
}

export function readPoint26EvidenceArtifact(
  path: string = POINT26_EVIDENCE_OUT_PATH,
): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

export function writePoint26EvidenceArtifact(
  evidence: Record<string, unknown>,
  path: string = POINT26_EVIDENCE_OUT_PATH,
): void {
  writeFileSync(path, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
}

export function persistPoint26CertificationEvidence(
  certificationChecks: Point26CertificationCheck[],
  path: string = POINT26_EVIDENCE_OUT_PATH,
): Point26EvidenceArtifact {
  const baseEvidence = readPoint26EvidenceArtifact(path);
  const evidence = augmentPoint26EvidenceWithCertificationChecks(baseEvidence, certificationChecks);
  writePoint26EvidenceArtifact(evidence, path);
  return evidence;
}

export function assertPoint26EvidenceHasCertificationChecks(
  evidence: unknown,
): asserts evidence is Point26EvidenceArtifact {
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
    throw new Error("Point 26 evidence artifact must be an object");
  }
  const checks = (evidence as Record<string, unknown>).certification_checks;
  if (!Array.isArray(checks)) {
    throw new Error("Point 26 evidence artifact missing certification_checks array");
  }
  for (const check of checks) {
    if (!check || typeof check !== "object" || Array.isArray(check)) {
      throw new Error("certification_checks entries must be objects");
    }
    const row = check as Record<string, unknown>;
    if (
      typeof row.name !== "string" ||
      typeof row.detail !== "string" ||
      typeof row.passed !== "boolean"
    ) {
      throw new Error("certification_checks entry missing name/passed/detail");
    }
  }
}
