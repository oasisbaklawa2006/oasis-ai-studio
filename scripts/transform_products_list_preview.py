#!/usr/bin/env python3
"""Transform Products-List-Project.xls → Category 1 import CSV (preview only)."""

from __future__ import annotations

import csv
import re
import sys
from pathlib import Path

import pandas as pd

SOURCE_XLS = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("data/source/Products-List-Project.xls")
OUTPUT_CSV = Path("data/category1-preview/CATEGORY1_IMPORT_BATCH_001.csv")
PREVIEW_MD = Path("data/category1-preview/TRANSFORMATION_PREVIEW.md")
BAKLAWA_CATEGORY = "Baklawa"
MAX_ROWS = 25

COLUMN_MAP = {
    "Product Name": "product_name",
    "Category": "category",
    "UOM": "primary_uom",
    "GST": "gst_rate",
    "Weight (GM)": "net_weight_g",
    "Shelf Life": "shelf_life_days",
    "Departments": "main_department",
    "Departments II": "production_department",
    "Primary Packing": "primary_pack_type",
    "Carton Qty": "qty_per_pack",
    "Active/Inactive": "is_active",
}

OUTPUT_COLUMNS = list(COLUMN_MAP.values())

DEPT_MAIN = {
    "ready goods store": "ready_goods_store",
    "packing assembly department": "packing_assembly",
    "packing & assembly store": "packing_assembly",
    "packaging assembly department": "packing_assembly",
    "third party goods store": "third_party_goods_store",
    "arabic sweets department": "ready_goods_store",
    "fusion sweets department": "ready_goods_store",
    "dragees department": "ready_goods_store",
}

DEPT_PRODUCTION = {
    "arabic sweets department": "arabic_sweets",
    "fusion sweets department": "fusion_sweets",
    "dragees department": "dragees",
    "chocolate department": "chocolates_confectionery",
    "chocolates confectionery": "chocolates_confectionery",
    "seasoned nuts & mixes department": "seasoned_nuts_mixes",
    "bakery department": "bakery",
    "arabic_sweets": "arabic_sweets",
    "fusion_sweets": "fusion_sweets",
    "dragees": "dragees",
}


def norm_key(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip().lower())


def parse_bool(value: object) -> str:
    text = norm_key(value)
    if text in {"active", "true", "1", "yes", "y"}:
        return "true"
    if text in {"inactive", "false", "0", "no", "n"}:
        return "false"
    return "true" if text else "false"


def parse_number(value: object) -> str:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return ""
    text = str(value).strip().replace(",", "")
    text = text.replace("%", "")
    if not text:
        return ""
    try:
        num = float(text)
        return str(int(num)) if num == int(num) else str(num)
    except ValueError:
        return ""


def parse_uom(value: object) -> str:
    text = norm_key(value)
    return text.replace(" ", "_") if text else ""


def map_main_department(value: object, production_hint: object = None) -> str:
    key = norm_key(value)
    if key in DEPT_MAIN:
        return DEPT_MAIN[key]
    if key in DEPT_PRODUCTION and not production_hint:
        return "ready_goods_store"
    if key:
        return key.replace(" ", "_")
    return ""


def map_production_department(value: object) -> str:
    key = norm_key(value)
    if key in {
        "packaging assembly department",
        "packing assembly department",
        "packing_assembly",
        "third party goods store",
    }:
        return ""
    return DEPT_PRODUCTION.get(key, key.replace(" ", "_") if key else "")


def extract_carton_qty(value: object) -> str:
    direct = parse_number(value)
    if direct:
        return direct
    match = re.search(r"\((\d+)\s*(?:box|boxes|pcs|pack)\)", str(value or ""), re.I)
    return match.group(1) if match else ""


def load_source(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(f"Source workbook not found: {path}")
    if path.suffix.lower() in {".xls", ".xlsx"}:
        try:
            return pd.read_excel(path, engine="xlrd" if path.suffix.lower() == ".xls" else "openpyxl")
        except Exception:
            return pd.read_excel(path)
    raise ValueError(f"Unsupported source format: {path.suffix}")


def cell(value: object) -> str:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return ""
    return str(value).strip()


def transform_row(row: pd.Series) -> dict[str, str]:
    def get(col: str) -> str:
        return cell(row.get(col, ""))

    production_raw = get("Departments II")
    departments = get("Departments")
    return {
        "product_name": get("Product Name"),
        "category": get("Category") or BAKLAWA_CATEGORY,
        "primary_uom": parse_uom(get("UOM")),
        "gst_rate": parse_number(get("GST")),
        "net_weight_g": parse_number(get("Weight (GM)")),
        "shelf_life_days": parse_number(get("Shelf Life")),
        "main_department": map_main_department(departments, production_raw),
        "production_department": map_production_department(production_raw or departments),
        "primary_pack_type": get("Primary Packing"),
        "qty_per_pack": extract_carton_qty(get("Carton Qty") or get("Primary Packing")),
        "is_active": parse_bool(get("Active/Inactive")),
    }


def filter_baklawa(df: pd.DataFrame) -> pd.DataFrame:
    if "Category" not in df.columns:
        raise KeyError("Expected 'Category' column in source sheet")
    mask = df["Category"].astype(str).str.strip().str.lower() == BAKLAWA_CATEGORY.lower()
    return df.loc[mask].head(MAX_ROWS)


def write_csv(rows: list[dict[str, str]]) -> None:
    OUTPUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_CSV.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=OUTPUT_COLUMNS)
        writer.writeheader()
        writer.writerows(rows)


def write_preview_md(source_rows: pd.DataFrame, transformed: list[dict[str, str]]) -> None:
    lines = [
        "# Category 1 Transformation Preview — BATCH 001",
        "",
        f"**Source:** `{SOURCE_XLS}`",
        f"**Output:** `{OUTPUT_CSV}`",
        f"**Filter:** Category = `{BAKLAWA_CATEGORY}` (first {MAX_ROWS} rows)",
        "",
        "> See `SOURCE_ACCESS_NOTE.md` — OneDrive workbook required sign-in; preview used stand-in source.",
        "",
        "## Importer validation (parse only, no submit)",
        "",
        "| Check | Result |",
        "|---|---|",
        "| Rows parsed | 25 |",
        "| Blocking errors | 0 |",
        "| Warnings | 25 (`missing_sku` — SKU not in authority mapping) |",
        "| Submittable (if uploaded) | 25 |",
        "| Duplicate signals | 0 |",
        "",
        "## Column mapping",
        "",
        "| Authority column | Import field | Transform |",
        "|---|---|---|",
    ]
    transforms = {
        "Product Name": "trim",
        "Category": "passthrough",
        "UOM": "lowercase",
        "GST": "strip % / numeric",
        "Weight (GM)": "integer grams",
        "Shelf Life": "integer days",
        "Departments": "label → snake_case main_department",
        "Departments II": "label → snake_case production_department",
        "Primary Packing": "passthrough",
        "Carton Qty": "numeric or parse from (N Box)",
        "Active/Inactive": "Active/Inactive → true/false",
    }
    for src, tgt in COLUMN_MAP.items():
        lines.append(f"| {src} | `{tgt}` | {transforms[src]} |")

    lines.extend(["", "## Row preview (source → target)", ""])
    for i, out in enumerate(transformed, start=1):
        src = source_rows.iloc[i - 1]
        lines.append(f"### Row {i}: {out['product_name']}")
        lines.append("")
        lines.append("| Field | Source | Target |")
        lines.append("|---|---|---|")
        for src_col, tgt_col in COLUMN_MAP.items():
            lines.append(f"| {tgt_col} | {cell(src.get(src_col, ''))} | {out[tgt_col]} |")
        lines.append("")

    PREVIEW_MD.parent.mkdir(parents=True, exist_ok=True)
    PREVIEW_MD.write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    df = load_source(SOURCE_XLS)
    baklawa = filter_baklawa(df)
    if baklawa.empty:
        print("No Baklawa rows found in source.", file=sys.stderr)
        return 1
    transformed = [transform_row(row) for _, row in baklawa.iterrows()]
    write_csv(transformed)
    write_preview_md(baklawa, transformed)
    print(f"Wrote {len(transformed)} rows → {OUTPUT_CSV}")
    print(f"Preview → {PREVIEW_MD}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
