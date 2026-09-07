# Point 50 — Channel Copy (Catalogue / WhatsApp / Web / Label) Census

## Programme status

- Point: 50
- Title: Channel-specific catalogue / WhatsApp / web / label copy — canonical closure
- Status: IN PROGRESS (bounded PR dependent on Point 49 #190; `PR merged != Point50 cleared`)
- Starting SHA / ancestry: `d829cedbc27ec9ba5e31dbacb15c0f2ed5ecc9f0` (Point 49 PR #190 head on `cursor/point49-multilingual-names-selling-points-973c`)
- Parent baseline: `5130d665cc0121191a10c904804e14d454ab3352` (Point 48 PR #186 head)
- Repository: `oasisbaklawa2006/oasis-ai-studio` (AI/knowledge plane)
- Upstream authority: Point 48 `governedProductNaming` + Point 49 `governedMultilingual` (`source_version` pin, factual grounding, review envelope)
- Scope boundary: channel tone/format adaptation only. Point 54 publication authority remains separate.

## Supported channels (governed matrix)

| Channel | Draft keys | Locale | Tone | Character limit | Provider | Review | Persistence | Consumer route |
|---------|------------|--------|------|-----------------|----------|--------|-------------|----------------|
| `catalogue_listing` | `catalogue_title`, `short_description`, `long_description` | en (Point 48) | Informational | 80 / 240 / 1200 | Point 48 heuristic + `catalogue-ai-copy` | Yes | `catalogue_ai_studio_drafts` | Catalogue Product AI Studio Content tab |
| `b2b_web` | `b2b_sales_copy` | en | Sales/wholesale | 500 | Point 50 heuristic + `catalogue-ai-copy` | Yes | Same | Content tab + export bundle |
| `export_catalogue` | `export_catalogue_copy` | en | Technical/compliance | 400 | Point 50 heuristic + `catalogue-ai-copy` | Yes | Same | Export bundle |
| `whatsapp` | `whatsapp_product_message` | en | Conversational | 1024 | Point 50 heuristic + `catalogue-ai-copy` | Yes | Same | Language/Messaging tab — **never auto-send** |
| `label_print` | `storage_shelf_life_copy` | en | Compliance/handling | 300 | Point 50 heuristic + `catalogue-ai-copy` | Yes | Same | Content tab + Fast Create `labelStarter` hints |

## Generator census

| # | Module / boundary | Output kinds | Provider | Language input | Provenance | Human review | Persistence target | Customer-facing consumption |
|---|-------------------|--------------|----------|----------------|------------|--------------|-------------------|----------------------------|
| 1 | `catalogueContentGenerators.ts` (pre-Point50) | 4 channel keys + 3 naming keys | **ungoverned inline heuristics** | Product fields directly | None | Studio operator edit | `catalogue_ai_studio_drafts` | Copy/paste only — no send/publish |
| 2 | `catalogueContentGenerators.ts` (Point50) | `b2b_sales_copy`, `export_catalogue_copy`, `whatsapp_product_message`, `storage_shelf_life_copy` | **`governedChannelCopy` heuristic** | Point48/49 `AuthoritativeChannelSource` only | `channelCopyProvenance` | Review-required suggestions | Same — never auto-publish | Same |
| 3 | `catalogueContentGenerators.ts` | `catalogue_title`, `short_description`, `long_description` | Point 48 naming (unchanged) | Authoritative facts | `namingProvenance` (Point 48) | Yes | Draft content | Catalogue listing / web cards |
| 4 | `catalogueContentGenerators.ts` | `hindi_description` | Point 49 multilingual (unchanged) | Approved Hindi or pending marker | `multilingualProvenance` (Point 49) | Yes | Draft content | Language tab |
| 5 | `catalogueAiGateway.ts` → `catalogue-ai-copy` | All 8 keys | **catalogue-ai-copy** edge (env-gated) | Point48 facts prompt | `source_snapshot.ai_generation` | `human_review_required` envelope | Draft row + audit log | "Generate Complete Catalogue Draft" |
| 6 | `catalogueAiGateway.ts` (Point50) | 4 channel keys | Same provider + **`validateGovernedChannelCopy`** | Point48/49 source pin | Same + `channel_prompt_version` | Same | Same | Rejects invented prices, unapproved compliance claims, unsafe truncation |
| 7 | `fastCreateSuggestions.ts` | `labelStarter` hints | Ungoverned category defaults (Point 30 compliance scope for ingredients/allergens) | Category defaults | None | Fast Create form review | `products` on explicit save | Label app handoff hints — **not print authority** |
| 8 | `whatsapp-webhook` / `whatsapp-studio-inbox-bridge` | inbound message routing | Meta/provider ingress | N/A | Bridge state | Operator inbox | `whatsapp_inbound_messages` | **Inbound only — not product copy generation** |
| 9 | `operatorInbox` / `mapErpWhatsAppMessage` | order draft visibility | ERP bridge mapper | Message content | Bridge provenance | Operator review | Sales order drafts | Order workflow — **not catalogue copy truth** |
| 10 | `catalogueLanguageFields.ts` | field classification | Static config | N/A | N/A | N/A | N/A | Separates WhatsApp/Hindi into Language tab |
| 11 | `buildExportBundlePreview` | plain-text bundle | Deterministic assembler | Draft content columns | None | Operator copy action | None | Manual copy — **no PDF/print publish** |
| 12 | Social/marketing generators | — | **Not present in repo** | — | — | — | — | Out of scope — no direct-publish path found |

## Gaps identified and remediated (this PR)

| Issue | Location | Risk | Point50 action |
|-------|----------|------|----------------|
| Channel copy generated inline without Point48/49 source pin | `catalogueContentGenerators.ts` | Factual drift; no audit trail | `governedChannelCopy` contract with `source_version` requirement |
| WhatsApp draft treated as product truth | Studio copy fields | Operator could mistake draft for sent message | Review envelope + explicit "never sends" hints preserved |
| B2B/export copy could embed invented prices | Inline heuristics + AI provider | Pricing authority violation | `detectChannelFactualDrift` — prices must match authoritative facts |
| Label/storage copy could carry unapproved compliance claims | AI provider + templates | Legal/compliance risk | `LABEL_COMPLIANCE_CLAIM_PATTERN` gate |
| No post-provider channel validator on catalogue AI output | `catalogueAiGateway.ts` | Unsafe channel adaptation could enter editor | `validateGovernedChannelCopy` + `validateProviderChannelEnvelope` |
| Unsupported truncation could drop product identity | No truncation contract | WhatsApp messages lose product name | `truncateChannelCopySafely` — fail closed |
| Channel copy mixed into multilingual truth | `hindi_description` in same schema | Locale/channel authority bleed | Point 49 owns Hindi; Point 50 validates only 4 channel keys |
| No deterministic mocked channel provider tests | — | Provider regressions | `mockChannelCopyProvider` + 24 unit tests |

## Explicitly not in this PR

- Point 54: publication authority / live catalogue/web publish certification
- Production `catalogue-ai-copy` edge deployment or mutation
- Auto-send WhatsApp messages
- Label print/PDF generation or barcode label app deployment
- Social/marketing channel generators (none found — would require Mission Control reassignment)
- Core schema migration for new channel columns

## Governed contract established (this PR)

Canonical module: `src/features/governedChannelCopy/`

- `AuthoritativeChannelSource` — Point48/49 facts + pinned `source_version` + pricing/export/compliance facts
- `buildHeuristicChannelSuggestions` — deterministic review candidates per channel
- `truncateChannelCopySafely` — length adaptation without meaning drift
- `detectChannelFactualDrift` — invented prices, unapproved compliance claims
- `validateGovernedChannelCopy` — channel-field factual fidelity gate
- `validateProviderChannelEnvelope` — requires `human_review_required`, `suggestion_only`, `approved: false`, `source_version`, `channel_prompt_version`
- `mockChannelCopyProvider` — deterministic test harness (no network)

### Fail-closed conditions

1. Missing / blank `product_name` (inherited from Point 48)
2. Missing or mismatched `source_version` pin
3. Unsupported channel outside governed matrix
4. Invented prices not present in authoritative facts
5. Unapproved legal/medical/nutritional/compliance claims on label channel copy
6. Provider envelope missing review markers or version pins
7. Truncation that would remove approved `product_name`
8. WhatsApp copy missing approved product name
9. Export copy missing authoritative HSN/GST when those facts are set

## Point 48 vs Point 49 vs Point 50 vs Point 54 separation

| Concern | Point | Module |
|---------|-------|--------|
| English naming/description factual grounding | 48 | `governedProductNaming` |
| Multilingual names, aliases, selling points, Hindi | 49 | `governedMultilingual` |
| Channel tone/format adaptation (B2B, export, WhatsApp, label) | 50 | `governedChannelCopy` |
| Publication authority / live publish certification | 54 | Central / Mission Control |

## Tests added

- `src/features/governedChannelCopy/governedChannelCopy.test.ts` — channel resolution, source-version pinning, factual fidelity, truncation safety, locale/channel boundaries, review serialization, mocked provider scenarios
- Existing `catalogueContentGenerators.test.ts` and `catalogueAiGateway.test.ts` remain compatible

## Completion gates

Point 50 PR merge does **not** clear the programme stage. Remaining runtime evidence required:

- Channel-specific human-review workflow certification in production
- Operator sign-off on WhatsApp draft vs sent-message UX
- Label copy compliance review with legal approver
- Mission Control gate certification per `oasisbaklawa2006/Oasis-Baklawa-Central/APPVERSE_MISSION_CONTROL.md`
- Point 49 #190 must merge first; then rebase onto current `main`, rerun full CI matrix, request review from `dineshmutrejabackup-cmd`, STOP before merge
