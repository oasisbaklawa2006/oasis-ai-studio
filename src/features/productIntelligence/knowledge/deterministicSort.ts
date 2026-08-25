/** Locale-independent UTF-16 code-unit comparator for immutable checksum keys. */
export function compareDeterministicKeys(left: string, right: string): number {
  const max = Math.max(left.length, right.length);
  for (let index = 0; index < max; index += 1) {
    const leftCode = index < left.length ? left.charCodeAt(index) : -1;
    const rightCode = index < right.length ? right.charCodeAt(index) : -1;
    if (leftCode !== rightCode) return leftCode - rightCode;
  }
  return 0;
}

export function sortDeterministicKeys<T>(entries: Iterable<[string, T]>): [string, T][] {
  return [...entries].sort(([left], [right]) => compareDeterministicKeys(left, right));
}

export function sortDeterministicStrings(values: Iterable<string>): string[] {
  return [...values].sort(compareDeterministicKeys);
}
