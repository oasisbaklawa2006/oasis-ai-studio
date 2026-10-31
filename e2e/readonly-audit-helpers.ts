import { type Browser, devices, type Page } from "@playwright/test";

export const STUDIO_URL = process.env.AI_STUDIO_URL || "https://oasis-ai-studio.vercel.app";
export const EMAIL = process.env.TEST_STUDIO_EMAIL || "";
export const PASSWORD = process.env.TEST_STUDIO_PASSWORD || "";
export const EXPECTED_DEPLOYMENT_SHA = process.env.EXPECTED_DEPLOYMENT_SHA || "";

export type PlaywrightNamedDevice = keyof typeof devices;

export async function createStudioContext(
  browser: Browser,
  playwrightDevice: PlaywrightNamedDevice,
) {
  const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  const studioOrigin = new URL(STUDIO_URL).origin;
  const context = await browser.newContext({
    ...devices[playwrightDevice],
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: bypassSecret ? { "x-vercel-protection-bypass": bypassSecret } : undefined,
  });
  if (bypassSecret) {
    await context.route(`${studioOrigin}/**`, async (route) => {
      await route.continue({
        headers: {
          ...route.request().headers(),
          "x-vercel-protection-bypass": bypassSecret,
        },
      });
    });
  }
  return context;
}

export async function readDeployedCommit(page: Page): Promise<string | null> {
  return page
    .locator('meta[name="oasis-build-commit"]')
    .getAttribute("content")
    .catch(() => null);
}

export async function waitForExpectedDeployment(page: Page): Promise<string | null> {
  if (!EXPECTED_DEPLOYMENT_SHA) {
    return readDeployedCommit(page);
  }
  const deploymentDeadline = Date.now() + 8 * 60_000;
  let deployedCommit: string | null = null;
  for (;;) {
    await page.goto(`${STUDIO_URL}/auth`, { waitUntil: "domcontentloaded" });
    deployedCommit = await readDeployedCommit(page);
    if (deployedCommit === EXPECTED_DEPLOYMENT_SHA) break;
    if (Date.now() >= deploymentDeadline) {
      throw new Error(
        `Expected deployment ${EXPECTED_DEPLOYMENT_SHA}, found ${deployedCommit ?? "no build identity"}`,
      );
    }
    await page.waitForTimeout(10_000);
  }
  return deployedCommit;
}

export async function loginStudio(page: Page): Promise<{
  authResult: "authenticated" | "redirected_to_auth";
  deploymentSha: string | null;
  shaBindingOk: boolean;
}> {
  if (!EMAIL || !PASSWORD) {
    throw new Error("TEST_STUDIO_EMAIL and TEST_STUDIO_PASSWORD are required");
  }
  const deploymentSha = await waitForExpectedDeployment(page);
  const shaBindingOk = !EXPECTED_DEPLOYMENT_SHA || deploymentSha === EXPECTED_DEPLOYMENT_SHA;
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL((url) => !url.pathname.includes("/auth"), { timeout: 60_000 });
  const redirectedToAuth = page.url().includes("/auth");
  return {
    authResult: redirectedToAuth ? "redirected_to_auth" : "authenticated",
    deploymentSha,
    shaBindingOk,
  };
}

export function safeScreenshotName(uatId: string, uiState: string) {
  return `${uatId.toLowerCase().replace(/[^a-z0-9]+/g, "-")}--${uiState}`;
}
