# AI Studio — Final Internal MVP Status

_Last updated: versioned snapshot + Central sync preview branch_

## Shipped on `main` (prior PRs)

| PR | Scope |
|----|--------|
| #19 | Security/tooling, AI compliance safety (suggestion-only GST/HSN) |
| #20 | Product Truth MVP — readiness, UOM/packaging, channel/pricing/MOQ, Product Truth tab |

## This branch adds

- **Versioned catalogue snapshots** (`catalogue_versions`) with immutable approved/published/synced rows
- **Central sync preview** (connector 25B/25C shape, no live write)
- **Sync event log** (`catalogue_sync_events`, `preview_only` status)
- **Product Truth → Central Sync** admin panel

## Internal MVP checklist

| Capability | Status |
|------------|--------|
| Product readiness scoring | Ready |
| UOM / packaging engines | Ready |
| Channel pricing / MOQ validation | Ready |
| Compliance manual approval (GST/HSN) | Ready |
| Versioned snapshot JSON | Ready (this branch) |
| Central export preview | Ready (this branch) |
| Live Central sync | **Not live** |
| Oasis Central repo changes | **Out of scope** |

## Operations

- Run migration on AI Studio Supabase before relying on DB-backed version history
- Until then, versions/events persist in browser `localStorage` per product
- Do not enable `LIVE_CENTRAL_WRITE_ENABLED` without Central pilot sign-off

## Recommended merge

Safe to merge after review: additive schema, preview-only Central path, tests green. Apply migration in AI Studio staging before production catalogue publish workflows.
