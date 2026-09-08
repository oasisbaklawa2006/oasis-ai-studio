# Point 31 — Full Editor Architecture Canonical Closure Census

**Issue:** #459 · **Baseline:** `main` @ `fad395d1865e163b07863cb123789f3b5a441dec` (post-Point34 #197, 2026-09-08)  
**Classification:** **INDEPENDENT IMPLEMENTATION GAP** — architecture/integration boundaries only  
**Scope boundary:** Does not absorb Point32 product/variant hierarchy, Point33 pack/carton/pallet, Point34 compliance fields, Points35–40 workflow/data semantics, or Points41–47 media execution.

## 1. Exact AI main SHA

```text
fad395d1865e163b07863cb123789f3b5a441dec
```

Latest commit: `POINT34 — ingredients / allergens / shelf-life / storage canonical closure (#197)`

## 2. Route census

| Route | Component | Authority | Notes |
| --- | --- | --- | --- |
| `/products` | `Products.tsx` | List entry | Opens Fast Create or Full Editor |
| `/products/new` | `ProductEdit.tsx` (`id=new`) | **Canonical create** | Single governed create shell |
| `/products/:id` | `ProductEdit.tsx` | **Canonical edit** | Single governed edit shell |
| `/products/new/fast` | `FastCreateProduct.tsx` | Handoff tier | Session draft → Full Editor pre-fill |
| `/products/:id/media` | `ProductEditDeepLinks.tsx` | Redirect only | → `?tab=media` (SCREEN #29) |
| `/products/:id/aliases` | `ProductEditDeepLinks.tsx` | Redirect only | → identity tab + `#product-language-terms` (SCREEN #30) |
| `/admin/catalogue-product-studio` | `CatalogueProductStudio.tsx` | Copy drafts only | `catalogue_ai_studio_drafts` — never writes `products` |
| `/admin/catalogue-builder` | `CapabilityUnavailable` | **Non-authoritative** | Legacy builder code retained, route stubbed |
| `/catalogues`, `/catalogues/:id` | `CapabilityUnavailable` | **Non-authoritative** | Legacy catalogue routes stubbed |
| `/media` | `Media.tsx` | Media library | Standalone review; not product editor |
| `/approvals` | `ApprovalInbox.tsx` | Approval workflow | Contributor draft approve/reject |

Canonical route contract: `src/features/productAuthority/fullEditorArchitecture.ts`

## 3. Component / store / adapter census

### Full Editor shell (authoritative)

| Artifact | Path | Role |
| --- | --- | --- |
| Page shell | `src/pages/ProductEdit.tsx` | 12-tab monolithic editor host |
| Tab registry | `src/features/productAuthority/productEditTabs.ts` | Canonical tab values + `?tab=` validation |
| Architecture contract | `src/features/productAuthority/fullEditorArchitecture.ts` | Routes, domain map, identity, save boundary, tab orchestration |
| Schema adapter | `src/features/productAuthority/productSchemaAdapter.ts` | `form ↔ products` allowlist, validation, insert/update payload |
| Deep links | `src/features/productAuthority/productEditDeepLinks.ts` | Media + aliases URL builders |
| Deep-link redirects | `src/pages/ProductEditDeepLinks.tsx` | Route aliases → canonical `?tab=` |
| Request race guard | `src/features/productAuthority/requestRace.ts` | Conflicting edit-session protection |
| Draft authority strip | `src/lib/formDraftAuthority.ts` | Excludes authority-owned fields from localStorage drafts |

### Tab panels and shared components

| Tab | Key components | Form adapter |
| --- | --- | --- |
| `identity` | `SkuBuilder`, `AliasManager` | `productSchemaAdapter`, `aliasSchemaAdapter` |
| `uom` | inline fields | `productSchemaAdapter`, `packLogic` |
| `media` | `ProductMediaUploader` | `productMediaMutationAuthority`, `mediaDraftBoundary` |
| `private_label` | inline fields | `productSchemaAdapter` |
| `customisation` | inline fields | `productSchemaAdapter` |
| `dimensions` | inline fields | `shippingDimensions`, `productSchemaAdapter` |
| `frozen` | inline fields | `productSchemaAdapter` |
| `bom` | `BomBuilder` | `bomTableContract` |
| `channels` | `ChannelPricingRules`, `ChannelMoqRules` | `channelPricingMapper`, `syncChannelPricingFromForm` |
| `compliance` | `ComplianceAiPanel`, `LabelReadinessPanel` | `complianceApproval`, `compliancePersistence` |
| `ops` | inline fields | `productSchemaAdapter` |
| `product_truth` | `ProductTruthAdminSection` (lazy) | `productTruth/*` panels |

### Non-authoritative / parallel surfaces

| Surface | Persistence | Split from Full Editor? |
| --- | --- | --- |
| Fast Create | `sessionStorage` + direct/draft save | Intentional create tier; handoff only |
| Catalogue Product Studio | `catalogue_ai_studio_drafts` | Copy/localisation drafts — separate authority |
| Catalogue Builder | `collectionStore` (localStorage fallback) | Route stubbed — non-authoritative |
| Media page | `product_media` via governed uploader | Library view, not editor shell |

## 4. Save / publish / approval handler census

| Handler | Path | Boundary |
| --- | --- | --- |
| **Governed save resolver** | `resolveFullEditorSavePath()` in `fullEditorArchitecture.ts` | Single entry — direct / contributor / blocked |
| Direct write | `ProductEdit.save()` → `products` insert/update | `canWriteProductsDirectly(roles)` |
| Contributor draft | `ProductEdit.save()` → `submitCatalogueDraft({ draftType: "product" })` | `catalogue_product_drafts` |
| Channel pricing sync | `syncChannelPricingFromForm()` | Post-save; approval-governed (Point38) |
| Media mutation | `productMediaMutationAuthority` | Tab-local reconciler; not a second product save path |
| Fast Create save | `saveFastCreateProduct.ts` | Separate create tier |
| Studio draft workflow | `catalogueDraftRepository.ts` | Never touches `products` |
| Approval inbox | `ApprovalInbox.tsx` | Approve/reject contributor drafts (Points38/39) |

## 5. Draft repository census

| Storage | Module | Scope |
| --- | --- | --- |
| `localStorage` `catalogue_product_form_draft_*` | `ProductEdit.tsx` | Autosave resilience (non-authoritative) |
| `sessionStorage` `oasis-fast-create-draft-v2` | `fastCreateDraft.ts` | Fast Create handoff |
| `catalogue_product_drafts` | `draftService.ts` | Contributor product create/update |
| `catalogue_ai_studio_drafts` | `catalogueDraftRepository.ts` | Catalogue copy only |
| `catalogue_media_submissions` | `mediaDraftBoundary.ts` | Media contributor drafts |

## 6. Feature flags

| Mechanism | Status |
| --- | --- |
| `useFeatureFlags.ts` | Returns empty — no production `feature_flags` table |
| `VITE_CATALOGUE_AI_ENABLED` | Gates Catalogue Studio AI generation only |
| Full Editor enablement | **Always on** for `/products` access — no separate flag |

## 7. Legacy / duplicate editor paths

| Path | Status | Action |
| --- | --- | --- |
| `/admin/catalogue-builder` | Stubbed | Listed as non-authoritative in architecture contract |
| `/catalogues/*` | Stubbed | Non-authoritative |
| Central product editor | External (Central repo) | E2E comparison baseline only |
| `/products/new` vs `/products/new/fast` | Intentional dual create | Fast Create hands off; Full Editor is authority |
| Catalogue Studio vs Full Editor | Intentional split | Studio drafts copy; master data in Full Editor |

## 8. Mobile / responsive handoff

| Mechanism | Location | Notes |
| --- | --- | --- |
| `useIsMobile()` (768px) | `use-mobile.tsx` | Sidebar drawer only |
| Full Editor layout | `ProductEdit.tsx` | Responsive grids + horizontal tab scroll |
| Mobile handoff route | **None** | Data-only Fast Create → Full Editor handoff |

## 9. Deep-link entry points

| Entry | URL | Resolver |
| --- | --- | --- |
| Tab deep link | `/products/:id?tab=<tab>` | `resolveFullEditorTabState()` |
| Create | `/products/new` | `resolveFullEditorIdentity()` → create |
| Duplicate | `/products/new?duplicateFrom=<id>` | `ProductEdit` effect |
| Fast Create handoff | Navigate to `/products/new` | `fastCreateFormPatchFromDraft()` |
| Media alias route | `/products/:id/media` | `productMediaDeepLink()` |
| Aliases alias route | `/products/:id/aliases` | `productAliasesDeepLink()` |
| Studio chip | `fullEditorDeepLink()` | `catalogueStudioNavigation.ts` → architecture map |

## 10. Duplicate authoring authorities identified

| Risk | Mitigation in Point 31 |
| --- | --- |
| `ProductEdit` + Catalogue Studio both touch product fields | Studio writes `catalogue_ai_studio_drafts` only; deep-links to Full Editor for master fixes |
| Tab-local media mutation vs save | `productMediaMutationAuthority` pub/sub — not a second product save boundary |
| localStorage draft vs DB authority | `stripAuthorityFieldsFromDraft()` excludes authority-owned keys |
| Fast Create direct save vs Full Editor | Separate tier; handoff is patch-only |
| Legacy catalogue builder | Route stubbed + listed non-authoritative |

## 11. Tab → downstream domain ownership map

Defined in `FULL_EDITOR_TAB_DOMAIN_OWNERSHIP` (`fullEditorArchitecture.ts`):

| Tab | Owner | Scope |
| --- | --- | --- |
| `identity` | Point32 | Name, class, SKU, departments, aliases |
| `uom` | Point33 | Pack sizes, UOM, carton logic |
| `media` | Point41 | Hero image and governed media |
| `private_label` | Point42 | Private-label terms |
| `customisation` | Point43 | Customisation types |
| `dimensions` | Point35 | Dimensions, weight, CBM |
| `frozen` | Point36 | Frozen shelf-life |
| `bom` | Point37 | Bill of materials |
| `channels` | Point38 | Channel pricing (approval-governed) |
| `compliance` | Point34 | Compliance / label fields |
| `ops` | Point40 | Operational notes |
| `product_truth` | Point53 | Deferred-detail Product Truth panels |

Point 31 provides the shell and ownership map only — field validation rules remain in downstream points.

## 12. Fail-closed guarantees (architecture contract)

| Condition | Behaviour |
| --- | --- |
| Unresolved product identity | `resolveFullEditorIdentity()` → invalid; page shows unavailable state |
| Conflicting edit session | `hasFullEditorIdentityConflict()` blocks save until `loadedId` matches route |
| Fetch in flight | Save blocked via save boundary |
| Unknown `?tab=` | Falls back to `identity` |
| Read-only user | Save path `blocked` |
| Unsupported direct publish | `allowDirectPublish: false` blocks direct write |

## 13. Test evidence

| Test file | Coverage |
| --- | --- |
| `fullEditorArchitecture.test.ts` | Routes, domain map, identity, save boundary, tab state |
| `productEditTabs.test.ts` | Tab validation |
| `productEditDeepLinks.test.ts` | Deep-link URL builders |
| `catalogueStudioNavigation.test.ts` | Readiness category → tab map |
| `product-authoring-ux-audit.spec.ts` | E2E Full Editor + Fast Create |
| `full-app-readonly-audit.spec.ts` | Route smoke |

## 14. Production mutation

**NONE** — architecture contract, census evidence, and unit tests only. No Supabase migration, Edge Function deployment, or production data change.

## 15. Gate state

`PR MERGED != Point31 CLEARED` — editor runtime/mobile UAT reconciliation remains a downstream programme gate.

## 16. Rebase reconciliation (post-Point34 #197)

Rebased onto `fad395d` with **no merge conflicts**. Point31 save-boundary wiring (`resolveFullEditorSavePath`) runs **before** Point34 factual-composition gates (`factualCompositionSaveValidation`, `productEditDirectProductsRow`) — architecture boundary only; Point34 authority not duplicated.
