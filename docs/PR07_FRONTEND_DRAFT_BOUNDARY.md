# PR-07 Frontend Draft Write Boundary

## Role behavior
- `super_admin`: direct master write mode preserved for product save.
- `catalogue_contributor`: cannot write master product directly; submits drafts.
- other roles: read-only for product save path in this PR.

## Draft table map
- product -> `catalogue_product_drafts` -> `catalogue.products.submit`
- media -> `catalogue_media_submissions` -> `catalogue.media.submit`
- alias -> `catalogue_alias_drafts` -> `catalogue.alias.submit`
- bom -> `catalogue_bom_drafts` -> `catalogue.bom.submit`
- moq -> `catalogue_moq_drafts` -> `catalogue.moq.submit`
- pricing -> `catalogue_pricing_drafts` -> `catalogue.pricing.submit`
- tag -> `catalogue_tag_drafts` -> `catalogue.tags.submit`

## What was refactored in PR-07
- Added central permission helpers using RPCs:
  - `get_my_role_keys()`
  - `has_catalogue_permission(permission_key)`
  - `is_catalogue_reviewer()`
- Added draft submission service + hook.
- Added Approval Inbox page (`/approvals`) for reviewers.
- Added write-mode safety banner.
- Refactored **ProductEdit create/update save only**:
  - super_admin path remains direct insert/update to `products`.
  - catalogue_contributor path now submits `catalogue_product_drafts`.
  - read-only users are blocked.

## What remains direct-write (pending PR-08)
- media flows
- alias flows
- BOM flows
- MOQ flows
- pricing flows
- tags flows
- other write surfaces listed in `docs/WRITE_SURFACE_MAP.md`

## How to test
1. Login as `super_admin`:
   - ProductEdit save should update `products` directly.
   - Banner should show "Direct master write mode".
2. Login as `catalogue_contributor`:
   - ProductEdit save should create row in `catalogue_product_drafts`.
   - Success message: "Submitted for approval. No master product was changed."
   - Banner should show "Draft submission mode — changes require approval".
3. Login as unsupported/read-only role:
   - ProductEdit save should be blocked with permission message.
   - Banner should show "Read-only mode".
4. Reviewer/super_admin:
   - `/approvals` should list pending drafts and allow reject.
   - approve may return mapping-not-finalized warning for now.
