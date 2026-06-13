# AI Studio — Label / Product Search Status

_Date: 2026-03-28 · Repo: `oasis-ai-studio`_

## Symptom

Label Studio product picker (and Products search) showed:

> Advanced alias search unavailable — using Central-compatible basic search.

## Root cause

**Expected fallback by design.** The app calls RPC `search_products_with_aliases`; when absent or failing on shared Central Supabase, it falls back to client-side ILIKE search on `products` + `product_aliases`.

| Component | RPC used | Fallback |
|-----------|----------|----------|
| `src/lib/productSearch.ts` | `search_products_with_aliases(_q text)` | `basicSearchFallback()` |
| `src/components/ProductPicker.tsx` | via `searchProductsWithAliases` | same |
| `src/pages/Products.tsx` | via `searchProductsWithAliases` | same |
| `src/pages/Labels.tsx` | ProductPicker | same |

### Why RPC may be missing on live DB

- Migration exists in AI Studio repo: `supabase/migrations/20260506053901_*.sql`, `20260506055900_*.sql`
- May not be deployed on `tcxvcatsqqertcnycuop`, or RPC references columns (`product_name` vs `name`) that differ from live schema
- Prior audits note RPC **broken/missing on Central** — fallback is the supported path until RPC is redeployed

### Fallback behavior (safe)

Fallback search still:

- Matches `products.name`, `products.sku` (ILIKE)
- Matches `product_aliases.alias_text`, `canonical_name`
- Resolves alias-linked products
- Returns scored results (SKU exact > name > alias)

**No data loss.** Search quality may be lower than trigram RPC but is production-usable.

## Fix applied in code

| Before | After |
|--------|-------|
| Warning-styled alarming message | Neutral info: **"Using basic product search (name, SKU, and alias table)."** |
| `text-warning` in ProductPicker / Products | `text-muted-foreground` |

RPC path unchanged — will auto-use advanced search when RPC succeeds.

## Backend action (optional improvement)

To enable advanced search on live Supabase:

1. Deploy `search_products_with_aliases` matching live column names (`coalesce(product_name, name)`, active aliases).
2. Grant execute to `authenticated` (see `20260506092720_*.sql`).
3. Verify in browser console: no `[productSearch] RPC unavailable` log.

**Not required for Label Studio or ProductEdit GO** — fallback is intentional.

## Validation

- [ ] Label Studio → product picker finds products by name/SKU
- [ ] No yellow warning styling on fallback message
- [ ] Console may log RPC unavailable (informational) — not a user-facing error
