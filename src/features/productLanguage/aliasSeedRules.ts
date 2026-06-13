export type AliasSeed = {
  alias: string;
  language?: string;
  script?: string;
  alias_type?: string;
};

export const ALIAS_SEED_RULES: { match: RegExp; aliases: AliasSeed[] }[] = [
  {
    match: /kunafa|kadayif|kataifi|knafe|shredded filo/i,
    aliases: [
      { alias: "Kunafa" },
      { alias: "Knafeh" },
      { alias: "Kadayif", language: "tr" },
      { alias: "Kataifi" },
      { alias: "كنافة", language: "ar", script: "arabic", alias_type: "arabic_name" },
    ],
  },
  {
    match: /pyramid.*baklawa|cashew pyramid|boukaj/i,
    aliases: [
      { alias: "Cashew Pyramid" },
      { alias: "Pyramid Baklawa" },
      { alias: "Boukaj", alias_type: "authentic_name" },
      { alias: "Kaju Pyramid", language: "hi", alias_type: "hindi_name" },
    ],
  },
  {
    match: /katori|cashew tart|cashew cup/i,
    aliases: [
      { alias: "Cashew Tart" },
      { alias: "Katori Baklawa" },
      { alias: "Kaju Katori", language: "hi", alias_type: "hindi_name" },
    ],
  },
  {
    match: /dragee|choco ball|chocolate ball/i,
    aliases: [
      { alias: "Dragee" },
      { alias: "Chocolate Ball" },
      { alias: "Choco Ball" },
    ],
  },
  {
    match: /hamper|gift box|assorted/i,
    aliases: [
      { alias: "Gift Hamper" },
      { alias: "Assorted Hamper" },
      { alias: "Gift Box" },
    ],
  },
];

export function seedAliasesFromName(productName: string): AliasSeed[] {
  const text = `${productName}`;
  const out: AliasSeed[] = [];
  const seen = new Set<string>();

  for (const rule of ALIAS_SEED_RULES) {
    if (!rule.match.test(text)) continue;
    for (const a of rule.aliases) {
      const key = a.alias.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(a);
    }
  }

  const short = productName.split(/[\/,|]/)[0]?.trim();
  if (short && short.length > 2 && !seen.has(short.toLowerCase())) {
    out.unshift({ alias: short, alias_type: "official_alias" });
  }

  return out.slice(0, 12);
}

export function whatsappKeywordsFromAliases(aliases: AliasSeed[]): string[] {
  return aliases
    .map((a) => a.alias)
    .filter((a) => a.length <= 24)
    .slice(0, 6);
}
