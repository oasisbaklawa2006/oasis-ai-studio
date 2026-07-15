# Oasis AI Studio — Permanent Renovation Scope

Date: 2026-07-15  
Application baseline: `main` at `f29a90c9521a70dedcc329132342771205ed8ff6` after PR #104
Production database authority: `tcxvcatsqqertcnycuop`  
Evidence: post-merge full application E2E run `29433521163`; product-authoring smoke run
`29433521348`; production deployment `5460723032`

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
- [x] The former invalid-contract baseline is removed: the post-merge crawl recorded zero network
      errors across all 24 routes, down from API failures on 22 of 24 routes.
- [ ] Zero console errors: the dashboard recorded one `get_current_user_roles` failed-fetch console
      message even though the RPC exists and the authenticated crawl completed.
- [ ] Production write paths have been verified end-to-end.

## Post-merge production audit — 2026-07-15

- [x] PR #104 merged with verified merge commit
      `f29a90c9521a70dedcc329132342771205ed8ff6`.
- [x] `main` points to that merge commit and contains both expected parents: the former `main` and
      reviewed head `9081fd8d050812b1ad82afcf80b0800e389d474f`.
- [x] Vercel deployed that exact merge SHA to the Production environment.
- [x] Production alias `https://oasis-ai-studio.vercel.app` passed the exact-SHA authenticated crawl.
- [x] All post-merge GitHub workflows passed: release quality, ownership boundaries,
      Super-Linter, security/code quality, Playwright smoke, and full application E2E.
- [x] Post-merge evidence artifact retained with digest
      `sha256:3f5f03971a8deaa03197329a0e34839442e7b7dbf821b1c488652c827574a5a8`.
- [x] Production Supabase project is `ACTIVE_HEALTHY`; `products` and
      `get_current_user_roles()` exist; the read-only census returned 368 products.
- [ ] Protect `main` with a GitHub ruleset/branch protection. GitHub currently reports it as
      unprotected.
- [ ] Eliminate the single intermittent dashboard role-fetch console error and repeat the crawl.
- [ ] Replace/update Actions that still target deprecated Node 20 internals; GitHub currently
      forces them onto Node 24 and emits a warning.
- [ ] Triage production Supabase advisor debt in the backend owner repository. The current
      project-wide read-only advisor scan reports 15 security errors, 204 security warnings,
      3 security informational notices, 441 performance warnings, and 220 performance
      informational notices. These pre-date and were not changed by PR #104.

### Current runtime classification

The E2E report's `full-built` label means that a route rendered meaningful, non-fatal content. It
does **not** prove that every persistence or approval action behind that page is complete.

| Runtime group | Modules | Verified position |
| --- | --- | --- |
| Render-safe, writes not accepted yet | Dashboard, Products, Fast Create, Full Editor, Media, Catalogue Product Studio, Data Correction, Pilot Readiness, Pilot Aliases, Resolver Preview, Operator Inbox, Approval Inbox | Routes render; selected read-only interactions pass; production writes remain untested. |
| Intentionally capability-deferred | Tags, Catalogues, Catalogue Builder, Hampers/BOM, Ingredients/Nutrition, Labels, Label Queue, Audit Log | No invalid backend requests; retained implementations are presented safely while canonical backend decisions remain pending. |
| Partial | Category-1 Import | Route renders, but the workflow remains incomplete. |
| On hold | AI Studio roadmap, Testing checklist, Settings/integration activation | Explicitly shown as unavailable/future work. |

## Historical pre-R2 failure baseline (closed as a runtime-contract incident)

The following table records what the initial audit found before PRs #101–#104. It is retained as
incident evidence and is **not** the current production result. PR #104 removed the invalid requests
or replaced them with explicit capability-deferred states; the current post-merge crawl recorded
zero network errors.

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
absent, and `search_products_with_aliases` is absent. `get_current_user_roles()` exists. Those
absence decisions remain authoritative until Phase R2 explicitly maps, builds, retires, or defers
each capability.

## Permanent renovation plan

### Phase R0 — Freeze and evidence

- [x] Restore the governed application baseline.
- [x] Repair authentication accessibility and protected Playwright execution.
- [x] Add security, quality, build, and ownership gates.
- [x] Add a non-aborting complete read-only E2E route audit.
- [x] Capture screenshots, console failures, network failures, JSON, and Markdown evidence.
- [x] Keep unsafe schema-replay branches marked NO-GO and unmerged.

### Phase R1 — Shared frontend contract repair

- [x] Cache the confirmed absence of `feature_flags` so it does not fail on every route.
- [x] Remove the invalid `products.archived_at` request from Product Master.
- [x] Use `is_active` as the current production-compatible active-product rule.
- [x] Make missing optional capabilities visibly unavailable rather than silently successful.
- [ ] Regenerate Supabase TypeScript types from production and reconcile stale generated types.
- [x] Rerun the full application audit; network failures reduced from 22 of 24 routes to zero
      across 24 routes. One dashboard console transport error remains separately tracked.

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

### Renovation execution ledger

- [x] PR #101 merged: scope, first invalid-query repairs, and E2E trigger correction.
- [x] PR #102 merged: immutable deployed-commit identity and exact-SHA audit waiting.
- [x] PR #103 merged: canonical frontend capability contract, safe alias fallback, and
      mutation-free readiness probes.
- [x] Eight stale or unsafe open PRs closed with preservation notes; no unreviewed branch content
      was merged.
- [x] Local R2 commit `55d1a61`: honest on-hold states for absent modules, no invalid catalogue,
      tag, label, ingredient, hamper, audit, integration, or import-log probes.
- [x] Local performance commit `92412d9`: route-level lazy loading and vendor separation; largest
      minified chunk reduced from approximately 552 kB to approximately 207 kB with no warning
      suppression.
- [x] R2 quality remeasurement: 663 tests, application typecheck, production build, repository
      boundaries, and production dependency audit (0 vulnerabilities) pass.
- [x] Publish R2 through PR #104 and rerun exact-SHA production E2E on both the reviewed head and
      post-merge Production deployment.

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

- [x] Zero unexpected network failures across every registered route in post-merge read-only E2E.
- [ ] Zero uncaught console errors.
- [x] Every registered static route and discovered internal navigation target verified; no unknown
      internal links were reported.
- [ ] Desktop and mobile viewport coverage.
- [ ] Accessibility scan for labels, keyboard navigation, focus, and contrast.
- [x] Unit tests, typecheck, production build, boundaries, Biome, Super-Linter, CodeQL, Semgrep, and Trivy green.
- [x] Read-only production E2E green on merge commit `f29a90c9`.
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
