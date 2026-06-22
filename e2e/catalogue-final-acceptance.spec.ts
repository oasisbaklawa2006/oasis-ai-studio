import { test, expect, type Page, type TestInfo } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const STUDIO_URL = process.env.AI_STUDIO_URL || 'https://oasis-ai-studio.vercel.app';
const EMAIL = process.env.TEST_STUDIO_EMAIL ?? '';
const PASSWORD = process.env.TEST_STUDIO_PASSWORD ?? '';
const HERO_IMAGE = path.join(process.cwd(), 'e2e/fixtures/test-hero.png');
const REPORT_PATH = path.join(process.cwd(), 'test-results/catalogue-final-acceptance-report.md');
const SHOTS_DIR = path.join(process.cwd(), 'test-results/catalogue-acceptance-screenshots');

type SkuConfig = {
  division: string;
  category: string;
  subcategory: string;
  packaging: string;
};

type ProductConfig = {
  name: string;
  productClass: string;
  productType: string;
  displayCategory: string;
  sku: SkuConfig;
  alias: string;
  aliasSearch: string;
};

type StepResult = {
  step: string;
  pass: boolean;
  detail?: string;
};

type ProductResult = {
  name: string;
  pass: boolean;
  sku: string;
  productId: string;
  steps: StepResult[];
  screenshot?: string;
  consoleErrors: string[];
  networkErrors: string[];
  severity: 'P0' | 'P1' | 'P2' | 'P3' | 'none';
};

const ACCEPTANCE_PRODUCTS: ProductConfig[] = [
  {
    name: 'Classic Pistachio Assiyah Bulk',
    productClass: 'bulk_loose_product',
    productType: 'Baklawa',
    displayCategory: 'Baklawa',
    sku: { division: 'AS', category: 'BKL', subcategory: 'PST', packaging: 'BULK' },
    alias: 'Pista Assiyah Bulk',
    aliasSearch: 'Pista Assiyah',
  },
  {
    name: 'Classic Pistachio Midya Bulk',
    productClass: 'bulk_loose_product',
    productType: 'Baklawa',
    displayCategory: 'Baklawa',
    sku: { division: 'AS', category: 'BKL', subcategory: 'PST', packaging: 'BULK' },
    alias: 'Midya Bulk Pista',
    aliasSearch: 'Midya Bulk',
  },
  {
    name: 'Classic Pistachio Midya Gift Pack 6 pcs',
    productClass: 'ready_pack',
    productType: 'Baklawa',
    displayCategory: 'Baklawa',
    sku: { division: 'AS', category: 'BKL', subcategory: 'PST', packaging: 'RBOX' },
    alias: 'Midya Gift 6',
    aliasSearch: 'Midya Gift',
  },
  {
    name: 'Cashew Tart Bulk',
    productClass: 'bulk_loose_product',
    productType: 'Baklawa',
    displayCategory: 'Baklawa',
    sku: { division: 'AS', category: 'BKL', subcategory: 'CSH', packaging: 'BULK' },
    alias: 'Kaju Tart Bulk',
    aliasSearch: 'Kaju Tart',
  },
  {
    name: 'Pistachio Bulbul Bulk',
    productClass: 'bulk_loose_product',
    productType: 'Baklawa',
    displayCategory: 'Baklawa',
    sku: { division: 'AS', category: 'BKL', subcategory: 'PST', packaging: 'BULK' },
    alias: 'Bulbul Pista',
    aliasSearch: 'Bulbul',
  },
  {
    name: 'Double Pistachio Sarma Bulk',
    productClass: 'bulk_loose_product',
    productType: 'Baklawa',
    displayCategory: 'Baklawa',
    sku: { division: 'AS', category: 'BKL', subcategory: 'PST', packaging: 'BULK' },
    alias: 'Double Sarma',
    aliasSearch: 'Double Sarma',
  },
  {
    name: 'Frozen Cheese Kunafa',
    productClass: 'semi_prepared_frozen',
    productType: 'Kunafa',
    displayCategory: 'Kunafa',
    sku: { division: 'FR', category: 'KNF', subcategory: 'KNF', packaging: 'FROZEN' },
    alias: 'Cheese Kunafa Frozen',
    aliasSearch: 'Cheese Kunafa',
  },
  {
    name: 'Roasted Kunafa',
    productClass: 'bulk_loose_product',
    productType: 'Kunafa',
    displayCategory: 'Kunafa',
    sku: { division: 'AS', category: 'KNF', subcategory: 'KNF', packaging: 'TRAY1KG' },
    alias: 'Roasted KNA',
    aliasSearch: 'Roasted KNA',
  },
  {
    name: 'Pistachio Stuffed Dates',
    productClass: 'bulk_loose_product',
    productType: 'Dates',
    displayCategory: 'Dates',
    sku: { division: 'CH', category: 'DAT', subcategory: 'PST', packaging: 'LOOSE' },
    alias: 'Pista Dates',
    aliasSearch: 'Pista Dates',
  },
  {
    name: 'Channa Badam Barfi',
    productClass: 'bulk_loose_product',
    productType: 'Fusion Sweets',
    displayCategory: 'Fusion Sweets',
    sku: { division: 'FS', category: 'FUS', subcategory: 'ASS', packaging: 'BULK' },
    alias: 'Channa Barfi',
    aliasSearch: 'Channa Barfi',
  },
];

const productResults: ProductResult[] = [];
let productionBundle: string | null = null;
let authBlocked = false;
let authBlockReason = '';

function slug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
}

function ensureDirs() {
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
}

function classifySeverity(steps: StepResult[]): ProductResult['severity'] {
  const failed = steps.filter((s) => !s.pass).map((s) => s.step);
  if (
    failed.some((s) =>
      /login|create|save|sku|persist|snapshot preview|approve snapshot/i.test(s),
    )
  ) {
    return 'P0';
  }
  if (
    failed.some((s) =>
      /search|alias|hero|pricing|compliance|preview|persist after refresh/i.test(s),
    )
  ) {
    return 'P1';
  }
  if (failed.length) return 'P2';
  return 'none';
}

function writeReport() {
  ensureDirs();
  const passCount = productResults.filter((r) => r.pass).length;
  const go = passCount === ACCEPTANCE_PRODUCTS.length && !authBlocked;

  const lines: string[] = [
    '# Catalogue Final Acceptance Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Studio URL: ${STUDIO_URL}`,
    `Production bundle: ${productionBundle ?? 'unknown'}`,
    '',
    `## GO / NO-GO: **${go ? 'GO' : 'NO-GO'}**`,
    '',
    `Passed: ${passCount}/${ACCEPTANCE_PRODUCTS.length}`,
    '',
  ];

  if (authBlocked) {
    lines.push(`> Auth blocked automation: ${authBlockReason}`, '');
  }

  lines.push('## Product results', '', '| # | Product | Result | SKU | Severity |', '|---|---------|--------|-----|----------|');
  ACCEPTANCE_PRODUCTS.forEach((p, i) => {
    const r = productResults.find((x) => x.name === p.name);
    lines.push(
      `| ${i + 1} | ${p.name} | ${r?.pass ? 'PASS' : 'FAIL'} | ${r?.sku || '—'} | ${r?.severity ?? '—'} |`,
    );
  });

  lines.push('', '## Step detail', '');
  for (const r of productResults) {
    lines.push(`### ${r.name}`, '');
    if (r.screenshot) lines.push(`Screenshot: \`${r.screenshot}\``, '');
    for (const s of r.steps) {
      lines.push(`- [${s.pass ? 'x' : ' '}] ${s.step}${s.detail ? ` — ${s.detail}` : ''}`);
    }
    if (r.consoleErrors.length) {
      lines.push('', 'Console errors:', '```', ...r.consoleErrors.slice(0, 20), '```');
    }
    if (r.networkErrors.length) {
      lines.push('', 'Network errors:', '```', ...r.networkErrors.slice(0, 20), '```');
    }
    lines.push('');
  }

  const p0p1 = productResults.flatMap((r) =>
    r.steps
      .filter((s) => !s.pass)
      .map((s) => ({ product: r.name, step: s.step, severity: r.severity, detail: s.detail })),
  );

  if (p0p1.length) {
    lines.push('## Issues', '');
    for (const issue of p0p1) {
      lines.push(`- **${issue.severity}** ${issue.product}: ${issue.step}${issue.detail ? ` (${issue.detail})` : ''}`);
    }
  }

  fs.writeFileSync(REPORT_PATH, lines.join('\n'));
}

async function detectBundle(page: Page) {
  const html = await page.content();
  const m = html.match(/index-[A-Za-z0-9_-]+\.js/);
  productionBundle = m?.[0] ?? null;
}

async function loginStudio(page: Page): Promise<{ ok: boolean; reason?: string }> {
  if (!EMAIL || !PASSWORD) {
    return { ok: false, reason: 'TEST_STUDIO_EMAIL / TEST_STUDIO_PASSWORD not set' };
  }

  await page.goto(`${STUDIO_URL}/auth`, { waitUntil: 'networkidle' });
  await detectBundle(page);
  await page.getByRole('tab', { name: 'Sign In' }).click();

  const captcha = page.locator(
    'iframe[src*="captcha"], iframe[src*="hcaptcha"], iframe[src*="recaptcha"], [data-captcha]',
  );
  if (await captcha.count()) {
    return { ok: false, reason: 'Captcha detected on login page — manual session required' };
  }

  const signInForm = page.locator('form').filter({ has: page.getByRole('button', { name: 'Sign In' }) });
  await signInForm.locator('input[type="email"]').fill(EMAIL);
  await signInForm.locator('input[type="password"]').fill(PASSWORD);
  await signInForm.getByRole('button', { name: 'Sign In' }).click();

  try {
    await page.waitForURL((url) => !url.pathname.includes('/auth'), { timeout: 60_000 });
  } catch {
    const body = await page.locator('body').innerText();
    if (/invalid|incorrect|failed|error/i.test(body)) {
      return { ok: false, reason: 'Invalid credentials or login error on page' };
    }
    return { ok: false, reason: 'Login did not redirect away from /auth within 60s' };
  }

  return { ok: true };
}

function fieldSelect(page: Page, label: string | RegExp) {
  return page
    .locator('label')
    .filter({ hasText: label })
    .first()
    .locator('xpath=..')
    .locator('select');
}

async function selectField(page: Page, label: string | RegExp, value: string) {
  const sel = fieldSelect(page, label);
  await expect(sel).toBeVisible();
  await sel.selectOption(value);
}

async function skuSection(page: Page) {
  return page.locator('.card-elevated').filter({ hasText: 'SKU · System identity' });
}

async function selectSkuCode(page: Page, label: string, code: string) {
  const section = await skuSection(page);
  const sel = section.getByText(label, { exact: true }).locator('..').locator('select');
  await expect(sel).toHaveCount(1);
  await expect(sel).toBeVisible();
  const preferred = sel.locator(`option[value="${code}"]`);
  if (await preferred.count()) {
    await sel.selectOption(code);
    return;
  }
  const fallback = await sel.locator('option').evaluateAll((opts) =>
    opts.map((o) => (o as HTMLOptionElement).value).filter((v) => v && v.length > 0),
  );
  if (!fallback.length) {
    throw new Error(`No ${label} options available (wanted ${code})`);
  }
  await sel.selectOption(fallback[0]);
}

async function generateSku(page: Page): Promise<string> {
  const section = await skuSection(page);
  await section.getByRole('button', { name: 'Generate SKU' }).click();
  await expect(section.locator('code').first()).not.toHaveText('Not generated yet', { timeout: 30_000 });
  const sku = (await section.locator('code').first().innerText()).trim();
  expect(sku).toMatch(/^OAS-/);
  return sku;
}

async function clickTab(page: Page, name: string | RegExp) {
  const tab = page.getByRole('tab', { name }).first();
  await tab.click();
  await expect(tab).toHaveAttribute('data-state', 'active');
}

async function saveProduct(page: Page) {
  const saveBtn = page.getByRole('button', { name: /^Save$/ }).first();
  await saveBtn.click();
  await Promise.race([
    page.getByText('Saved', { exact: false }).waitFor({ state: 'visible', timeout: 60_000 }),
    page.locator('.text-destructive').filter({ hasText: /error|missing|fix/i }).waitFor({ state: 'visible', timeout: 60_000 }).then(() => {
      throw new Error('Save surfaced validation error');
    }),
  ]).catch(async (err) => {
    if (String(err).includes('Save surfaced')) throw err;
    await page.waitForLoadState('networkidle');
  });
}

async function uploadHero(page: Page) {
  const heroTab = page.getByRole('tab', { name: /Hero image/i });
  if (await heroTab.isVisible().catch(() => false)) {
    await clickTab(page, /Hero image/i);
  }
  const fileInput = page.locator('input[type="file"]').first();
  await expect(fileInput).toBeAttached({ timeout: 30_000 });
  await fileInput.setInputFiles(HERO_IMAGE);
  await page.waitForTimeout(4000);
}

async function addAlias(page: Page, alias: string) {
  await clickTab(page, /^Identity$/i);
  const aliasSection = page.locator('#product-language-terms');
  await expect(aliasSection).toBeVisible({ timeout: 30_000 });
  await aliasSection.scrollIntoViewIfNeeded();
  const input = aliasSection.locator('input').first();
  await input.fill(alias);
  await aliasSection.getByRole('button', { name: /^Add$/ }).click();
  await expect(page.getByText(/Alias (added|saved|updated)/i)).toBeVisible({ timeout: 15_000 }).catch(async () => {
    await expect(page.locator('[data-sonner-toast]').filter({ hasNotText: /error|failed/i })).toBeVisible({ timeout: 5000 });
  });
  await expect(aliasSection.getByText(alias, { exact: true })).toBeVisible({ timeout: 30_000 });
}

async function fillUomMoq(page: Page) {
  await clickTab(page, /UOM \/ MOQ/i);
  await selectField(page, /Primary UOM/i, 'kg');
  await selectField(page, /B2B UOM/i, 'kg');
  await selectField(page, /Retail UOM/i, 'pack');
  await page.locator('label', { hasText: /Pieces per kg/i }).locator('..').locator('input').fill('40');
  await page.locator('label', { hasText: /Approx\. piece weight/i }).locator('..').locator('input').fill('25');
  await page.locator('label', { hasText: /^MOQ value/i }).locator('..').locator('input').fill('2');
  await selectField(page, /^MOQ UOM/i, 'pack');
}

async function fillCompliance(page: Page) {
  await clickTab(page, /^Compliance$/i);
  const aiBtn = page.getByRole('button', { name: /Generate AI compliance suggestions/i });
  await aiBtn.click();
  await page.waitForTimeout(4000);

  const approveButtons = page.getByRole('button', { name: /Approve for save/i });
  const count = await approveButtons.count();
  for (let i = 0; i < count; i += 1) {
    await approveButtons.nth(0).click();
    await page.waitForTimeout(300);
  }

  const hsn = page.locator('label', { hasText: /^HSN$/ }).locator('..').locator('input');
  if ((await hsn.inputValue()).trim() === '') await hsn.fill('19059090');

  const gst = page.locator('label', { hasText: /^GST %/ }).locator('..').locator('input');
  if ((await gst.inputValue()).trim() === '') await gst.fill('5');

  const shelf = page.locator('label', { hasText: /Shelf life/i }).locator('..').locator('input');
  if ((await shelf.inputValue()).trim() === '') await shelf.fill('90');

  const storage = page.locator('label', { hasText: /Storage instructions/i }).locator('..').locator('textarea');
  if ((await storage.inputValue()).trim() === '') {
    await storage.fill('Store in a cool, dry place.');
  }
}

async function addApprovedB2bPrice(page: Page) {
  await clickTab(page, /Business Rules/i);
  const pricingRoot = page.locator('.card-elevated').filter({ hasText: 'Sales Pricing Rules' });

  const addBtn = pricingRoot.getByRole('button', { name: /Add Price/i });
  await expect(addBtn).toBeVisible();
  await addBtn.click();
  await page.waitForTimeout(2000);

  const card = pricingRoot.locator('.rounded-xl.border.bg-background').first();
  await card.getByRole('button', { name: /^Edit$/ }).click();

  await card.locator('label', { hasText: /Pricing Label/i }).locator('..').locator('select').selectOption('b2b');
  await card.locator('label', { hasText: /Price Type/i }).locator('..').locator('select').selectOption('fixed_price');
  await card.locator('label', { hasText: /Base Price/i }).locator('..').locator('input').fill('1500');

  await page.waitForTimeout(2000);

  const approveBtn = card.getByRole('button', { name: /^Approve$/ });
  if (await approveBtn.isVisible().catch(() => false)) {
    await approveBtn.click();
    await page.waitForTimeout(1000);
  }
}

async function runCentralSync(page: Page) {
  await clickTab(page, /Product Truth/i);
  await page.getByRole('tab', { name: 'Central Sync' }).click();
  await page.waitForTimeout(2000);

  const rlsError = page.getByText(/RLS|row-level security|permission denied/i);
  const missingTable = page.getByText(/missing table|does not exist|catalogue versions query failed/i);
  const localFallback = page.getByText(/local storage|not authoritative/i);

  const previewBtn = page.getByRole('button', { name: /Generate preview/i });
  if (!(await previewBtn.isDisabled())) {
    await previewBtn.click();
    await page.waitForTimeout(6000);
  }

  if (await rlsError.isVisible().catch(() => false)) {
    throw new Error('RLS error in Central Sync panel');
  }
  if (await missingTable.isVisible().catch(() => false)) {
    throw new Error('Missing table error in Central Sync panel');
  }
  if (await localFallback.isVisible().catch(() => false)) {
    throw new Error('Local fallback authority error in Central Sync panel');
  }

  const approveBtn = page.getByRole('button', { name: /Approve snapshot/i });
  if (!(await approveBtn.isDisabled())) {
    await approveBtn.click();
    await page.waitForTimeout(6000);
  }

  const hasOutput =
    (await page.getByText(/Payload JSON preview|version_code|OAS-CAT/i).first().isVisible().catch(() => false)) ||
    (await page.locator('pre').first().isVisible().catch(() => false));
  if (!hasOutput) {
    const blockers = await page.locator('.text-destructive, .text-warning').allInnerTexts();
    throw new Error(`Central sync produced no preview output: ${blockers.slice(0, 6).join('; ')}`);
  }
}

async function searchProductMaster(page: Page, query: string, productName: string) {
  await page.goto(`${STUDIO_URL}/products`, { waitUntil: 'networkidle' });
  const search = page.getByPlaceholder(/Search by name, SKU, alias/i);
  await search.fill(query);
  await page.waitForTimeout(800);
  await expect(page.getByRole('link', { name: new RegExp(productName, 'i') }).first()).toBeVisible({
    timeout: 45_000,
  });
}

async function verifyPersistence(page: Page, cfg: ProductConfig, sku: string, alias: string, productId: string) {
  if (page.url().includes('/auth')) {
    const login = await loginStudio(page);
    if (!login.ok) throw new Error(`Session lost after refresh: ${login.reason}`);
  }
  await page.goto(`${STUDIO_URL}/products/${productId}`, { waitUntil: 'networkidle' });
  await page.reload({ waitUntil: 'networkidle' });
  if (page.url().includes('/auth')) {
    const login = await loginStudio(page);
    if (!login.ok) throw new Error(`Session lost after hard refresh: ${login.reason}`);
    await page.goto(`${STUDIO_URL}/products/${productId}`, { waitUntil: 'networkidle' });
  }

  await clickTab(page, /^Identity$/i);
  const nameInput = page.getByRole('textbox').first();
  await expect(nameInput).toHaveValue(cfg.name, { timeout: 30_000 });

  const skuCode = await (await skuSection(page)).locator('code').first().innerText();
  expect(skuCode.trim()).toBe(sku);

  await expect(page.locator('#product-language-terms').getByText(alias, { exact: true })).toBeVisible();

  await clickTab(page, /^Compliance$/i);
  const hsn = page.locator('label', { hasText: /^HSN$/ }).locator('..').locator('input');
  await expect(hsn).not.toHaveValue('');

  await clickTab(page, /UOM \/ MOQ/i);
  const moq = page.locator('label', { hasText: /^MOQ value/i }).locator('..').locator('input');
  await expect(moq).not.toHaveValue('');
}

async function runProductFlow(page: Page, cfg: ProductConfig, testInfo: TestInfo): Promise<ProductResult> {
  const steps: StepResult[] = [];
  const consoleErrors: string[] = [];
  const networkErrors: string[] = [];
  let sku = '';
  let productId = '';
  let screenshot: string | undefined;

  const onConsole = (msg: { type: () => string; text: () => string }) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  };
  const onResponse = (res: { url: () => string; status: () => number; request: () => { method: () => string } }) => {
    if (res.status() >= 400 && /supabase|oasis-ai-studio/.test(res.url())) {
      networkErrors.push(`${res.request().method()} ${res.status()} ${res.url()}`);
    }
  };

  page.on('console', onConsole);
  page.on('response', onResponse);
  page.on('dialog', (d) => d.accept());

  const record = (step: string, pass: boolean, detail?: string) => {
    steps.push({ step, pass, detail });
    if (!pass) throw new Error(detail ?? step);
  };

  try {
    await page.goto(`${STUDIO_URL}/products/new`, { waitUntil: 'domcontentloaded' });

    await page.locator('label', { hasText: /Product Name/i }).locator('..').locator('input').fill(cfg.name);
    await selectField(page, /Product Class/i, cfg.productClass);
    await page.locator('label', { hasText: /Product Type/i }).locator('..').locator('input').fill(cfg.productType);
    await page.locator('label', { hasText: /Display Category/i }).locator('..').locator('input').fill(cfg.displayCategory);
    await selectField(page, /Main Department/i, 'third_party_goods_store');
    record('Create product form', true);

    await selectSkuCode(page, 'Division', cfg.sku.division);
    await selectSkuCode(page, 'Category', cfg.sku.category);
    await selectSkuCode(page, 'Subcategory', cfg.sku.subcategory);
    await selectSkuCode(page, 'Packaging', cfg.sku.packaging);
    sku = await generateSku(page);
    record('Generate SKU', true, sku);

    await saveProduct(page);
    await page.waitForURL(/\/products\/[0-9a-f-]{36}/i, { timeout: 60_000 });
    productId = page.url().split('/').pop() ?? '';
    record('Save product', true, productId);

    if (await page.getByRole('tab', { name: /Hero image|Media/i }).isVisible().catch(() => false)) {
      await clickTab(page, /Hero image|Media/i);
    }
    await uploadHero(page);
    await saveProduct(page);
    record('Upload hero image', true);

    await addAlias(page, cfg.alias);
    record('Generate/save aliases', true, cfg.alias);

    await fillUomMoq(page);
    await fillCompliance(page);
    await addApprovedB2bPrice(page);
    await saveProduct(page);
    record('Pricing / MOQ / UOM / compliance', true);

    await clickTab(page, /Product Truth/i);
    await expect(page.getByText(/Product Truth/i).first()).toBeVisible();
    record('Open Product Truth', true);

    await runCentralSync(page);
    record('Generate Preview + Approve Snapshot', true);

    await searchProductMaster(page, cfg.name, cfg.name);
    record('Search by full name', true);
    await searchProductMaster(page, cfg.name.split(' ').slice(0, 2).join(' '), cfg.name);
    record('Search by partial name', true);
    await searchProductMaster(page, sku, cfg.name);
    record('Search by SKU', true);
    await searchProductMaster(page, cfg.aliasSearch, cfg.name);
    record('Search by alias', true);

    await page.goto(`${STUDIO_URL}/products/${productId}`, { waitUntil: 'networkidle' });
    await page.reload({ waitUntil: 'networkidle' });
    await verifyPersistence(page, cfg, sku, cfg.alias, productId);
    record('Persist after hard refresh', true);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const lastOpen = steps.findIndex((s) => !s.pass);
    if (lastOpen >= 0) {
      steps[lastOpen].detail = msg;
    } else {
      steps.push({ step: 'Unhandled failure', pass: false, detail: msg });
    }

    const shotFile = path.join(SHOTS_DIR, `${slug(cfg.name)}-failure.png`);
    await page.screenshot({ path: shotFile, fullPage: true }).catch(() => {});
    screenshot = path.relative(process.cwd(), shotFile);
    await testInfo.attach(`failure-${slug(cfg.name)}`, { path: shotFile });
  } finally {
    page.off('console', onConsole);
    page.off('response', onResponse);
  }

  const pass = steps.every((s) => s.pass);
  const severity = classifySeverity(steps);
  const result: ProductResult = {
    name: cfg.name,
    pass,
    sku,
    productId,
    steps,
    screenshot,
    consoleErrors: [...new Set(consoleErrors)],
    networkErrors: [...new Set(networkErrors)],
    severity,
  };
  productResults.push(result);
  return result;
}

test.describe.configure({ mode: 'serial' });

test.describe('Catalogue final production acceptance', () => {
  test.beforeAll(() => {
    ensureDirs();
    if (!fs.existsSync(HERO_IMAGE)) {
      throw new Error(`Missing hero fixture: ${HERO_IMAGE}`);
    }
  });

  test.afterAll(() => {
    writeReport();
  });

  test('login', async ({ page }) => {
    const login = await loginStudio(page);
    if (!login.ok) {
      authBlocked = true;
      authBlockReason = login.reason ?? 'Login failed';
      writeReport();
      expect.soft(false, authBlockReason).toBeTruthy();
      return;
    }
    expect(login.ok).toBeTruthy();
  });

  for (const cfg of ACCEPTANCE_PRODUCTS) {
    test(`acceptance: ${cfg.name}`, async ({ page }) => {
      test.skip(authBlocked, authBlockReason);

      const login = await loginStudio(page);
      expect(login.ok).toBeTruthy();

      const result = await runProductFlow(page, cfg, test.info());
      if (!result.pass) {
        const failed = result.steps.filter((s) => !s.pass).map((s) => s.step).join(', ');
        throw new Error(`${cfg.name} failed at: ${failed}`);
      }
    });
  }
});
