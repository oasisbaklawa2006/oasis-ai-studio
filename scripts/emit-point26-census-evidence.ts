import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  AI_INFERENCE_BOUNDARY_CENSUS,
  SHADOW_INFERENCE_RISKS,
  summarizeCensusForAudit,
} from "../src/shared/ai/inferenceCensus";

const summary = summarizeCensusForAudit();
const evidence = {
  point: 26,
  title: "AI inference / audit authority closure",
  generated_at: new Date().toISOString(),
  baseline_sha: summary.baseline_sha,
  census_summary: summary,
  boundaries: AI_INFERENCE_BOUNDARY_CENSUS,
  shadow_risks: SHADOW_INFERENCE_RISKS,
};

const outDir = join(process.cwd(), "audit-artifacts", "point26-inference-audit");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "census-evidence.json");
writeFileSync(outPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ outPath, summary }));
