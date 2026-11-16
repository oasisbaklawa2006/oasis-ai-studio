import type { BrowserContext, Route } from "@playwright/test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { installStudioAuditRouting } from "../../e2e/studio-audit-security";

const STUDIO = "https://oasis-ai-studio.vercel.app";
const SHA = "5bc36db0a192b1be2dc02693336c2f6a2dc4e26c";

function approvedEnvironment() {
  vi.stubEnv("AI_STUDIO_URL", STUDIO);
  vi.stubEnv("GITHUB_REF", "refs/heads/main");
  vi.stubEnv("GITHUB_EVENT_NAME", "workflow_dispatch");
  vi.stubEnv("GITHUB_SHA", SHA);
  vi.stubEnv("EXPECTED_DEPLOYMENT_SHA", SHA);
  vi.stubEnv("VERCEL_AUTOMATION_BYPASS_SECRET", "synthetic-test-only-bypass");
  vi.stubEnv("TEST_STUDIO_PASSWORD", "synthetic-test-only-password");
}

async function mockRouteContext(additionalNavigationOrigins: string[] = []) {
  let handler: ((route: Route) => Promise<void>) | undefined;
  const context = {
    route: vi.fn(async (_pattern: string, callback: (route: Route) => Promise<void>) => {
      handler = callback;
    }),
  };
  await installStudioAuditRouting(context as unknown as BrowserContext, additionalNavigationOrigins);
  if (!handler) throw new Error("Route handler not installed");
  return handler;
}

function requestRoute(url: string, navigation: boolean) {
  const route = {
    request: () => ({
      url: () => url,
      isNavigationRequest: () => navigation,
      headers: () => ({ accept: "*/*" }),
    }),
    abort: vi.fn(async () => {}),
    fetch: vi.fn(async () => ({ status: () => 200, headers: () => ({}) })),
    fulfill: vi.fn(async () => {}),
    continue: vi.fn(async () => {}),
  };
  return route;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("protected Studio browser routing", () => {
  it("blocks foreign navigation before sending any protected request", async () => {
    approvedEnvironment();
    const handler = await mockRouteContext();
    const route = requestRoute("https://attacker.example/steal", true);
    await handler(route as unknown as Route);
    expect(route.abort).toHaveBeenCalledWith("blockedbyclient");
    expect(route.fetch).not.toHaveBeenCalled();
    expect(route.continue).not.toHaveBeenCalled();
  });

  it("injects the bypass header only into a zero-redirect Node fetch to Studio", async () => {
    approvedEnvironment();
    const handler = await mockRouteContext();
    const route = requestRoute(`${STUDIO}/auth`, true);
    await handler(route as unknown as Route);
    expect(route.fetch).toHaveBeenCalledWith({
      url: `${STUDIO}/auth`,
      headers: { accept: "*/*", "x-vercel-protection-bypass": "synthetic-test-only-bypass" },
      maxRedirects: 0,
    });
    expect(route.fulfill).toHaveBeenCalledTimes(1);
    expect(route.continue).not.toHaveBeenCalled();
  });

  it("blocks a Studio redirect to a foreign origin before fulfilling Chromium", async () => {
    approvedEnvironment();
    const handler = await mockRouteContext();
    const route = requestRoute(`${STUDIO}/auth`, true);
    route.fetch.mockResolvedValueOnce({
      status: () => 302,
      headers: () => ({ location: "https://attacker.example/steal" }),
    } as never);
    await handler(route as unknown as Route);
    expect(route.abort).toHaveBeenCalledWith("blockedbyclient");
    expect(route.fulfill).not.toHaveBeenCalled();
    expect(route.fetch).toHaveBeenCalledTimes(1);
  });

  it("resolves approved same-origin redirects without handing a 302 to Chromium", async () => {
    approvedEnvironment();
    const handler = await mockRouteContext();
    const route = requestRoute(`${STUDIO}/auth`, true);
    route.fetch.mockResolvedValueOnce({
      status: () => 302,
      headers: () => ({ location: "/login" }),
    } as never);
    await handler(route as unknown as Route);
    expect(route.fetch).toHaveBeenCalledTimes(2);
    expect(route.fetch).toHaveBeenLastCalledWith({
      url: `${STUDIO}/login`,
      headers: { accept: "*/*", "x-vercel-protection-bypass": "synthetic-test-only-bypass" },
      maxRedirects: 0,
    });
    expect(route.fulfill).toHaveBeenCalledTimes(1);
  });

  it("blocks a Central navigation redirect to a foreign origin without leaking bypass", async () => {
    approvedEnvironment();
    const central = "https://cursor-central-vercel.vercel.app";
    const handler = await mockRouteContext([central]);
    const route = requestRoute(`${central}/login`, true);
    route.fetch.mockResolvedValueOnce({
      status: () => 302,
      headers: () => ({ location: "https://attacker.example/credential-form" }),
    } as never);
    await handler(route as unknown as Route);
    expect(route.abort).toHaveBeenCalledWith("blockedbyclient");
    expect(route.fulfill).not.toHaveBeenCalled();
    expect(route.fetch).toHaveBeenCalledWith({
      url: `${central}/login`,
      headers: { accept: "*/*" },
      maxRedirects: 0,
    });
  });

  it("checks Studio navigation redirects even without a bypass secret", async () => {
    approvedEnvironment();
    vi.stubEnv("VERCEL_AUTOMATION_BYPASS_SECRET", "");
    const handler = await mockRouteContext();
    const route = requestRoute(`${STUDIO}/auth`, true);
    route.fetch.mockResolvedValueOnce({
      status: () => 302,
      headers: () => ({ location: "https://attacker.example/credential-form" }),
    } as never);
    await handler(route as unknown as Route);
    expect(route.abort).toHaveBeenCalledWith("blockedbyclient");
    expect(route.fulfill).not.toHaveBeenCalled();
  });

  it("allows foreign API requests without forwarding the bypass header", async () => {
    approvedEnvironment();
    const handler = await mockRouteContext();
    const route = requestRoute("https://example.supabase.co/rest/v1/products", false);
    await handler(route as unknown as Route);
    expect(route.continue).toHaveBeenCalledWith();
    expect(route.fetch).not.toHaveBeenCalled();
  });

  it("rejects a PR ref before registering any protected network route", async () => {
    approvedEnvironment();
    vi.stubEnv("GITHUB_REF", "refs/pull/294/merge");
    const context = { route: vi.fn() };
    await expect(installStudioAuditRouting(context as unknown as BrowserContext)).rejects.toThrow(
      "reviewed main",
    );
    expect(context.route).not.toHaveBeenCalled();
  });

  it("rejects unapproved Studio target before protected routing", async () => {
    approvedEnvironment();
    vi.stubEnv("AI_STUDIO_URL", "https://attacker.example");
    const context = { route: vi.fn() };
    await expect(installStudioAuditRouting(context as unknown as BrowserContext)).rejects.toThrow(
      "not explicitly approved",
    );
    expect(context.route).not.toHaveBeenCalled();
  });
});
