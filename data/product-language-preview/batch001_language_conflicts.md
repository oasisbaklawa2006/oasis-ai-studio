# Batch 001 Language Term Conflicts — Preview Only

**Status:** Review draft — not imported, not submitted, no DB writes.

**Generated:** 2026-06-10
**Cohort:** OAS-AS-BKL-0001 … OAS-AS-BKL-0025 (651 term rows)

## Summary

| Metric | Count |
|--------|-------|
| Total term rows | 651 |
| HIGH conflict terms | 35 |
| Products needing clarification | 6 |
| SKUs covered | 25 |

## Global HIGH-risk tokens (never auto-resolve alone)

- `pyramid`, `pistachio`, `pista`, `baklava`, `baklawa`, `cashew`, `kaju`
- `asiyah`, `durum`, `boukaj`, `ring`, `tart`, `kitta`, `square`
- Always require nut + shape + special qualifier, or full official name / SKU

## Cross-SKU disambiguation clusters


### Pyramid family

| SKU | Official Name | Risk |
|-----|---------------|------|
| OAS-AS-BKL-0006 | Cashew Pyramid | Cashew boukaj — not pistachio |
| OAS-AS-BKL-0011 | Pistachio Pyramid(Topping) | Must include **topping** marker |
| OAS-AS-BKL-0019 | Pistachio Pyramid | Plain pistachio boukaj — not topping variant |

### Asiyah family

| SKU | Official Name | Disambiguator |
|-----|---------------|---------------|
| OAS-AS-BKL-0012 | Chocolate Pistachio Asiyah | chocolate filo |
| OAS-AS-BKL-0013 | Chocolate Cashew Asiyah | chocolate + cashew |
| OAS-AS-BKL-0014 | Mor Cashew Asiyah | beetroot/purple filo |
| OAS-AS-BKL-0015 | Mor Pistachio Asiyah | beetroot/purple filo |
| OAS-AS-BKL-0016 | Pistachio Asiyah | plain pistachio |
| OAS-AS-BKL-0017 | Cashew Asiyah | plain cashew |

## Products needing clarification


### OAS-AS-BKL-0006 — Cashew Pyramid

- HIGH-risk terms in preview: **2**
- Cashew pyramid vs pistachio pyramid SKUs — require nut in phrase
- **Question:** Cashew pyramid vs pistachio pyramid SKUs — require nut in phrase

### OAS-AS-BKL-0011 — Pistachio Pyramid(Topping)

- HIGH-risk terms in preview: **3**
- Ambiguous vs OAS-AS-BKL-0019 — pyramid(topping) must include topping marker
- **Question:** Ambiguous vs OAS-AS-BKL-0019 — pyramid(topping) must include topping marker

### OAS-AS-BKL-0012 — Chocolate Pistachio Asiyah

- HIGH-risk terms in preview: **7**
- Multiple asiyah SKUs — require chocolate/mor/plain qualifier
- **Question:** Multiple asiyah SKUs — require chocolate/mor/plain qualifier

### OAS-AS-BKL-0015 — Mor Pistachio Asiyah

- HIGH-risk terms in preview: **7**
- **Question:** Pistachio-only phrase — pair with shape (ring/tart/pyramid/asiyah/durum) for OAS-AS-BKL-0015

### OAS-AS-BKL-0016 — Pistachio Asiyah

- HIGH-risk terms in preview: **7**
- Multiple asiyah SKUs — require chocolate/mor/plain qualifier
- **Question:** Multiple asiyah SKUs — require chocolate/mor/plain qualifier

### OAS-AS-BKL-0019 — Pistachio Pyramid

- HIGH-risk terms in preview: **4**
- Shares pyramid/boukaj with OAS-AS-BKL-0006 and OAS-AS-BKL-0011
- **Question:** Shares pyramid/boukaj with OAS-AS-BKL-0006 and OAS-AS-BKL-0011

## HIGH conflict term sample (first 40)


| SKU | Term | Type | Clarification |
|-----|------|------|---------------|
| OAS-AS-BKL-0001 | kitta | search_keyword | Bare "kitta" matches multiple Batch 001 SKUs — require full product phrase or SKU OAS-AS-BKL-0001 |
| OAS-AS-BKL-0006 | pyramid baklawa | search_keyword | Pyramid without cashew qualifier — maps to multiple pyramid SKUs |
| OAS-AS-BKL-0006 | boukaj | search_keyword | Bare "boukaj" matches multiple Batch 001 SKUs — require full product phrase or SKU OAS-AS-BKL-0006 |
| OAS-AS-BKL-0011 | Pistachio Boukaj | official_alias | Pistachio-only phrase — pair with shape (ring/tart/pyramid/asiyah/durum) for OAS-AS-BKL-0011 |
| OAS-AS-BKL-0011 | pistachio boukaj | whatsapp_keyword | Pistachio-only phrase — pair with shape (ring/tart/pyramid/asiyah/durum) for OAS-AS-BKL-0011 |
| OAS-AS-BKL-0011 | boukaj | search_keyword | Bare "boukaj" matches multiple Batch 001 SKUs — require full product phrase or SKU OAS-AS-BKL-0011 |
| OAS-AS-BKL-0012 | Pistachio Assiyah | official_alias | Pistachio-only phrase — pair with shape (ring/tart/pyramid/asiyah/durum) for OAS-AS-BKL-0012 |
| OAS-AS-BKL-0012 | Pistachio High Jump Baklawa | official_alias | Pistachio-only phrase — pair with shape (ring/tart/pyramid/asiyah/durum) for OAS-AS-BKL-0012 |
| OAS-AS-BKL-0012 | Pistachio High Gap Baklawa | official_alias | Pistachio-only phrase — pair with shape (ring/tart/pyramid/asiyah/durum) for OAS-AS-BKL-0012 |
| OAS-AS-BKL-0012 | pistachio assiyah | whatsapp_keyword | Pistachio-only phrase — pair with shape (ring/tart/pyramid/asiyah/durum) for OAS-AS-BKL-0012 |
| OAS-AS-BKL-0012 | pistachio high jump baklawa | whatsapp_keyword | Pistachio-only phrase — pair with shape (ring/tart/pyramid/asiyah/durum) for OAS-AS-BKL-0012 |
| OAS-AS-BKL-0012 | pistachio high gap baklawa | whatsapp_keyword | Pistachio-only phrase — pair with shape (ring/tart/pyramid/asiyah/durum) for OAS-AS-BKL-0012 |
| OAS-AS-BKL-0012 | asiyah | search_keyword | Bare "asiyah" matches multiple Batch 001 SKUs — require full product phrase or SKU OAS-AS-BKL-0012 |
| OAS-AS-BKL-0013 | asiyah | search_keyword | Bare "asiyah" matches multiple Batch 001 SKUs — require full product phrase or SKU OAS-AS-BKL-0013 |
| OAS-AS-BKL-0014 | asiyah | search_keyword | Bare "asiyah" matches multiple Batch 001 SKUs — require full product phrase or SKU OAS-AS-BKL-0014 |
| OAS-AS-BKL-0015 | Pistachio Assiyah | official_alias | Pistachio-only phrase — pair with shape (ring/tart/pyramid/asiyah/durum) for OAS-AS-BKL-0015 |
| OAS-AS-BKL-0015 | Pistachio High Jump Baklawa | official_alias | Pistachio-only phrase — pair with shape (ring/tart/pyramid/asiyah/durum) for OAS-AS-BKL-0015 |
| OAS-AS-BKL-0015 | Pistachio High Gap Baklawa | official_alias | Pistachio-only phrase — pair with shape (ring/tart/pyramid/asiyah/durum) for OAS-AS-BKL-0015 |
| OAS-AS-BKL-0015 | pistachio assiyah | whatsapp_keyword | Pistachio-only phrase — pair with shape (ring/tart/pyramid/asiyah/durum) for OAS-AS-BKL-0015 |
| OAS-AS-BKL-0015 | pistachio high jump baklawa | whatsapp_keyword | Pistachio-only phrase — pair with shape (ring/tart/pyramid/asiyah/durum) for OAS-AS-BKL-0015 |
| OAS-AS-BKL-0015 | pistachio high gap baklawa | whatsapp_keyword | Pistachio-only phrase — pair with shape (ring/tart/pyramid/asiyah/durum) for OAS-AS-BKL-0015 |
| OAS-AS-BKL-0015 | asiyah | search_keyword | Bare "asiyah" matches multiple Batch 001 SKUs — require full product phrase or SKU OAS-AS-BKL-0015 |
| OAS-AS-BKL-0016 | Pistachio Assiyah | official_alias | Pistachio-only phrase — pair with shape (ring/tart/pyramid/asiyah/durum) for OAS-AS-BKL-0016 |
| OAS-AS-BKL-0016 | Pistachio High Jump Baklawa | official_alias | Pistachio-only phrase — pair with shape (ring/tart/pyramid/asiyah/durum) for OAS-AS-BKL-0016 |
| OAS-AS-BKL-0016 | Pistachio High Gap Baklawa | official_alias | Pistachio-only phrase — pair with shape (ring/tart/pyramid/asiyah/durum) for OAS-AS-BKL-0016 |
| OAS-AS-BKL-0016 | pistachio assiyah | whatsapp_keyword | Pistachio-only phrase — pair with shape (ring/tart/pyramid/asiyah/durum) for OAS-AS-BKL-0016 |
| OAS-AS-BKL-0016 | pistachio high jump baklawa | whatsapp_keyword | Pistachio-only phrase — pair with shape (ring/tart/pyramid/asiyah/durum) for OAS-AS-BKL-0016 |
| OAS-AS-BKL-0016 | pistachio high gap baklawa | whatsapp_keyword | Pistachio-only phrase — pair with shape (ring/tart/pyramid/asiyah/durum) for OAS-AS-BKL-0016 |
| OAS-AS-BKL-0016 | asiyah | search_keyword | Bare "asiyah" matches multiple Batch 001 SKUs — require full product phrase or SKU OAS-AS-BKL-0016 |
| OAS-AS-BKL-0017 | asiyah | search_keyword | Bare "asiyah" matches multiple Batch 001 SKUs — require full product phrase or SKU OAS-AS-BKL-0017 |
| OAS-AS-BKL-0018 | kitta | search_keyword | Bare "kitta" matches multiple Batch 001 SKUs — require full product phrase or SKU OAS-AS-BKL-0018 |
| OAS-AS-BKL-0019 | Pistachio Boukaj | official_alias | Pistachio-only phrase — pair with shape (ring/tart/pyramid/asiyah/durum) for OAS-AS-BKL-0019 |
| OAS-AS-BKL-0019 | pistachio boukaj | whatsapp_keyword | Pistachio-only phrase — pair with shape (ring/tart/pyramid/asiyah/durum) for OAS-AS-BKL-0019 |
| OAS-AS-BKL-0019 | pyramid baklawa | search_keyword | Pyramid without nut qualifier — maps to 0006, 0011, or 0019 |
| OAS-AS-BKL-0019 | boukaj | search_keyword | Bare "boukaj" matches multiple Batch 001 SKUs — require full product phrase or SKU OAS-AS-BKL-0019 |

---

*Preview only. Do not import until Category 2 language batch is approved.*
