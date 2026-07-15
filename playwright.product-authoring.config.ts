import { defineConfig, devices } from "@playwright/test";

const studioUrl = process.env.AI_STUDIO_URL || "https://oasis-ai-studio.vercel.app";
const centralUrl = process.env.CENTRAL_URL || "https://cursor-central-vercel.vercel.app";
const vercelBypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

/**
 * Product authoring UX audit — Central vs AI Studio.
 * Run: npm run test:product-authoring-audit
 *
 * Optional env (authenticated dry-run; no production save unless PRODUCT_AUTHORING_SAVE=1):
 *   TEST_STUDIO_EMAIL, TEST_STUDIO_PASSWORD
 *   TEST_CENTRAL_EMAIL, TEST_CENTRAL_PASSWORD
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/product-authoring-ux-audit.spec.ts",
  timeout: 600_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: "audit-artifacts/product-authoring/playwright-output",
  reporter: [
    ["list"],
    ["json", { outputFile: "audit-artifacts/product-authoring/playwright-report.json" }],
  ],
  use: {
    browserName: "chromium",
    // Playwright traces persist request headers. Never record a live Vercel
    // automation-bypass secret in an uploaded CI artifact.
    trace: vercelBypassSecret ? "off" : "retain-on-failure",
    screenshot: "off",
    video: "off",
    actionTimeout: 25_000,
    navigationTimeout: 60_000,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: vercelBypassSecret
      ? { "x-vercel-protection-bypass": vercelBypassSecret }
      : undefined,
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
  metadata: { studioUrl, centralUrl },
});
