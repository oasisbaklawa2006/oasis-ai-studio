import * as fs from "node:fs";
import * as path from "node:path";
import { expect, type Page, test } from "@playwright/test";

const STUDIO_URL = process.env.AI_STUDIO_URL || "https://oasis-ai-studio.vercel.app";
const EMAIL = process.env.TEST_STUDIO_EMAIL || "";
const PASSWORD = process.env.TEST_STUDIO_PASSWORD || "";
const ROOT = path.join(process.cwd(), "audit-artifacts", "full-app");
const SHOTS = path.join(ROOT, "screenshots");

const routes = [
  ["dashboard", "/"],
  ["products", "/products"],
  ["fast-create", "/products/new/fast"],
  ["full-editor", "/products/new"],
  ["category-1-import", "/admin/import/category-1"],
  ["media", "/media"],
  ["tags", "/tags"],
  ["catalogues", "/catalogues"],
  ["catalogue-builder", "/admin/catalogue-builder"],
  ["catalogue-product-studio", "/admin/catalogue-product-studio"],
  ["hampers", "/hampers"],
  ["ingredients", "/ingredients"],
  ["labels", "/labels"],
  ["label-queue", "/label-queue"],
  ["data-correction", "/data-correction"],
  ["ai-studio", "/ai-studio"],
  ["testing", "/testing"],
  ["pilot-readiness", "/testing/pilot-readiness"],
  ["pilot-aliases", "/testing/pilot-aliases"],
  ["resolver-preview", "/admin/resolver-preview"],
  ["operator-inbox", "/admin/operator-inbox"],
  ["settings", "/settings"],
  ["audit-log", "/audit-log"],
  ["approvals", "/approvals"],
] as const;

type Status = "full-built" | "partial" | "on-hold" | "wrongly-built" | "not-accessible";
type RouteResult = {
  name: string;
  route: string;
  finalUrl: string;
  status: Status;
  title: string;
  heading: string;
  bodyLength: number;
  internalLinks: string[];
  brokenLinkContracts: string[];
  consoleErrors: string[];
  networkErrors: string[];
  notes: string[];
  screenshot: string;
};

type ProcessResult = { process: string; status: "pass" | "fail" | "blocked"; evidence: string };

const results: RouteResult[] = [];
const processes: ProcessResult[] = [];

function safeName(value: string) {
  return value
    .replace(/[^a-z0-9-]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function isKnownRoute(href: string) {
  const pathname = new URL(href, STUDIO_URL).pathname;
  if (pathname.startsWith("/c/")) return true;
  if (/^\/products\/[0-9a-f-]{36}$/i.test(pathname)) return true;
  if (/^\/catalogues\/[^/]+(?:\/proposal)?$/i.test(pathname)) return true;
  return routes.some(([, route]) => route === pathname);
}

function classify(body: string, fatal: boolean, inaccessible: boolean): Status {
  if (inaccessible) return "not-accessible";
  if (fatal) return "wrongly-built";
  if (/roadmap|future feature|setup required|not enabled/i.test(body)) return "on-hold";
  if (/coming soon|not implemented|placeholder|mapping not finalized|unavailable/i.test(body))
    return "partial";
  return "full-built";
}

async function login(page: Page) {
  await page.goto(`${STUDIO_URL}/auth`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL((url) => !url.pathname.includes("/auth"), { timeout: 60_000 });
}

async function auditRoute(page: Page, name: string, route: string) {
  const consoleErrors: string[] = [];
  const networkErrors: string[] = [];
  const consoleListener = (message: { type: () => string; text: () => string }) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  };
  const responseListener = (response: { status: () => number; url: () => string }) => {
    if (response.status() >= 400) networkErrors.push(`${response.status()} ${response.url()}`);
  };
  page.on("console", consoleListener);
  page.on("response", responseListener);

  const notes: string[] = [];
  try {
    await page.goto(`${STUDIO_URL}${route}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(1_500);
  } catch (error) {
    notes.push(`Navigation error: ${String(error)}`);
  }

  const finalUrl = page.url();
  const body = await page
    .locator("body")
    .innerText()
    .catch(() => "");
  const heading = await page
    .locator("h1, h2")
    .first()
    .innerText()
    .catch(() => "");
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

  const internalLinks = await page
    .locator('a[href^="/"]')
    .evaluateAll((anchors) =>
      [
        ...new Set(
          anchors.map((anchor) => (anchor as HTMLAnchorElement).getAttribute("href") || ""),
        ),
      ]
        .filter(Boolean)
        .sort(),
    )
    .catch(() => [] as string[]);
  const brokenLinkContracts = internalLinks.filter((href) => !isKnownRoute(href));
  const screenshot = path.join(SHOTS, `${safeName(name)}.png`);
  await page.screenshot({ path: screenshot, fullPage: false }).catch(() => undefined);

  results.push({
    name,
    route,
    finalUrl,
    status: classify(body, fatal, inaccessible),
    title: await page.title().catch(() => ""),
    heading,
    bodyLength: body.trim().length,
    internalLinks,
    brokenLinkContracts,
    consoleErrors: [...new Set(consoleErrors)],
    networkErrors: [...new Set(networkErrors)],
    notes,
    screenshot: path.relative(process.cwd(), screenshot),
  });
  page.off("console", consoleListener);
  page.off("response", responseListener);
}

async function recordProcess(process: string, action: () => Promise<string>) {
  try {
    processes.push({ process, status: "pass", evidence: await action() });
  } catch (error) {
    processes.push({ process, status: "fail", evidence: String(error) });
  }
}

function writeReport() {
  fs.mkdirSync(ROOT, { recursive: true });
  const report = {
    generatedAt: new Date().toISOString(),
    target: STUDIO_URL,
    safety: "Read-only: no Save/Create/Approve/Reject/Upload/Activation actions executed.",
    summary: {
      totalRoutes: results.length,
      byStatus: Object.fromEntries(
        (["full-built", "partial", "on-hold", "wrongly-built", "not-accessible"] as Status[]).map(
          (status) => [status, results.filter((result) => result.status === status).length],
        ),
      ),
      processesPassed: processes.filter((process) => process.status === "pass").length,
      processesFailed: processes.filter((process) => process.status === "fail").length,
    },
    routes: results,
    processes,
  };
  fs.writeFileSync(path.join(ROOT, "full-app-audit.json"), JSON.stringify(report, null, 2));

  const rows = results.map(
    (result) =>
      `| ${result.name} | \`${result.route}\` | ${result.status} | ${result.heading || "—"} | ${result.consoleErrors.length} | ${result.networkErrors.length} | ${result.brokenLinkContracts.join(", ") || "—"} |`,
  );
  const processRows = processes.map(
    (result) =>
      `| ${result.process} | ${result.status} | ${result.evidence.replaceAll("|", "\\|")} |`,
  );
  fs.writeFileSync(
    path.join(ROOT, "FULL_APP_E2E_REPORT.md"),
    [
      "# Oasis AI Studio — Full Application E2E Audit",
      "",
      `Generated: ${report.generatedAt}`,
      `Target: ${STUDIO_URL}`,
      "Safety: read-only; no persistence controls were activated.",
      "",
      "## Route and module matrix",
      "",
      "| Module | Route | Classification | Visible heading | Console errors | Network errors | Unknown internal links |",
      "|---|---|---|---|---:|---:|---|",
      ...rows,
      "",
      "## Read-only process checks",
      "",
      "| Process | Status | Evidence |",
      "|---|---|---|",
      ...processRows,
      "",
      "## Classification rules",
      "",
      "- full-built: route rendered meaningful content without a detected fatal state.",
      "- partial: visible copy declares a placeholder, unavailable action, or unfinished mapping.",
      "- on-hold: visible copy declares roadmap/future/setup-required/not-enabled state.",
      "- wrongly-built: blank page, framework overlay, not-found, or fatal-error state.",
      "- not-accessible: authenticated account lacks permission or was redirected to auth.",
    ].join("\n"),
  );
}

test.describe.configure({ mode: "serial" });

test.describe("Complete application read-only E2E audit", () => {
  test.beforeAll(() => {
    if (!EMAIL || !PASSWORD)
      throw new Error("TEST_STUDIO_EMAIL and TEST_STUDIO_PASSWORD are required");
    fs.mkdirSync(SHOTS, { recursive: true });
  });

  test.afterAll(writeReport);

  test("authenticate and crawl every registered static route", async ({ page }) => {
    await login(page);
    expect(page.url()).not.toContain("/auth");
    for (const [name, route] of routes) await auditRoute(page, name, route);
  });

  test("exercise critical authoring processes without persistence", async ({ page }) => {
    await login(page);

    await recordProcess("Products search", async () => {
      await page.goto(`${STUDIO_URL}/products`, { waitUntil: "domcontentloaded" });
      const search = page.getByPlaceholder(/search by name, sku, alias/i);
      await search.fill("baklawa");
      await page.waitForTimeout(750);
      return `Search accepted; visible product links: ${await page.locator('a[href^="/products/"]').count()}`;
    });

    await recordProcess("Fast Create dry-run", async () => {
      await page.goto(`${STUDIO_URL}/products/new/fast`, { waitUntil: "domcontentloaded" });
      const controls = await page.locator("input, textarea, select, [role=combobox]").count();
      const name = page.getByLabel(/product name/i).first();
      if (await name.isVisible().catch(() => false)) await name.fill("E2E READ ONLY — DO NOT SAVE");
      await expect(page.getByText(/Fast Create/i).first()).toBeVisible();
      return `${controls} authoring controls rendered; no Create Product Draft action executed.`;
    });

    await recordProcess("Full Editor dry-run", async () => {
      await page.goto(`${STUDIO_URL}/products/new`, { waitUntil: "domcontentloaded" });
      const controls = await page.locator("input, textarea, select, [role=combobox]").count();
      const name = page.getByLabel(/product name/i).first();
      if (await name.isVisible().catch(() => false)) await name.fill("E2E READ ONLY — DO NOT SAVE");
      const tabs = await page.getByRole("tab").count();
      return `${controls} controls and ${tabs} tabs rendered; no Save action executed.`;
    });

    await recordProcess("Product-to-editor link contract", async () => {
      await page.goto(`${STUDIO_URL}/products`, { waitUntil: "domcontentloaded" });
      await expect(page.locator('a[href="/products/new/fast"]')).toBeVisible();
      await expect(page.locator('a[href="/products/new"]')).toBeVisible();
      return "Fast Create and Full editor canonical entry links are both visible.";
    });
  });
});
