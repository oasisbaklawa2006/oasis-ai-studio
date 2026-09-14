import { describe, expect, it } from "vitest";
import {
  AI_INFERENCE_BOUNDARY_CENSUS,
  getLlmBoundaries,
  getPoint26AuditBoundaries,
  POINT26_CENSUS_BASELINE_SHA,
  SHADOW_INFERENCE_RISKS,
  summarizeCensusForAudit,
} from "./inferenceCensus";

describe("inferenceCensus", () => {
  it("records the current main SHA baseline", () => {
    expect(POINT26_CENSUS_BASELINE_SHA).toMatch(/^[0-9a-f]{40}$/);
  });

  it("lists every LLM boundary with fail-closed and human-review gates", () => {
    const llm = getLlmBoundaries();
    expect(llm.length).toBeGreaterThanOrEqual(2);
    for (const boundary of llm) {
      expect(boundary.fail_closed_on_malformed).toBe(true);
      expect(boundary.human_review_gate).toBe(true);
      expect(boundary.can_mutate_canonical_without_approval).toBe(false);
    }
  });

  it("separates Point 26 audit scope from Point 30 extraction", () => {
    const point26 = getPoint26AuditBoundaries();
    const point30 = AI_INFERENCE_BOUNDARY_CENSUS.filter(
      (b) => b.programme_scope === "point30-extraction",
    );
    expect(point26.some((b) => b.service === "catalogue-ai-copy")).toBe(true);
    expect(point30.some((b) => b.service === "oasis-ai-chat")).toBe(true);
    expect(point30.some((b) => b.service === "generate-product-attributes")).toBe(true);
    expect(point26.every((b) => b.programme_scope === "point26-audit")).toBe(true);
    expect(point30.every((b) => b.programme_scope === "point30-extraction")).toBe(true);
  });

  it("summarizes audit closure metrics", () => {
    const summary = summarizeCensusForAudit();
    expect(summary.baseline_sha).toBe(POINT26_CENSUS_BASELINE_SHA);
    expect(summary.total_boundaries).toBe(AI_INFERENCE_BOUNDARY_CENSUS.length);
    expect(summary.all_llm_fail_closed).toBe(true);
    expect(summary.all_llm_human_review).toBe(true);
  });

  it("tracks shadow risks with resolved mitigations for known gaps", () => {
    const resolved = SHADOW_INFERENCE_RISKS.filter((r) => r.severity === "resolved");
    expect(resolved.some((r) => r.id === "catalogue-gateway-no-oasis-fallback")).toBe(true);
    expect(resolved.some((r) => r.id === "alias-stream-json-leak")).toBe(true);
    expect(resolved.some((r) => r.id === "catalogue-provenance-service-marker")).toBe(true);
  });
});
