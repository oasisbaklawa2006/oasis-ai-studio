# Point 27 — Fast Create Canonical Workflow Census

## Canonical authority

Fast Create is a governed draft-creation surface. It must never insert directly into master `products`, regardless of operator privilege.

| Layer | Canonical surface | Authority |
| --- | --- | --- |
| Route | `/products/new/fast` | UI only |
| Intake | `fastCreate/intake/*` | Draft prefill and validation |
| AI enrichment | `governedAiExtraction/fastCreateEnrichment.ts` | Suggestion-only; pending AI aliases excluded |
| SKU | `requireFastCreateSku` / Core SKU RPC | Structured proposal for review |
| Exact duplicate gate | `assertNoBlockingProductCollisions` | Point 28 fail-closed SKU/barcode protection |
| Save | `submitFastCreateProductDraft` | Core `submit_catalogue_product_draft_v1` only |
| Approval | `/approvals` | Governed promotion to master product |

## Rebased closure

The original Point 27 branch conflicted after later product-governance work landed on `main`. This rebased closure preserves those later controls while removing the remaining direct-write bypass.

The canonical save path now:

1. validates product name/category and authorized submission role;
2. blocks unsupported sale types;
3. resolves a structured SKU proposal;
4. strips unapproved compliance suggestions;
5. preserves factual-composition and live legal fields in the draft payload;
6. applies Point 28 exact SKU/barcode collision protection;
7. carries reviewed intake barcode evidence without claiming master identity;
8. submits only through `submit_catalogue_product_draft_v1`;
9. returns a governed draft identity and pending-state result.

## Fail-closed invariants

- No `.from("products").insert(...)` from Fast Create.
- Privileged roles and contributors use the same governed draft boundary.
- Pending AI aliases are not promoted as canonical search identity.
- Exact duplicate SKU/barcode collisions block before draft submission.
- Unsupported internal-only sale types cannot silently become sellable product classes.
- Product promotion remains an Approval Inbox/Core responsibility.

## Completion evidence

`src/features/fastCreate/fastCreateAuthority.test.ts` provides structural regression coverage for the route, Core RPC boundary, absence of direct product writes, Point 28 duplicate enforcement, governed AI enrichment, and factual-composition preservation.

`src/features/fastCreate/saveFastCreateProduct.test.ts` provides behavioral regression coverage for privileged-role draft submission, no direct table writes, structured SKU handoff, alias filtering, sale-type guards, barcode handoff, and duplicate blocking.
