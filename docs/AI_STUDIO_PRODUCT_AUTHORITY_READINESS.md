# AI Studio Product Authority Readiness

_Date: 2026-03-13 · Verdict: **PARTIAL GO** — authority shift acceptable for catalogue/PIM; blockers remain for sole operational master_

## Readiness matrix

| Domain | Status | Score /10 | Evidence | Blockers |
|--------|--------|-----------|----------|----------|
| **Products** | **PARTIAL** | 7 | Rich `ProductEdit`, Fast Create, drafts, SKU RPC | Central still live-writes; dual editor |
| **Media** | **PARTIAL** | 7 | 16-type taxonomy, draft queue, dual-column sync | Bucket split; Central upload path |
| **Aliases** | **PARTIAL** | 8 | `AliasManager` term types, seeds, draft path | LLM streaming UX; RPC search deploy |
| **Labels** | **PARTIAL** | 6 | Label Queue, `nutrition_panels` table | ProductEdit nutrition split from panels |
| **Nutrition** | **NOT READY** | 4 | `nutrition_panels` exists | No unified editor; free text on product row |
| **Packaging** | **PARTIAL** | 7 | UOM engine, primary pack preview | Not surfaced in Fast Create review |
| **Compliance** | **PARTIAL** | 8 | AI panel + approval strip + constants | Live AI depends on edge fn uptime |
| **Collections** | **NOT READY** | 5 | Catalogue Builder code complete | Live migration not applied |

---

## Domain detail

### Products — PARTIAL (7/10)

**Ready:** Contributor drafts, admin direct write (fixed), Fast Create, Product Truth, Category 1 import staging.  
**Not ready:** Central parallel create; variant manager only in Central; resolver not in Studio UI.

### Media — PARTIAL (7/10)

**Ready:** `product_media`, readiness engine, hero sync, Fast Create pre-upload.  
**Not ready:** Single bucket enforcement; Central backfill.

### Aliases — PARTIAL (8/10)

**Ready:** Typed terms (search, WhatsApp, regional), shared seeds, draft submission.  
**Not ready:** Production RPC alias search; Central `products.aliases[]` dual store.

### Labels — PARTIAL (6/10)

**Ready:** Label Queue workflow, readiness checks.  
**Not ready:** End-to-end label data from ProductEdit single screen.

### Nutrition — NOT READY (4/10)

**Ready:** Conservative AI posture (excludes auto nutrition truth).  
**Not ready:** `nutrition_panels` integration in ProductEdit.

### Packaging — PARTIAL (7/10)

**Ready:** `uomPackagingEngine`, conversion validation, MOQ rules.  
**Not ready:** Defaults not visible in create flow beyond category presets.

### Compliance — PARTIAL (8/10)

**Ready:** `ComplianceAiPanel`, field-level approval, save stripping.  
**Not ready:** Owner must confirm edge functions on production.

### Collections — NOT READY (5/10)

**Ready:** Client diagnostics, local dev fallback policy.  
**Not ready:** `catalogue_collections` on live DB.

---

## Product Authority readiness score

| Dimension | Weight | Score | Weighted |
|-----------|--------|-------|----------|
| Data model depth | 20% | 9 | 1.80 |
| Governance | 20% | 9 | 1.80 |
| Create/edit speed | 15% | 8 | 1.20 |
| Automation | 15% | 7 | 1.05 |
| Media | 10% | 7 | 0.70 |
| Operational parity | 10% | 5 | 0.50 |
| Live infra | 10% | 5 | 0.50 |
| **Overall** | 100% | | **7.55 / 10** |

**Target for full authority shift:** ≥8.5/10

---

## GO / NO-GO

### GO — AI Studio as **Catalogue Authority Plane (PIM)**

✅ Author new products via Fast Create or governed drafts  
✅ Richer model than Central for catalogue, compliance metadata, media taxonomy  
✅ Approval inbox and compliance gates superior to Central  
✅ Faster create path than Central (Fast Create)

### NO-GO — AI Studio as **sole Product Master** (today)

❌ Central still required for buyer catalogue activation economics, variants, live order resolver  
❌ Collections + RPC migrations not confirmed on production  
❌ Nutrition not end-to-end  
❌ Dual bucket / dual write until owner aligns storage

### Recommended stance

**PARTIAL GO** — Begin shifting **authoring authority** to AI Studio immediately. Keep Central as **operational activation plane** until:

1. `catalogue_collections` migration applied  
2. `search_products_with_aliases` RPC live  
3. `product-media` bucket canonical (+ Central read compat)  
4. Nutrition panels wired to ProductEdit  
5. 30-day parallel run with diff audit

---

## Remaining blockers (ordered)

| # | Blocker | Owner | ETA |
|---|---------|-------|-----|
| 1 | Apply collections migration | Supabase admin | Week 1 |
| 2 | Deploy alias search RPC | Supabase admin | Week 1 |
| 3 | Confirm/create `product-media` bucket | Supabase admin | Week 1 |
| 4 | Nutrition panel editor in ProductEdit | Studio dev | Week 2–3 |
| 5 | Central → Studio deep link handoff | Both teams | Week 3 |
| 6 | Variant draft type | Studio dev | Quarter |

---

## Comparison to Central (post-wave)

| Dimension | Central | AI Studio |
|-----------|---------|-----------|
| Speed (create) | 8/10 | **9/10** (Fast Create) |
| Automation (wired) | 7/10 | **8/10** |
| Data quality | 7/10 | **8/10** |
| Governance | 6/10 | **9/10** |
| Scalability | 6/10 | **8/10** |

**AI Studio is now more powerful and better governed than Central for catalogue authoring. Speed parity achieved via Fast Create. Full authority requires infra blockers cleared + nutrition unification.**
