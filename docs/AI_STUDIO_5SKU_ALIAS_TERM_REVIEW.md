# AI Studio 5-SKU Alias Term Review

_Date: 2026-03-13 · 80 governed terms (16 × 5 SKUs)_

**Disclaimer:** All terms are **suggestions only**. Approve in **`/testing/pilot-aliases`** before saving. Nothing is written to `product_aliases` until explicit user approval.

## Schema (review model)

| Field | Values |
|-------|--------|
| `alias_text` | Display / match text |
| `alias_type` | `official` · `search_keyword` · `whatsapp_keyword` · `phonetic` · `sales_term` |
| `channel_scope` | `catalogue` · `whatsapp` · `both` · `internal` |
| `review_status` | `suggested` → user sets `approved` or `rejected` |

**DB mapping on save:** `alias_type` → `product_aliases.alias_type` (`official_alias`, `search_keyword`, etc.). `channel_scope` and `review_status` are included in draft payload metadata until migration (see alias authority plan).

## Collision rules applied

| Rule | Action |
|------|--------|
| Bare generic (`kitta`, `durum`, `baklawa`, …) | **Auto-reject** |
| Same normalized text on another pilot SKU | **Block** |
| Ambiguous shared phrase without anchor | **Block** or **warn** |
| Weak anchor | **Warn** — manual review |

**Cross-SKU scan result:** **0 hard blocks** in curated pack (80/80 pass collision gate).

## Review summary by SKU

| SKU | Product | Terms | Collisions flagged | Recommended approve |
|-----|---------|------:|-------------------:|------------------:|
| OAS-AS-BKL-0024 | Mor Pistachio Durum | 16 | 0 block | 16 |
| OAS-AS-BKL-0020 | Tart Cashew | 16 | 0 block | 16 |
| OAS-AS-BKL-0001 | Cashew Kitta | 16 | 0 block | 16* |
| OAS-AS-BKL-0025 | Coconut Durum | 16 | 0 block | 16 |
| OAS-AS-BKL-0007 | Cashew Finger | 16 | 0 block | 16 |

\* **0001 manual note:** Avoid approving bare `kitta` or `lebanese baklawa` if added manually — not in curated pack.

---

## OAS-AS-BKL-0024 — Mor Pistachio Durum

### Official / search (5)

| alias_text | alias_type | channel_scope | collision |
|------------|------------|---------------|-----------|
| Mor Pista Durum | official | catalogue | none |
| Beetroot Pistachio Durum | official | catalogue | none |
| Mor Pistachio Durum Baklawa | official | both | none |
| Turkish mor pistachio roll | search_keyword | catalogue | none |
| Purple pistachio durum | search_keyword | both | none |

### WhatsApp (5)

| alias_text | channel_scope |
|------------|---------------|
| mor pistachio durum | whatsapp |
| mor pista durum | whatsapp |
| beetroot pistachio durum | whatsapp |
| need mor pistachio durum | whatsapp |
| mor pistachio durum kg | whatsapp |

### Phonetic (3)

`mor pista duram` · `mor pistashio durum` · `mor pista dorum`

### Sales terms (3)

`MPD durum` · `Mor pista roll` · `Beetroot durum` (internal)

**Collision vs other products:** `durum roll` / `turkish roll` shared with 0025 — curated terms include **product anchors** (`mor pistachio`, `beetroot`).

---

## OAS-AS-BKL-0020 — Tart Cashew

### Official / search (5)

| alias_text | alias_type | channel_scope |
|------------|------------|---------------|
| Tart Kaju | official | catalogue |
| Cashew Baklawa Tart | official | catalogue |
| Tart Cashew Baklawa | official | both |
| Cashew katori tart | search_keyword | both |
| Lebanese tart cashew | search_keyword | catalogue |

### WhatsApp (5)

`tart cashew` · `tart kaju` · `cashew tart baklawa` · `need tart cashew` · `tart cashew kg`

### Phonetic (3)

`tart cashoo` · `tart kajoo` · `cashew tartt`

### Sales terms (3)

`TC tart` · `Tart cashew loose` · `Katori tart cashew`

**Collision note:** `katori` alone is ambiguous vs other katori products — pack uses **cashew katori tart**.

---

## OAS-AS-BKL-0001 — Cashew Kitta

### Official / search (5)

| alias_text | alias_type | channel_scope |
|------------|------------|---------------|
| Kaju Kitta | official | catalogue |
| Cashew Nut Kitta | official | catalogue |
| Cashew Kitta Baklawa | official | both |
| Lebanese Cashew Kitta | search_keyword | catalogue |
| Cashew Diamond Piece | search_keyword | both |

### WhatsApp (5)

`cashew kitta` · `kaju kitta` · `need cashew kitta` · `send cashew kitta` · `cashew kitta kg`

### Phonetic (3)

`cashoo kitta` · `cashew kita` · `kaju kita`

### Sales terms (3)

`Kitta cashew` · `CK kitta loose` · `Kitta bulk piece`

**Collision note (historical):** Language preview flagged bare **`kitta`** as HIGH collision across Batch 001 — **excluded** from this pack.

---

## OAS-AS-BKL-0025 — Coconut Durum

### Official / search (5)

| alias_text | alias_type | channel_scope |
|------------|------------|---------------|
| Nariyal Durum | official | catalogue |
| Coconut Roll Baklava | official | catalogue |
| Coconut Durum Baklawa | official | both |
| Turkish coconut durum | search_keyword | catalogue |
| Nariyal roll baklawa | search_keyword | both |

### WhatsApp (5)

`coconut durum` · `nariyal durum` · `coconut durum baklawa` · `need coconut durum` · `coconut durum kg`

### Phonetic (3)

`cocunut durum` · `nariyal duram` · `coconut dorum`

### Sales terms (3)

`CD coconut durum` · `Nariyal durum loose` · `Coco durum roll`

**Collision note:** Do **not** approve `coconut roll` alone on 0024 (wrong product) — not in pack.

---

## OAS-AS-BKL-0007 — Cashew Finger

### Official / search (5)

| alias_text | alias_type | channel_scope |
|------------|------------|---------------|
| Kaju Finger | official | catalogue |
| Cashew Asabi | official | catalogue |
| Cashew Finger Baklawa | official | both |
| Lebanese Cashew Finger | search_keyword | catalogue |
| Cashew finger sweet | search_keyword | both |

### WhatsApp (5)

`cashew finger` · `kaju finger` · `cashew asabi` · `need cashew finger` · `cashew finger kg`

### Phonetic (3)

`cashew fingar` · `kaju fingar` · `cashew asabeh`

### Sales terms (3)

`Finger cashew` · `CF finger loose` · `Asabi piece`

---

## Rejected generics (do not add)

| Term | Reason |
|------|--------|
| kitta | Bare generic — multiple Batch 001 SKUs |
| finger | Bare generic |
| durum | Bare generic |
| tart | Bare generic |
| lebanese baklawa | Category-level, not SKU-specific |
| turkish roll | Shared 0024/0025 vocabulary without anchor |

---

## How to approve and save

1. Open **`/testing/pilot-aliases`**
2. Select SKU tab → review 16 terms
3. **Approve** per term (or **Approve safe terms**)
4. **Save approved** → direct `product_aliases` insert (admin) or alias draft (contributor)
5. Blocked collisions cannot be saved

**Export files:**

- `data/pilot/pilot_5sku_alias_suggestions.json`
- `data/pilot/pilot_5sku_alias_suggestions.csv`

**Regenerate:** `npm run generate:pilot-aliases`

---

## Code references

| Module | Role |
|--------|------|
| `pilotAliasSeeds.ts` | Curated 16-term packs |
| `pilotAliasCollision.ts` | Generic reject + cross-SKU check |
| `pilotAliasEngine.ts` | Bundle builder |
| `PilotAliasReview.tsx` | Review UI |
| `pilotAliasSave.ts` | Approved-only persistence |
