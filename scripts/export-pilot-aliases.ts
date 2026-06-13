import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { buildAllPilotAliasBundles } from "../src/features/productAuthority/pilotAliasEngine";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "data", "pilot");

const bundles = buildAllPilotAliasBundles();
const rows = bundles.flatMap((b) => b.terms);
const payload = { generated_at: new Date().toISOString(), bundles, rows };

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "pilot_5sku_alias_suggestions.json"), JSON.stringify(payload, null, 2) + "\n");

const headers = [
  "sku",
  "product_name",
  "alias_text",
  "alias_type",
  "channel_scope",
  "review_status",
  "collision_level",
  "collision_reason",
];
const csv = [
  headers.join(","),
  ...rows.map((r) =>
    headers
      .map((h) => {
        const v =
          h === "collision_level"
            ? r.collision.level
            : h === "collision_reason"
              ? r.collision.reason
              : (r as Record<string, unknown>)[h];
        return `"${String(v ?? "").replace(/"/g, '""')}"`;
      })
      .join(","),
  ),
].join("\n");
writeFileSync(join(OUT, "pilot_5sku_alias_suggestions.csv"), csv + "\n");
console.log("Exported pilot alias suggestions to data/pilot/");
