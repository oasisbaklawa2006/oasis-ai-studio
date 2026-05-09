# PR-05 Central Table Mapping (Design Only)

This document maps current Catalogue App concepts to Central Supabase tables for draft/approval workflow design.

| Catalogue App concept | Central target | PR-05 design decision |
|---|---|---|
| `products` | `products` | Keep as canonical master table. Contributors submit drafts; approval RPC applies writes to master. |
| `product_media` / hero image changes | `catalogue_media_submissions` first, then `products.image_url` (or Central media model if available) | Never direct-write from contributor flow. Approved submission mutates master only through reviewer-approved RPC. |
| `product_aliases` | `product_aliases` | Alias changes enter draft first (`catalogue_alias_drafts`), then approved apply step updates central alias records. |
| `product_bom_items` | `product_bom` | BOM edits enter `catalogue_bom_drafts`; apply logic must adapt payload to central `product_bom` structure. |
| `product_moq_rules` | `moq_rules` | MOQ edits enter `catalogue_moq_drafts`; reviewer-approved RPC writes to `moq_rules`. |
| `product_pricing_rules` | `pricing_slabs` (only if compatible) | If `pricing_slabs` cannot represent channel-rich pricing, keep richer model in draft payload until Central pricing schema is expanded. |
| `product_tags` / `product_tag_mapping` | `product_tags` / `product_tag_mapping` | Tag mutation requests stored in `catalogue_tag_drafts`; approved RPC applies normalized tag + mapping updates. |
| `user_roles` / `app_role` (legacy app) | **DO NOT USE** | Central access model is `roles + user_role_map + permissions + role_permission_map`; no `app_role`/`user_roles` dependency allowed. |

## Role model baseline for Catalogue App in Central
- Existing Central roles include: `super_admin`, `sales_executive`, `production_manager`, `assembly_manager`, `packing_supervisor`, `dispatch_head`, `finance_head`, `support_executive`, `customer_user`.
- PR-05 proposes additive `catalogue_contributor` role (design only) and permission-based checks for submit/review operations.
