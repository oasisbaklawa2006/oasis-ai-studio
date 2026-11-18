import type { StudioAccessRow } from "@/features/studioAccess/studioAccessContract";

export type StudioDirectoryFilter = "all" | "unassigned" | "active" | "protected" | "inactive";

/** Pure presentation filter; Core's scoped directory RPC remains the only identity source. */
export function filterStudioDirectory(
  rows: readonly StudioAccessRow[],
  search: string,
  filter: StudioDirectoryFilter,
): StudioAccessRow[] {
  const query = search.trim().toLocaleLowerCase();
  return rows.filter((row) => {
    const owner = row.profile_keys.includes("owner");
    const coreAccepted =
      row.core_active && ["active", "accepted"].includes(row.invite_status ?? "");
    const matches =
      !query ||
      (row.display_name ?? "").toLocaleLowerCase().includes(query) ||
      (row.email ?? "").toLocaleLowerCase().includes(query);
    if (!matches) return false;
    switch (filter) {
      case "unassigned":
        return row.studio_status === "not_assigned" && !owner;
      case "active":
        return row.studio_status === "active";
      case "protected":
        return owner;
      case "inactive":
        return !coreAccepted;
      default:
        return true;
    }
  });
}
