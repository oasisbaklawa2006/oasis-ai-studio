import { defineConfig, devices } from "@playwright/test";

const studioUrl = process.env.AI_STUDIO_URL || "https://oasis-ai-studio.vercel.app";
const vercelBypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/full-app-readonly-audit.spec.ts",
  timeout: 300_000,
  expect: { timeout: 30_000 },
  workers: 1,
  retries: 0,
  outputDir: "audit-artifacts/full-app/playwright-output",
  reporter: [["list"], ["json", { outputFile: "audit-artifacts/full-app/playwright-report.json" }]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: studioUrl,
    trace: vercelBypassSecret ? "off" : "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    ignoreHTTPSErrors: true,
  },
});
