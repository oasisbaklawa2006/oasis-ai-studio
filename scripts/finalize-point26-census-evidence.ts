import {
  type Point26CertificationCheck,
  persistPoint26CertificationEvidence,
} from "../src/shared/ai/point26EvidenceArtifact";

const raw = process.env.POINT26_CERTIFICATION_CHECKS;
if (!raw) {
  console.error("POINT26_CERTIFICATION_CHECKS env var required");
  process.exit(1);
}

let checks: Point26CertificationCheck[];
try {
  checks = JSON.parse(raw) as Point26CertificationCheck[];
} catch {
  console.error("POINT26_CERTIFICATION_CHECKS must be valid JSON");
  process.exit(1);
}

const evidence = persistPoint26CertificationEvidence(checks);
console.log(
  JSON.stringify({
    outPath: evidence.certification_checks.length,
    checks: evidence.certification_checks.length,
  }),
);
