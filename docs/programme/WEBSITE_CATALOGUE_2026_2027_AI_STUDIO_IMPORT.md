# Website Catalogue 2026–2027 — AI Studio Import Record

**Source:** Oasis Baklawa Canva catalogue, design `DAHSw1uoEhM`  
**Programme:** Website / D2C Gifting Website  
**Owner authorization:** 2026-09-10 — "You may instill the new catalogue products into the ai studio."  
**Destination:** governed `public.catalogue_product_drafts` approval workflow  
**Import actor:** existing catalogue-contributor import identity already used by the production catalogue workflow  

## Result

- 93 new product drafts submitted through `public.submit_catalogue_product_draft_v1`.
- `public.products` remained at 338 rows after the import.
- All imported drafts remain `pending_approval`.
- All imported drafts have `is_active=false` and `is_catalogue_ready=false`.
- No operational MRP, B2B price, export price, currency, GST, HSN, stock, fulfilment, SKU, compliance, or media value was invented.
- Canva prices were retained only as source evidence under `import_meta.observed_price_inr` with `price_authoritative=false`.
- Existing `Misr 15` was detected and not duplicated.

## Imported product drafts

### Everyday / specific variants

- Humming Bird 12
- Humming Bird 16
- Marine 16
- Citrus
- 6 Pcs Assorted Baklawa
- 9 Pcs Assorted Baklawa
- 16 Pcs Assorted Baklawa
- Royal Tusk 16
- Royal Tusk 25

### Premium

- Opera
- Mayura
- Mirabella
- Sunflower
- Shalimar
- Cedar
- Marigold
- Matrix
- Arcade
- Boxy
- Akbar
- Derby
- Marble
- Tulip
- Executive
- Jaypore
- Bandhej
- Premia
- Jaipur
- Daffodil
- Nawab
- Royal Blue
- Royal White
- Jodhpur

### Hampers

- Glory I
- Glory II
- Glory III
- Majesty
- Panache
- Smoke
- Epicure
- Ambar
- Eden Plus
- Iris Plus
- Elegance
- Elanor Grande
- Gulfam
- Timberland
- Woodland
- Pure Bliss - II
- Pure Bliss - III
- Elanor
- Bloom
- Persia
- Navy Royale
- Hermitage
- Blossom
- Olive Royale
- Tote’ Luxe
- Noir Petite
- Innosence Dew
- Tote Allure
- Tote Mix
- Noir Grande
- Noir Treat

### Luxury

- Candy - 4
- Ferris Wheel
- Candy - 3
- Monte Carlo
- Empress
- Mosaic
- Tiara
- Europa Quattro
- Macau
- Goldberg

### Commercial / packed products

- Chana Badaam Barfi
- Premium Baklawa Box
- Misr 24
- Medley 4
- Medley 3
- Nuts Medley

### Rosello variants

- Rosello 12 PCs
- Rosello 16 PCs
- Rosello 25 Pcs

### Luxe

- Oliver - I
- Oliver - II
- Arabesque - II
- Arabesque - III
- Arabesque - IV
- Shubham
- Ivory
- Peacock
- Lotus
- Sereneda

## Existing product retained

`Misr 15` already exists in production product master as SKU `OAS-AS-BKL-ASS-RBOX-0002`. The import deliberately did not create another product or pending draft for the same normalized name.

## Catalogue structure retained as structure, not products

The following source labels were interpreted as collection/family headings rather than SKU-level products and were not submitted as product drafts:

- Iris Collection
- Eden Collection
- Midnight Collection
- Morocco Collection
- Humming Bird Collection
- Rosello Collection
- Marine Collection
- Fern Collection
- Crystal Collection
- Sultan Collection
- Truffle Collection
- Misr Collection
- Royal Tusk

They should be modeled later as catalogue collections/families or merchandising structure where required.

## Source-quality exclusions

Obvious template or placeholder material was excluded from product truth, including `Kitchen Set`, `Minimalism`, `Queval`, `Furniture Catalog`, chapter headings, generic `Hamper` headings, and Lorem ipsum copy.

Source spelling/typography was preserved when uncertain rather than silently corrected. `Innosence Dew` is therefore flagged for spelling review; `Tote’ Luxe` preserves the source typography. `Sereneda` retains the source name but none of the surrounding Lorem ipsum. Rosello capitalization was normalized only for the draft display name and noted in provenance.

## Governance boundary

This import authorizes AI Studio review only. A pending catalogue product draft is not a live product, website publication, D2C sale authorization, stock promise, price approval, or Appverse operational release. Promotion into `public.products`, publication, pricing and fulfilment remain governed by their existing approval authorities.
