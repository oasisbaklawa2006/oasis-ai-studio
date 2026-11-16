import type { BrowserContext, Page } from "@playwright/test";
import {
  approvedStudioOrigin,
  verifyProtectedStudioAudit,
} from "../scripts/verify-studio-audit-target.mjs";

/**
 * Fail-closed audit transport. Browser requests never receive the Vercel bypass
 * header. The Node-side route.fetch follows zero redirects, so a 302 to a
 * foreign host cannot carry the bypass secret to that host.
 */
export async function installStudioAuditRouting(
  context: BrowserContext,
  additionalNavigationOrigins: string[] = [],
): Promise<void> {
  const studioOrigin = approvedStudioOrigin(process.env);
  const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (bypassSecret || process.env.TEST_STUDIO_PASSWORD) {
    verifyProtectedStudioAudit(process.env);
  }
  const allowedNavigation = new Set([studioOrigin, ...additionalNavigationOrigins]);

  await context.route("**/*", async (route) => {
    const request = route.request();
    let origin: string;
    try {
      origin = new URL(request.url()).origin;
    } catch {
      await route.abort("blockedbyclient");
      return;
    }

    if (request.isNavigationRequest() && !allowedNavigation.has(origin)) {
      await route.abort("blockedbyclient");
      return;
    }

    if (bypassSecret && origin === studioOrigin) {
      // Unlike route.continue({headers}), fetch(maxRedirects:0) never forwards
      // the injected header along an HTTP redirect to a different origin.
      const response = await route.fetch({
        headers: { ...request.headers(), "x-vercel-protection-bypass": bypassSecret },
        maxRedirects: 0,
      });
      await route.fulfill({ response });
      return;
    }
    await route.continue();
  });
}

export function assertStudioPageOrigin(page: Page): void {
  if (new URL(page.url()).origin !== approvedStudioOrigin(process.env)) {
    throw new Error("BLOCKED: Studio login page left the approved origin");
  }
}

export async function assertExpectedStudioDeployment(page: Page): Promise<void> {
  const expected = process.env.EXPECTED_DEPLOYMENT_SHA;
  if (!expected || !/^[0-9a-f]{40}$/i.test(expected)) {
    throw new Error("BLOCKED: protected audit requires exact expected deployment SHA");
  }
  assertStudioPageOrigin(page);
  const observed = await page
    .locator('meta[name="oasis-build-commit"]')
    .getAttribute("content", { timeout: 5_000 });
  if (observed !== expected) {
    throw new Error("BLOCKED: Studio deployment SHA does not match the approved main ref");
  }
}
