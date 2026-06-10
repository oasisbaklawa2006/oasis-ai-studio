# Language Term Persistence Gap Report

**Date:** 2026-06-10  
**Program:** AI Studio Catalogue Authority Completion Wave — Workstream C  
**Scope:** `product_aliases`, draft approval path, WhatsApp keyword routing, Product Truth snapshots  
**Mode:** Code + schema audit — no migrations, no direct writes

---

## Executive summary

| Gap area | Severity | Persistence today | Impact |
|----------|----------|-------------------|--------|
| `term_type` loss on approval | **Critical** | Draft payload only | Cannot distinguish WhatsApp vs official at query time |
| `channel_scope` loss | **Critical** | Draft payload only | Channel routing requires inference/heuristics |
| `language` / `script` loss | High | Draft payload only | Regional term support blocked |
| `source` tag loss | Medium | `catalogue_approval_audit.payload_snapshot` | Provenance audit only via audit table |
| UI term type storage | High | `localStorage` per browser | Not shared across users/devices |
| Schema drift (local vs Central) | High | Two column models | Type errors, insert failures on wrong path |
| Product Truth snapshot | High | Column unused | No frozen authority for catalogue/resolver |
| **Language persistence readiness** | | **28%** | |

201 approved aliases exist on Central with only `alias_text`, `canonical_name`, `product_id`, and `created_at`. All semantic metadata required for WhatsApp keyword governance is lost at the master boundary.

---

## Central `product_aliases` schema (live)

Verified columns on `tcxvcatsqqertcnycuop`:

| Column | Type | Populated on approve? |
|--------|------|---------------------|
| `id` | uuid | auto |
| `alias_text` | text | ✓ from draft |
| `canonical_name` | text | ✓ from draft |
| `product_id` | uuid | ✓ from draft |
| `created_at` | timestamptz | auto |

**Not present on Central:** `term_type`, `channel_scope`, `language`, `script`, `source`, `alias_type`, `is_active`, `normalized_alias`.

Local migration (`supabase/migrations/20260506053901_*.sql`) defines a richer schema (`alias`, `alias_type`, `language`, `script`, `source`, `is_active`, `normalized_alias`) that does **not** match Central production.

---

## Approval path metadata loss

### Draft payload (rich)

Drafts submitted to `catalogue_alias_drafts` include:

```json
{
  "scope": "product_alias",
  "alias_text": "cashew kitta",
  "term_type": "whatsapp_keyword",
  "channel_scope": ["whatsapp"],
  "product_id": "...",
  "canonical_name": "Cashew Kitta",
  "language": null,
  "script": null,
  "source": "batch001_language_wave2a"
}
```

### Approval RPC (stripped)

`approve_catalogue_draft_internal` in `scripts/supabase/PR06C1_central_tag_alias_approve_mapping.sql`:

```sql
INSERT INTO public.product_aliases (alias_text, canonical_name, product_id)
VALUES (v_alias_text, v_canonical_name, v_product_id)
```

**Dropped fields:** `term_type`, `channel_scope`, `language`, `script`, `source`, `alias_type`.

### Where metadata survives

| Location | Fields preserved | Queryable at runtime? |
|----------|------------------|----------------------|
| `catalogue_alias_drafts.payload` (approved rows) | Full | Only via draft history |
| `catalogue_approval_audit.payload_snapshot` | Full | Audit UI only |
| `product_aliases` master | 3 fields | Yes — resolver/search |
| `localStorage` (`termTypeStorage.ts`) | `term_type` by row key | Per-browser only |

---

## UI persistence gaps

### `termTypeStorage.ts`

```typescript
// src/features/productLanguage/termTypeStorage.ts
const STORAGE_PREFIX = "oasis-product-language-term-types";
```

Term types for approved aliases are stored in browser `localStorage` keyed by `productId` + alias row id. This is:

- Not durable across devices
- Not available to server-side resolver
- Lost on cache clear
- Not written back to master on approval

### `AliasManager.tsx`

Reads/writes `product_aliases` using local schema types (`alias`, `alias_type`) while Central uses `alias_text`. Admin insert path in `terms.ts` documents "DB-safe insert — only Central-supported product_aliases columns" but UI components still reference legacy column names.

### `loadResolverCatalog.ts`

Loads `product_aliases` for resolver prototype. No `term_type` filter — all aliases treated equally for matching. WhatsApp-specific routing cannot prefer `whatsapp_keyword` over `official_alias`.

---

## Product Truth snapshot gap

| Item | Status |
|------|--------|
| `products.product_truth_snapshot` column | Exists on Central |
| Written from Product Edit | **No** |
| Written on import approval | **No** |
| Read by Catalogue Builder | **No** |
| Read by Public Catalogue | **No** |
| Read by Resolver | **No** |

Catalogue Builder uses `productToForm()` with hardcoded `media_status: "approved"` and `complianceApproved: true` — optimistic gates that do not reflect master truth.

---

## Functional impact

| Consumer | Current behavior | Required behavior |
|----------|------------------|-------------------|
| WhatsApp bot | Match any alias text | Prefer `whatsapp_keyword` channel scope |
| Product search | Trigram on `alias_text` | Optionally boost by `term_type` |
| Catalogue share | N/A | Official display names from `official_alias` |
| Clarification engine | Heuristic ambiguity | Use `term_type` + cross-SKU registry |
| Audit / rollback | Draft snapshot only | Master-level provenance |

---

## `product_aliases` limitations summary

| Limitation | Detail |
|------------|--------|
| No term classification | Cannot query "all WhatsApp keywords for SKU X" |
| No channel scope | Cannot enforce channel-specific alias sets |
| No normalization column on Central | Relies on runtime `lower(trim())` |
| No `is_active` flag | Cannot soft-disable without delete |
| No uniqueness constraint visible | Cross-product collision detection is application-level only |
| No FK cascade audit | Deletes lose draft linkage |

---

## Readiness score: 28%

| Capability | Weight | Score |
|------------|--------|-------|
| Alias text → product mapping | 30% | 90% (201 rows work) |
| Term type on master | 25% | 0% |
| Channel scope on master | 25% | 0% |
| Runtime query without localStorage | 10% | 10% |
| Product Truth snapshot | 10% | 0% |
| **Weighted total** | | **28%** |

---

## Recommended remediation (implementation wave)

### Wave 3A — Schema alignment (requires migration — out of scope this wave)

1. Add to Central `product_aliases`: `term_type text`, `channel_scope text[]`, `source text`, `language text`, `script text`.
2. Update `approve_catalogue_draft_internal` INSERT to map all payload fields.
3. Backfill from `catalogue_approval_audit.payload_snapshot` for 201 existing rows.

### Wave 3B — Application (no migration, interim)

1. Resolver reads approved draft payloads as secondary index (read-only join on `catalogue_alias_drafts` where status = approved).
2. Remove `localStorage` term type dependency; show "type unknown (master)" in UI for approved rows.
3. Stop hardcoding `complianceApproved: true` in Catalogue Builder.

### Wave 3C — Product Truth snapshot

1. On product draft approval, write `product_truth_snapshot` JSONB with media, pricing, compliance, language summary.
2. Catalogue Builder reads snapshot instead of live optimistic form.

---

## References

- `scripts/supabase/PR06C1_central_tag_alias_approve_mapping.sql` (lines 401–404)
- `src/features/productLanguage/terms.ts`
- `src/features/productLanguage/termTypeStorage.ts`
- `src/features/productResolver/loadResolverCatalog.ts`
- `src/integrations/supabase/types.ts` (local `alias` schema)
- Live Central columns verified 2026-06-10
