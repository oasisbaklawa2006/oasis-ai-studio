/** Central uses `alias_text`; repo dev schema uses `alias`. */
export function getAliasText(row: { alias_text?: string | null; alias?: string | null }): string {
  return (row.alias_text ?? row.alias ?? "").trim();
}
