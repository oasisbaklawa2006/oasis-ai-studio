import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { describe, expect, it } from "vitest";
import { CapabilityUnavailable } from "./CapabilityUnavailable";

describe("unavailable capability recovery", () => {
  it("directs staff to Core and keeps unrelated product editing reachable", () => {
    const html = renderToStaticMarkup(
      <StaticRouter location="/">
        <CapabilityUnavailable title="Labels" capability="labels" />
      </StaticRouter>,
    );
    expect(html).toContain("Oasis Core");
    expect(html).toContain('href="/products"');
    expect(html).not.toContain("RLS");
    expect(html).not.toContain("schema");
  });
  it("gives public catalogue visitors an actionable failure without an internal schema disclosure", () => {
    const html = renderToStaticMarkup(
      <StaticRouter location="/">
        <CapabilityUnavailable
          title="Public Catalogue"
          capability="the governed catalogues table"
          publicView
        />
      </StaticRouter>,
    );
    expect(html).toContain("Ask the catalogue owner");
    expect(html).not.toContain("governed catalogues table");
    expect(html).not.toContain('href="/products"');
    expect(html).not.toContain("Oasis Core");
  });
});
