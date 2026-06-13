# AI Studio — Owner Live Smoke Checklist

**Repo:** `oasis-ai-studio`  
**Production URL:** https://oasis-ai-studio.vercel.app  
**Audience:** Owner / admin (`owner` or `admin` role)  
**Time budget:** 15–20 minutes  
**Date:** _______________  
**Tester:** _______________  
**Browser:** _______________ (recommend Chrome, DevTools open → Console)

---

## Before you start

- [ ] Use an **owner** or **admin** account (not a catalogue contributor unless testing draft-only paths).
- [ ] Open DevTools → **Console** before login; leave it open for all steps.
- [ ] **Do not** approve live product changes in Approval Inbox unless you explicitly intend to.
- [ ] **Do not** click **Save** on a real product unless you intend a live master write (owner/admin saves go direct to `products`).
- [ ] For media upload, use a **small test image** you own (e.g. `smoke-test.jpg`, &lt; 500 KB). Skip upload if unsure.
- [ ] Screenshot any **red toast**, blank screen, or console error (note step number in filename).

**Pre-flight (unauthenticated):** Production login page loads at `/auth` — confirmed deploy is serving the app (no blank screen).

---

## Quick route map

| Step | URL |
|------|-----|
| Dashboard | `/` |
| Products | `/products` |
| Product edit | `/products/{id}` |
| Media Library | `/media` |
| Approval Inbox | `/approvals` |
| Catalogue Builder | `/admin/catalogue-builder` |
| Label Studio | `/labels` |
| Label Queue | `/label-queue` |
| Category 1 Import | `/admin/import/category-1` |
| Data Correction | `/data-correction` |

---

## 1. Login (~2 min)

| # | Action | Pass if… |
|---|--------|----------|
| 1.1 | Go to https://oasis-ai-studio.vercel.app | Sign-in page or redirect to `/auth` |
| 1.2 | Sign in (email/password or Google) | Lands on Dashboard `/` |
| 1.3 | Check Console | **No** `ReferenceError: COMPLIANCE_APPROVER is not defined` or other boot crash |
| 1.4 | Check UI | Dashboard cards/nav visible; no infinite “Loading your account…” |

**Fail signals:** Blank white screen, `AccessRestricted` for owner, `Account role setup failed` with no recovery.

---

## 2. Products (~4 min)

| # | Action | Pass if… |
|---|--------|----------|
| 2.1 | Nav → **Products** (`/products`) | Product grid/list renders (may be empty but no error) |
| 2.2 | Click **one existing product** | ProductEdit opens at `/products/{id}` |
| 2.3 | Scan tabs | At minimum: **Identity**, **UOM / MOQ**, **Compliance**, **Ops Notes**; existing products also show **Media**, **Product Truth** |
| 2.4 | Click **Identity** → confirm name/SKU/category fields populated or empty form (new) | Fields render, not stuck loading |
| 2.5 | Click **UOM / MOQ** | UOM selects and Primary Packing section visible |
| 2.6 | **Hard refresh** (Ctrl/Cmd+R) on product detail | Same product reloads; still accessible |
| 2.7 | Console | No uncaught errors during tab switches |

**Do not click Save** unless you intend a live write.

---

## 3. Media (~3 min)

| # | Action | Pass if… |
|---|--------|----------|
| 3.1 | Nav → **Media** (`/media`) | Media Library page loads (grid or empty state) |
| 3.2 | Return to product → **Media** tab | `ProductMediaUploader` section visible |
| 3.3 | **Optional:** Upload one small test image | **Success:** image appears in gallery or hero updates |
| 3.4 | If upload fails | Record exact toast/console message (e.g. storage policy, RLS, bucket) — still **Pass** for smoke if failure is clear and actionable |

**Expected owner behavior:** Direct upload to storage (not draft). Contributors see “submitted for approval” messaging.

---

## 4. Aliases (~2 min)

| # | Action | Pass if… |
|---|--------|----------|
| 4.1 | Product → **Identity** tab → scroll to **Product language terms** | Alias section loads with term-type tabs |
| 4.2 | Pick a product whose name matches heuristics (e.g. contains **Kunafa**, **Pyramid**, **Katori**) | — |
| 4.3 | Click **Generate basic** | Toast: `Added N starter terms` (owner direct) **or** `Submitted N drafts for approval` (contributor) |
| 4.4 | Verify outcome | **Owner/admin:** new rows appear in list immediately. **Contributor:** rows do **not** appear until approved; check `/approvals` |
| 4.5 | Do **not** delete live aliases unless test data | — |

**Known:** Generation uses name-matched seed rules only — no LLM. “No starter aliases matched” is OK for unrelated product names.

---

## 5. Compliance / Nutrition (~2 min)

| # | Action | Pass if… |
|---|--------|----------|
| 5.1 | Product → **Compliance** tab | Pack/shelf section + Ingredients / Allergen / Nutritional textareas visible |
| 5.2 | Confirm data | Existing product shows ingredients/nutrition text or empty fields |
| 5.3 | Look for **Compliance AI** panel | **Expected gap:** No “Generate AI compliance suggestions” button — panel is **not wired** in ProductEdit yet |
| 5.4 | Record | Mark **Known gap** in results table (not a smoke fail) |

---

## 6. Drafts / Approvals (~2 min)

| # | Action | Pass if… |
|---|--------|----------|
| 6.1 | Nav → **Approvals** (`/approvals`) | Inbox loads with tabs: Awaiting Approval / Approved / Rejection Bin |
| 6.2 | **Draft submit (optional, cautious)** | **Owner/admin:** product **Save** writes live — **skip** unless editing a dedicated test product. **Safer:** skip submit; inbox load-only is enough for smoke |
| 6.3 | If you submitted a test alias/media draft earlier | Item appears under **Awaiting Approval** |
| 6.4 | **Do not Approve** live product/media drafts | Unless you explicitly confirm in writing |

---

## 7. Catalogue Builder (~2 min)

| # | Action | Pass if… |
|---|--------|----------|
| 7.1 | Nav → **Catalogue Builder** (`/admin/catalogue-builder`) | Page loads with collections UI |
| 7.2 | Confirm products available | Product picker or list populates when adding to collection |
| 7.3 | Optional | Create a collection named `SMOKE TEST - DELETE` — only if comfortable; not required |

**Blocker signals:** `LocalCatalogueFallbackDisabledError`, permanent spinner, empty product list with Supabase error toast.

---

## 8. Label Studio / Label Queue (~2 min)

| # | Action | Pass if… |
|---|--------|----------|
| 8.1 | Nav → **Labels** (`/labels`) | Label Studio loads; product picker works |
| 8.2 | Pick any product | Label form fields render (net qty, status, etc.) |
| 8.3 | Nav → **Label Queue** (`/label-queue`) | Queue table loads with filters |
| 8.4 | **Do not save** label changes on live products unless intended | — |

---

## 9. Category 1 Import (~1 min)

| # | Action | Pass if… |
|---|--------|----------|
| 9.1 | Nav → **Category 1 Import** (`/admin/import/category-1`) | Staging UI loads (upload area, mapping preview area) |
| 9.2 | **Do not upload** a file unless a prepared staging file is ready | — |
| 9.3 | Note banner | If “import logs unavailable” banner shows, record — UI can still pass |

---

## 10. Data Correction (~1 min)

| # | Action | Pass if… |
|---|--------|----------|
| 10.1 | Nav → **Data Correction** (`/data-correction`) | Filter chips + product list/grid loads |
| 10.2 | Click one filter (e.g. **Missing price**) | List updates without error |

---

## Results table (fill in during smoke)

| Route | Expected | Actual | Pass/Fail | Error message | Screenshot Y/N |
|-------|----------|--------|-----------|---------------|----------------|
| `/auth` → login | Sign-in works; redirect to dashboard | | | | |
| `/` | Dashboard loads; no boot console error | | | | |
| `/products` | Product list loads | | | | |
| `/products/{id}` | ProductEdit tabs render | | | | |
| `/products/{id}` (refresh) | Product still accessible after reload | | | | |
| `/media` | Media Library loads | | | | |
| `/products/{id}` → Media tab | Product media section loads | | | | |
| `/products/{id}` → Media tab | Upload succeeds **or** clear storage/RLS error recorded | | | | |
| `/products/{id}` → Identity → Aliases | Alias section loads | | | | |
| `/products/{id}` → Aliases | Generate basic → terms added or draft submitted | | | | |
| `/products/{id}` → Compliance | Manual ingredients/nutrition visible | | | | |
| `/products/{id}` → Compliance | No AI panel (known gap) | | | | |
| `/approvals` | Approval Inbox loads | | | | |
| `/admin/catalogue-builder` | Builder loads; products/collections usable | | | | |
| `/labels` | Label Studio loads | | | | |
| `/label-queue` | Label Queue loads | | | | |
| `/admin/import/category-1` | Staging UI loads (no upload required) | | | | |
| `/data-correction` | UI loads with filters | | | | |

---

## Final verdict (owner completes after smoke)

### AI Studio live ProductEdit smoke

- [ ] **PASS** — Login, products, ProductEdit tabs, refresh, and core routes work; no blocking console errors  
- [ ] **PARTIAL** — App usable but one or more routes fail (media, aliases, builder, labels, etc.)  
- [ ] **FAIL** — Cannot login, blank screen, or ProductEdit inaccessible  

**Selected:** _______________

### PIM readiness

- [ ] **GO** — Safe for daily product editing as primary PIM  
- [ ] **PARTIAL** — Usable for authoring; gaps remain before full PIM handoff  
- [ ] **NO-GO** — Blocking failures; do not use for production editing  

**Selected:** _______________

---

## Next required fix list (pre-filled from code audit — update after live run)

| Priority | Fix | Trigger if live smoke shows… |
|----------|-----|------------------------------|
| P1 | Wire `ComplianceAiPanel` into ProductEdit Compliance tab | Confirmed known gap (step 5) |
| P1 | Fix media storage / RLS if upload fails | Storage policy or 403 on upload |
| P1 | Fix role bootstrap if dashboard stuck | `Account role setup failed` |
| P2 | Verify Approval Inbox RPCs for reviewers | Inbox error or empty with pending drafts in DB |
| P2 | Catalogue Builder product fetch / collections persistence | Builder empty or collection save fails |
| P2 | Label Queue / related table RLS | Queue fails to load |
| P3 | Category 1 import logs table (optional) | Banner only — non-blocking |
| P3 | Central live sync | Out of scope for this smoke — preview-only by design |

**Additional issues found in live smoke:**

1. _______________________________________________  
2. _______________________________________________  
3. _______________________________________________

---

## Reference

- Static validation report: `docs/AI_STUDIO_AUTHENTICATED_PRODUCTEDIT_VALIDATION.md`
- Production boot fix: `COMPLIANCE_APPROVER_ROLES` in `src/lib/permissions.ts` (commit `bdc66c9`)
