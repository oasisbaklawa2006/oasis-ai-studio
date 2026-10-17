# AI Studio — repository repair certification and activation gates

Authority: [Studio #240](https://github.com/oasisbaklawa2006/oasis-ai-studio/issues/240),
[Central #629](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/issues/629).
Repair lane: [PR #249](https://github.com/oasisbaklawa2006/oasis-ai-studio/pull/249),
`fix/240-review-recovery-ai-timeout`. No protected merge or production deployment is authorized by this certificate.

## Baseline and scope

Starting/default main: `b8a47a4595edfe227f7884db40219b2cf50a968f`; production deployment was verified at that same SHA.
The continuation fetched main again and reused existing PR #249 at `ecbf9e811726b3d388a33d5d66a4555498ac5af8`.
At the original census, 16 open PRs were dependency updates; no overlapping application repair lane existed.
Existing Point certificates and merged work were inspected as historical evidence, not treated as live acceptance.
No new issue, duplicate product authority, foreign repository code change, paid preview or production mutation was created.
The exact final head and CI/review result are recorded in PR #249's head/checks and certification comment.

A separate mechanical commit contains 148 formatting/import fixes produced by the configured Biome gate.
The functional commit repairs compiler/schema drift, review recovery, alias handling, unavailable lifecycle UX,
OAuth wiring, accessibility and stale hooks; it also removes unused frontend entry points/exports and dependencies.
There is no visual-system redesign. Failed browser-run outputs and legacy generated census artifacts are not part of the patch.

## Reproduced defects and repairs

| Defect / boundary | Repair / regression evidence |
| --- | --- |
| Media Approve stayed hidden after Core's deployed media mapping | Existing Core reviewer RPC enabled; `reviewResult.test.ts`, `mediaReviewDesk.test.ts` |
| HTTP-success `ok:false`, wrong action/draft/table could become successful review UI | Exact response validation, fail closed; stale rows cleared, retry offered, obsolete loads ignored, synchronous double-action locks |
| AI transport and response-body reads could hang | 30-second AbortController deadline, cleanup and actionable session/network failures; `catalogueAiGateway.test.ts`, `catalogueAiRequestRecovery.test.ts`; no paid retry |
| `npm run typecheck` checked an empty root project | Checks real Studio application source with strict null checking; release CI now also requires ESLint, Biome, Knip and coverage |
| Canonical product/alias/commercial/RPC types had drifted | Selected types refreshed from current Core generated metadata; precise unions, null handling and typed projections replace `any` escapes |
| Alias queries/writes used absent `alias`, active/language metadata columns and schema fallback | One canonical `alias_text`/`canonical_name` payload/query; validate entire batch before writes; no invented canonical name or competing schema; `aliasSchemaAdapter.test.ts` |
| Unlinked aliases could appear attached to a product by name | Product alias panel now reads exact Core product_id only; resolver skips unlinked aliases |
| Alias loading notified parent on every load and could loop | Notifications only after mutation; load failure/retry state, mutation lockout during loading/error, obsolete-response protection; three mounted `AliasManager.test.tsx` cases |
| Product correction requested absent legacy price columns | Reads canonical product projection rather than invalid column list; commercial proposals remain Core governed |
| Archive/delete attempted non-existent Core RPCs | Unavailable actions disabled with actionable Core explanation; no fabricated RPC or write client; `productGovernanceService.test.ts` |
| OAuth used obsolete Lovable result shape | Existing Supabase OAuth authority used directly; missing redirect produces an actionable failure; unused legacy bridge removed |
| Unavailable routes exposed backend implementation text without a recovery path | Staff directed to Core activation and working Products route; public link asks catalogue owner for approved publication without schema disclosure; `CapabilityUnavailable.test.tsx` |
| Static analysis found dead entry points and stale public exports | 15 unreachable frontend files removed, unused exports/types/private declarations pruned, unused dependencies removed; Knip PASS. OCR language dependency retained because build copies its binary assets |
| Accessibility and hook defects | Explicit button types/alt text, truthful breadcrumb semantics, decorative OTP separation, chart CSS as text instead of HTML injection, stable SKU/filter memo inputs and toast subscriptions |

Frozen `supabase/functions/**` and migrations were not edited. `typecheck:build` improved from 281 errors to **eight**,
all in frozen `supabase/functions/_shared/erpInboxBridge/processErpInboundRow.ts` (skipped/value union narrowing).
These enter the full references compiler through test-only re-export wrappers, not the application dependency graph.
`tsconfig.studio.json` excludes tests and that test-only bridge; unit tests remain enabled. Full-reference failures remain
visible in the non-blocking CI audit. The Core authority guard prohibits repairing this frozen backend copy in Studio.
The canonical Core correction and governed snapshot refresh must be routed through the existing programme authority.

## Executed validation

| Command | Actual outcome |
| --- | --- |
| `npm ci --ignore-scripts --no-audit --no-fund` | PASS, deterministic lockfile; an offline attempt lacked cached zlibjs, normal clean install succeeded |
| `npm run quality:local` | PASS: application typecheck, coverage, production build and repository boundaries |
| `npm run test:coverage` | **163 files / 1,493 tests PASS**; 42 added cases over original 1,451-test baseline |
| Configured coverage thresholds | PASS: statements/lines **47.75%**, branches **77.29%**, functions **77.63%**; these are threshold results, not complete workflow coverage |
| `npm run lint` | PASS, zero errors / 11 non-blocking warnings |
| `npm run lint:biome` | PASS, zero errors; 81 warnings / 53 informational diagnostics remain, not represented as a clean-warning certificate |
| Fast Create compliance and older-browser alias calls could run without a deadline | Both compliance callers use the SDK 30-second timeout; aliases use a 15-second AbortController through body consumption and clear timers; stalled request/body and absent-native-timeout regressions PASS |
| `npm run quality:dead-code` | PASS, zero Knip findings |
| `npm run typecheck:build` | FAIL, eight frozen Core bridge errors; no remaining Studio source/test errors |
| Ownership / Core authority checks | PASS, zero new violations; pre-existing frozen backend content remains |
| Focused alias/lifecycle regressions | 16 tests PASS; five mounted/route recovery tests PASS |
| `npm run certify:point26-inference-audit` | PASS, 3/3 checks; static census/provenance evidence, not live inference |
| `npm run certify:point30-governed-ai -- --local-only` | Local governed extraction/stale guard PASS; explicitly **LIVE_PROVIDER_GATED**; no provider request |
| `npm run smoke:catalogue-ai` | Missing JWT HTTP401 PASS; invalid JWT HTTP401 PASS; authenticated checks skipped; no inference spend |
| `npm run test:full-app-audit` | 1 prerequisite failure, 1 not run: TEST_STUDIO_EMAIL/PASSWORD unavailable |
| `npm run test:catalogue-final-acceptance` | 1 prerequisite failure, 10 not run: browser executable unavailable |
| `npm run test:product-authoring-audit` | 4 prerequisite failures: browser executable unavailable |
| Chromium installation retry | FAIL, truncated/download failure; no fabricated browser PASS |

The GitHub release gate runs a fresh install and the strengthened checks against the exact PR head.
CI/review results must be read from that head, not from earlier green checks. No independent human approval is inferred
from an automated review, and no automatic merge/deployment is performed.

## Current evidence matrix

| State | Capability and actual evidence boundary |
| --- | --- |
| COMPLETE | Repository-level Studio compilation, local regression suite, coverage thresholds, build, static analysis and ownership checks; bounded review/alias/AI-transport recovery |
| PARTIAL | Product authoring, variants, factual/commercial readiness, media/camera contracts, catalogue versions/preview, governed AI and cross-app payloads have local tests; authenticated persistence, consumer delivery and whole-screen viewport journeys remain unverified |
| BROKEN | Full-reference compiler's eight frozen Core bridge errors; deployed Core catalogue-ai-copy v44 lacks required governed suggestion/source/channel envelope fields |
| NOT IMPLEMENTED | Public catalogue/share resolver and absent legacy catalogues/collections tables; ingredients, hampers, labels/tags legacy master routes; product archive/delete RPCs. No replacement local authority was invented |
| EXTERNAL BLOCKER | Hosted Supabase preview/decryption problem unchanged; local browser download blocked; authenticated role sessions absent. These are distinct blockers |
| PHYSICAL UAT | Actual phone/camera capture, handheld scans and physical device journeys require device evidence; simulated camera/unit tests do not qualify |
| PRODUCTION APPROVAL | Governed Core publication/lifecycle/approval releases, protected merge and deployment remain human controlled; no schema/RLS/data/secret/public website change |
| LIVE_PROVIDER_GATED | No authenticated model inference, live provider cost/rate/entitlement or provider-outage acceptance. Studio guards reject incomplete Core envelopes rather than accepting unsafe suggestions |
| OWNER COMMERCIAL DATA | Approved prices/tax/MOQ, allergen/ingredient facts, availability, rights and channel decisions remain required before commercial publication |
| SUPERSEDED | Earlier July capability snapshot and September certificates are historical; current metadata confirms media approval mapping and selected schema contracts, not live workflow acceptance |

## Read-only Core / cross-app evidence and next gates

Current generated schema confirms canonical product_id, product_aliases fields, product_bom, product_moq_rules,
product_pricing_rules, catalogue_versions and AI Studio draft tables. It does **not** expose legacy catalogues,
catalogue_collections, feature_flags, ingredients, labels, hampers or tags tables. audit_logs exists, but the Studio
legacy audit route has no accepted scoped projection; table existence does not establish authorization.

`pg_get_functiondef`/privilege metadata verified Core media mapping, reviewer checks, pending-state checks, row locks,
auditing and rejection paths. Anon has no review execution grant; authenticated execution still requires server reviewer
checks. No authenticated mutation or cross-company role test was executed.

Core catalogue-ai-copy v44 is ACTIVE/JWT protected, but success lacks `suggestion_only`, `approved`, `source_version`
and `channel_prompt_version` required by Studio's multilingual/channel guard. This is routed to existing Core #405,
Studio #240 and Central #629; no provider secret, production function or Studio safety guard was weakened.

Product/variant/media/catalogue/version/channel identities remain canonical. Buyer/Trace/website/WhatsApp output is
not claimed certified from code inspection or mocks. Public release remains gated on Core's approved publication
resolver and approved commercial/customer data. Foreign repository code remains untouched.

Next human action: independent review and protected approval of PR #249. Subsequent live activation requires authorized
role sessions, Core-owned governed contract releases and physical UAT; provider/public commercial release requires its
separate approval. Repository certification does not substitute for those gates.

## AI workflow inventory

| Workflow | Existing authority / local evidence | Live classification |
| --- | --- | --- |
| Naming, description, selling points, multilingual and channel/catalogue copy | catalogue-ai-copy gateway; governed naming/multilingual/channel contracts; 30-second request/body deadline, source guards and human review | LIVE_PROVIDER_GATED; Core v44 envelope mismatch must be repaired by Core |
| Ingredient, allergen, compliance and attribute suggestions | generate-product-attributes through Core; governed extraction, factual merge and stale guards; 30-second SDK deadline at both Studio callers | LIVE_PROVIDER_GATED; no ingredient/allergen/tax suggestion is a verified commercial fact |
| AI aliases / search terms | Authenticated oasis-ai-chat; pending aliases excluded from persistence until review; explicit 15-second request/body cancellation with cleanup, including browsers without AbortSignal.timeout | LIVE_PROVIDER_GATED; stalled-request and stalled-body regressions PASS, no automatic inference retry |
| Chat assistant | AI workspace routes to existing governed workspaces; no new independent browser provider or chat backend | No standalone chat activation claimed |
| Image assistance / enhancement | Existing media governance, exact-product enhancement, rights and derivative contracts | Provider/rights/approval gated; no generated image or production derivative claimed |
| OCR / barcode extraction | Local same-origin Tesseract assets and reviewed intake identity/checksum contracts | Local contracts/build verified; actual device/image journey remains unverified |
| Duplicate detection, classification and tagging helpers | Existing deterministic canonical-product/alias matching and reviewed draft suggestions | No model inference or invented canonical identity claimed |

No provider credential, entitlement, server rate/cost policy or real hallucination benchmark is certified from unit tests.
