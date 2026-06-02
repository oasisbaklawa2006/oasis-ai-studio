# Supabase environment map (Catalogue / Central)

> Owner-maintained. Agents must verify project ref in the Supabase dashboard before any mutating SQL.

## Project references

| Ref | Dashboard name | Role in repo | Notes |
|-----|----------------|--------------|-------|
| `tcxvcatsqqertcnycuop` | oasis-baklawa | **Live Central / production** (unless owner relabels) | Documented in `docs/CENTRAL_SUPABASE_CHECKLIST.md` as the canonical Central target. ~300+ live products. |
| `aruyieslaxjhnamlstpx` | *(unknown)* | **Intended staging** (not verified here) | Not referenced in this repository. Not accessible via agent MCP in prior sessions. Confirm in dashboard before use. |
| `wgajrxyoararisiwjzox` | *(legacy)* | **Lovable / old** | `supabase/config.toml` + local `.env.example` lineage; not Central. |

## Naming rules for agents and runbooks

1. Do **not** call SQL or sign-off “staging” unless the **target ref** is confirmed in the Supabase dashboard (or an updated row in this table).
2. `tcxvcatsqqertcnycuop` = **Central** in docs; treat as **production** until a separate staging ref is documented and used.
3. Migrations and approval mapping tests belong on **verified staging** first, then production with explicit owner approval.

## PR-06C1a incident (2026-06-02)

- **Intent:** Run PR-06C1a on staging.
- **Actual:** `PR06C1_central_tag_alias_approve_mapping.sql` and manual approve tests were applied on **`tcxvcatsqqertcnycuop`** (live Central).
- **Function:** `approve_catalogue_draft_internal` + `catalogue_slugify_tag_part` remain deployed on production. **Do not rollback** unless owner explicitly requests it.
- **Test data:** Master rows, drafts (`source_app = 'pr06c1_staging_verify'`), and linked audit rows must be removed via owner-reviewed cleanup — see `scripts/supabase/PR06C1a_production_test_artifact_cleanup.sql`.
- **Optional follow-up:** Four blocked-approve test drafts (`payload = {"test": true}`, `submitted_at` ~ `2026-06-02 04:05:34 UTC`) use default `source_app = 'catalogue_app'`; not in the primary cleanup script. See optional block at end of that file.

## Related docs

- `docs/CENTRAL_SUPABASE_CHECKLIST.md` — env vars and ref assertion
- `docs/PR06C_APPROVAL_MAPPING.md` — C1a payload mapping
- `scripts/supabase/PR06C1a_production_test_artifact_cleanup.sql` — production test artifact cleanup (do not run without owner review)
