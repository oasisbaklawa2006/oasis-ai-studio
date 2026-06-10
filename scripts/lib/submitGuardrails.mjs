/**
 * Guardrails for governed catalogue_alias_drafts submit scripts.
 * Default: dry-run summary only. Live SQL requires CONFIRM_LIVE_SUBMIT=true.
 */

export function idempotencyKey(row) {
  const p = row.payload ?? {};
  const source = String(p.source ?? row.source_app ?? "").trim().toLowerCase();
  const productId = String(p.product_id ?? row.target_record_id ?? "").trim().toLowerCase();
  const alias = String(p.alias_text ?? p.alias ?? "").trim().toLowerCase();
  return `${source}|${productId}|${alias}`;
}

export function dedupeDraftRows(rows, { batchLabel = "batch" } = {}) {
  const seen = new Map();
  const unique = [];
  const duplicates = [];

  for (const row of rows) {
    const key = idempotencyKey(row);
    if (!key || key === "||") {
      unique.push(row);
      continue;
    }
    if (seen.has(key)) {
      duplicates.push({ key, row });
      continue;
    }
    seen.set(key, row);
    unique.push(row);
  }

  return { unique, duplicates, batchLabel };
}

export function resolveSubmitMode(argv = process.argv, env = process.env) {
  const liveFlag = argv.includes("--live");
  const dryRunFlag = argv.includes("--dry-run");
  const live = liveFlag && !dryRunFlag;
  const confirm = env.CONFIRM_LIVE_SUBMIT === "true";

  return { live, confirm, dryRun: !live };
}

export function buildInsertSql(rows) {
  const json = JSON.stringify(rows).replace(/'/g, "''");
  return `
INSERT INTO catalogue_alias_drafts (
  source_app, target_table, target_record_id, operation, payload, status, submitted_by
)
SELECT
  elem->>'source_app',
  elem->>'target_table',
  NULLIF(elem->>'target_record_id', '')::uuid,
  elem->>'operation',
  elem->'payload',
  elem->>'status',
  (elem->>'submitted_by')::uuid
FROM jsonb_array_elements('${json}'::jsonb) AS elem
RETURNING id;
`;
}

export function printDryRunSummary({ batchLabel, rows, duplicates, chunkIdx, chunkCount }) {
  const bySource = {};
  const byProduct = {};
  for (const row of rows) {
    const source = row.payload?.source ?? "unknown";
    bySource[source] = (bySource[source] ?? 0) + 1;
    const pid = row.payload?.product_id ?? "?";
    byProduct[pid] = (byProduct[pid] ?? 0) + 1;
  }

  const summary = {
    mode: "dry-run",
    batch: batchLabel,
    chunk: chunkIdx,
    chunk_rows: rows.length,
    chunk_count: chunkCount,
    duplicate_rows_skipped: duplicates.length,
    by_source: bySource,
    by_product_count: Object.keys(byProduct).length,
    live_guard: "Set CONFIRM_LIVE_SUBMIT=true and pass --live to emit SQL",
    warning:
      "Wave drafts may already be approved in production. Do not re-submit without checking pending drafts.",
  };

  console.error(JSON.stringify(summary, null, 2));
}

export function guardSubmit({ rows, batchLabel, chunkIdx = 0, chunkCount = 1, argv, env }) {
  const { live, confirm } = resolveSubmitMode(argv, env);
  const { unique, duplicates } = dedupeDraftRows(rows, { batchLabel });

  if (!unique.length) {
    console.error(JSON.stringify({ mode: live ? "live" : "dry-run", batch: batchLabel, chunk: chunkIdx, rows: 0 }));
    return { emitted: false, rows: [] };
  }

  if (!live) {
    printDryRunSummary({ batchLabel, rows: unique, duplicates, chunkIdx, chunkCount });
    return { emitted: false, rows: unique };
  }

  if (!confirm) {
    console.error(
      `[${batchLabel}] Refusing live SQL: CONFIRM_LIVE_SUBMIT=true is required. Use --dry-run (default) for preview.`,
    );
    process.exit(1);
  }

  if (duplicates.length) {
    console.error(
      `[${batchLabel}] Refusing live SQL: ${duplicates.length} duplicate idempotency keys in chunk ${chunkIdx}.`,
    );
    process.exit(1);
  }

  return { emitted: true, rows: unique, sql: buildInsertSql(unique) };
}
