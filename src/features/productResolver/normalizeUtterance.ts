const FILLER_WORDS = new Set([
  "need",
  "send",
  "want",
  "please",
  "order",
  "kg",
  "kgs",
  "gram",
  "grams",
  "piece",
  "pieces",
  "box",
  "chahiye",
  "chiye",
  "dedo",
  "bhejo",
  "mujhe",
  "mera",
  "meri",
]);

const QUANTITY_PATTERN = /\b\d+(?:\.\d+)?\b/g;

export function normalizeUtterance(input: string): string {
  let text = input
    .toLowerCase()
    .replace(/[₹$,;:!?()[\]{}'"`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  text = text.replace(QUANTITY_PATTERN, " ");

  const tokens = text
    .split(" ")
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && !FILLER_WORDS.has(t));

  return tokens.join(" ").replace(/\s+/g, " ").trim();
}
