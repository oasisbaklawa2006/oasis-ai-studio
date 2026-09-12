import { expect, test } from "@playwright/test";

const EMAIL = process.env.TEST_STUDIO_EMAIL || "";
const PASSWORD = process.env.TEST_STUDIO_PASSWORD || "";
const MOBILE_VIEWPORT = { width: 390, height: 844 };

async function loginIfNeeded(page: import("@playwright/test").Page) {
  if (!EMAIL || !PASSWORD) {
    test.skip(true, "TEST_STUDIO_EMAIL and TEST_STUDIO_PASSWORD required for authenticated mobile audit");
  }
  await page.goto("/auth");
  await page.getByLabel(/email/i).fill(EMAIL);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 60_000 });
}

test.describe("Point 51 — mobile Fast Create product draft authority", () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test("390px viewport — Fast Create has no horizontal overflow", async ({ page }) => {
    await loginIfNeeded(page);
    await page.goto("/products/new/fast");
    await expect(page.getByRole("heading", { name: /fast create/i })).toBeVisible({
      timeout: 30_000,
    });

    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth > doc.clientWidth + 2;
    });
    expect(overflow, "Fast Create must not overflow horizontally at 390px").toBe(false);
  });

  test("390px viewport — mobile product create banner and intake tabs visible", async ({ page }) => {
    await loginIfNeeded(page);
    await page.goto("/products/new/fast");

    await expect(page.getByTestId("mobile-product-create-banner")).toBeVisible();
    await expect(page.getByRole("button", { name: /barcode/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /ocr \/ image/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /voice/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /paste \/ text/i })).toBeVisible();
  });

  test("390px viewport — governed draft submit control present", async ({ page }) => {
    await loginIfNeeded(page);
    await page.goto("/products/new/fast");

    const submit = page.getByTestId("fast-create-submit-draft");
    await expect(submit).toBeVisible();
    await expect(submit).toHaveText(/create product draft/i);
  });

  test("390px viewport — Fast Create reachable from sidebar nav", async ({ page }) => {
    await loginIfNeeded(page);
    await page.goto("/products");
    await page.getByRole("button", { name: /menu/i }).click();
    await page.getByRole("link", { name: /fast create/i }).click();
    await expect(page).toHaveURL(/\/products\/new\/fast/);
    await expect(page.getByTestId("mobile-product-create-banner")).toBeVisible();
  });
});
