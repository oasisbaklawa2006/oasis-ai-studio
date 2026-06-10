# Oasis Product Language Authority — Design

**Date:** 2026-06-10  
**Status:** Design only — no implementation  
**Authority environment:** AI Studio → Central Supabase `tcxvcatsqqertcnycuop`  
**Reference cohort:** Category 1 Batch 001 (`OAS-AS-BKL-0001` … `OAS-AS-BKL-0025`)

**Constraints:** No code, SQL, migrations, or data changes in this document.

---

## Purpose

Define the **permanent authority model** for how Oasis names and discovers products across:

- Internal ops (AI Studio, Central order-taking)
- Trace (label and compliance surfaces)
- WhatsApp sales and catalogue flows
- Future customer-facing discovery apps

**Core rule:** `SKU` + `product_id` are the only external system identities. All language below is **search and display aid**, never a foreign key.

---

## Batch 001 anchor products

| SKU | Official name (Central `products.name`) | Family |
|-----|----------------------------------------|--------|
| `OAS-AS-BKL-0001` | Cashew Kitta | Lebanese Baklawa / Kitta |
| `OAS-AS-BKL-0012` | Chocolate Pistachio Asiyah | Asiyah / gap-style |
| `OAS-AS-BKL-0019` | Pistachio Pyramid | Pyramid / Boukaj |
| `OAS-AS-BKL-0025` | Coconut Durum | Turkish Durum roll |

Authority sheet columns (not yet fully imported) illustrate intended richness per SKU:

- **Aliases** — e.g. `Kaju Kitta`, `Pistachio Boukaj`, `Pistachio Assiyah`
- **WhatsApp keywords** — e.g. `need cashew kitta`, `send pistachio pyramid`, `coconut durum kg`

---

## A. Final authority model

### Layer 0 — System identity (not a language term)

| Field | Table | Owner |
|-------|-------|-------|
| `sku` | `products` | Category 1 (immutable after lock) |
| `product_id` | `products.id` | System |
| **Official Name** | `products.name` | Category 1 |

Everything else in this document is **Category 2 — Product Language**.

### Layer 1 — Typed language terms (recommended target)

Single authority table: **`product_language_terms`** (evolution of today’s `product_aliases`).

| Term type | Purpose | Approval | Storage |
|-----------|---------|------------|---------|
| **Official Name** | Legal/catalogue display name | Category 1 product draft | `products.name` |
| **Official Alias** | Approved alternate correct name | Yes (Cat 2) | `product_language_terms` |
| **Customer Term** | How buyers ask for the product | Yes | `product_language_terms` |
| **WhatsApp Keyword** | Chat/order matching phrases | Yes | `product_language_terms` |
| **Regional Term** | Locale/market vocabulary | Yes | `product_language_terms` |
| **Legacy Name** | Retired or pre-rebrand names | Yes | `product_language_terms` |
| **Search Keyword** | Broad discovery / fuzzy match | Yes (lower bar) | `product_language_terms` |

**Do not** store typed terms on `products.aliases[]` long term — that array is legacy, unapproved, and untyped.

### Term type reference (Batch 001 examples)

#### 1. Official Name

| | |
|--|--|
| **Purpose** | Single canonical human name on invoices, labels, B2B docs, catalogue cards |
| **Examples** | `Cashew Kitta`; `Chocolate Pistachio Asiyah`; `Pistachio Pyramid`; `Coconut Durum` |
| **Approval** | **Required** — Category 1 product draft → reviewer |
| **Storage** | `products.name` |
| **Central** | **Yes** — master identity field |
| **Trace** | **Yes** — primary label title |
| **Customer App** | **Yes** — default display name |

#### 2. Official Alias

| | |
|--|--|
| **Purpose** | Correct alternate names used internally and in export; not misspellings |
| **Examples** | `Kaju Kitta` (0001); `Chocolate Pista Asiyah` (0012); `Pistachio Boukaj` (0019); `Coconut Durum Baklava` (0025) |
| **Approval** | **Required** — Cat 2 language draft |
| **Storage** | `product_language_terms.term_type = official_alias` |
| **Central** | **Yes** — order/search resolution |
| **Trace** | **Optional** — secondary line on label only if policy allows |
| **Customer App** | **Optional** — subtitle under official name |

#### 3. Customer Term

| | |
|--|--|
| **Purpose** | Natural language customers use in shops/WhatsApp; may be informal |
| **Examples** | `cashew piece`; `chocolate pista gap`; `pista pyramid`; `coconut roll` |
| **Approval** | **Required** |
| **Storage** | `term_type = customer_term` |
| **Central** | **Yes** — sales matching |
| **Trace** | **No** |
| **Customer App** | **Yes** — search synonyms |

#### 4. WhatsApp Keyword

| | |
|--|--|
| **Purpose** | Phrases that trigger product recognition in WhatsApp order flows |
| **Examples** | `need cashew kitta`; `send cashew kitta`; `need pistachio pyramid`; `send coconut durum`; `coconut durum kg` |
| **Approval** | **Required** — higher scrutiny (order impact) |
| **Storage** | `term_type = whatsapp_keyword` + `channel_scope` includes `whatsapp` |
| **Central** | **Yes** — WhatsApp Business / order bot |
| **Trace** | **No** |
| **Customer App** | **Future** — if chat ordering shared |

#### 5. Regional Term

| | |
|--|--|
| **Purpose** | Market/language-specific names (Hindi, Arabic, Turkish, Romanized) |
| **Examples** | `काजू कित्ता` (0001); `بقلاوة كاجو` ; `Kadayıf` (wrong family — must not attach); `Fıstıklı durum` (0025) |
| **Approval** | **Required** — language reviewer when non-Latin |
| **Storage** | `term_type = regional_term` + `language` + `script` |
| **Central** | **Yes** — regional sales |
| **Trace** | **Yes** — bilingual label variants when approved |
| **Customer App** | **Yes** — locale search |

#### 6. Legacy Name

| | |
|--|--|
| **Purpose** | Old catalogue/PDF names; prevents broken search after rename |
| **Examples** | `Pistachio Pyramid(Topping)` → maps to 0011 vs 0019 disambiguation; old `Cashew Pyramid` strings pointing to wrong SKU |
| **Approval** | **Required** — must include `effective_to` or `supersedes_sku` note in draft |
| **Storage** | `term_type = legacy_name` |
| **Central** | **Yes** — historical order lookup |
| **Trace** | **No** — never on new labels |
| **Customer App** | **Search only** — redirect to current official name |

#### 7. Search Keyword

| | |
|--|--|
| **Purpose** | Broad discovery terms, category-level words, common misspellings |
| **Examples** | `baklawa`; `baklava`; `lebanese sweet`; `arabic sweet`; `kitta`; `asiyah`; `durum`; `pyramid` (with disambiguation rules) |
| **Approval** | **Required** — auto-suggest allowed as draft; reviewer prunes over-broad terms |
| **Storage** | `term_type = search_keyword` |
| **Central** | **Yes** — `search_products_with_language_terms` RPC |
| **Trace** | **No** |
| **Customer App** | **Yes** — primary discovery |

### Disambiguation rule (critical for Batch 001)

Shared keywords (`pyramid`, `pista`, `durum`, `asiyah`) **must** resolve via:

1. `product_id` / `sku` anchor on every term row  
2. Match score + specificity (longer phrase beats single token)  
3. Optional `term_rank` / `specificity_score` column  
4. Human reviewer rejects ambiguous global keywords without SKU scope

Example: `pyramid` alone may match multiple SKUs; `pistachio pyramid kg` should prefer `OAS-AS-BKL-0019`.

---

## B. Lifecycle

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────────────┐
│ Category 1      │     │ Category 2           │     │ Published language        │
│ product draft   │────▶│ language term drafts │────▶│ product_language_terms  │
│ (official name) │     │ (typed terms)        │     │ + catalogue_versions      │
└─────────────────┘     └──────────────────────┘     └─────────────────────────┘
         │                          │                              │
         ▼                          ▼                              ▼
   products.name              pending_approval                  is_active = true
   sku locked                 reviewer queue                    synced snapshot
```

| Stage | State | Where |
|-------|-------|-------|
| **Proposed** | Contributor or import staging | `catalogue_language_term_drafts` or extended `catalogue_alias_drafts` |
| **Pending** | `status = pending_approval` | Draft table |
| **Approved** | Master row created/updated | `product_language_terms` |
| **Active** | `is_active = true`, in search index | Master + RPC |
| **Deprecated** | `is_active = false` or `effective_to` set | Master (soft) |
| **Versioned** | Immutable snapshot | `catalogue_versions.snapshot_json.language_terms[]` |
| **Synced** | Read-only on Central consumers | Central sync event (future) |

**Category 1 import today:** official name lands on `products`; alias/WhatsApp columns in authority CSV are **not** auto-promoted — they require **Category 2 language import batch** after SKU exists.

---

## C. Approval workflow

### Roles

| Role | Can propose | Can approve |
|------|-------------|-------------|
| `catalogue_contributor` | Draft submit | No |
| `product_manager` / `admin` | Direct write (transitional) or draft | Yes |
| `catalogue_reviewer` | — | Yes (all Cat 2 language) |
| Language specialist (future) | — | `regional_term` + `whatsapp_keyword` |

### Draft payload (target shape)

```json
{
  "scope": "product_language_term",
  "product_id": "uuid",
  "sku": "OAS-AS-BKL-0001",
  "term_type": "whatsapp_keyword",
  "term_text": "need cashew kitta",
  "language": "en",
  "script": "latin",
  "region": "IN-NCR",
  "channel_scope": ["whatsapp", "search"],
  "source": "category2_import_batch_002",
  "notes": "From authority sheet col WhatsApp keywords"
}
```

### Approve RPC mapping (future)

`catalogue_language_term_drafts` → `product_language_terms`

| Operation | Master effect |
|-----------|---------------|
| `create` | INSERT term row |
| `update` | UPDATE text/metadata; bump `version` |
| `delete_request` | `is_active = false` or hard delete if never synced |

### Review gates by term type

| Term type | Extra review |
|-----------|--------------|
| Official Name | Category 1 product approval (existing) |
| Official Alias | Standard |
| Customer Term | Standard |
| **WhatsApp Keyword** | **Sales + reviewer** — triggers real orders |
| Regional Term | Script/language sanity |
| Legacy Name | Confirm superseded SKU |
| Search Keyword | Reject if cross-SKU ambiguous |

---

## D. AI Studio ownership

| Category | AI Studio surface | Owns |
|----------|-------------------|------|
| **Category 1** | Product Edit Identity, `/admin/import/category-1` | `products.name`, SKU, UOM, compliance |
| **Category 2** | Alias Manager → **Language Terms** panel, future `/admin/import/category-2-language` | All typed terms |
| **Category 3** | Catalogue Builder | Collection composition only — **not** term authority |
| **Category 4** | Product Truth → Central Sync preview | Versioned export bundle |

**AI Studio is the authoring authority.** Central is the **runtime consumer** after approved snapshot sync (preview today; live sync gated).

### Current vs target (honest)

| Capability | Today | Target |
|------------|-------|--------|
| Official Name | `products.name` via Cat 1 | Same |
| Typed terms | Flat `product_aliases.alias_text` | `product_language_terms` + `term_type` |
| WhatsApp keywords | Not stored | `whatsapp_keyword` rows |
| Approval | `catalogue_alias_drafts` (metadata dropped) | Full payload preserved |
| Search | Client fallback + missing RPC | `search_products_with_language_terms` |
| Import | Cat 1 ignores alias columns | Cat 2 language CSV staging |

---

## E. Central consumption model

Central (order-taking, B2B portal, WhatsApp integrations) consumes **approved, versioned** language bundles:

```json
{
  "sku": "OAS-AS-BKL-0001",
  "official_name": "Cashew Kitta",
  "language_terms": [
    { "type": "whatsapp_keyword", "text": "need cashew kitta", "active": true },
    { "type": "search_keyword", "text": "kitta", "active": true },
    { "type": "official_alias", "text": "Kaju Kitta", "active": true }
  ],
  "language_version": "2026-06-10T12:00:00Z"
}
```

| Consumer | Fields used |
|----------|-------------|
| Order entry / SKU lookup | `sku`, `official_name` |
| Fuzzy product search | `search_keyword`, `customer_term`, `official_alias` |
| WhatsApp matcher | `whatsapp_keyword` only (channel filter) |
| Pricing display | `official_name` — never alias as price line item |

**Not enabled yet:** live Central sync (`LIVE_CENTRAL_WRITE_ENABLED = false`). Central today reads `products.name` and legacy `product_aliases` / `products.aliases[]` ad hoc.

---

## F. Trace consumption model

Trace (Labels, Label Queue, compliance PDFs) has **stricter** rules than search:

| Term type | Trace use |
|-----------|-----------|
| Official Name | **Required** on label front panel |
| Official Alias | Optional secondary line if compliance approves |
| Regional Term | Bilingual label back panel when `language` approved |
| Customer Term | **No** |
| WhatsApp Keyword | **No** |
| Legacy Name | **No** on new prints |
| Search Keyword | **No** |

Trace must **never** render WhatsApp keywords or broad search tokens on physical labels. Trace reads from Product Truth compliance-approved snapshot, not raw search index.

---

## G. Future customer-app consumption

| Phase | Behaviour |
|-------|-----------|
| **Phase 1** | Search API returns `official_name` + matched `term_type` + `term_text`; UI shows official name always |
| **Phase 2** | Locale-aware search using `regional_term` |
| **Phase 3** | “Did you mean?” for `legacy_name` → current SKU |
| **Phase 4** | WhatsApp deep-link with pre-filled SKU from keyword match |

**API contract (future):**

```
GET /catalogue/search?q=kitta
→ [{ product_id, sku, display_name, matched_term, matched_term_type, score }]
```

Customer app **display name** = `official_name` only. Matched term shown as hint: “Found via: Kaju Kitta”.

---

## Recommended schema

### Option A (preferred): Evolve `product_aliases` → `product_language_terms`

Additive migration on Central — **no rename in phase 1**:

```text
product_language_terms
├── id                    uuid PK
├── product_id            uuid NOT NULL FK → products(id)
├── term_type             text NOT NULL  -- enum: see §A
├── term_text             text NOT NULL  -- (today: alias_text)
├── normalized_term       text GENERATED  -- lower(trim), index
├── canonical_name        text NULL      -- legacy compat; deprecate
├── language              text NULL
├── script                text NULL
├── region                text NULL
├── channel_scope         text[] NULL    -- {whatsapp,search,customer_app,central,trace}
├── source                text NOT NULL DEFAULT 'manual'
├── confidence_score      numeric DEFAULT 1.0
├── is_active             boolean DEFAULT true
├── effective_from        timestamptz NULL
├── effective_to          timestamptz NULL
├── version               int DEFAULT 1
├── created_by            uuid NULL
├── approved_by           uuid NULL
├── approved_at           timestamptz NULL
├── created_at            timestamptz NOT NULL
└── UNIQUE (product_id, term_type, normalized_term)
```

**View for backward compatibility:**

```text
product_aliases_compat → SELECT id, product_id, term_text AS alias_text, canonical_name, ...
```

### Option B: Keep `products.name` + separate tables per type

Rejected — seven tables duplicates approval/search logic.

### Official Name stays on `products`

```text
products.name  -- Category 1 authority; not duplicated in language terms table
```

---

## Recommended approval workflow

1. **Contributor** adds term in AI Studio Language panel → `catalogue_language_term_drafts` (`pending_approval`).
2. **Reviewer** sees term type, SKU, product name, channel, side-by-side with existing terms for same SKU.
3. **Approve RPC** writes `product_language_terms`; stores full metadata; audit in `catalogue_approval_audit`.
4. **Snapshot job** (manual today) includes `language_terms[]` in `catalogue_versions.snapshot_json`.
5. **Central sync** (future) receives approved snapshot only.

**Bulk path for Batch 001 authority columns:**

- `/admin/import/category-2-language` — CSV: `sku, term_type, term_text, language, channel`
- One draft row per term; reviewer batch-approves per SKU group

---

## Mapping authority sheet → term types

| Authority CSV column | Term type(s) |
|---------------------|--------------|
| Product name | `official_name` → Cat 1 only |
| Aliases (semicolon list) | Split → `official_alias`, `customer_term`, `search_keyword` (reviewer reclassifies) |
| WhatsApp keywords | `whatsapp_keyword` |
| Hindi/Arabic in alias list | `regional_term` |
| Old PDF name | `legacy_name` |

Example row **Cashew Kitta** (`OAS-AS-BKL-0001`):

| Source string | Proposed type |
|---------------|---------------|
| `Cashew Kitta` | official_name (already on product) |
| `Kaju Kitta` | official_alias |
| `cashew kitta` | search_keyword |
| `need cashew kitta` | whatsapp_keyword |
| `cashew baklawa piece` | customer_term |

---

## Recommended next implementation PR

**After** PR #32 (client search fallback) is merged:

**PR: Category 2 language term types in AliasManager (client + draft payload only, no SQL)**

- Extend AliasManager term type dropdown to match §A enum
- Draft payload includes `term_type` + `channel_scope` (stored in draft JSON even before DB columns)
- Filter list by type tabs (Aliases / WhatsApp / Regional / Search)
- No master write beyond current `alias_text` shape until SQL PR lands

**Following PR (SQL, separate review):** additive `term_type`, `channel_scope`, `is_active` columns + approve RPC update + Central-native search RPC.

---

## What must not happen

- Storing WhatsApp keywords only in catalogue proposal text
- Using `products.aliases[]` as authority
- Treating alias text as SKU substitute in APIs
- Auto-importing authority sheet keywords on Cat 1 approve without review
- Enabling live Central sync before snapshot includes `language_terms`

---

## Confirmation

This document is **design only**. No code, SQL, migrations, or product data were created or modified.
