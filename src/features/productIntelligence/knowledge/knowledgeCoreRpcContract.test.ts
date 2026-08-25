import { describe, expect, it } from "vitest";
import type { ProductGovernanceRpc } from "@/integrations/supabase/types.extensions";
import { CORE_SUBMIT_KNOWLEDGE_DRAFT_RPC } from "./submitKnowledgeDraft";

const EXPECTED_CORE_RPC_ARGS = [
  "p_schema_version",
  "p_source_catalogue_version_ids",
  "p_knowledge",
  "p_content_checksum",
  "p_candidate_status",
  "p_handoff_eligibility",
  "p_idempotency_key",
] as const;

describe("Core knowledge bridge RPC contract", () => {
  it("targets the merged Core #121 RPC name", () => {
    expect(CORE_SUBMIT_KNOWLEDGE_DRAFT_RPC).toBe("whatsapp_submit_intelligence_knowledge_draft");
  });

  it("matches ExtendedDatabase RPC arg contract from merged Core migration", () => {
    type RpcArgs = ProductGovernanceRpc["whatsapp_submit_intelligence_knowledge_draft"]["Args"];
    const requiredKeys = EXPECTED_CORE_RPC_ARGS;
    const shape: Record<(typeof requiredKeys)[number], unknown> = {
      p_schema_version: "wa-knowledge/v1",
      p_source_catalogue_version_ids: ["11111111-1111-4111-8111-111111111111"],
      p_knowledge: {},
      p_content_checksum: "a".repeat(64),
      p_candidate_status: "PUBLICATION_CANDIDATE",
      p_handoff_eligibility: "HANDOFF_READY",
      p_idempotency_key: "wa-knowledge-handoff:test",
    };
    const keys = Object.keys(shape).sort();
    expect(keys).toEqual([...requiredKeys].sort());

    const typed: RpcArgs = shape;
    expect(typed.p_schema_version).toBe("wa-knowledge/v1");
    expect(typed.p_handoff_eligibility).toBe("HANDOFF_READY");
  });
});
