import { expect, type Page, test } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const STUDIO_URL = process.env.AI_STUDIO_URL || "https://oasis-ai-studio.vercel.app";
const CENTRAL_URL = process.env.CENTRAL_URL || "https://cursor-central-vercel.vercel.app";

const ART = path.join(process.cwd(), "audit-artifacts", "product-authoring");
const SHOTS = path.join(ART, "screenshots");

type FlowMetrics = {
  system: "central" | "ai-studio";
  mode: "gate" | "authenticated-dry-run";
  authenticated: boolean;
  finalUrl: string;
  clickCount: number;
  manualFieldsEntered: number;
  visibleFormControls: number;
  prefilledControls: number;
  tabOrSectionNavigations: number;
  timeToFormReadyMs: number | null;
  timeToMinFillMs: number | null;
  savedProduct: boolean;
  screenshots: string[];
  notes: string[];
};

type AuditReport = {
  generatedAt: string;
  studioUrl: string;
  centralUrl: string;
  hasStudioAuth: boolean;
  hasCentralAuth: boolean;
  flows: FlowMetrics[];
  referencePath: typeof REFERENCE_PATH;
};

const REFERENCE_PATH = {
  central: {
    route: "/admin/products",
    createControl: "Add New Product",
    layout: "single slide-out panel, 6 scroll sections",
    emptyFormFieldCount: 47,
    prefilledDefaults: [
      "category (first option)",
      "storage_type ambient",
      "shelf_life 90",
      "hsn_code 19059090",
      "gst_percentage 18",
      "dietary_tags Eggless",
      "uom Kg",
      "settlement_unit KG",
      "moq 1",
      "is_active true",
      "visible_in_catalog true",
      "product_family bulk_sweets",
    ],
    minAdminSaveFields: ["name", "wholesale_price", "production_department"],
    activeKgExtras: ["grams_per_piece", "weight_per_box_kg"],
    aiFeatures: [
      "Generate AI Details (HSN, GST, allergens, ingredients)",
      "Generate AI Aliases (oasis-ai-chat)",
      "AI description stub",
      "Nutrition placeholder template",
    ],
    estimatedMinClicks: 3,
    estimatedMinManualFields: 5,
    estimatedTypicalManualFields: 12,
  },
  aiStudio: {
    route: "/products/new",
    createControl: "Full editor",
    layout: "full-page editor, up to 12 tabs (class-dependent)",
    emptyFormFieldCount: 72,
    prefilledDefaults: [
      "currency INR",
      "is_active true",
      "is_catalogue_ready false",
      "sku_locked true",
    ],
    minAdminSaveFields: [
      "product_name",
      "product_class",
      "sku (4 code picks + generate)",
      "main_department",
      "production_department (if ready_goods_store)",
    ],
    contributorMinFields: ["product_name", "product_class", "product_type or category"],
    aiFeatures: [
      "SkuBuilder RPC generate_oasis_sku",
      "AliasManager heuristic seed (not LLM)",
      "ComplianceAiPanel exists but unwired on ProductEdit",
    ],
    estimatedMinClicks: 11,
    estimatedMinManualFields: 8,
    estimatedTypicalManualFields: 18,
  },
} as const;

function ensureDirs() {
  fs.mkdirSync(SHOTS, { recursive: true });
}

function shotPath(system: string, name: string) {
  return path.join(SHOTS, `${system}-${name}.png`);
}

async function snap(page: Page, system: string, name: string, shots: string[]) {
  const file = shotPath(system, name);
  await page.screenshot({ path: file, fullPage: true });
  shots.push(path.relative(process.cwd(), file));
}

function writeReport(report: AuditReport) {
  fs.mkdirSync(ART, { recursive: true });
  const out = path.join(ART, "metrics.json");
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
}

async function instrumentClicks(page: Page): Promise<{ getCount: () => number }> {
  let count = 0;
  await page.exposeFunction("__auditClick", () => {
    count += 1;
  });
  await page.addInitScript(() => {
    document.addEventListener(
      "click",
      () => {
        // @ts-expect-error injected
        window.__auditClick?.();
      },
      true,
    );
  });
  return { getCount: () => count };
}

async function countFormControls(page: Page) {
  return page.evaluate(() => {
    const controls = Array.from(
      document.querySelectorAll<HTMLElement>(
        'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), [role="combobox"]:not([aria-disabled="true"])',
      ),
    );
    const prefilled = controls.filter((el) => {
      if (el instanceof HTMLInputElement) {
        if (el.type === "checkbox" || el.type === "radio") return el.checked;
        return (el.value ?? "").trim().length > 0;
      }
      if (el instanceof HTMLTextAreaElement) return (el.value ?? "").trim().length > 0;
      if (el instanceof HTMLSelectElement)
        return el.selectedIndex > 0 || (el.value ?? "").trim().length > 0;
      const text = el.textContent?.trim() ?? "";
      return text.length > 0 && !text.includes("Select");
    });
    return { visibleFormControls: controls.length, prefilledControls: prefilled.length };
  });
}

async function loginStudio(page: Page, email: string, password: string) {
  await page.goto(`${STUDIO_URL}/auth`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL((url) => !url.pathname.includes("/auth"), { timeout: 45_000 });
}

async function loginCentral(page: Page, email: string, password: string) {
  await page.goto(`${CENTRAL_URL}/login`, { waitUntil: "domcontentloaded" });
  const emailTab = page.getByRole("button", { name: /email/i });
  if (await emailTab.isVisible().catch(() => false)) await emailTab.click();
  const emailInput = page
    .locator('input[type="email"], input[name="email"], input[autocomplete="username"]')
    .first();
  const passwordInput = page.locator('input[type="password"]').first();
  await emailInput.fill(email);
  await passwordInput.fill(password);
  const submit = page.getByRole("button", { name: /sign in|log in|continue/i }).first();
  await submit.click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 60_000 });
}

test.describe("Product authoring UX audit", () => {
  const flows: FlowMetrics[] = [];

  test.afterAll(() => {
    writeReport({
      generatedAt: new Date().toISOString(),
      studioUrl: STUDIO_URL,
      centralUrl: CENTRAL_URL,
      hasStudioAuth: !!(process.env.TEST_STUDIO_EMAIL && process.env.TEST_STUDIO_PASSWORD),
      hasCentralAuth: !!(process.env.TEST_CENTRAL_EMAIL && process.env.TEST_CENTRAL_PASSWORD),
      flows,
      referencePath: REFERENCE_PATH,
    });
  });

  test("AI Studio — unauthenticated gate", async ({ page }) => {
    ensureDirs();
    const screenshots: string[] = [];
    const notes: string[] = [];
    const tracker = await instrumentClicks(page);
    const t0 = Date.now();

    await page.goto(`${STUDIO_URL}/products`, { waitUntil: "networkidle" });
    await snap(page, "ai-studio", "01-products-redirect", screenshots);

    const finalUrl = page.url();
    const onAuth = finalUrl.includes("/auth");
    notes.push(
      onAuth
        ? "Redirects to /auth when unauthenticated (expected)."
        : `Unexpected URL: ${finalUrl}`,
    );

    await page.goto(`${STUDIO_URL}/products/new`, { waitUntil: "networkidle" });
    await snap(page, "ai-studio", "02-new-product-redirect", screenshots);

    const authControls = await countFormControls(page);
    const timeToFormReadyMs = Date.now() - t0;

    flows.push({
      system: "ai-studio",
      mode: "gate",
      authenticated: false,
      finalUrl: page.url(),
      clickCount: tracker.getCount(),
      manualFieldsEntered: 0,
      visibleFormControls: authControls.visibleFormControls,
      prefilledControls: authControls.prefilledControls,
      tabOrSectionNavigations: 0,
      timeToFormReadyMs,
      timeToMinFillMs: null,
      savedProduct: false,
      screenshots,
      notes,
    });

    expect(onAuth || finalUrl.includes("/auth")).toBeTruthy();
  });

  test("Central — unauthenticated gate", async ({ page }) => {
    ensureDirs();
    const screenshots: string[] = [];
    const notes: string[] = [];
    const tracker = await instrumentClicks(page);
    const t0 = Date.now();

    await page.goto(`${CENTRAL_URL}/admin/products`, { waitUntil: "networkidle" });
    await snap(page, "central", "01-admin-products-redirect", screenshots);

    const finalUrl = page.url();
    const onLogin = finalUrl.includes("/login");
    notes.push(
      onLogin
        ? "Redirects to /login when unauthenticated (expected)."
        : `Unexpected URL: ${finalUrl}`,
    );

    const loginControls = await countFormControls(page);
    const timeToFormReadyMs = Date.now() - t0;

    flows.push({
      system: "central",
      mode: "gate",
      authenticated: false,
      finalUrl,
      clickCount: tracker.getCount(),
      manualFieldsEntered: 0,
      visibleFormControls: loginControls.visibleFormControls,
      prefilledControls: loginControls.prefilledControls,
      tabOrSectionNavigations: 0,
      timeToFormReadyMs,
      timeToMinFillMs: null,
      savedProduct: false,
      screenshots,
      notes,
    });

    expect(onLogin).toBeTruthy();
  });

  test("AI Studio — authenticated dry-run (optional)", async ({ page }) => {
    const email = process.env.TEST_STUDIO_EMAIL;
    const password = process.env.TEST_STUDIO_PASSWORD;
    test.skip(
      !email || !password,
      "Set TEST_STUDIO_EMAIL and TEST_STUDIO_PASSWORD for live authoring metrics",
    );

    ensureDirs();
    const screenshots: string[] = [];
    const notes: string[] = ["Dry-run: does not persist product unless PRODUCT_AUTHORING_SAVE=1"];
    const tracker = await instrumentClicks(page);
    const stamp = Date.now();
    let manualFieldsEntered = 0;
    let tabNav = 0;

    const t0 = Date.now();
    await loginStudio(page, email!, password!);
    await page.goto(`${STUDIO_URL}/products`, { waitUntil: "networkidle" });
    await snap(page, "ai-studio", "03-products-list-auth", screenshots);

    // Use the route as the durable UI contract. The visible label has changed from
    // "New Product" to "Full editor", but the canonical authoring URL is stable.
    const fullEditorLink = page.locator('a[href="/products/new"]');
    await expect(
      fullEditorLink,
      "Products must expose the canonical Full editor link",
    ).toBeVisible();
    await fullEditorLink.click();
    await page.waitForURL(/\/products\/new/, { timeout: 30_000 });
    const timeToFormReadyMs = Date.now() - t0;
    await snap(page, "ai-studio", "04-new-product-form", screenshots);

    const fill = async (label: string | RegExp, value: string) => {
      const field = page.getByLabel(label);
      if (await field.count()) {
        await field.fill(value);
        manualFieldsEntered += 1;
      }
    };

    await fill(/product name/i, `UX Audit Baklawa ${stamp}`);
    await fill(/product type/i, "Baklawa");

    const classTrigger = page
      .locator('[id*="product_class"], button:has-text("Product class")')
      .first();
    if (await classTrigger.isVisible().catch(() => false)) {
      await classTrigger.click();
      await page.getByRole("option").first().click();
      manualFieldsEntered += 1;
      tabNav += 1;
    } else {
      const classSelect = page
        .locator("select")
        .filter({ hasText: /bulk|ready|gift/i })
        .first();
      if (await classSelect.count()) {
        await classSelect.selectOption({ index: 1 });
        manualFieldsEntered += 1;
      }
    }

    for (const tab of ["UOM", "Compliance", "Ops"]) {
      const tabBtn = page.getByRole("tab", { name: new RegExp(tab, "i") });
      if (await tabBtn.isVisible().catch(() => false)) {
        await tabBtn.click();
        tabNav += 1;
      }
    }
    await snap(page, "ai-studio", "05-tabs-explored", screenshots);

    const deptSelect = page.getByLabel(/main department/i);
    if (await deptSelect.count()) {
      await deptSelect.selectOption({ index: 1 });
      manualFieldsEntered += 1;
    }

    const tFill0 = Date.now();
    const formStats = await countFormControls(page);
    const timeToMinFillMs = Date.now() - tFill0;

    const allowSave = process.env.PRODUCT_AUTHORING_SAVE === "1";
    let savedProduct = false;
    if (allowSave) {
      await page.getByRole("button", { name: /save|create/i }).click();
      savedProduct = true;
      notes.push("PRODUCT_AUTHORING_SAVE=1 — product may have been persisted.");
    } else {
      notes.push("Stopped before save (production-safe dry-run).");
    }

    flows.push({
      system: "ai-studio",
      mode: "authenticated-dry-run",
      authenticated: true,
      finalUrl: page.url(),
      clickCount: tracker.getCount(),
      manualFieldsEntered,
      visibleFormControls: formStats.visibleFormControls,
      prefilledControls: formStats.prefilledControls,
      tabOrSectionNavigations: tabNav,
      timeToFormReadyMs,
      timeToMinFillMs,
      savedProduct,
      screenshots,
      notes,
    });
  });

  test("Central — authenticated dry-run (optional)", async ({ page }) => {
    const email = process.env.TEST_CENTRAL_EMAIL;
    const password = process.env.TEST_CENTRAL_PASSWORD;
    test.skip(
      !email || !password,
      "Set TEST_CENTRAL_EMAIL and TEST_CENTRAL_PASSWORD for live authoring metrics",
    );

    ensureDirs();
    const screenshots: string[] = [];
    const notes: string[] = ["Dry-run: does not persist product unless PRODUCT_AUTHORING_SAVE=1"];
    const tracker = await instrumentClicks(page);
    const stamp = Date.now();
    let manualFieldsEntered = 0;

    const t0 = Date.now();
    await loginCentral(page, email!, password!);
    await page.goto(`${CENTRAL_URL}/admin/products`, { waitUntil: "networkidle" });
    await snap(page, "central", "02-products-list-auth", screenshots);

    await page.getByRole("button", { name: /add new product/i }).click();
    await page
      .getByText(/identity|product name/i)
      .first()
      .waitFor({ timeout: 30_000 });
    const timeToFormReadyMs = Date.now() - t0;
    await snap(page, "central", "03-new-product-panel", screenshots);

    const nameInput = page
      .locator("input")
      .filter({
        has: page.locator('xpath=..//label[contains(.,"Product Name") or contains(.,"Name")]'),
      })
      .first();
    if (await nameInput.count()) {
      await nameInput.fill(`UX Audit Baklawa ${stamp}`);
    } else {
      await page.locator("input").first().fill(`UX Audit Baklawa ${stamp}`);
    }
    manualFieldsEntered += 1;

    const priceInput = page.getByLabel(/b2b|wholesale|base price/i).first();
    if (await priceInput.count()) {
      await priceInput.fill("999");
      manualFieldsEntered += 1;
    }

    const deptSelect = page.getByLabel(/target department|production department/i).first();
    if (await deptSelect.count()) {
      await deptSelect.selectOption({ index: 1 });
      manualFieldsEntered += 1;
    }

    const tFill0 = Date.now();
    const formStats = await countFormControls(page);
    const timeToMinFillMs = Date.now() - tFill0;

    const allowSave = process.env.PRODUCT_AUTHORING_SAVE === "1";
    let savedProduct = false;
    if (allowSave) {
      await page.getByRole("button", { name: /save product|save/i }).click();
      savedProduct = true;
      notes.push("PRODUCT_AUTHORING_SAVE=1 — product may have been persisted.");
    } else {
      notes.push("Stopped before save (production-safe dry-run).");
    }

    flows.push({
      system: "central",
      mode: "authenticated-dry-run",
      authenticated: true,
      finalUrl: page.url(),
      clickCount: tracker.getCount(),
      manualFieldsEntered,
      visibleFormControls: formStats.visibleFormControls,
      prefilledControls: formStats.prefilledControls,
      tabOrSectionNavigations: 0,
      timeToFormReadyMs,
      timeToMinFillMs,
      savedProduct,
      screenshots,
      notes,
    });
  });
});
