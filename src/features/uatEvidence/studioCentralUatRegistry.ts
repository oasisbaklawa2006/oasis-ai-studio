/**
 * Central census — dedicated AI Studio UAT-ID mapping (read-only evidence lane).
 * Stable identifiers for UAT-0122..UAT-0127; do not renumber without Mission Control update.
 */

export type UatEvidenceVerdict = "PASS" | "FAIL" | "BLOCKED" | "NOT-TESTED";

export type StudioCentralUatUiState = "default" | "camera-capture-flow";

export type StudioCentralUatDeviceProfile = "desktop" | "phone";

export type StudioCentralUatPlaywrightDevice = "Desktop Chrome" | "iPhone 13";

export type StudioCentralUatCase = {
  uatId: "UAT-0122" | "UAT-0123" | "UAT-0124" | "UAT-0125" | "UAT-0126" | "UAT-0127";
  pathname: string;
  uiState: StudioCentralUatUiState;
  deviceProfile: StudioCentralUatDeviceProfile;
  playwrightDevice: StudioCentralUatPlaywrightDevice;
  summary: string;
};

export const STUDIO_CENTRAL_UAT_EVIDENCE_CASES: readonly StudioCentralUatCase[] = [
  {
    uatId: "UAT-0122",
    pathname: "/",
    uiState: "default",
    deviceProfile: "desktop",
    playwrightDevice: "Desktop Chrome",
    summary: "Dashboard landing — desktop read-only route load",
  },
  {
    uatId: "UAT-0123",
    pathname: "/media",
    uiState: "default",
    deviceProfile: "phone",
    playwrightDevice: "iPhone 13",
    summary: "Media library — phone viewport read-only route load",
  },
  {
    uatId: "UAT-0124",
    pathname: "/media/review",
    uiState: "default",
    deviceProfile: "desktop",
    playwrightDevice: "Desktop Chrome",
    summary: "Media review governance desk — desktop read-only route load",
  },
  {
    uatId: "UAT-0125",
    pathname: "/products/new/fast",
    uiState: "default",
    deviceProfile: "desktop",
    playwrightDevice: "Desktop Chrome",
    summary: "Fast Create — desktop read-only surface (no draft save)",
  },
  {
    uatId: "UAT-0126",
    pathname: "/testing/pilot-readiness",
    uiState: "default",
    deviceProfile: "desktop",
    playwrightDevice: "Desktop Chrome",
    summary: "Pilot readiness testing route — desktop read-only load",
  },
  {
    uatId: "UAT-0127",
    pathname: "/media",
    uiState: "camera-capture-flow",
    deviceProfile: "phone",
    playwrightDevice: "iPhone 13",
    summary:
      "Media upload dialog camera UI — browser-emulated phone only; not physical-device certification",
  },
] as const;

export const STUDIO_CENTRAL_UAT_IDS: readonly StudioCentralUatCase["uatId"][] =
  STUDIO_CENTRAL_UAT_EVIDENCE_CASES.map((caseRow) => caseRow.uatId);

export function getStudioCentralUatCase(uatId: string): StudioCentralUatCase | undefined {
  return STUDIO_CENTRAL_UAT_EVIDENCE_CASES.find((caseRow) => caseRow.uatId === uatId);
}

export function assertStudioCentralUatRegistry(): void {
  const ids = STUDIO_CENTRAL_UAT_EVIDENCE_CASES.map((c) => c.uatId);
  const unique = new Set(ids);
  if (unique.size !== ids.length) {
    throw new Error("Duplicate UAT IDs in studio central registry");
  }
  if (ids.length !== 6) {
    throw new Error(`Expected 6 central UAT cases, found ${ids.length}`);
  }
  for (const caseRow of STUDIO_CENTRAL_UAT_EVIDENCE_CASES) {
    if (!caseRow.pathname.startsWith("/")) {
      throw new Error(`Invalid pathname for ${caseRow.uatId}`);
    }
  }
}
