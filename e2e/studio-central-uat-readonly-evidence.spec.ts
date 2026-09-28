import * as fs from "node:fs";
import * as path from "node:path";
import { expect, test } from "@playwright/test";
import { collectReadOnlyUatContractViolations } from "../src/features/uatEvidence/readOnlyUatAuditContract";
import {
  STUDIO_CENTRAL_UAT_EVIDENCE_CASES,
  type StudioCentralUatCase,
  type UatEvidenceVerdict,
} from "../src/features/uatEvidence/studioCentralUatRegistry";
import {
  createStudioContext,
  loginStudio,
  STUDIO_URL,
  safeScreenshotName,
} from "./readonly-audit-helpers";

const ROOT = path.join(process.cwd(), "audit-artifacts", "full-app");
const SHOTS = path.join(ROOT, "screenshots", "uat-central");
const REPORT_JSON = path.join(ROOT, "studio-central-uat-evidence.json");
const REPORT_MD = path.join(ROOT, "STUDIO_CENTRAL_UAT_EVIDENCE.md");

type UatEvidenceRow = {
  uatId: string;
  route: string;
  uiState: string;
  deviceProfile: string;
  viewport: { width: number; height: number };
  finalUrl: string;
  deploymentSha: string | null;
  expectedDeploymentSha: string | null;
  shaBindingOk: boolean;
  authResult: "authenticated" | "redirected_to_auth" | "access_denied";
  verdict: UatEvidenceVerdict;
  consoleErrors: string[];
  networkFailures: string[];
  persistenceViolations: string[];
  screenshot: string;
  notes: string[];
  physicalDeviceCertification: "browser-emulated-only" | "not-applicable";
};

const evidenceRows: UatEvidenceRow[] = [];

function deriveVerdict(input: {
  shaBindingOk: boolean;
  authResult: UatEvidenceRow["authResult"];
  fatal: boolean;
  inaccessible: boolean;
  persistenceViolations: string[];
  cameraFlowOk: boolean;
  uiState: string;
}): UatEvidenceVerdict {
  if (!input.shaBindingOk) return "FAIL";
  if (input.persistenceViolations.length > 0) return "FAIL";
  if (input.authResult === "redirected_to_auth") return "BLOCKED";
  if (input.inaccessible) return "BLOCKED";
  if (input.fatal) return "FAIL";
  if (input.uiState === "camera-capture-flow" && !input.cameraFlowOk) return "FAIL";
  return "PASS";
}

async function collectRouteSignals(page: import("@playwright/test").Page) {
  const consoleErrors: string[] = [];
  const networkFailures: string[] = [];
  const persistenceRequests: { method: string; url: string }[] = [];

  const consoleListener = (message: { type: () => string; text: () => string }) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  };
  const responseListener = (response: {
    status: () => number;
    url: () => string;
    request: () => { method: () => string };
  }) => {
    const method = response.request().method();
    const url = response.url();
    persistenceRequests.push({ method, url });
    if (response.status() >= 400) networkFailures.push(`${response.status()} ${url}`);
  };

  page.on("console", consoleListener);
  page.on("response", responseListener);

  return {
    finish: () => {
      page.off("console", consoleListener);
      page.off("response", responseListener);
      return {
        consoleErrors: [...new Set(consoleErrors)],
        networkFailures: [...new Set(networkFailures)],
        persistenceViolations: collectReadOnlyUatContractViolations(persistenceRequests),
      };
    },
  };
}

async function exerciseCase(
  page: import("@playwright/test").Page,
  caseRow: StudioCentralUatCase,
  loginMeta: {
    authResult: "authenticated" | "redirected_to_auth";
    deploymentSha: string | null;
    shaBindingOk: boolean;
  },
) {
  const signals = await collectRouteSignals(page);
  const notes: string[] = [];
  let cameraFlowOk = true;

  try {
    await page.goto(`${STUDIO_URL}${caseRow.pathname}`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await page.waitForTimeout(1_500);
  } catch (error) {
    notes.push(`Navigation error: ${String(error)}`);
  }

  if (caseRow.uiState === "camera-capture-flow") {
    notes.push(
      "Browser-emulated phone evidence only — physical camera/device certification is a separate gate.",
    );
    const addMedia = page.getByRole("button", { name: /add media/i });
    if (!(await addMedia.isVisible().catch(() => false))) {
      cameraFlowOk = false;
      notes.push(
        "Add Media control not visible — cannot evidence camera-capture UI without mutation rights.",
      );
    } else {
      await addMedia.click();
      await page.waitForTimeout(500);
      const takePhoto = page.getByRole("button", { name: /take photo/i });
      const takePhotoVisible = await takePhoto.isVisible().catch(() => false);
      const captureInput = page.locator('input[type="file"][capture="environment"]');
      const capturePresent = (await captureInput.count()) > 0;
      cameraFlowOk = takePhotoVisible && capturePresent;
      if (!takePhotoVisible) notes.push("Take photo control not visible in upload dialog.");
      if (!capturePresent) notes.push("Camera capture file input not present in DOM.");
      notes.push("Did not click Take photo or activate file/camera picker (read-only contract).");
    }
  }

  if (caseRow.uatId === "UAT-0125") {
    const controls = await page.locator("input, textarea, select, [role=combobox]").count();
    if (controls > 0) {
      const name = page.getByLabel(/product name/i).first();
      if (await name.isVisible().catch(() => false)) {
        await name.fill("E2E READ ONLY — DO NOT SAVE");
      }
      notes.push(
        "Fast Create controls exercised read-only; no Create Product Draft action executed.",
      );
    }
  }

  const body = await page
    .locator("body")
    .innerText()
    .catch(() => "");
  const finalUrl = page.url();
  const overlay = await page
    .locator("[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay")
    .count();
  const inaccessible =
    /\/auth(?:\?|$)/.test(finalUrl) || /access denied|permission required/i.test(body);
  const fatal =
    overlay > 0 ||
    body.trim().length === 0 ||
    /404|page not found|something went wrong/i.test(body);

  if (inaccessible)
    notes.push("Authenticated user lacks access or was redirected to authentication.");
  if (fatal) notes.push("Blank, error-overlay, not-found, or fatal-error state detected.");

  const viewport = page.viewportSize() ?? { width: 0, height: 0 };
  const screenshotPath = path.join(
    SHOTS,
    `${safeScreenshotName(caseRow.uatId, caseRow.uiState)}.png`,
  );
  await page.screenshot({ path: screenshotPath, fullPage: false }).catch(() => undefined);

  const { consoleErrors, networkFailures, persistenceViolations } = signals.finish();

  const authResult: UatEvidenceRow["authResult"] = inaccessible
    ? finalUrl.includes("/auth")
      ? "redirected_to_auth"
      : "access_denied"
    : "authenticated";

  return {
    uatId: caseRow.uatId,
    route: caseRow.pathname,
    uiState: caseRow.uiState,
    deviceProfile: caseRow.deviceProfile,
    viewport,
    finalUrl,
    deploymentSha: loginMeta.deploymentSha,
    expectedDeploymentSha: process.env.EXPECTED_DEPLOYMENT_SHA || null,
    shaBindingOk: loginMeta.shaBindingOk,
    authResult,
    verdict: deriveVerdict({
      shaBindingOk: loginMeta.shaBindingOk,
      authResult,
      fatal,
      inaccessible,
      persistenceViolations,
      cameraFlowOk,
      uiState: caseRow.uiState,
    }),
    consoleErrors,
    networkFailures,
    persistenceViolations,
    screenshot: path.relative(process.cwd(), screenshotPath),
    notes,
    physicalDeviceCertification:
      caseRow.uiState === "camera-capture-flow" ? "browser-emulated-only" : "not-applicable",
  } satisfies UatEvidenceRow;
}

function writeReports() {
  fs.mkdirSync(ROOT, { recursive: true });
  const report = {
    generatedAt: new Date().toISOString(),
    target: STUDIO_URL,
    safety:
      "Read-only UAT evidence for Central census UAT-0122..0127; no persistence controls activated.",
    expectedDeploymentSha: process.env.EXPECTED_DEPLOYMENT_SHA || null,
    cases: STUDIO_CENTRAL_UAT_EVIDENCE_CASES,
    evidence: evidenceRows,
    summary: {
      pass: evidenceRows.filter((row) => row.verdict === "PASS").length,
      fail: evidenceRows.filter((row) => row.verdict === "FAIL").length,
      blocked: evidenceRows.filter((row) => row.verdict === "BLOCKED").length,
      notTested: evidenceRows.filter((row) => row.verdict === ("NOT-TESTED" as UatEvidenceVerdict))
        .length,
    },
  };
  fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2));

  const table = evidenceRows.map(
    (row) =>
      `| ${row.uatId} | \`${row.route}\` | ${row.uiState} | ${row.deviceProfile} | ${row.verdict} | ${row.deploymentSha ?? "—"} | ${row.authResult} | ${row.consoleErrors.length} | ${row.networkFailures.length} | ${row.persistenceViolations.length} |`,
  );
  fs.writeFileSync(
    REPORT_MD,
    [
      "# AI Studio — Central census UAT evidence (UAT-0122..0127)",
      "",
      `Generated: ${report.generatedAt}`,
      `Target: ${STUDIO_URL}`,
      "",
      "| UAT ID | Route | UI state | Device | Verdict | Deployment SHA | Auth | Console errs | Network errs | Persistence violations |",
      "|---|---|---|---|---|---|---|---:|---:|---:|",
      ...table,
      "",
      "Physical camera/device certification is **not** claimed by browser-emulated phone evidence (UAT-0127).",
    ].join("\n"),
  );
}

test.describe.configure({ mode: "serial" });

test.describe("Central census UAT read-only evidence", () => {
  test.beforeAll(() => {
    fs.mkdirSync(SHOTS, { recursive: true });
  });

  test.afterAll(writeReports);

  for (const caseRow of STUDIO_CENTRAL_UAT_EVIDENCE_CASES) {
    test(`${caseRow.uatId} ${caseRow.pathname} (${caseRow.uiState}, ${caseRow.deviceProfile})`, async ({
      browser,
    }) => {
      const context = await createStudioContext(browser, caseRow.playwrightDevice);
      const page = await context.newPage();
      const loginMeta = await loginStudio(page);
      expect(loginMeta.authResult).toBe("authenticated");

      const row = await exerciseCase(page, caseRow, loginMeta);
      evidenceRows.push(row);
      await context.close();

      if (row.verdict === "FAIL") {
        expect.soft(row.verdict, row.notes.join("; ")).toBe("PASS");
      }
    });
  }
});
