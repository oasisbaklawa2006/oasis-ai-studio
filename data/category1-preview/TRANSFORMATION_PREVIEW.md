# Category 1 Transformation Preview — BATCH 001

**Source:** `data/source/Products-List-Project.xls`
**Output:** `data/category1-preview/CATEGORY1_IMPORT_BATCH_001.csv`
**Filter:** Category = `Baklawa` (first 25 rows)

## Column mapping

| Authority column | Import field | Transform |
|---|---|---|
| Product Name | `product_name` | trim |
| Category | `category` | passthrough |
| UOM | `primary_uom` | lowercase |
| GST | `gst_rate` | strip % / numeric |
| Weight (GM) | `net_weight_g` | integer grams |
| Shelf Life | `shelf_life_days` | integer days |
| Departments | `main_department` | label → snake_case main_department |
| Departments II | `production_department` | label → snake_case production_department |
| Primary Packing | `primary_pack_type` | passthrough |
| Carton Qty | `qty_per_pack` | numeric or parse from (N Box) |
| Active/Inactive | `is_active` | Active/Inactive → true/false |

## Row preview (source → target)

### Row 1: Assorted Baklawa Tin Pack 600gm

| Field | Source | Target |
|---|---|---|
| product_name | Assorted Baklawa Tin Pack 600gm | Assorted Baklawa Tin Pack 600gm |
| category | Baklawa | Baklawa |
| primary_uom | Pack | pack |
| gst_rate | 5 | 5 |
| net_weight_g | 600 | 600 |
| shelf_life_days | 90 | 90 |
| main_department |  |  |
| production_department |  |  |
| primary_pack_type | Jumbo Master (24 Box) | Jumbo Master (24 Box) |
| qty_per_pack |  | 24 |
| is_active | Active | true |

### Row 2: Baklawa Ball

| Field | Source | Target |
|---|---|---|
| product_name | Baklawa Ball | Baklawa Ball |
| category | Baklawa | Baklawa |
| primary_uom | kg | kg |
| gst_rate | 5 | 5 |
| net_weight_g | 1000 | 1000 |
| shelf_life_days | 90 | 90 |
| main_department | Fusion Sweets Department | ready_goods_store |
| production_department | Fusion Sweets Department | fusion_sweets |
| primary_pack_type | Large Master (8 Box) | Large Master (8 Box) |
| qty_per_pack |  | 8 |
| is_active | Active | true |

### Row 3: Baklawa Bite

| Field | Source | Target |
|---|---|---|
| product_name | Baklawa Bite | Baklawa Bite |
| category | Baklawa | Baklawa |
| primary_uom | kg | kg |
| gst_rate | 5 | 5 |
| net_weight_g | 1000 | 1000 |
| shelf_life_days | 90 | 90 |
| main_department | Fusion Sweets Department | ready_goods_store |
| production_department | Fusion Sweets Department | fusion_sweets |
| primary_pack_type | Large Master (8 Box) | Large Master (8 Box) |
| qty_per_pack |  | 8 |
| is_active | Inactive | false |

### Row 4: Baklawa Classic Collection - Pack of 4 Pcs

| Field | Source | Target |
|---|---|---|
| product_name | Baklawa Classic Collection - Pack of 4 Pcs | Baklawa Classic Collection - Pack of 4 Pcs |
| category | Baklawa | Baklawa |
| primary_uom | pcs | pcs |
| gst_rate | 5 | 5 |
| net_weight_g | 95 | 95 |
| shelf_life_days | 90 | 90 |
| main_department | Packaging Assembly Department | packing_assembly |
| production_department | Packaging Assembly Department |  |
| primary_pack_type | Jumbo Master (45 Box) | Jumbo Master (45 Box) |
| qty_per_pack |  | 45 |
| is_active | Active | true |

### Row 5: Baklawa Classic Collection - Pack of 6 Pcs

| Field | Source | Target |
|---|---|---|
| product_name | Baklawa Classic Collection - Pack of 6 Pcs | Baklawa Classic Collection - Pack of 6 Pcs |
| category | Baklawa | Baklawa |
| primary_uom | pcs | pcs |
| gst_rate | 5 | 5 |
| net_weight_g | 145 | 145 |
| shelf_life_days | 90 | 90 |
| main_department | Packaging Assembly Department | packing_assembly |
| production_department | Packaging Assembly Department |  |
| primary_pack_type | Jumbo Master (24 Box) | Jumbo Master (24 Box) |
| qty_per_pack |  | 24 |
| is_active | Active | true |

### Row 6: Baklawa Classic Collection - Pack of 9 Pcs

| Field | Source | Target |
|---|---|---|
| product_name | Baklawa Classic Collection - Pack of 9 Pcs | Baklawa Classic Collection - Pack of 9 Pcs |
| category | Baklawa | Baklawa |
| primary_uom | pcs | pcs |
| gst_rate | 5 | 5 |
| net_weight_g | 225 | 225 |
| shelf_life_days | 90 | 90 |
| main_department | Packaging Assembly Department | packing_assembly |
| production_department | Packaging Assembly Department |  |
| primary_pack_type | Jumbo Master (42 Box) | Jumbo Master (42 Box) |
| qty_per_pack |  | 42 |
| is_active | Active | true |

### Row 7: Baklawa Crystal Collection - Pack of 4 Pcs

| Field | Source | Target |
|---|---|---|
| product_name | Baklawa Crystal Collection - Pack of 4 Pcs | Baklawa Crystal Collection - Pack of 4 Pcs |
| category | Baklawa | Baklawa |
| primary_uom | pcs | pcs |
| gst_rate | 5 | 5 |
| net_weight_g | 95 | 95 |
| shelf_life_days | 90 | 90 |
| main_department | Packaging Assembly Department | packing_assembly |
| production_department | Packaging Assembly Department |  |
| primary_pack_type | Jumbo Master (45 Box) | Jumbo Master (45 Box) |
| qty_per_pack |  | 45 |
| is_active | Inactive | false |

### Row 8: Baklawa Crystal Collection - Pack of 6 Pcs

| Field | Source | Target |
|---|---|---|
| product_name | Baklawa Crystal Collection - Pack of 6 Pcs | Baklawa Crystal Collection - Pack of 6 Pcs |
| category | Baklawa | Baklawa |
| primary_uom | pcs | pcs |
| gst_rate | 5 | 5 |
| net_weight_g | 145 | 145 |
| shelf_life_days | 90 | 90 |
| main_department | Packaging Assembly Department | packing_assembly |
| production_department | Packaging Assembly Department |  |
| primary_pack_type | Jumbo Master (60 Box) | Jumbo Master (60 Box) |
| qty_per_pack |  | 60 |
| is_active | Inactive | false |

### Row 9: Baklawa Crystal Collection - Pack of 9 Pcs

| Field | Source | Target |
|---|---|---|
| product_name | Baklawa Crystal Collection - Pack of 9 Pcs | Baklawa Crystal Collection - Pack of 9 Pcs |
| category | Baklawa | Baklawa |
| primary_uom | pcs | pcs |
| gst_rate | 5 | 5 |
| net_weight_g | 200 | 200 |
| shelf_life_days | 90 | 90 |
| main_department | Packaging Assembly Department | packing_assembly |
| production_department | Packaging Assembly Department |  |
| primary_pack_type | Jumbo Master (20 Box) | Jumbo Master (20 Box) |
| qty_per_pack |  | 20 |
| is_active | Active | true |

### Row 10: Baklawa Misr Collection - Pack of 15 Pcs

| Field | Source | Target |
|---|---|---|
| product_name | Baklawa Misr Collection - Pack of 15 Pcs | Baklawa Misr Collection - Pack of 15 Pcs |
| category | Baklawa | Baklawa |
| primary_uom | pcs | pcs |
| gst_rate | 5 | 5 |
| net_weight_g | 370 | 370 |
| shelf_life_days | 90 | 90 |
| main_department | Packaging Assembly Department | packing_assembly |
| production_department | Packaging Assembly Department |  |
| primary_pack_type | Jumbo Master (18 Box) | Jumbo Master (18 Box) |
| qty_per_pack |  | 18 |
| is_active | Active | true |

### Row 11: Baklawa Misr Collection - Pack of 24 Pcs

| Field | Source | Target |
|---|---|---|
| product_name | Baklawa Misr Collection - Pack of 24 Pcs | Baklawa Misr Collection - Pack of 24 Pcs |
| category | Baklawa | Baklawa |
| primary_uom | pcs | pcs |
| gst_rate | 5 | 5 |
| net_weight_g | 600 | 600 |
| shelf_life_days | 90 | 90 |
| main_department | Packaging Assembly Department | packing_assembly |
| production_department | Packaging Assembly Department |  |
| primary_pack_type | Small Master (4 Box) | Small Master (4 Box) |
| qty_per_pack |  | 4 |
| is_active | Active | true |

### Row 12: Baklawa Petit Gourmet Collection - Pack of 16 Pcs

| Field | Source | Target |
|---|---|---|
| product_name | Baklawa Petit Gourmet Collection - Pack of 16 Pcs | Baklawa Petit Gourmet Collection - Pack of 16 Pcs |
| category | Baklawa | Baklawa |
| primary_uom | pcs | pcs |
| gst_rate | 5 | 5 |
| net_weight_g | 350 | 350 |
| shelf_life_days | 90 | 90 |
| main_department | Packaging Assembly Department | packing_assembly |
| production_department | Packaging Assembly Department |  |
| primary_pack_type | Jumbo Master (12 Box) | Jumbo Master (12 Box) |
| qty_per_pack |  | 12 |
| is_active | Active | true |

### Row 13: Baklawa Petit Gourmet Collection - Pack of 28 Pcs

| Field | Source | Target |
|---|---|---|
| product_name | Baklawa Petit Gourmet Collection - Pack of 28 Pcs | Baklawa Petit Gourmet Collection - Pack of 28 Pcs |
| category | Baklawa | Baklawa |
| primary_uom | pcs | pcs |
| gst_rate | 5 | 5 |
| net_weight_g | 615 | 615 |
| shelf_life_days | 90 | 90 |
| main_department | Packaging Assembly Department | packing_assembly |
| production_department | Packaging Assembly Department |  |
| primary_pack_type | Jumbo Master (12 Box) | Jumbo Master (12 Box) |
| qty_per_pack |  | 12 |
| is_active | Active | true |

### Row 14: Baklawa Royal Collection -  250g

| Field | Source | Target |
|---|---|---|
| product_name | Baklawa Royal Collection -  250g | Baklawa Royal Collection -  250g |
| category | Baklawa | Baklawa |
| primary_uom | pcs | pcs |
| gst_rate | 5 | 5 |
| net_weight_g | 250 | 250 |
| shelf_life_days | 90 | 90 |
| main_department | Packaging Assembly Department | packing_assembly |
| production_department | Packaging Assembly Department |  |
| primary_pack_type | Jumbo Master (18 Box) | Jumbo Master (18 Box) |
| qty_per_pack |  | 18 |
| is_active | Active | true |

### Row 15: Baklawa Royal Collection -  380g

| Field | Source | Target |
|---|---|---|
| product_name | Baklawa Royal Collection -  380g | Baklawa Royal Collection -  380g |
| category | Baklawa | Baklawa |
| primary_uom | pcs | pcs |
| gst_rate | 5 | 5 |
| net_weight_g | 415 | 415 |
| shelf_life_days | 90 | 90 |
| main_department | Packaging Assembly Department | packing_assembly |
| production_department | Packaging Assembly Department |  |
| primary_pack_type | Jumbo Master (12 Box) | Jumbo Master (12 Box) |
| qty_per_pack |  | 12 |
| is_active | Active | true |

### Row 16: Baklawa Sugar-Free Collection - Pack of 4 Pcs

| Field | Source | Target |
|---|---|---|
| product_name | Baklawa Sugar-Free Collection - Pack of 4 Pcs | Baklawa Sugar-Free Collection - Pack of 4 Pcs |
| category | Baklawa | Baklawa |
| primary_uom | pcs | pcs |
| gst_rate | 5 | 5 |
| net_weight_g | 95 | 95 |
| shelf_life_days | 90 | 90 |
| main_department | Packaging Assembly Department | packing_assembly |
| production_department | Packaging Assembly Department |  |
| primary_pack_type | Jumbo Master (45 Box) | Jumbo Master (45 Box) |
| qty_per_pack |  | 45 |
| is_active | Inactive | false |

### Row 17: Baklawa Sugar-Free Collection - Pack of 6 Pcs

| Field | Source | Target |
|---|---|---|
| product_name | Baklawa Sugar-Free Collection - Pack of 6 Pcs | Baklawa Sugar-Free Collection - Pack of 6 Pcs |
| category | Baklawa | Baklawa |
| primary_uom | pcs | pcs |
| gst_rate | 5 | 5 |
| net_weight_g | 145 | 145 |
| shelf_life_days | 90 | 90 |
| main_department | Packaging Assembly Department | packing_assembly |
| production_department | Packaging Assembly Department |  |
| primary_pack_type | Jumbo Master (24 Box) | Jumbo Master (24 Box) |
| qty_per_pack |  | 24 |
| is_active | Inactive | false |

### Row 18: Baklawa Sugar-Free Collection - Pack of 9 Pcs

| Field | Source | Target |
|---|---|---|
| product_name | Baklawa Sugar-Free Collection - Pack of 9 Pcs | Baklawa Sugar-Free Collection - Pack of 9 Pcs |
| category | Baklawa | Baklawa |
| primary_uom | pcs | pcs |
| gst_rate | 5 | 5 |
| net_weight_g | 220 | 220 |
| shelf_life_days | 90 | 90 |
| main_department | Packaging Assembly Department | packing_assembly |
| production_department | Packaging Assembly Department |  |
| primary_pack_type | Jumbo Master (42 Box) | Jumbo Master (42 Box) |
| qty_per_pack |  | 42 |
| is_active | Inactive | false |

### Row 19: Baklawa Sultan Collection - Pack of 12 Pcs

| Field | Source | Target |
|---|---|---|
| product_name | Baklawa Sultan Collection - Pack of 12 Pcs | Baklawa Sultan Collection - Pack of 12 Pcs |
| category | Baklawa | Baklawa |
| primary_uom | pcs | pcs |
| gst_rate | 5 | 5 |
| net_weight_g | 285 | 285 |
| shelf_life_days | 90 | 90 |
| main_department | Packaging Assembly Department | packing_assembly |
| production_department | Packaging Assembly Department |  |
| primary_pack_type | Jumbo Master (32 Box) | Jumbo Master (32 Box) |
| qty_per_pack |  | 32 |
| is_active | Active | true |

### Row 20: Baklawa Sultan Collection - Pack of 6 Pcs

| Field | Source | Target |
|---|---|---|
| product_name | Baklawa Sultan Collection - Pack of 6 Pcs | Baklawa Sultan Collection - Pack of 6 Pcs |
| category | Baklawa | Baklawa |
| primary_uom | pcs | pcs |
| gst_rate | 5 | 5 |
| net_weight_g | 145 | 145 |
| shelf_life_days | 90 | 90 |
| main_department | Packaging Assembly Department | packing_assembly |
| production_department | Packaging Assembly Department |  |
| primary_pack_type | Jumbo Master (36 Box) | Jumbo Master (36 Box) |
| qty_per_pack |  | 36 |
| is_active | Inactive | false |

### Row 21: Baklawa Vegan Collection - Pack of 4 Pcs

| Field | Source | Target |
|---|---|---|
| product_name | Baklawa Vegan Collection - Pack of 4 Pcs | Baklawa Vegan Collection - Pack of 4 Pcs |
| category | Baklawa | Baklawa |
| primary_uom | pcs | pcs |
| gst_rate | 5 | 5 |
| net_weight_g | 95 | 95 |
| shelf_life_days | 90 | 90 |
| main_department | Packaging Assembly Department | packing_assembly |
| production_department | Packaging Assembly Department |  |
| primary_pack_type | Jumbo Master (45 Box) | Jumbo Master (45 Box) |
| qty_per_pack |  | 45 |
| is_active | Inactive | false |

### Row 22: Baklawa Vegan Collection - Pack of 6 Pcs

| Field | Source | Target |
|---|---|---|
| product_name | Baklawa Vegan Collection - Pack of 6 Pcs | Baklawa Vegan Collection - Pack of 6 Pcs |
| category | Baklawa | Baklawa |
| primary_uom | pcs | pcs |
| gst_rate | 5 | 5 |
| net_weight_g | 145 | 145 |
| shelf_life_days | 90 | 90 |
| main_department | Packaging Assembly Department | packing_assembly |
| production_department | Packaging Assembly Department |  |
| primary_pack_type | Jumbo Master (24 Box) | Jumbo Master (24 Box) |
| qty_per_pack |  | 24 |
| is_active | Inactive | false |

### Row 23: Baklawa Vegan Collection - Pack of 9 Pcs

| Field | Source | Target |
|---|---|---|
| product_name | Baklawa Vegan Collection - Pack of 9 Pcs | Baklawa Vegan Collection - Pack of 9 Pcs |
| category | Baklawa | Baklawa |
| primary_uom | pcs | pcs |
| gst_rate | 5 | 5 |
| net_weight_g | 220 | 220 |
| shelf_life_days | 90 | 90 |
| main_department | Packaging Assembly Department | packing_assembly |
| production_department | Packaging Assembly Department |  |
| primary_pack_type | Jumbo Master (42 Box) | Jumbo Master (42 Box) |
| qty_per_pack |  | 42 |
| is_active | Active | true |

### Row 24: Basbousa Almond Baklawa

| Field | Source | Target |
|---|---|---|
| product_name | Basbousa Almond Baklawa | Basbousa Almond Baklawa |
| category | Baklawa | Baklawa |
| primary_uom | kg | kg |
| gst_rate | 5 | 5 |
| net_weight_g | 1200 | 1200 |
| shelf_life_days | 90 | 90 |
| main_department | Arabic Sweets Department | ready_goods_store |
| production_department | Arabic Sweets Department | arabic_sweets |
| primary_pack_type | Large Master (8 Box) | Large Master (8 Box) |
| qty_per_pack |  | 8 |
| is_active | Active | true |

### Row 25: Basbousa Cashew Baklawa

| Field | Source | Target |
|---|---|---|
| product_name | Basbousa Cashew Baklawa | Basbousa Cashew Baklawa |
| category | Baklawa | Baklawa |
| primary_uom | kg | kg |
| gst_rate | 5 | 5 |
| net_weight_g | 1200 | 1200 |
| shelf_life_days | 90 | 90 |
| main_department | Arabic Sweets Department | ready_goods_store |
| production_department | Arabic Sweets Department | arabic_sweets |
| primary_pack_type | Large Master (8 Box) | Large Master (8 Box) |
| qty_per_pack |  | 8 |
| is_active | Inactive | false |
