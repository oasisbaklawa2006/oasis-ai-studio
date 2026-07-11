import { describe, expect, it } from "vitest";
import {
  buildAiGenerationProvenance,
  isAiGenerationBlockedByIdentity,
  mergeAiGeneratedContent,
  readPersistedAiGenerationProvenance,
  restoreAiGenerationState,
} from "./catalogueAiGenerationMerge";
import {
  CATALOGUE_DRAFT_CONTENT_KEYS,
  CATALOGUE_DRAFT_PROMPT_KEYS,
  type CatalogueDraftContent,
  type CatalogueDraftPrompts,
} from "./catalogueDraftTypes";
import type { ReadinessCategory, ReadinessResult } from "./catalogueProductReadiness";

function content(fill: string, overrides: Partial<CatalogueDraftContent> = {}): CatalogueDraftContent {
  const base = Object.fromEntries(CATALOGUE_DRAFT_CONTENT_KEYS.map((k) => [k, fill])) as CatalogueDraftContent;
  return { ...base, ...overrides };
}

function prompts(): CatalogueDraftPrompts {
  return Object.fromEntries(CATALOGUE_DRAFT_PROMPT_KEYS.map((k) => [k, "prompt"])) as CatalogueDraftPrompts;
}

function category(key: string, state: ReadinessCategory["state"]): ReadinessCategory {
  return { key, label: key, state, detail: "", nextAction: null, group: "general" };
}

function readiness(categories: ReadinessCategory[]): ReadinessResult {
  return { score: 0, overallLabel: "Not ready", categories };
}

describe("isAiGenerationBlockedByIdentity", () => {
  it("blocks when readiness is null (not yet computed)", () => {
    expect(isAiGenerationBlockedByIdentity(null)).toBe(true);
  });

  it("blocks when the identity category itself is missing", () => {
    expect(isAiGenerationBlockedByIdentity(readiness([category("identity", "missing")]))).toBe(true);
  });

  it(
    "does NOT block when identity passes even though other categories are missing " +
      "(Bugbot regression: this used to key off overallLabel, which goes 'Not ready' for any " +
      "missing category — hero image, pricing, HSN/GST — wrongly blocking generation)",
    () => {
      const result = readiness([
        category("identity", "pass"),
        category("hero_image", "missing"),
        category("pricing", "missing"),
      ]);
      expect(isAiGenerationBlockedByIdentity(result)).toBe(false);
    },
  );

  it("does NOT block when identity is only a warn (name set, no description yet)", () => {
    expect(isAiGenerationBlockedByIdentity(readiness([category("identity", "warn")]))).toBe(false);
  });
});

describe("mergeAiGeneratedContent", () => {
  it("applies every field when there is no active baseline to compare against", () => {
    const result = mergeAiGeneratedContent(content("old"), content("ai"), null);
    expect(result.content).toEqual(content("ai"));
    expect(result.appliedFields).toEqual([...CATALOGUE_DRAFT_CONTENT_KEYS]);
    expect(result.preservedCount).toBe(0);
  });

  it("preserves a field already diverged from the baseline, applies the rest", () => {
    const baseline = content("template");
    const current = content("template", { catalogue_title: "operator's own title" });
    const ai = content("ai generated");
    const result = mergeAiGeneratedContent(current, ai, baseline);
    expect(result.content.catalogue_title).toBe("operator's own title");
    expect(result.content.short_description).toBe("ai generated");
    expect(result.appliedFields).not.toContain("catalogue_title");
    expect(result.appliedFields).toContain("short_description");
    expect(result.preservedCount).toBe(1);
  });
});

describe("buildAiGenerationProvenance", () => {
  it("classifies an untouched AI-applied field as fields_ai_generated", () => {
    const ai = content("ai generated");
    const provenance = buildAiGenerationProvenance(ai, ai, [...CATALOGUE_DRAFT_CONTENT_KEYS], "Informational");
    expect(provenance.fields_ai_generated).toEqual([...CATALOGUE_DRAFT_CONTENT_KEYS]);
    expect(provenance.fields_human_edited_after_generation).toEqual([]);
    expect(provenance.fields_preserved_from_prior_edit).toEqual([]);
  });

  it("classifies an AI-applied field the operator then changed as human_edited_after_generation", () => {
    const aiBaseline = content("ai generated");
    const final = content("ai generated", { catalogue_title: "operator rewrote this" });
    const provenance = buildAiGenerationProvenance(final, aiBaseline, [...CATALOGUE_DRAFT_CONTENT_KEYS], "Premium");
    expect(provenance.fields_human_edited_after_generation).toEqual(["catalogue_title"]);
    expect(provenance.fields_ai_generated).not.toContain("catalogue_title");
  });

  it(
    "never labels a field AI didn't apply as human_edited_after_generation, even if it differs " +
      "from the AI baseline (Bugbot regression: a field preserved because it was already edited " +
      "BEFORE generation used to be misclassified as edited AFTER generation)",
    () => {
      // catalogue_title was never in appliedFields — it was preserved from a prior edit.
      const appliedFields = CATALOGUE_DRAFT_CONTENT_KEYS.filter((k) => k !== "catalogue_title");
      const aiBaseline = content("ai generated"); // includes a value for catalogue_title AI never applied
      const final = content("ai generated", { catalogue_title: "operator's pre-existing edit" });
      const provenance = buildAiGenerationProvenance(final, aiBaseline, appliedFields, "Concise");
      expect(provenance.fields_human_edited_after_generation).not.toContain("catalogue_title");
      expect(provenance.fields_ai_generated).not.toContain("catalogue_title");
      expect(provenance.fields_preserved_from_prior_edit).toContain("catalogue_title");
    },
  );
});

describe("readPersistedAiGenerationProvenance", () => {
  it("returns null when there is no source_snapshot, no ai_generation blob, or one missing the service marker", () => {
    expect(readPersistedAiGenerationProvenance(null)).toBeNull();
    expect(readPersistedAiGenerationProvenance({})).toBeNull();
    expect(readPersistedAiGenerationProvenance({ ai_generation: null })).toBeNull();
    expect(readPersistedAiGenerationProvenance({ ai_generation: { fields_ai_generated: ["catalogue_title"] } })).toBeNull();
  });

  it(
    "recognizes a real record where every field was preserved (nothing applied), instead of " +
      "treating it as absent (Bugbot regression: a run where the operator had already edited every " +
      "field before generation left fields_ai_generated/fields_human_edited_after_generation both " +
      "empty — a real, intentional record — but was wrongly discarded as if no run had occurred, " +
      "wiping it on the next save)",
    () => {
      const result = readPersistedAiGenerationProvenance({
        ai_generation: {
          service: "oasis-ai-chat",
          tone: "Concise",
          fields_ai_generated: [],
          fields_human_edited_after_generation: [],
          fields_preserved_from_prior_edit: [...CATALOGUE_DRAFT_CONTENT_KEYS],
        },
      });
      expect(result).not.toBeNull();
      expect(result?.fields_ai_generated).toEqual([]);
      expect(result?.fields_human_edited_after_generation).toEqual([]);
      expect(result?.fields_preserved_from_prior_edit).toEqual([...CATALOGUE_DRAFT_CONTENT_KEYS]);
    },
  );

  it(
    "reads a previously saved blob back out unchanged, for preserving provenance history on a " +
      "save that involves no fresh AI generation this session (Bugbot regression: a save used to " +
      "silently overwrite prior provenance with null the moment the studio was reopened)",
    () => {
      const snapshot = {
        product_name: "Pineapple Dragees",
        ai_generation: {
          service: "oasis-ai-chat",
          tone: "Premium",
          fields_ai_generated: ["catalogue_title", "short_description"],
          fields_human_edited_after_generation: ["long_description"],
          fields_preserved_from_prior_edit: ["b2b_sales_copy"],
        },
      };
      const result = readPersistedAiGenerationProvenance(snapshot);
      expect(result).not.toBeNull();
      expect(result?.tone).toBe("Premium");
      expect(result?.fields_ai_generated).toEqual(["catalogue_title", "short_description"]);
      expect(result?.fields_human_edited_after_generation).toEqual(["long_description"]);
      expect(result?.fields_preserved_from_prior_edit).toEqual(["b2b_sales_copy"]);
    },
  );

  it("ignores an unrecognized tone or content key rather than throwing", () => {
    const result = readPersistedAiGenerationProvenance({
      ai_generation: {
        service: "oasis-ai-chat",
        tone: "Aggressive", // not a real CatalogueAiTone
        fields_ai_generated: ["catalogue_title", "not_a_real_field"],
        fields_human_edited_after_generation: [],
      },
    });
    expect(result?.tone).toBeNull();
    expect(result?.fields_ai_generated).toEqual(["catalogue_title"]);
  });
});

describe("restoreAiGenerationState", () => {
  it("returns null when the loaded draft was never touched by AI generation", () => {
    expect(restoreAiGenerationState("p1", content("template"), prompts(), null)).toBeNull();
    expect(restoreAiGenerationState("p1", content("template"), prompts(), { some_other_key: 1 })).toBeNull();
  });

  it(
    "reconstructs the baseline from the freshly loaded content for every AI-touched field, so a " +
      "reopened draft's 'Edited' badge doesn't compare untouched AI fields against the raw " +
      "template (Bugbot regression)",
    () => {
      const loaded = content("loaded from server");
      const snapshot = {
        ai_generation: {
          tone: "Concise",
          fields_ai_generated: ["catalogue_title"],
          fields_human_edited_after_generation: ["short_description"],
          fields_preserved_from_prior_edit: ["long_description"],
        },
      };
      const restored = restoreAiGenerationState("p1", loaded, prompts(), snapshot);
      expect(restored).not.toBeNull();
      expect(restored?.baseline.productId).toBe("p1");
      expect(restored?.baseline.content).toEqual(loaded);
      expect(restored?.appliedFields).toEqual(["catalogue_title", "short_description"]);
      expect(restored?.tone).toBe("Concise");
    },
  );
});
