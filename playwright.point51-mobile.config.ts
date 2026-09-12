import { defineConfig, devices } from "@playwright/test";

const studioUrl = process.env.AI_STUDIO_URL || "https://oasis-ai-studio.vercel.app";
const vercelBypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/point51-mobile-fast-create.spec.ts",
  timeout: 120_000,
  expect: { timeout: 30_000 },
  workers: 1,
  retries: 0,
  outputDir: "audit-artifacts/point51-mobile/playwright-output",
  reporter: [
    ["list"],
    ["json", { outputFile: "audit-artifacts/point51-mobile/playwright-report.json" }],
  ],
  use: {
    ...devices["iPhone 14"],
    viewport: { width: 390, height: 844 },
    baseURL: studioUrl,
    trace: vercelBypassSecret ? "off" : "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: vercelBypassSecret
      ? { "x-vercel-protection-bypass": vercelBypassSecret }
      : {},
  },
});
