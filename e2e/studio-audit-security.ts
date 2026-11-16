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
      console.warn(`[studio-audit] blocked navigation: unapproved origin ${origin}`);
      await route.abort("blockedbyclient");
      return;
    }

    if (request.isNavigationRequest() || (bypassSecret && origin === studioOrigin)) {
      // Unlike route.continue({headers}), fetch(maxRedirects:0) never forwards
      // the injected header along an HTTP redirect to a different origin.
      const headers = { ...request.headers() };
      if (bypassSecret && origin === studioOrigin) {
        headers["x-vercel-protection-bypass"] = bypassSecret;
      }
      let target = request.url();
      const navigation = request.isNavigationRequest();
      // Resolve same-origin redirects in Node. Never expose a redirect to
      // Chromium: Playwright may not intercept its follow-up request.
      for (let hop = 0; hop < 6; hop += 1) {
        const response = await route.fetch({ url: target, headers, maxRedirects: 0 });
        const status = response.status();
        if (status < 300 || status >= 400) {
          await route.fulfill({ response });
          return;
        }
        const location = response.headers().location;
        if (!location) {
          console.warn(
            `[studio-audit] blocked redirect: missing Location (HTTP ${status}, origin ${origin})`,
          );
          await route.abort("blockedbyclient");
          return;
        }
        let next: URL;
        try {
          next = new URL(location, target);
        } catch {
          console.warn(
            `[studio-audit] blocked redirect: invalid Location (HTTP ${status}, origin ${origin})`,
          );
          await route.abort("blockedbyclient");
          return;
        }
        if (
          !allowedNavigation.has(next.origin) ||
          next.origin !== origin ||
          next.protocol !== "https:"
        ) {
          console.warn(
            `[studio-audit] blocked redirect: ${origin} -> ${next.origin} (HTTP ${status}); destination origin not approved or not same-origin HTTPS`,
          );
          await route.abort("blockedbyclient");
          return;
        }
        if (navigation) {
          // Serve a synthetic navigation document, not the redirected response.
          // A meta refresh starts a NEW browser navigation at the validated URL,
          // so Chromium reports the correct destination and routing runs again.
          // Escape the URL to prevent HTML injection in the refresh attribute.
          const safeLocation = next.href
            .replaceAll("&", "&amp;")
            .replaceAll('"', "&quot;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;");
          await route.fulfill({
            status: 200,
            contentType: "text/html; charset=utf-8",
            headers: {
              "cache-control": "no-store",
              "content-security-policy": "default-src 'none'",
            },
            body: `<!doctype html><html><head><meta http-equiv="refresh" content="0;url=${safeLocation}"></head><body></body></html>`,
          });
          return;
        }
        target = next.href;
      }
      await route.abort("blockedbyclient");
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
  // Wait at most 90 seconds for Vercel promotion, below the 10-minute
  // product-authoring Playwright test timeout. Never enter credentials on a
  // stale or unidentified deployment.
  const deadline = Date.now() + 90_000;
  while (true) {
    assertStudioPageOrigin(page);
    const observed = await page
      .locator('meta[name="oasis-build-commit"]')
      .getAttribute("content", {
        timeout: 3_000,
      })
      .catch(() => null);
    if (observed === expected) return;
    if (Date.now() >= deadline) {
      throw new Error("BLOCKED: Studio deployment SHA does not match the approved main ref");
    }
    await page.waitForTimeout(3_000);
    await page.reload({ waitUntil: "domcontentloaded", timeout: 15_000 });
  }
}
