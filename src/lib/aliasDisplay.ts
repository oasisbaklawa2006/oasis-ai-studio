/** Central uses `alias_text`; repo dev schema uses `alias`. */
export function getAliasText(row: { alias_text?: string | null; alias?: string | null }): string {
  return (row.alias_text ?? row.alias ?? "").trim();
}

export function hasAliasActiveFlag(row: Record<string, unknown>): boolean {
  return typeof row.is_active === "boolean";
}
