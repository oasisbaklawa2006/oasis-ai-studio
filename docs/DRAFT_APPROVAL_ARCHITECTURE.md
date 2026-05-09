# Draft Approval Architecture (Design-Only, No SQL Yet)

## Purpose
Define a safe contributor workflow for Catalogue App changes without allowing direct writes to master tables.

## Role model
- Add/confirm `catalogue_contributor` role for contributor users.
- `owner`/`admin` remain final approvers.

## Core principle
Contributors can create submissions/drafts only. They cannot update/delete master product/catalogue/label/BOM/pricing tables directly.

## Proposed draft/submission tables
- `catalogue_product_drafts`
- `catalogue_media_submissions`
- `catalogue_bom_drafts`
- `catalogue_price_moq_drafts`
- `catalogue_catalogue_drafts`
- `catalogue_import_logs`

## Draft record pattern
Each draft row should include:
- `source_app` (fixed: `catalogue_app`)
- `status` lifecycle (`pending_approval` -> `approved` / `rejected`)
- `payload` (`jsonb`) containing normalized patch data
- review metadata:
  - `reviewed_by`
  - `reviewed_at`
  - `review_notes`

## Approval inbox
- A central inbox view/list groups pending drafts across all draft tables.
- Owner/admin reviewers process pending items in one queue.

## Approval RPC concept
- Owner/admin-only RPCs apply approved draft payloads into master tables.
- Approval RPCs should:
  - validate actor role
  - validate payload schema
  - write master table updates in transaction
  - mark draft as approved/rejected with reviewer metadata

## Why contributors cannot update/delete master tables
- Preserves data integrity and auditability.
- Prevents accidental overwrite of production catalogue content.
- Enables traceable, reviewable change workflow.
- Supports phased rollout and rollback safety.

## Out of scope for this PR
- No migration SQL.
- No schema changes.
- No frontend feature refactor yet.
