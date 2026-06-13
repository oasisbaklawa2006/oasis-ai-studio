const STORAGE_KEY = "oasis_pilot_alias_review_v1";

export type StoredPilotReview = Record<string, "suggested" | "approved" | "rejected">;

export function loadPilotAliasReview(): StoredPilotReview {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function savePilotAliasReview(map: StoredPilotReview) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function setPilotTermReview(
  termId: string,
  status: "suggested" | "approved" | "rejected",
): StoredPilotReview {
  const map = loadPilotAliasReview();
  map[termId] = status;
  savePilotAliasReview(map);
  return map;
}

export function clearPilotAliasReview() {
  localStorage.removeItem(STORAGE_KEY);
}
