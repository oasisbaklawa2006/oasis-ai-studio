# Full Editor Enterprise Completion Contract

Date: 2026-07-13  
Baseline: `main@46244287f02f6c213399200092ea3755889c2941`  
Implementation branch: `codex/full-editor-enterprise-completion-2026-07-13`

## Release definition

"Complete" means every item in this contract is either:

1. implemented and covered by an automated acceptance gate; or
2. an external production dependency with a verified contract, named owning repository, safe disabled state, and an executable smoke check.

Documentation-only, preview-only, hard-coded, localStorage-only, or visually rendered behavior does not count as complete production behavior unless this contract explicitly labels it as a fallback.

## System ownership

| Plane | Repository | Authority |
|---|---|---|
| Catalogue authoring | `oasis-ai-studio` | Product drafts, catalogue content, governed AI assistance, approval UX, readiness, catalogue composition |
| Canonical backend | `oasis-supabase-core` | Schema, RLS, storage policies, Edge Functions, transactional/idempotent RPCs, audit persistence |
| Operational commerce | `Oasis-Baklawa-Central` | Approved catalogue intake, buyer visibility, pricing/order consumption, inventory/operations |
| Physical traceability | `oasis-trace` | SKU/carton/label identities, scan events, printing and Central-compatible execution payloads |

No frontend repository may claim backend transactionality, idempotency, concurrency control, or durable audit unless the corresponding canonical-backend behavior is deployed and verified.

## Functional completion matrix

### A. Full Editor product aggregate

- [ ] Controlled product archetype rather than free-text internal tokens.
- [ ] Identity, taxonomy, departments, SKU, UOM, packaging, MOQ, pricing, media, aliases, BOM, compliance, labels, SEO/channel copy and publication state have explicit ownership.
- [ ] Draft-scoped child records can exist before a master product is created.
- [ ] New products are inactive/unpublished by default.
- [ ] Category/archetype changes expose their invalidation impact before destructive mutation.
- [ ] Field, section, aggregate, approval and publication validation are distinct.
- [ ] All blockers deep-link and focus the owning field/section.
- [ ] A final authoritative save cannot succeed partially.
- [ ] Create/submit is idempotent across double-click, retry, timeout and refresh.
- [ ] Concurrent stale edits cannot silently overwrite newer revisions.
- [ ] Drafts survive refresh, interruption, device change and session renewal.

### B. Human-effort reduction

- [ ] Department, BOM requirement, packaging preview, unit conversion, carton arithmetic, readiness and compatibility fields are derived where deterministic.
- [ ] Category/archetype templates prefill safe defaults with provenance.
- [ ] Clone/similar-product prefill supports selective acceptance.
- [ ] Keyboard-only authoring is practical and accessible.
- [ ] Sticky identity/progress/save state prevents long-form context loss.
- [ ] Simple products do not traverse irrelevant enterprise sections.
- [ ] Every critical authoring and catalogue workflow is mobile-first: 320 px minimum width, touch-safe targets, no hidden horizontal workflow navigation, and no desktop-only action.

### C. Governed AI

- [ ] AI catalogue copy generation is live through an approved gateway and cannot invent compliance, price or product facts.
- [ ] Image/PDF/document extraction produces field-level suggestions with source, confidence and review status.
- [ ] Category, tags, aliases, WhatsApp keywords and similar-product prefills are suggestion-only until accepted.
- [ ] Duplicate detection runs before SKU reservation/master creation.
- [ ] Media enhancement preserves originals and creates governed derivatives.
- [ ] HSN, GST, nutrition, allergen, origin and legal claims never auto-approve.
- [ ] AI failures, timeouts and malformed responses degrade safely without losing edits.
- [ ] AI usage has bounded prompts, explicit user actions, caching/deduplication and test fixtures to control cost.

### C1. Media weight and rendition policy

- [ ] Every received or generated image is fingerprinted and converted into governed WebP renditions before catalogue delivery.
- [ ] Every received or generated video is queued for governed WebM transcoding; unprocessed source video is never treated as delivery-ready.
- [ ] One original is retained for traceability and future reprocessing; operators and catalogue consumers never download that original by default.
- [ ] Responsive image selection serves thumbnail, screen, WhatsApp or print rendition according to use case and device.
- [ ] EXIF orientation is normalized and unnecessary metadata is stripped from delivery renditions.
- [ ] Alpha/transparency, colour profile, animation and conversion failures have explicit handling rather than silent corruption.
- [ ] Content hashes deduplicate identical uploads and generated outputs.
- [ ] The upload UI reports source bytes, optimized bytes, percentage saved, dimensions, format and processing status.
- [ ] Mobile conversion never blocks the main thread for perceptible periods; heavy/video processing runs in a worker or canonical backend job.
- [ ] Readiness blocks a media asset whose required delivery rendition failed.

Initial byte budgets (measured encoded size, adjustable from evidence):

| Rendition | Target | Maximum |
|---|---:|---:|
| List thumbnail | 15 KB | 30 KB |
| Mobile product card | 35 KB | 75 KB |
| Desktop product card | 80 KB | 160 KB |
| WhatsApp image | 120 KB | 250 KB |
| Print product image | quality/dimension governed | 1.5 MB unless source cannot meet print quality |

The system must not claim that UHD print media can always be reduced to a few literal bytes. Quality and encoded byte size are both release constraints.

### D. Central and Trace integration

- [ ] AI Studio publishes only approved, immutable catalogue versions.
- [ ] Central intake is idempotent and records source version, product mapping, outcome and timestamp.
- [ ] Central buyer visibility cannot be enabled for a blocked/unapproved version.
- [ ] Central operational variants/pricing cannot silently fork catalogue identity.
- [ ] Trace receives stable SKU/GTIN/carton/label identifiers, not aliases or display text as identity.
- [ ] Trace scan/print payloads can be reconciled to the approved product/version and Central product mapping.
- [ ] Cross-app contract tests use shared fixtures and reject incompatible schema versions.
- [ ] Disabled integrations remain truthful and visible; no preview is labelled live sync.

### E. Catalogue composition and export

- [ ] Audience profiles: B2B, B2C, HoReCa, export and WhatsApp.
- [ ] Per-profile field inclusion, pricing visibility, MOQ and language rules.
- [ ] Product images use print-suitable source/renditions with deterministic fallback behavior.
- [ ] Professional cover, section, product-grid/detail, terms/contact and back-cover layouts.
- [ ] A4 print output with correct margins, pagination, bleed-safe layout and embedded fonts/images.
- [ ] Export remains sharp at print zoom; source images are never silently downscaled below the profile threshold.
- [ ] WhatsApp-friendly compressed PDF and product-card/message outputs are separate from print-master output.
- [ ] Missing images, long names, RTL/Unicode, large catalogues and mixed aspect ratios cannot corrupt layout.
- [ ] Generated catalogue carries version, audience, generation time and approval provenance.

The visual style will be calibrated against the owner-provided catalogue reference without copying protected assets or weakening the structured export contract.

## Release quality gates

### Deterministic gate on every milestone

- TypeScript typecheck.
- Production build.
- Unit and integration tests.
- Repository ownership boundary check.
- Targeted lint: changed files must introduce zero lint errors.
- No focused/skipped tests in changed scope.

### Full release gate

- Entire-repository lint has zero errors.
- Bundle budgets and route-level lazy loading meet the agreed threshold.
- Authenticated Playwright coverage for Full Editor and catalogue builder.
- Refresh, back/forward, two-tab, session-expiry and interrupted-network suites.
- Double-submit and idempotent-retry suites.
- Upload/AI cancellation, timeout and retry suites.
- Hostile input: Unicode, RTL, HTML-like text, JSON-like text, extreme lengths and invalid numeric combinations.
- Accessibility scan plus keyboard-only critical journey.
- Responsive evidence at mobile, tablet and desktop breakpoints.
- Media-rendition byte-budget, visual-difference, orientation, transparency and corrupted-input tests.
- Mobile performance budgets for initial JavaScript, route chunks, images, long tasks and interaction latency.
- Catalogue PDF structural and rendered-page visual checks.
- Cross-app fixture/contract tests against Central and Trace.
- Load/stress thresholds documented with dataset size, concurrency, latency and failure budget.

## Cost-control policy

- One implementation branch and one final PR unless a backend-owned change requires its own repository.
- Deterministic local tests before remote CI.
- No paid reviewer/bot fan-out on intermediate commits.
- One consolidated remote quality gate at milestone boundaries.
- AI calls mocked in CI; one controlled staging integration smoke per release candidate.
- Cache identical AI requests and prevent double invocation in UI state.
- Browser evidence captured once per stable checkpoint, not per edit.

## Release blockers

Any unresolved critical/high data-loss, duplicate-write, authorization, publication, cross-app identity, compliance, or traceability defect blocks release. A successful Vercel deployment alone is not release evidence.
