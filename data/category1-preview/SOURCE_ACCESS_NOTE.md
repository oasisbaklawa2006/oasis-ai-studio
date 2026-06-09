# Source file access — Products-List-Project.xls

**OneDrive link:** https://1drv.ms/x/c/7ae0e5c81cd5073b/IQAUr3cjpp_cRIjqdgMxS_tMAV2QV34aExZjHbXY6ZvkMkQ

## Status: blocked (sign-in required)

Automated download from this environment returned **Microsoft sign-in / 403 blocked**. The workbook could not be read directly.

## What was generated instead

This preview batch was built using:

1. `scripts/transform_products_list_preview.py` — the exact mapping pipeline for the authority sheet
2. A **stand-in source workbook** at `data/source/Products-List-Project.xls` with 25 rows where `Category = Baklawa`, reconstructed from live Central `products` names matching *Baklawa/Baklava* (read-only SQL), shaped to the authority column headers you specified

## To regenerate from the real Excel file

1. Re-share the OneDrive file as **Anyone with the link can view** (no sign-in), **or** upload `Products-List-Project.xls` to `data/source/`
2. Run:

```bash
python3 scripts/transform_products_list_preview.py data/source/Products-List-Project.xls
```

3. Review `data/category1-preview/CATEGORY1_IMPORT_BATCH_001.csv` and `TRANSFORMATION_PREVIEW.md`

**No import or draft submission** — preview artifacts only.
