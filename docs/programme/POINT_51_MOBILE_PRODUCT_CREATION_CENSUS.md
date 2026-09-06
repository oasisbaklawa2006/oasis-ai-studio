# Point 51 — AI Mobile Product Creation Canonical Closure (Census)

**Programme point:** 51 — AI mobile product creation  
**Repository:** `oasis-ai-studio` (AI/knowledge plane)  
**Baseline SHA:** `6f8e16417dcef2323d833072d23a92a32b87a833` (`main` @ 2026-09-06)  
**Ancestry (recent):**

| SHA | PR / commit |
| --- | --- |
| `6f8e164` | POINT35 — Dimensions / weight / CBM (#147) |
| `cf0fd3c` | POINT33 — Pack hierarchy (#151) |
| `33f61f2` | Point 27/29/30 residual — draftTableMap + deep links (#140) |
| `c010b26` | POINT30 runtime certification remediation |
| `cdf9014` | POINT30 governed AI extraction (#138) |
| `a547b03` | Point 29 multimodal product input (#135) |
| `8556bdd` | Points 26–27,31–33 closure lane matrix (#139) |
| `1512146` | Point 28 similar product detection |

**Status:** IMPLEMENTATION (this PR) — `PR merged != Point 51 cleared` until mobile UAT passes.

---

## 1. Canonical mobile product creation path

| Item | Value |
| --- | --- |
| **Route** | `/products/new/fast` |
| **Page** | `src/pages/FastCreateProduct.tsx` |
| **Authority module** | `src/features/mobileProductCreate/mobileProductCreateAuthority.ts` |
| **Save (contributor)** | `submitFastCreateProductDraft` → RPC `submit_catalogue_product_draft_v1` |
| **Save (admin-class)** | Direct `products.insert` with SKU guard + compliance strip |
| **Human approval (Point 39)** | `/approvals` (Approval Inbox) |
| **Workflow state (Point 38)** | `INTAKE` → `DRAFT_IN_PROGRESS` → `READY_FOR_GOVERNED_SUBMIT` → `SUBMITTED_AWAITING_HUMAN_APPROVAL` |

Contributors **never** publish. Admin-class direct writes still require structured SKU RPC and strip unapproved compliance fields.

---

## 2. Route / form / intake census

### Product creation routes

| Route | Component | Mobile-capable | Draft-only path |
| --- | --- | --- | --- |
| `/products/new/fast` | `FastCreateProduct` | **Yes (canonical)** | Contributor → governed draft RPC |
| `/products/new` (via `:id`) | `ProductEdit` | Partial (dense 12-tab editor) | Contributor → `submitCatalogueDraft` |
| `/admin/import/category-1` | `Category1ImportStaging` | No (batch CSV) | Contributor drafts |
| `/admin/catalogue-product-studio` | `CatalogueProductStudio` | Partial (existing products) | Copy/media drafts only |

### AI-assisted intake adapters (Point 29 lineage)

| Mode | Adapter | Files |
| --- | --- | --- |
| Barcode | `intakeFromBarcode()` | `barcodeIntake.ts`, `barcodeLookup.ts` |
| OCR / image | `prepareOcrIntakeFromImage()`, `intakeFromOcrText()` | `ocrIntake.ts`, `ocrPixelExtract.ts` |
| Voice | `intakeFromVoiceTranscript()` | `textIntake.ts`, `useVoiceCapture.ts` |
| Paste / text | `intakeFromText()` | `textIntake.ts`, `productTextParser.ts` |

UI: `FastCreateIntakePanel` → `IntakeModeTabs` (barcode | ocr | voice | text).

### Session draft

| Function | Storage |
| --- | --- |
| `emptyFastCreateDraft()` / `loadFastCreateDraft()` / `saveFastCreateDraft()` | `sessionStorage` key `oasis-fast-create-draft-v2` |
| `fastCreateFormPatchFromDraft()` | Full Editor handoff |

### Required vs deferred fields

| Required (readiness meter) | Deferred / unknown (Point 53) |
| --- | --- |
| Product name | HSN/GST without approval |
| Category | AI compliance suggestions |
| Packaging (sale-type dependent) | Pending AI aliases |
| MRP / B2B (sale-type dependent) | Export fields |
| Hero image (sale-type dependent) | SKU for contributors (admin RPC at approval) |

---

## 3. Desktop-only assumptions resolved in this PR

| Issue | Resolution |
| --- | --- |
| No mobile viewport CI | `e2e/point51-mobile-fast-create.spec.ts` @ 390×844 |
| OCR file-only (no camera) | `capture="environment"` on OCR + hero inputs |
| Fast Create absent from nav | Sidebar entry `/products/new/fast` |
| No Point 51 authority census | This document + `mobileProductCreateAuthority.ts` |
| Price grid fixed 2-col | `grid-cols-1 sm:grid-cols-2` |
| SKU row overflow | `flex-wrap` on header row |

### Remaining (out of scope — separate points)

| Item | Programme point |
| --- | --- |
| Mobile approval / launch UX | Point 52 |
| Native camera capture sheet UX | Point 44 |
| Publication authority | Point 54 |
| End-to-end mobile UAT on device | Post-merge gate |

---

## 4. Duplicate flows / bypass risks

| Risk | Disposition |
| --- | --- |
| Full Editor `/products/new` parallel create | Kept — full 72-field path; Fast Create is speed path |
| Contributor Full Editor uses `submitCatalogueDraft` (direct insert) vs Fast Create RPC | **Known divergence** — not expanded in Point 51; both are draft-only |
| Admin direct `products.insert` from Fast Create | Allowed for admin-class roles with SKU + compliance guards |
| AI aliases without approval | Blocked by `getPersistableFastCreateAliases()` (Point 30) |
| Placeholder SKUs `DRAFT-*` / `OAS-FC-*` | Blocked by `requireFastCreateSku()` |

---

## 5. Predecessor mapping (Points 27–40)

| Point | Title | Dependency on `main` @ `6f8e164` | Point 51 usage |
| --- | --- | --- | --- |
| **27** | Governed Fast Create | **Merged** (#140 residual, matrix #139) | Base route + save paths |
| **28** | Similar product detection | **Merged** (#133) | Barcode duplicate check in intake |
| **29** | Multimodal product input | **Merged** (#135) | Barcode/OCR/voice/text adapters |
| **30** | Governed AI extraction | **Merged** (#138, runtime cert) | `extractionProvenance`, alias filter |
| **31** | Media workflow | Partial (Point 31 routes in #140) | Hero upload staging |
| **32** | Multilingual | Partial — Core schema blocked | Alias seeds only |
| **33** | Publication handoff | **Merged** (#151 pack hierarchy) | Not used for create |
| **35** | Dimensions/CBM | **Merged** (#147) | Export fields deferred to Full Editor |
| **36** | MOQ/lead time | Branch exists, not required | Out of Fast Create scope |
| **38** | Workflow state | Mission Control — no separate PR | `deriveMobileDraftWorkflowState()` |
| **39** | Human approval authority | Mission Control — Approval Inbox | `/approvals` routing |
| **40** | *(not in AI Studio programme docs)* | N/A | N/A |

**Hard predecessors:** All merged on current `main`. No stack required.

**Soft runtime dependencies (production):**

- RPC `generate_oasis_sku` / `sku_code_rules`
- RPC `submit_catalogue_product_draft_v1`
- RPC `catalogue_claim_intake_barcode`
- Storage bucket `product-media`

---

## 6. Test evidence

| Suite | Path | Count / scope |
| --- | --- | --- |
| Mobile authority unit tests | `src/features/mobileProductCreate/mobileProductCreateAuthority.test.ts` | Identity, role, Point 30/38/39/53 |
| Fast Create module | `src/features/fastCreate/**/*.test.ts` | 36+ tests (intake, draft, save) |
| Governed AI | `src/features/governedAiExtraction/governedAiExtraction.test.ts` | Point 30 enrichment |
| Mobile viewport E2E | `e2e/point51-mobile-fast-create.spec.ts` | 390px overflow, banner, intake, nav |
| CI command | `npm run test:point51-mobile` | Playwright iPhone 14 project |

---

## 7. Safety

- No production data mutation from this PR.
- No Supabase migration or Edge Function deployment.
- No expansion into Central/Core operational authority.
- Draft PR until review by `dineshmutrejabackup-cmd`.

---

## 8. Gate state

| Gate | State |
| --- | --- |
| Code + census + unit tests | **THIS PR** |
| Mobile viewport E2E (authenticated) | Requires `TEST_STUDIO_EMAIL` / `TEST_STUDIO_PASSWORD` |
| Real mobile UAT | **NOT CLEARED** — post-merge owner action |
| Programme Point 51 cleared | **NOT CLEARED** until UAT evidence |
