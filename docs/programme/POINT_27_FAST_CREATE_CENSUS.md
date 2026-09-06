# Point 27 — Fast Create Canonical Workflow Closure

**ASM:** AI Studio governed Fast Create (Mission Control #459 Point 27)  
**Baseline SHA:** `6f8e16417dcef2323d833072d23a92a32b87a833` (`main` @ 2026-09-06)  
**Point38 #157 dependency:** **NOT a hard dependency** on this HEAD — no workflow-state module is consumed by Fast Create; ApprovalInbox draft lifecycle (`pending_approval` → approve/reject RPCs) is the existing governed workflow boundary.

## Authority census matrix

| Surface | Path / module | Persistence | Governance | Boundary |
| --- | --- | --- | --- | --- |
| **Primary UI** | `src/pages/FastCreateProduct.tsx` | Session draft (`fastCreateDraft.ts` v2) | Readiness meter + mandatory-field gates | Canonical Fast Create |
| **Route** | `/products/new/fast` (`App.tsx`) | — | Auth-wrapped | Canonical entry |
| **Entry CTAs** | `Products.tsx`, `Dashboard.tsx`, `aiStudioWorkspace.ts` | — | Link only | Discovery |
| **Intake (multimodal)** | `FastCreateIntakePanel.tsx` → `fastCreate/intake/*` | Draft patch only | Duplicate barcode fail-safe (`barcodeLookup.ts`) | **Point 29** — intake, not save |
| **Heuristic + AI suggestions** | `fastCreateSuggestions.ts`, `governedAiExtraction/fastCreateEnrichment.ts` | Suggestion object | AI aliases/compliance gated; `getPersistableFastCreateAliases` | **Point 30** — extraction |
| **SKU authority** | `requireFastCreateSku`, `generate_oasis_sku` RPC | `sku_draft` in draft payload | `assertStructuredSkuForSave`; blocks `DRAFT-*` / `OAS-FC-*` | **Core** RPC dep |
| **Hero pre-upload** | `uploadFastCreateHero.ts` | `product-media` staging path | `validateMediaFile` + bucket probe | Pre-save media only |
| **Canonical save** | `saveFastCreateProduct.ts` | `catalogue_product_drafts` via `submit_catalogue_product_draft_v1` | **Draft-only** — no `products.insert` | This PR closure |
| **Approval handoff** | `/approvals` (`ApprovalInbox.tsx`) | `approve_catalogue_product_draft` RPC | Reviewer gate + structured SKU check | Publication not in Fast Create |
| **Full Editor handoff** | `ProductEdit.tsx` | `loadFastCreateDraft` → form prefill | Clears session draft; separate save path | Post-navigation assist |
| **Duplicate name (similar)** | `productGovernance/duplicateDetection.ts` | Read-only list scan | Not wired into Fast Create save | **Point 28** — separate |
| **Sale type / pack model** | `saleType.ts`, `fastCreateDraft.ts` readiness | Form fields → draft payload | Unsupported sale types fail closed | **Point 32** product class |
| **Legacy full editor create** | `/products/new` (`ProductEdit.tsx`) | Contributor draft or admin direct | Separate surface — not Fast Create | Point 26 Product Master |

## Demo / bypass / shadow paths (audit result)

| Risk | Status | Evidence |
| --- | --- | --- |
| Direct `products` insert from Fast Create | **CLOSED this PR** | `saveFastCreateProduct.ts` — RPC draft only |
| Placeholder / fallback SKU (`OAS-FC-*`) | **Blocked** | `skuGuard.ts` + `requireFastCreateSku` throws |
| Unapproved AI compliance in payload | **Stripped** | `stripUnapprovedComplianceFields` before draft build |
| Unapproved AI aliases persisted | **Blocked** | `getPersistableFastCreateAliases` excludes `pendingAiAliases` |
| Duplicate barcode intake | **Fail-closed** | `intakeFromBarcode` → `duplicate_barcode` |
| Unsafe catalogue publication | **Not in scope** | `is_catalogue_ready: false` in `fast_create_meta`; approval required |
| Local-only shadow schema | **None found** | Uses Core `catalogue_product_drafts` + `products` read lookup only |
| `submitCatalogueDraft` table insert bypass | **Not used** | Fast Create uses governed `submit_catalogue_product_draft_v1` RPC |

## Canonical Fast Create boundary

```
Operator inputs (name, category, sale type, packaging, hero)
        ↓
Session draft + readiness gates (fastCreateDraft.ts)
        ↓
Optional intake (Point 29) / AI enrichment (Point 30) — suggestions only
        ↓
Structured SKU resolution (Core generate_oasis_sku) — fail closed if unavailable
        ↓
submit_catalogue_product_draft_v1 → catalogue_product_drafts (pending_approval)
        ↓
ApprovalInbox → approve_catalogue_product_draft → master products row
```

**Out of scope (consumed, not duplicated):**

- **Point 28:** Similar-product name warnings on Products list — not Fast Create save gate.
- **Point 29:** Barcode/OCR/voice/text intake panels — prefill only.
- **Point 30:** Governed AI extraction for aliases/compliance — suggestions with provenance.
- **Point 32:** Sale-type → `product_class` mapping and pack readiness rules.
- **Point 38:** No separate workflow-state engine on this HEAD; draft `status` + ApprovalInbox is sufficient.

## Files in canonical Fast Create module

| File | Role |
| --- | --- |
| `src/pages/FastCreateProduct.tsx` | Primary UI |
| `src/components/FastCreateIntakePanel.tsx` | Multimodal intake shell |
| `src/features/fastCreate/saveFastCreateProduct.ts` | Governed draft save |
| `src/features/fastCreate/fastCreateDraft.ts` | Session draft + handoff patch |
| `src/features/fastCreate/fastCreateSuggestions.ts` | Heuristic defaults |
| `src/features/fastCreate/fastCreateIntakeBarcode.ts` | Core RPC draft submit |
| `src/features/fastCreate/fastCreateSkuCodes.ts` | Category → SKU code mapping |
| `src/features/fastCreate/uploadFastCreateHero.ts` | Hero staging upload |
| `src/features/fastCreate/intake/*` | Point 29 intake adapters |
| `src/features/governedAiExtraction/fastCreateEnrichment.ts` | Point 30 AI boundary |

## Test matrix (this PR)

| Check | Command | Result |
| --- | --- | --- |
| Typecheck | `npm run typecheck` | (run at PR head) |
| Fast Create unit | `npm test -- --run src/features/fastCreate` | 64+ tests |
| Authority census | `fastCreateAuthority.test.ts` | Structural regression guard |
| Boundaries | `npm run check:boundaries` | Required gate |
| Full unit suite | `npm test` | Required gate |
| Build | `npm run build` | Required gate |

## Core dependencies (unchanged)

- `generate_oasis_sku` RPC + `sku_code_rules` table for structured SKU minting.
- `submit_catalogue_product_draft_v1` RPC for governed draft insert.
- `approve_catalogue_product_draft` RPC for master row promotion (ApprovalInbox).
- `product-media` storage bucket for hero pre-upload (client probe fail-closed).

## Safety

- No production data mutation.
- No new Supabase migrations in AI Studio.
- `PR merged != Point 27 cleared` until runtime E2E on live Core RPCs is reconciled.
