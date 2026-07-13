# Oasis AI Studio Autonoma Knowledge Base

## Mission

Oasis AI Studio is an internal product-intelligence and catalogue-authoring application for Oasis Baklawa. It supports product master maintenance, SKU and packaging authority, pricing and MOQ presentation, media readiness, label readiness, hamper/BOM planning, catalogue content drafting, public catalogue previews, approvals, audit logs, and future WhatsApp/B2B catalogue workflows.

Autonoma must test whether the implemented app is complete, safe, governed, and usable. It must not treat page existence as feature completion.

## Safety Rules

- Production is read-only unless the test is explicitly running through the Autonoma Environment Factory with disposable records.
- Never sign up random production users.
- Never create, edit, save, submit, approve, reject, upload, delete, publish, or change settings in production outside an approved factory dry-run.
- Never expose passwords, tokens, service-role keys, session tokens, authorization headers, customer data, or private payloads in evidence.
- If a step may mutate business data and the current environment is not staging/preview disposable data, mark it `not executed - mutation risk`.
- A known error reproduced is not a pass. Mark it `known defect reproduced`.

## Roles

The app role enum is:

- `owner`
- `admin`
- `product_manager`
- `catalogue_manager`
- `designer`
- `sales`

Tests must verify visible UI restrictions and backend/API denial where safely testable. Hiding a button is not enough to prove authorization.

## Primary Routes

| Route | Purpose |
|---|---|
| `/auth` | Login and account access |
| `/` | Main dashboard |
| `/products` | Product master list, search, filters |
| `/products/new/fast` | Fast Create product flow |
| `/products/:id` | Full Product Editor |
| `/media` | Media library |
| `/tags` | Tag manager |
| `/catalogues` | Catalogue list |
| `/admin/catalogue-builder` | Catalogue Builder |
| `/admin/catalogue-product-studio` | Catalogue Product AI Studio |
| `/catalogues/:id` | Catalogue detail |
| `/catalogues/:id/proposal` | Catalogue proposal |
| `/c/:slug` | Public catalogue |
| `/hampers` | Hamper and BOM workspace |
| `/ingredients` | Ingredients |
| `/labels` | Label Studio |
| `/label-queue` | Label Queue |
| `/ai-studio` | AI Studio roadmap/status |
| `/testing` | Manual testing page |
| `/testing/pilot-readiness` | Pilot readiness dashboard |
| `/testing/pilot-aliases` | Alias review |
| `/settings` | Settings and feature flags |
| `/audit-log` | Audit log |
| `/approvals` | Approval inbox |
| `/data-correction` | Data correction |
| `/admin/resolver-preview` | Resolver preview |
| `/resolver-preview` | Legacy resolver preview |
| `/admin/operator-inbox` | WhatsApp operator inbox |
| `/admin/import/category-1` | Category 1 import staging |

## Product Data Contract

Use real `products` columns only. Do not use generic fields such as `name`, `status`, `department`, `uom`, or `readiness_score`.

Required product fields:

- `product_name`
- `sku`

Important optional fields:

- `short_name`
- `category`
- `subcategory`
- `product_type`
- `material_type`
- `is_active`
- `is_catalogue_ready`
- `label_status`
- `media_status`
- `mrp`
- `b2b_price_inr`
- `b2b_uom`
- `retail_uom`
- `gst_rate`
- `hsn_code`
- `pack_size`
- `shelf_life_days`
- `storage_instructions`
- `pdf_storage_condition`
- `pdf_shelf_life`
- `pdf_primary_packaging`
- `pdf_secondary_packaging`
- `sku_locked`
- `sku_version`
- `bom_required`
- `moq_value`
- `moq_uom`
- `pieces_per_kg`
- `approximate_piece_weight_g`
- `product_class`
- `main_department`
- `production_department`

## Evidence Required

For every tested route or workflow capture:

- URL
- environment
- viewport
- role/account type
- expected result
- actual result
- screenshots
- console errors
- failed network requests
- reproduction steps
- severity if defective

## Release Decision

Final output must classify each capability as:

- `Verified Complete`
- `Partial`
- `Missing`
- `Blocked`
- `Defective`
- `Known Defect Reproduced`
- `Not Tested`
