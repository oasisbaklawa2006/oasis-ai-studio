# Batch 001 Language Safety Split — Preview Only

**Status:** Review split — not draftable until human sign-off per row.

**Source:** `batch001_language_terms_preview.csv` (651 rows)

## Split summary

| Bucket | Count | % |
|--------|-------|---|
| SAFE_TO_DRAFT | 541 | 83% |
| REVIEW_ONLY | 110 | 17% |
| **Total** | **651** | 100% |

## By term type (safe vs review)

| term_type | safe | review |
|-----------|------|--------|
| official_alias | 148 | 11 |
| customer_term | 108 | 1 |
| whatsapp_keyword | 248 | 11 |
| regional_term | 3 | 26 |
| search_keyword | 34 | 61 |

## HIGH-risk clusters (review-only)

- **term_text appears on 23 SKUs**: 46 terms
- **conflict_risk=HIGH**: 20 terms
- **term_text appears on 9 SKUs**: 18 terms
- **term_text appears on 2 SKUs**: 8 terms
- **boukaj**: 7 terms
- **asiyah**: 6 terms
- **insufficient context to identify single SKU**: 3 terms
- **pyramid**: 2 terms

## Cross-SKU disambiguation families

- **pyramid**: OAS-AS-BKL-0006, OAS-AS-BKL-0011, OAS-AS-BKL-0019
- **boukaj**: OAS-AS-BKL-0006, OAS-AS-BKL-0011, OAS-AS-BKL-0019
- **asiyah**: OAS-AS-BKL-0012, OAS-AS-BKL-0013, OAS-AS-BKL-0014, OAS-AS-BKL-0015, OAS-AS-BKL-0016, OAS-AS-BKL-0017
- **durum**: OAS-AS-BKL-0024, OAS-AS-BKL-0025

## Products with insufficient safe terms

Minimum safe per SKU: official_alias≥2, customer_term≥3, whatsapp_keyword≥5, search_keyword≥2

**15** SKUs below minimum:

- **OAS-AS-BKL-0002** (Square Baklawa) — safe total 12: search_keyword: 1/2
- **OAS-AS-BKL-0009** (Special Square Baklawa) — safe total 13: search_keyword: 1/2
- **OAS-AS-BKL-0008** (Date Baklawa) — safe total 17: search_keyword: 1/2
- **OAS-AS-BKL-0019** (Pistachio Pyramid) — safe total 17: search_keyword: 0/2
- **OAS-AS-BKL-0003** (Cashew Ring) — safe total 19: search_keyword: 1/2
- **OAS-AS-BKL-0005** (Almond Crosole) — safe total 19: search_keyword: 0/2
- **OAS-AS-BKL-0006** (Cashew Pyramid) — safe total 19: search_keyword: 0/2
- **OAS-AS-BKL-0010** (Pistachio Ring) — safe total 19: search_keyword: 1/2
- **OAS-AS-BKL-0004** (Cashew Rosebud) — safe total 20: search_keyword: 0/2
- **OAS-AS-BKL-0016** (Pistachio Asiyah) — safe total 20: search_keyword: 1/2
- **OAS-AS-BKL-0007** (Cashew Finger) — safe total 22: search_keyword: 0/2
- **OAS-AS-BKL-0018** (Diamond Pistachio) — safe total 23: search_keyword: 1/2
- **OAS-AS-BKL-0001** (Cashew Kitta) — safe total 25: search_keyword: 1/2
- **OAS-AS-BKL-0011** (Pistachio Pyramid(Topping)) — safe total 25: search_keyword: 1/2
- **OAS-AS-BKL-0017** (Cashew Asiyah) — safe total 26: search_keyword: 1/2

## Recommended first alias draft batch

**Size:** 245 terms across **10 SKUs**

Anchor SKUs with full safe minimums (first 10 in cohort order):

- OAS-AS-BKL-0012 — Chocolate Pistachio Asiyah (21 safe terms)
- OAS-AS-BKL-0013 — Chocolate Cashew Asiyah (27 safe terms)
- OAS-AS-BKL-0014 — Mor Cashew Asiyah (29 safe terms)
- OAS-AS-BKL-0015 — Mor Pistachio Asiyah (23 safe terms)
- OAS-AS-BKL-0020 — Tart Cashew (25 safe terms)
- OAS-AS-BKL-0021 — Mix Nut Tart (21 safe terms)
- OAS-AS-BKL-0022 — Almond Tart (20 safe terms)
- OAS-AS-BKL-0023 — Pistachio Tart (22 safe terms)
- OAS-AS-BKL-0024 — Mor Pistachio Durum (31 safe terms)
- OAS-AS-BKL-0025 — Coconut Durum (26 safe terms)

**Suggested first alias draft (official_alias + whatsapp_keyword only):**
- **82 terms** across OAS-AS-BKL-0014, OAS-AS-BKL-0024, OAS-AS-BKL-0013, OAS-AS-BKL-0020
  - OAS-AS-BKL-0014 Mor Cashew Asiyah: 8 official_alias + 14 whatsapp_keyword
  - OAS-AS-BKL-0024 Mor Pistachio Durum: 8 official_alias + 13 whatsapp_keyword
  - OAS-AS-BKL-0013 Chocolate Cashew Asiyah: 8 official_alias + 12 whatsapp_keyword
  - OAS-AS-BKL-0020 Tart Cashew: 8 official_alias + 11 whatsapp_keyword

**Rollout:**
1. Draft safe official_alias + whatsapp_keyword rows for anchor 4 above
2. Human-review all REVIEW_ONLY pyramid/asiyah/boukaj rows before WhatsApp enablement
3. Add safe customer_term rows after anchor 4 sign-off
4. Expand to full 10-SKU batch (245 terms) then remaining cohort

## Safety rules applied

**SAFE_TO_DRAFT** when:
- conflict_risk is LOW or MEDIUM **and**
- term_text has enough context for one SKU **and**
- not a bare family/shape/filling token

**REVIEW_ONLY** when:
- conflict_risk is HIGH, or
- bare/ambiguous token, or
- term could match multiple Batch 001 SKUs, or
- clarification trigger required

---
*Preview only. No product_aliases writes. No catalogue_alias_drafts. No Central sync.*
