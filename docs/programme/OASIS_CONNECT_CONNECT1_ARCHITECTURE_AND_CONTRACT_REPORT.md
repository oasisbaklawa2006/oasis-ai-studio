# OASIS CONNECT — CONNECT-1 Architecture & Contract Report

**ASM work item:** ASM-OC-01 — OASIS CONNECT
**Register anchor:** Point 54a (proposal, not yet applied — see
`OASIS_CONNECT_REGISTER_PROPOSAL_POINT_54A.md`)
**Scope of this document:** read-only cross-repository census only. No
migration, Edge Function, schema mutation, or production change was made or
proposed as applied code.

## Repositories inspected and exact SHAs

| Repository | HEAD inspected | Access |
|---|---|---|
| `oasis-ai-studio` | `851787a7e994b5c5f96b196544c64fd1b7509553` (main) | push (session home repo) |
| `oasis-supabase-core` | `671781475ef8a625afec96c5336158a504c5e287` | read-only clone |
| `Oasis-Baklawa-Central` | `1dc6ce989744124c0721203bad103e9c1a83226b` | read-only clone |
| `oasis-trace` | `381c48658e339c581248b6959482d7977d7b42ab` | read-only clone (shallow) |

Note: read-only clones were used because a push-access request for
`Oasis-Baklawa-Central` was denied by the session permission classifier
(consistent with the prior denial for `oasis-supabase-core`). Everything below
is derived from reading these clones, not from assumption.

## 1. Current-state capability matrix

| Capability | Exists today? | Where |
|---|---|---|
| Canonical approved product truth | **Yes** | `oasis-ai-studio` `CatalogueSnapshotJson` (`src/features/catalogueSnapshot/types.ts`) — includes `channel_rules: ChannelMoqRule[]`, `pricing_rules: ChannelPriceRecord[]` |
| Consumer-safe product read projection | **Yes** | Core `public.published_products_v1()` (defined in `20260723161256_legacy_role_authority_baseline.sql:2706`) — returns `product_id, sku, product_name, short_description, long_description, category, subcategory, hero_image_url, pack_size, storage_type, shelf_life, shelf_life_days, dietary_tags, allergen_warnings, primary_uom, created_at`. No cost/margin/internal fields present — this **is** a working B2C-shaped projection already. |
| Channel/consumer-scoped pricing overlay | **Yes** | Core `public.buyer_product_prices_v1()` — returns `product_id, selling_price, currency, uom, gst_rate, tax_inclusive, applied_discount_percent, minimum_order_quantity, minimum_order_uom, order_increment, order_increment_uom, valid_from, valid_until`. Separate RPC from product data — pricing is not baked into the product projection. |
| Channel-scoped pricing authority (AI Studio side) | **Yes** | `src/features/productAuthority/channelPricingMapper.ts` — explicit list of channel price keys (`b2b_price`, `mrp`, `retail_price`, `bulk_price`, `wholesale_price`, `horeca_price`, `export_price`, `franchisee_price`, `own_outlet_price`, `special_price`, `costing_price`) mapped only into `product_pricing_rules`, never into `products` — comment states "never products table." |
| Generic consumer/application registry | **No** | No `connect_consumers`-equivalent table or RPC found anywhere in Core. |
| Consumer credential/token persistence (hashed, scoped, revocable) | **No** | Grepped Core migrations for `api_token`, `access_token`, `token_hash`, `consumer_token` — zero matches. No generic external-consumer auth model exists today. |
| Channel-profile persistence (configurable, not hard-coded) | **No** | Nothing in Core or AI Studio persists a named channel profile with a field allowlist. |
| Webhook/delta/change-feed engine | **No** | Not found in any of the four repos. |
| Trace printer/reprint authority | **Yes, live and mature** | Core: `trace_reprint_approver_allowed_v1()`, `trace_approve_reprint_request_v1(p_request_id, p_idempotency_key)` (SECURITY DEFINER, `pg_advisory_xact_lock`-guarded, checks `ols_trace_mutation_receipts` for idempotent replay, writes `ols_audit_logs`), `trace_save_printer_settings_v1()`, tables `ols_reprint_requests`, `ols_printers`. Migrations: `20260830101000_trace_printer_settings_authority.sql`, `20260911200000_trace_reprint_atomic_allocation_authority.sql`, `20260912010000/010100/010200_trace_reprint_allocation_*`/`_execution_*`, `20260915200000_trace_reprint_approval_authority.sql`. |
| Trace client already bridges to Core rather than deciding locally | **Yes** | `oasis-trace/src/components/ReprintModal.tsx` calls `allocateGovernedReprint` and `findReusableApprovedRequestLive` (`src/lib/governedReprintAllocation.ts`, `src/lib/reprintApprovalLookup.ts`) — live mode explicitly "delegates count allocation and approval threshold enforcement to Core." This is the exact pattern Oasis Connect's label bridge must reuse. |
| Central-side commercial/customer data ownership | **Partially inspected** | Central repo has no obviously named `connect`/pricing-authority module surfaced by keyword grep in this pass; Central's commercial-truth surface needs a deeper CONNECT-1b pass before CONNECT-4 is scoped (see Open Items). |

## 2. Ownership matrix (as verified, matching CLAUDE.md and the Central register)

- **Core** — sole owner of persistence, RLS, RPC, SECURITY DEFINER boundaries, audit (`ols_audit_logs`), idempotency (`ols_trace_mutation_receipts`). Confirmed no shadow schema exists elsewhere.
- **AI Studio** — owns `CatalogueSnapshotJson` (product/catalogue intelligence) and channel-pricing-key mapping into Core's `product_pricing_rules`. Does not own persistence.
- **Trace** — owns physical print/reprint/scan execution; already defers authorization decisions to Core rather than deciding locally.
- **Central** — commercial/operational truth; boundary not yet fully mapped in this pass (see Open Items).

## 3. Reusable-contract list (must be reused, not duplicated, in CONNECT-2/3)

1. `public.published_products_v1()` — reuse as the base of the B2C/WhatsApp/website consumer-safe projection rather than building a parallel "safe product view."
2. `public.buyer_product_prices_v1()` — reuse as the B2B pricing overlay pattern (separate RPC, not merged into product rows) — this is the precedent for "optional Central commercial overlay" in the required architecture flow.
3. `product_pricing_rules` + `channelPricingMapper.ts` key list — reuse as the channel-price taxonomy; do not invent new price-channel names.
4. `CatalogueSnapshotJson.channel_rules` / `.pricing_rules` — reuse as AI Studio's existing per-channel MOQ/price carrier; a channel profile's "allowed data scopes" should map onto these, not duplicate them.
5. `trace_approve_reprint_request_v1` + `ols_reprint_requests` + `ols_printers` — reuse as-is for CONNECT-5; Oasis Connect's label flow must call/bridge to this, never reimplement reprint approval or printer identity.
6. `ols_audit_logs` / `ols_trace_mutation_receipts` — reuse as the audit/idempotency substrate; any new `connect_delivery_log`/`connect_bindings` design in CONNECT-2 should follow this exact idempotency-key + advisory-lock + receipt-replay shape rather than inventing a new one.

## 4. Duplication/conflict list

- None found. No repository has attempted a competing consumer registry, token store, or reprint authority. The gap is absence, not duplication — CONNECT-2 is additive.

## 5. Proposed Oasis Connect contract (design-only, not applied)

Conceptual flow, confirmed compatible with what exists:

```
AI Studio approved CatalogueSnapshotJson
  -> Oasis Connect channel profile (new, AI-Studio-domain-logic, no persistence)
  -> Core: consumer identity + token authorization (new, CONNECT-2)
  -> Core: field projection = published_products_v1() [+ buyer_product_prices_v1() when B2B-scoped]
  -> optional Central commercial overlay (new governed Core-exposed RPC, CONNECT-4)
  -> consumer-specific payload
```

For Trace/labels:

```
AI Studio approved label dataset (ingredients/allergens/net weight presentation/template)
  -> Oasis Connect label profile (new, AI-Studio-domain-logic)
  -> Core governed contract (new, thin — resolves label-safe fields only)
  -> existing trace_approve_reprint_request_v1 / ols_printers / ols_reprint_requests (reused, unchanged)
  -> print/reprint/verification result
  -> ols_audit_logs (reused, unchanged)
```

## 6. Proposed Core persistence/RPC changes (CONNECT-2 scope — proposal only, not a migration)

Minimum net-new objects, informed by what already exists (avoids the `connect_profiles`/`connect_projections` split being wider than needed since projection logic for the product side can mostly be existing RPCs parameterized by consumer scope):

- `connect_consumers` — id, type, name, environment, status (active/suspended), version, audit columns.
- `connect_tokens` — consumer_id, token_hash (never plaintext), scopes[], rate_limit, expires_at, revoked_at.
- `connect_profiles` — id, label, consumer_type, field allowlist reference (can be a JSON column referencing AI-Studio-defined field keys rather than a new table per field).
- `connect_bindings` — consumer_id → profile_id, environment.
- `connect_delivery_log` — modeled directly on `ols_trace_mutation_receipts`' idempotency-key/fingerprint/response shape.
- A single `connect_authorize_and_project_v1(token, resource, params)`-style SECURITY DEFINER RPC that: validates the token/consumer/profile, then calls `published_products_v1()`/`buyer_product_prices_v1()` (or a Central-exposed RPC) internally and filters to the profile's allowlist server-side — this keeps the actual product data path reusing existing RPCs instead of copying data into new tables.
- No new printer/reprint tables — CONNECT-5 calls the existing Trace RPCs directly, gated by the same token/consumer check.

## 7. Channel-profile model (AI Studio domain logic, CONNECT-3 scope)

Field-authority-tagged (`AI_STUDIO | CORE | CENTRAL | TRACE | CALCULATED`), allowlist + explicit `neverEmit` denylist per profile, scope-gated per field. Five reference profiles: `b2c_india_v1`, `b2b_india_v1`, `whatsapp_retail_v1`, `website_retail_v1`, `trace_label_v1`. (This matches the design abandoned in the earlier unauthorized scratch — it may be recreated once CONNECT-2's contract exists, per the register's CONNECT-3 gate; it must be rebuilt against the actual `connect_authorize_and_project_v1` contract rather than the placeholder registry used in the deleted draft.)

## 8. Field-authority model

Reuse the source-path → authority mapping approach validated in the deleted scratch design, but anchor every `CORE`-tagged path to a real column/RPC output confirmed in section 1 above (e.g., `identity.sku` → `published_products_v1().sku`), not a hypothetical path.

## 9. Security model requirements confirmed feasible

- Fail-closed token check is achievable as a single SECURITY DEFINER gate (`connect_authorize_and_project_v1`), matching the existing `trace_approve_reprint_request_v1` pattern (auth check → idempotency/replay check → action).
- B2C/B2B isolation is already structurally supported: `buyer_product_prices_v1()` is a separate RPC from `published_products_v1()`, so a B2C-scoped token simply never gets routed to the pricing RPC — no field-level filtering race is needed for that specific leak class.
- Revocation: `connect_tokens.revoked_at` checked on every call, consistent with how `ols_reprint_requests` status checks work today.

## 10. Integration-test matrix (to be implemented in CONNECT-2/3, not yet built)

1. B2C token → `buyer_product_prices_v1` call → must fail closed (wrong scope).
2. Revoked token → any call → must fail closed.
3. Trace-scoped token → request for pricing/customer fields → must fail closed.
4. WhatsApp-scoped token → request for a draft/unapproved product → must fail closed (published_products_v1 already excludes unapproved rows by construction — confirm this in CONNECT-2 test suite rather than assuming).
5. Consumer A's token → Consumer B's delivery log/binding → must fail closed (cross-consumer isolation).
6. Idempotent replay of `connect_authorize_and_project_v1` with same idempotency key → same response, no duplicate side effects (mirrors existing `ols_trace_mutation_receipts` test pattern).

## Open items for CONNECT-1b (not blocking this report, but not yet closed)

- Central's commercial-truth module boundary (pricing/MOQ/carton/customer-hierarchy ownership inside `Oasis-Baklawa-Central`) was only keyword-grepped, not read in depth — CONNECT-4 scoping needs a follow-up pass reading Central's actual pricing/customer-hierarchy source files before Core's Central-facing overlay RPC is designed.
- `oasis-trace`'s barcode/scan verification contracts (`src/components/Barcode.tsx`, `useScanLoop.ts`) were located but not read for CONNECT-1's label-field census — needed before `trace_label_v1` profile fields are finalized.

## Registration status

Point 54a / ASM-OC-01 registration text has been drafted
(`OASIS_CONNECT_REGISTER_PROPOSAL_POINT_54A.md`) but **not applied** to
`Oasis-Baklawa-Central`'s register — push access to that repository was denied
by the session permission classifier. This report and the register proposal
are being pushed to `oasis-ai-studio` only, which is this session's actual
write scope.

---

## CONNECT-1 BLOCKED ONLY BY:

- Push/write access to `oasisbaklawa2006/Oasis-Baklawa-Central` to formally commit the Point 54a / ASM-OC-01 register entry (denied by session permission classifier; requires either owner action to apply `OASIS_CONNECT_REGISTER_PROPOSAL_POINT_54A.md` directly, or an explicit permission grant for this session to push to Central).

No production mutation, migration, Edge Function deployment, or schema change was made or proposed as applied code. CONNECT-2 (Core contract implementation) cannot begin until the register entry is actually in place and a human with Core repository authority picks up the proposed contract in section 6.
