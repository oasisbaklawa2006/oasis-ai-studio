function splitWords(text: string): string[] {
  const words: string[] = [];
  let word = "";
  for (const ch of text) {
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      if (word) {
        words.push(word);
        word = "";
      }
      continue;
    }
    word += ch;
  }
  if (word) words.push(word);
  return words;
}

function tokenize(text: string): string[] {
  const tokens: string[] = [];
  let current = "";
  for (const ch of text.toLowerCase()) {
    const isAlpha = ch >= "a" && ch <= "z";
    const isDigit = ch >= "0" && ch <= "9";
    if (isAlpha || isDigit) {
      current += ch;
      continue;
    }
    if (current) {
      tokens.push(current);
      current = "";
    }
  }
  if (current) tokens.push(current);
  return tokens;
}

function isDigitToken(value: string, maxLen = 4): boolean {
  if (value.length === 0 || value.length > maxLen) return false;
  for (const ch of value) {
    if (ch < "0" || ch > "9") return false;
  }
  return true;
}

function compactWhitespace(value: string): string {
  let out = "";
  for (const ch of value) {
    if (ch !== " " && ch !== "\t" && ch !== "\n" && ch !== "\r") out += ch;
  }
  return out;
}

function isAllDigits(value: string): boolean {
  if (!value) return false;
  for (const ch of value) {
    if (ch < "0" || ch > "9") return false;
  }
  return true;
}

export { compactWhitespace, isAllDigits, isDigitToken, splitWords, tokenize };
