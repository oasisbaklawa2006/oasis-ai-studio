import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const baseRef = process.env.QUALITY_BASE_REF;
if (!baseRef || /^0+$/.test(baseRef)) {
  console.log("No comparable base ref; changed-file Biome check skipped.");
  process.exit(0);
}

const changed = execFileSync(
  "git",
  ["diff", "--name-only", "--diff-filter=ACMR", `${baseRef}...HEAD`],
  { encoding: "utf8" },
)
  .split("\n")
  .map((file) => file.trim())
  .filter(Boolean)
  .filter((file) => /\.(?:cjs|js|json|jsx|mjs|ts|tsx)$/.test(file))
  .filter((file) => existsSync(file));

if (changed.length === 0) {
  console.log("No changed JavaScript, TypeScript or JSON files to check.");
  process.exit(0);
}

const biomeBin = path.resolve("node_modules/.bin/biome");
const result = spawnSync(biomeBin, ["check", ...changed], { stdio: "inherit" });
process.exit(result.status ?? 1);
