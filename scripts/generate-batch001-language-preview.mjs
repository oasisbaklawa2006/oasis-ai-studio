#!/usr/bin/env node
/**
 * Preview-only generator — no DB writes, no drafts, no imports.
 * Output: data/product-language-preview/batch001_language_terms_preview.csv
 *         data/product-language-preview/batch001_language_conflicts.md
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_DIR = join(ROOT, "data/product-language-preview");

const HSN = "21069099";
const CATEGORY = "Baklawa";

const SKUS = Array.from({ length: 25 }, (_, i) =>
  `OAS-AS-BKL-${String(i + 1).padStart(4, "0")}`,
);

const GLOBAL_HIGH_RISK = new Set([
  "pyramid",
  "pistachio",
  "pista",
  "baklava",
  "baklawa",
  "cashew",
  "kaju",
  "asiyah",
  "assiyah",
  "durum",
  "boukaj",
  "ring",
  "tart",
  "kitta",
  "square",
]);

function parseCsvProducts() {
  const raw = readFileSync(
    join(ROOT, "data/category1-preview/CATEGORY1_IMPORT_BATCH_001_uploaded.csv"),
    "utf8",
  );
  const lines = raw.split("\n").slice(2).filter(Boolean);
  const map = new Map();
  for (const line of lines) {
    const cols = line.split(",");
    const sno = parseInt(cols[0], 10);
    if (!sno || sno < 1 || sno > 25) continue;
    const name = cols[3]?.trim();
    const subcat = cols[5]?.trim() || "Lebanese Baklawa";
    const aliases = (cols[11] || "")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    const whatsapp = (cols[12] || "")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    map.set(sno, { name, subcat, aliases, whatsapp });
  }
  return map;
}

/** Product 25 missing from CSV — authority design anchor */
const COCONUT_DURUM = {
  name: "Coconut Durum",
  subcat: "Turkish Baklawa",
  aliases: [
    "Coconut Durum",
    "Coconut Roll",
    "Nariyal Durum",
    "Coconut Durum Baklava",
    "Coconut Durum Baklawa",
    "Coconut Turkish Roll Baklava",
    "Coconut Roll Baklava",
    "Coconut Durum Turkish Baklava",
  ],
  whatsapp: [
    "coconut durum",
    "coconut roll",
    "nariyal durum",
    "coconut durum baklava",
    "coconut durum baklawa",
    "need coconut durum",
    "send coconut durum",
    "coconut durum kg",
  ],
};

function productMeta(sno, csvMap) {
  const row = sno === 25 ? COCONUT_DURUM : csvMap.get(sno);
  if (!row) throw new Error(`Missing product row ${sno}`);
  return { sku: SKUS[sno - 1], official_name: row.name, subcat: row.subcat, ...row };
}

function hasEnoughContext(term, officialName) {
  const t = term.toLowerCase();
  const nameTokens = officialName.toLowerCase().split(/[\s()]+/).filter((x) => x.length > 2);
  const matched = nameTokens.filter((tok) => t.includes(tok));
  return matched.length >= 2 || t.includes(officialName.toLowerCase());
}

function assessConflict(term, officialName, sku, conflictNotes) {
  const t = term.toLowerCase().trim();
  const bare = t.replace(/[^a-z0-9\s]/g, " ").trim();

  for (const risky of GLOBAL_HIGH_RISK) {
    if (bare === risky || bare === `need ${risky}` || bare === `send ${risky}`) {
      return { risk: "HIGH", question: `Bare "${risky}" matches multiple Batch 001 SKUs — require full product phrase or SKU ${sku}` };
    }
  }

  if (/\bpyramid\b/i.test(term) && !/\(topping\)/i.test(officialName) && officialName.includes("Pyramid(Topping)")) {
    return { risk: "HIGH", question: `Distinguish OAS-AS-BKL-0011 (topping) from OAS-AS-BKL-0019 (plain pistachio pyramid) and OAS-AS-BKL-0006 (cashew pyramid)` };
  }

  if (/\bpyramid\b/i.test(term) && officialName === "Pistachio Pyramid" && !/pistachio|pista|boukaj/i.test(term)) {
    return { risk: "HIGH", question: "Pyramid without nut qualifier — maps to 0006, 0011, or 0019" };
  }

  if (/\bpyramid\b/i.test(term) && officialName === "Cashew Pyramid" && !/cashew|kaju|boukaj/i.test(term)) {
    return { risk: "HIGH", question: "Pyramid without cashew qualifier — maps to multiple pyramid SKUs" };
  }

  if (/\bpistachio\b/i.test(term) && !/ring|tart|pyramid|asiyah|durum|diamond|mor|chocolate|\(topping\)/i.test(term) && officialName.includes("Pistachio")) {
    if (!hasEnoughContext(term, officialName)) {
      return { risk: "HIGH", question: `Pistachio-only phrase — pair with shape (ring/tart/pyramid/asiyah/durum) for ${sku}` };
    }
  }

  if (/^baklava$/i.test(bare) || /^baklawa$/i.test(bare)) {
    return { risk: "HIGH", question: "Category token only — never auto-resolve to a single SKU" };
  }

  if (conflictNotes?.length) {
    const ambiguous = conflictNotes.some((n) => /pyramid|boukaj|asiyah|pistachio/i.test(term) && /disambigu/i.test(n));
    if (ambiguous && !hasEnoughContext(term, officialName)) {
      return { risk: "HIGH", question: conflictNotes[0] };
    }
  }

  if (GLOBAL_HIGH_RISK.has(bare.split(/\s+/)[0]) && !hasEnoughContext(term, officialName)) {
    return { risk: "MEDIUM", question: `Partial token match — prefer full "${officialName}" phrase for WhatsApp` };
  }

  return { risk: "LOW", question: "" };
}

function regionalTerms(meta) {
  const terms = [];
  const { official_name, subcat } = meta;
  if (/cashew|kaju/i.test(official_name)) {
    terms.push({ text: "काजू बकलावा", language: "hi", script: "devanagari" });
  }
  if (/pistachio|pista/i.test(official_name)) {
    terms.push({ text: "पिस्ता बकलावा", language: "hi", script: "devanagari" });
  }
  if (/almond|badam/i.test(official_name)) {
    terms.push({ text: "बादाम बकलावा", language: "hi", script: "devanagari" });
  }
  if (/date|khajur|khajoor/i.test(official_name)) {
    terms.push({ text: "खजूर बकलावा", language: "hi", script: "devanagari" });
  }
  if (/coconut|nariyal/i.test(official_name)) {
    terms.push({ text: "नारियल दुरुम", language: "hi", script: "devanagari" });
  }
  if (/kitta|diamond/i.test(official_name)) {
    terms.push({ text: "काजू कित्ता", language: "hi", script: "devanagari" });
  }
  if (subcat.includes("Turkish") || /durum|roll/i.test(official_name)) {
    terms.push({ text: "Fıstıklı durum", language: "tr", script: "latin" });
  }
  if (/square/i.test(official_name)) {
    terms.push({ text: "مربع بقلاوة", language: "ar", script: "arabic" });
  }
  return terms.slice(0, 3);
}

function nomenclatureAliases(meta) {
  const { official_name } = meta;
  const extra = [];
  if (/kitta/i.test(official_name)) extra.push("Cashew Diamond", "Kaju Diamond");
  if (/pyramid/i.test(official_name) && /cashew/i.test(official_name)) extra.push("Cashew Boukaj");
  if (/pyramid/i.test(official_name) && /pistachio/i.test(official_name)) extra.push("Pistachio Boukaj");
  if (/asiyah/i.test(official_name)) {
    const nut = /pistachio|pista/i.test(official_name) ? "Pistachio" : "Cashew";
    extra.push(`${nut} High Jump`, `${nut} High Gap`);
    if (/chocolate/i.test(official_name)) extra.push(`Chocolate ${nut} High Jump`);
    if (/mor/i.test(official_name)) extra.push(`Beetroot ${nut} Asiyah`, `Purple ${nut} Asiyah`);
  }
  if (/durum/i.test(official_name)) {
    if (/coconut/i.test(official_name)) extra.push("Coconut Roll", "Nariyal Roll");
    if (/mor/i.test(official_name)) extra.push("Mor Pistachio Roll", "Purple Pistachio Roll");
  }
  if (/finger/i.test(official_name)) extra.push("Cashew Asabi", "Cashew Asabeh");
  if (/crosole/i.test(official_name)) extra.push("Almond Croissant Shape Baklava");
  if (/tart/i.test(official_name) && /cashew/i.test(official_name)) extra.push("Cashew Katori", "Kaju Katori");
  return extra;
}

function customerTerms(meta) {
  const { official_name, aliases } = meta;
  const informal = [];
  if (/kitta/i.test(official_name)) informal.push("cashew piece", "kaju piece", "cashew kitta piece");
  if (/ring/i.test(official_name)) {
    const nut = /pistachio|pista/i.test(official_name) ? "pista ring" : "kaju ring";
    informal.push(nut, `${nut} sweet`);
  }
  if (/pyramid/i.test(official_name)) {
    const nut = /pistachio|pista/i.test(official_name) ? "pista pyramid" : "kaju pyramid";
    informal.push(nut);
    if (official_name.includes("(Topping)")) informal.push("pista pyramid topping", "pyramid with topping");
  }
  if (/asiyah/i.test(official_name)) {
    const nut = /pistachio|pista/i.test(official_name) ? "pista gap" : "cashew gap";
    informal.push("high jump sweet", nut, "asiyah piece");
  }
  if (/durum/i.test(official_name)) informal.push("coconut roll", "durum roll", "turkish roll");
  if (/square/i.test(official_name)) informal.push("square piece", "square sweet");
  if (/date/i.test(official_name)) informal.push("date sweet", "khajoor baklava");
  if (/tart/i.test(official_name)) informal.push("baklawa tart", "katori sweet");
  if (/diamond/i.test(official_name)) informal.push("pista diamond", "diamond shape pista");
  if (/mix nut/i.test(official_name)) informal.push("mixed nut tart", "mix tart");
  if (/rosebud/i.test(official_name)) informal.push("rose sweet", "kaju rose");
  if (/crosole/i.test(official_name)) informal.push("croissant baklava", "almond croissant");
  if (/finger/i.test(official_name)) informal.push("finger sweet", "cashew finger piece");
  if (/special square/i.test(official_name)) informal.push("special square piece");

  const fromAliases = aliases
    .filter((a) => !a.includes("Lebanese") && !a.includes("Baklava") && a.length < 40)
    .slice(0, 2);

  return [...new Set([...informal, ...fromAliases])].slice(0, 6);
}

function searchKeywords(meta) {
  const { official_name, subcat } = meta;
  const kw = [];
  if (subcat.includes("Lebanese")) kw.push("lebanese baklawa", "lebanese sweet");
  if (subcat.includes("Turkish")) kw.push("turkish baklawa", "turkish durum");
  if (/kitta|diamond/i.test(official_name)) kw.push("kitta", "diamond baklawa");
  if (/pyramid|boukaj/i.test(official_name)) kw.push("pyramid baklawa", "boukaj");
  if (/asiyah|assiyah/i.test(official_name)) kw.push("asiyah", "high jump baklawa");
  if (/durum|roll/i.test(official_name)) kw.push("durum roll", "baklawa roll");
  if (/tart|katori/i.test(official_name)) kw.push("baklawa tart", "katori");
  if (/ring/i.test(official_name)) kw.push("ring baklawa");
  if (/square/i.test(official_name)) kw.push("square baklawa");
  if (/chocolate/i.test(official_name)) kw.push("chocolate filo baklawa");
  if (/mor/i.test(official_name)) kw.push("beetroot filo", "purple filo baklawa");
  if (/date/i.test(official_name)) kw.push("date baklawa");
  if (/coconut/i.test(official_name)) kw.push("coconut baklawa");
  return [...new Set(kw)].slice(0, 5);
}

function conflictNotesForSku(sku) {
  if (sku === "OAS-AS-BKL-0011") return ["Ambiguous vs OAS-AS-BKL-0019 — pyramid(topping) must include topping marker"];
  if (sku === "OAS-AS-BKL-0019") return ["Shares pyramid/boukaj with OAS-AS-BKL-0006 and OAS-AS-BKL-0011"];
  if (sku === "OAS-AS-BKL-0006") return ["Cashew pyramid vs pistachio pyramid SKUs — require nut in phrase"];
  if (sku === "OAS-AS-BKL-0012" || sku === "OAS-AS-BKL-0016") return ["Multiple asiyah SKUs — require chocolate/mor/plain qualifier"];
  return [];
}

function buildProductTerms(sno, csvMap) {
  const meta = productMeta(sno, csvMap);
  const notes = conflictNotesForSku(meta.sku);
  const rows = [];

  const add = (term_type, term_text, opts = {}) => {
    const { language = "", script = "", forceRisk } = opts;
    const { risk, question } = forceRisk
      ? { risk: forceRisk, question: opts.clarification || "" }
      : assessConflict(term_text, meta.official_name, meta.sku, notes);
    rows.push({
      sku: meta.sku,
      official_name: meta.official_name,
      category: CATEGORY,
      hsn: HSN,
      term_type,
      term_text,
      language,
      script,
      conflict_risk: risk,
      clarification_question: question,
    });
  };

  const officialAliasPool = [
    ...meta.aliases.filter((a) => a !== meta.official_name),
    ...nomenclatureAliases(meta),
  ];
  const uniqueOfficial = [...new Set(officialAliasPool)].slice(0, 8);
  for (const t of uniqueOfficial.slice(0, Math.max(2, uniqueOfficial.length >= 2 ? uniqueOfficial.length : 2))) {
    add("official_alias", t);
  }

  const customers = customerTerms(meta);
  while (customers.length < 3) customers.push(`${meta.official_name.toLowerCase()} piece`);
  for (const t of customers.slice(0, Math.max(3, customers.length))) add("customer_term", t);

  const waPool = [...meta.whatsapp];
  const waNeed = [`need ${meta.official_name.toLowerCase()}`, `send ${meta.official_name.toLowerCase()}`, `${meta.official_name.toLowerCase()} kg`];
  const waUnique = [...new Set([...waPool, ...waNeed])];
  for (const t of waUnique.slice(0, Math.max(5, waUnique.length))) add("whatsapp_keyword", t);

  for (const r of regionalTerms(meta)) {
    add("regional_term", r.text, { language: r.language, script: r.script });
  }
  if (!rows.some((r) => r.term_type === "regional_term")) {
    add("regional_term", meta.official_name, { language: "en", script: "latin" });
  }

  for (const t of searchKeywords(meta)) add("search_keyword", t);

  const barePyramid = rows.find((r) => r.term_text.toLowerCase() === "pyramid");
  if (barePyramid) {
    barePyramid.conflict_risk = "HIGH";
    barePyramid.clarification_question = "Bare pyramid — never auto-map";
  }

  return { meta, rows, notes };
}

function escapeCsv(v) {
  const s = String(v ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const csvMap = parseCsvProducts();
  const allRows = [];
  const clarifications = [];
  const highConflicts = [];

  for (let sno = 1; sno <= 25; sno++) {
    const { meta, rows, notes } = buildProductTerms(sno, csvMap);
    allRows.push(...rows);

    const counts = {
      official_alias: rows.filter((r) => r.term_type === "official_alias").length,
      customer_term: rows.filter((r) => r.term_type === "customer_term").length,
      whatsapp_keyword: rows.filter((r) => r.term_type === "whatsapp_keyword").length,
      search_keyword: rows.filter((r) => r.term_type === "search_keyword").length,
    };

    for (const [k, min] of [
      ["official_alias", 2],
      ["customer_term", 3],
      ["whatsapp_keyword", 5],
      ["search_keyword", 2],
    ]) {
      if (counts[k] < min) {
        throw new Error(`${meta.sku} failed minimum ${k}: ${counts[k]} < ${min}`);
      }
    }

    const high = rows.filter((r) => r.conflict_risk === "HIGH");
    highConflicts.push(...high.map((r) => ({ ...r, product: meta.official_name })));

    if (notes.length || high.length > 2) {
      clarifications.push({
        sku: meta.sku,
        official_name: meta.official_name,
        notes,
        high_count: high.length,
        question:
          notes[0] ||
          (high[0]?.clarification_question ?? "Review HIGH-risk terms before import"),
      });
    }
  }

  const header = [
    "sku",
    "official_name",
    "category",
    "hsn",
    "term_type",
    "term_text",
    "language",
    "script",
    "conflict_risk",
    "clarification_question",
  ];

  const csvLines = [
    header.join(","),
    ...allRows.map((r) => header.map((h) => escapeCsv(r[h])).join(",")),
  ];

  writeFileSync(join(OUT_DIR, "batch001_language_terms_preview.csv"), csvLines.join("\n") + "\n");

  const md = [];
  md.push("# Batch 001 Language Term Conflicts — Preview Only\n");
  md.push("**Status:** Review draft — not imported, not submitted, no DB writes.\n");
  md.push(`**Generated:** ${new Date().toISOString().slice(0, 10)}`);
  md.push(`**Cohort:** OAS-AS-BKL-0001 … OAS-AS-BKL-0025 (${allRows.length} term rows)\n`);
  md.push("## Summary\n");
  md.push(`| Metric | Count |`);
  md.push(`|--------|-------|`);
  md.push(`| Total term rows | ${allRows.length} |`);
  md.push(`| HIGH conflict terms | ${highConflicts.length} |`);
  md.push(`| Products needing clarification | ${clarifications.length} |`);
  md.push(`| SKUs covered | 25 |\n`);

  md.push("## Global HIGH-risk tokens (never auto-resolve alone)\n");
  md.push("- `pyramid`, `pistachio`, `pista`, `baklava`, `baklawa`, `cashew`, `kaju`");
  md.push("- `asiyah`, `durum`, `boukaj`, `ring`, `tart`, `kitta`, `square`");
  md.push("- Always require nut + shape + special qualifier, or full official name / SKU\n");

  md.push("## Cross-SKU disambiguation clusters\n\n");
  md.push("### Pyramid family\n");
  md.push("| SKU | Official Name | Risk |");
  md.push("|-----|---------------|------|");
  md.push("| OAS-AS-BKL-0006 | Cashew Pyramid | Cashew boukaj — not pistachio |");
  md.push("| OAS-AS-BKL-0011 | Pistachio Pyramid(Topping) | Must include **topping** marker |");
  md.push("| OAS-AS-BKL-0019 | Pistachio Pyramid | Plain pistachio boukaj — not topping variant |\n");

  md.push("### Asiyah family\n");
  md.push("| SKU | Official Name | Disambiguator |");
  md.push("|-----|---------------|---------------|");
  md.push("| OAS-AS-BKL-0012 | Chocolate Pistachio Asiyah | chocolate filo |");
  md.push("| OAS-AS-BKL-0013 | Chocolate Cashew Asiyah | chocolate + cashew |");
  md.push("| OAS-AS-BKL-0014 | Mor Cashew Asiyah | beetroot/purple filo |");
  md.push("| OAS-AS-BKL-0015 | Mor Pistachio Asiyah | beetroot/purple filo |");
  md.push("| OAS-AS-BKL-0016 | Pistachio Asiyah | plain pistachio |");
  md.push("| OAS-AS-BKL-0017 | Cashew Asiyah | plain cashew |\n");

  md.push("## Products needing clarification\n\n");
  for (const c of clarifications) {
    md.push(`### ${c.sku} — ${c.official_name}\n`);
    md.push(`- HIGH-risk terms in preview: **${c.high_count}**`);
    if (c.notes.length) md.push(`- ${c.notes.join("\n- ")}`);
    md.push(`- **Question:** ${c.question}\n`);
  }

  md.push("## HIGH conflict term sample (first 40)\n\n");
  md.push("| SKU | Term | Type | Clarification |");
  md.push("|-----|------|------|---------------|");
  for (const h of highConflicts.slice(0, 40)) {
    md.push(`| ${h.sku} | ${h.term_text} | ${h.term_type} | ${h.clarification_question.replace(/\|/g, "/")} |`);
  }

  md.push("\n---\n");
  md.push("*Preview only. Do not import until Category 2 language batch is approved.*\n");

  writeFileSync(join(OUT_DIR, "batch001_language_conflicts.md"), md.join("\n"));

  const summary = {
    rows: allRows.length,
    high: highConflicts.length,
    clarifications: clarifications.length,
    byType: Object.fromEntries(
      ["official_alias", "customer_term", "whatsapp_keyword", "regional_term", "search_keyword"].map((t) => [
        t,
        allRows.filter((r) => r.term_type === t).length,
      ]),
    ),
  };
  console.log(JSON.stringify(summary, null, 2));
}

main();
