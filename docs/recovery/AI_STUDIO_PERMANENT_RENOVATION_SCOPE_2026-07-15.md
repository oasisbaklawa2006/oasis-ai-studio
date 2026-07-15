# Oasis AI Studio — Permanent Renovation Scope

Date: 2026-07-15  
Application baseline: `main` after PR #100  
Production database authority: `tcxvcatsqqertcnycuop`  
Evidence: Full application E2E run `29396674105`

## Meaning of this scope

The original build is the intended product scope represented by the router, navigation, pages, and
workflows. It is not assumed to have been previously proven in production. The current application
shell is recoverable: authentication works, every registered static route renders, and both authoring
forms render. The principal defect is that the frontend expects database objects that do not exist in
the canonical production project.

## Current verified position

- [x] Production URL opens behind the Vercel automation bypass.
- [x] Test account authenticates.
- [x] All 24 registered protected/static routes render meaningful content.
- [x] No route produced a blank screen, framework overlay, or not-found page.
- [x] Products search accepts input.
- [x] Fast Create renders 8 authoring controls.
- [x] Full Editor renders 13 controls and 5 tabs.
- [x] Fast Create and Full Editor entry links resolve.
- [ ] Backend contracts are healthy: **22 of 24 routes currently report API failures.**
- [ ] Production write paths have been verified end-to-end.

## Broken or incomplete linked modules

| Page/link | Route | Verified fault | Current status |
| --- | --- | --- | --- |
| Products | `/products` | `feature_flags` 404; `catalogues` 404; `products.archived_at` 400 | Partial |
| Fast Create | `/products/new/fast` | `feature_flags` 404 | Partial |
| Full Editor | `/products/new` | `feature_flags` 404 | Partial |
| Category-1 Import | `/admin/import/category-1` | `feature_flags`, `import_logs` 404 | Partial |
| Media Library | `/media` | `feature_flags` 404 | Partial |
| Tags | `/tags` | `tags`, `feature_flags` 404 | Partial |
| Catalogues | `/catalogues` | `catalogues`, `feature_flags` 404 | Partial |
| Catalogue Builder | `/admin/catalogue-builder` | `catalogue_collections`, `feature_flags` 404 | Partial |
| Catalogue Product Studio | `/admin/catalogue-product-studio` | `feature_flags` 404 | Partial |
| Hampers & BOM | `/hampers` | `hampers`, `feature_flags` 404 | Partial |
| Ingredients | `/ingredients` | `ingredients`, `nutrition_panels`, `product_ingredients`, `feature_flags` 404 | Partial |
| Label Studio | `/labels` | `labels`, `nutrition_panels`, `product_ingredients`, `feature_flags` 404 | Partial |
| Label Queue | `/label-queue` | `labels`, `nutrition_panels`, `product_ingredients`, `feature_flags` 404 | Partial |
| Data Correction | `/data-correction` | `feature_flags` 404 | Partial |
| AI Studio | `/ai-studio` | roadmap UI; `feature_flags` 404 | On hold / partial |
| Testing | `/testing` | local checklist; `feature_flags` 404 | On hold / partial |
| Pilot Readiness | `/testing/pilot-readiness` | `search_products_with_aliases` RPC 404 | Partial |
| Resolver Preview | `/admin/resolver-preview` | `feature_flags` 404 | Partial |
| Operator Inbox | `/admin/operator-inbox` | `feature_flags` 404 | Partial |
| Settings | `/settings` | `integration_settings`, `feature_flags` 404 | Partial |
| Audit Log | `/audit-log` | `feature_activation_audit`, `feature_flags` 404 | Partial |
| Approval Inbox | `/approvals` | `feature_flags` 404 | Partial |

Production introspection confirmed that all 12 reported tables are absent, `products.archived_at` is
absent, and `search_products_with_aliases` is absent. `get_current_user_roles()` exists.

## Permanent renovation plan

### Phase R0 — Freeze and evidence

- [x] Restore the governed application baseline.
- [x] Repair authentication accessibility and protected Playwright execution.
- [x] Add security, quality, build, and ownership gates.
- [x] Add a non-aborting complete read-only E2E route audit.
- [x] Capture screenshots, console failures, network failures, JSON, and Markdown evidence.
- [ ] Keep unsafe schema-replay branches marked NO-GO and unmerged.

### Phase R1 — Shared frontend contract repair

- [x] Cache the confirmed absence of `feature_flags` so it does not fail on every route.
- [x] Remove the invalid `products.archived_at` request from Product Master.
- [x] Use `is_active` as the current production-compatible active-product rule.
- [ ] Make missing optional capabilities visibly unavailable rather than silently successful.
- [ ] Regenerate Supabase TypeScript types from production and reconcile stale generated types.
- [ ] Rerun the full application audit; record the exact reduction in API failures.

### Phase R2 — Canonical backend capability decisions

For every absent object, decide **map, build, retire, or defer** before writing SQL:

- [ ] `feature_flags`
- [ ] `feature_activation_audit`
- [ ] `integration_settings`
- [ ] `catalogues`
- [ ] `catalogue_collections`
- [ ] `import_logs`
- [ ] `tags`
- [ ] `hampers`
- [ ] `ingredients`
- [ ] `product_ingredients`
- [ ] `nutrition_panels`
- [ ] `labels`
- [ ] `search_products_with_aliases(text)`

Each decision requires:

- [ ] live production caller/data-flow inventory;
- [ ] confirmation that no differently named canonical production object already owns the capability;
- [ ] RLS and grant design;
- [ ] forward-only migration in `oasis-supabase-core` when a backend object is genuinely required;
- [ ] disposable-branch replay and exact runtime assertions;
- [ ] separate production authorization.

### Phase R3 — Product authoring completion

- [ ] Fast Create validation, draft preservation, SKU generation, and handoff to Full Editor.
- [ ] Full Editor tab-by-tab read, validation, and save contract.
- [ ] Existing-product edit journey using a real production product ID.
- [ ] Duplicate-product journey and duplicate detection.
- [ ] Media upload, optimization, hero selection, and rollback.
- [ ] Alias, MOQ, pricing, BOM, packaging, compliance, and readiness persistence.
- [ ] Contributor draft path versus authorized direct-write path.
- [ ] Reversible E2E fixtures and cleanup proof on a disposable database branch.

### Phase R4 — Catalogue and merchandising completion

- [ ] Catalogue list/create/edit/detail/public-preview flows.
- [ ] Catalogue Builder collection persistence and product selection.
- [ ] Catalogue Product AI Studio draft/review/approval lifecycle.
- [ ] Media readiness and export gates.
- [ ] PDF, WhatsApp, and share-link outputs.
- [ ] Tags, hampers/BOM, ingredients/nutrition, and label lifecycle.

### Phase R5 — Governance and operations completion

- [ ] Category-1 import validation → draft → Approval Inbox.
- [ ] Approval RPC behaviour for every supported draft type.
- [ ] Explicit blocked state for unsupported approval mappings.
- [ ] Feature activation and integration diagnostics.
- [ ] Append-only audit evidence.
- [ ] Resolver and WhatsApp operator journeys against canonical Core functions only.

### Phase R6 — Release acceptance

- [ ] Zero unexpected 4xx/5xx requests across every registered route.
- [ ] Zero uncaught console errors.
- [ ] Every internal navigation target verified.
- [ ] Desktop and mobile viewport coverage.
- [ ] Accessibility scan for labels, keyboard navigation, focus, and contrast.
- [ ] Unit tests, typecheck, production build, boundaries, Biome, Super-Linter, CodeQL, Semgrep, and Trivy green.
- [ ] Read-only production E2E green.
- [ ] Write-enabled acceptance green on a disposable branch with cleanup proof.
- [ ] Explicit owner approval before any production schema or write-path rollout.

## Permanent exclusions

- [x] Do not replay the legacy migration chain against production.
- [x] Do not create legacy `user_roles` or `app_role` authority models.
- [x] Do not overwrite production authorization or onboarding functions.
- [x] Do not replace canonical `product_bom`, `product_tags`, or `product_tag_mapping` semantics.
- [x] Do not treat a rendered page as complete when its API calls fail.
- [x] Do not classify a form as passing when it renders zero usable controls.
- [x] Do not execute production writes from an audit workflow.

## Definition of done

The renovation is complete only when the route report, process report, application contracts, and
canonical production schema agree; all required capabilities pass their runtime journeys; deferred
features are visibly and intentionally disabled; and every production change has independent rollback
and verification evidence.
