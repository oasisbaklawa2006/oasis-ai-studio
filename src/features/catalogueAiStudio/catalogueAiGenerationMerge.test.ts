import { describe, expect, it } from "vitest";
import {
  advanceAiFieldTracking,
  buildAiGenerationProvenance,
  isAiGenerationBlockedByIdentity,
  mergeAiGeneratedContent,
  readPersistedAiGenerationProvenance,
  restoreAiGenerationState,
  type AiFieldTracking,
} from "./catalogueAiGenerationMerge";
import {
  CATALOGUE_DRAFT_CONTENT_KEYS,
  CATALOGUE_DRAFT_PROMPT_KEYS,
  type CatalogueDraftContent,
  type CatalogueDraftContentKey,
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

function tracking(overrides: Partial<AiFieldTracking>): AiFieldTracking {
  return { watchedFields: [], lockedHumanEditedFields: [], lockedPreservedFields: [], ...overrides };
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

  it(
    "always preserves a locked field regardless of whether it matches the baseline, so a " +
      "regeneration never overwrites content already known to be human-authored (Bugbot regression: " +
      "a restored human-edited field, whose baseline is the loaded — already edited — value, looked " +
      "'unchanged' to a plain diff and would otherwise be silently overwritten by fresh AI text)",
    () => {
      const baseline = content("loaded value"); // baseline equals current — a plain diff would NOT flag this as edited
      const current = content("loaded value");
      const ai = content("fresh ai text");
      const result = mergeAiGeneratedContent(current, ai, baseline, new Set(["catalogue_title"]));
      expect(result.content.catalogue_title).toBe("loaded value");
      expect(result.appliedFields).not.toContain("catalogue_title");
    },
  );
});

describe("advanceAiFieldTracking", () => {
  it("starts fresh (all preserved fields become lockedPreservedFields) when there is no prior tracking", () => {
    const appliedFields: CatalogueDraftContentKey[] = ["catalogue_title", "short_description"];
    const next = advanceAiFieldTracking(null, appliedFields);
    expect(next.watchedFields).toEqual(appliedFields);
    expect(next.lockedHumanEditedFields).toEqual([]);
    expect(next.lockedPreservedFields).toEqual(
      CATALOGUE_DRAFT_CONTENT_KEYS.filter((k) => !appliedFields.includes(k)),
    );
  });

  it("carries locked fields forward unchanged, since mergeAiGeneratedContent never touches them", () => {
    const remaining = CATALOGUE_DRAFT_CONTENT_KEYS.filter(
      (k) => k !== "catalogue_title" && k !== "short_description",
    );
    const prior = tracking({
      watchedFields: ["catalogue_title"],
      lockedHumanEditedFields: ["short_description"],
      lockedPreservedFields: [...remaining],
    });
    const next = advanceAiFieldTracking(prior, ["catalogue_title"]);
    expect(next.lockedHumanEditedFields).toEqual(["short_description"]);
    expect(next.lockedPreservedFields).toEqual([...remaining]);
  });

  it(
    "graduates a previously-watched field into lockedHumanEditedFields when it was preserved this " +
      "round (diverged from its AI baseline — a genuine human edit, which must stick)",
    () => {
      const prior = tracking({ watchedFields: ["catalogue_title", "short_description"] });
      // Only short_description was freshly applied; catalogue_title was preserved (diverged).
      const next = advanceAiFieldTracking(prior, ["short_description"]);
      expect(next.watchedFields).toEqual(["short_description"]);
      expect(next.lockedHumanEditedFields).toEqual(["catalogue_title"]);
    },
  );
});

describe("buildAiGenerationProvenance", () => {
  it("classifies an untouched watched field as fields_ai_generated", () => {
    const ai = content("ai generated");
    const provenance = buildAiGenerationProvenance(
      ai,
      ai,
      tracking({ watchedFields: [...CATALOGUE_DRAFT_CONTENT_KEYS] }),
      "Informational",
    );
    expect(provenance.fields_ai_generated).toEqual([...CATALOGUE_DRAFT_CONTENT_KEYS]);
    expect(provenance.fields_human_edited_after_generation).toEqual([]);
    expect(provenance.fields_preserved_from_prior_edit).toEqual([]);
  });

  it("classifies a watched field the operator then changed as human_edited_after_generation", () => {
    const aiBaseline = content("ai generated");
    const final = content("ai generated", { catalogue_title: "operator rewrote this" });
    const provenance = buildAiGenerationProvenance(
      final,
      aiBaseline,
      tracking({ watchedFields: [...CATALOGUE_DRAFT_CONTENT_KEYS] }),
      "Premium",
    );
    expect(provenance.fields_human_edited_after_generation).toEqual(["catalogue_title"]);
    expect(provenance.fields_ai_generated).not.toContain("catalogue_title");
  });

  it("passes locked fields through unconditionally, never re-diffing them", () => {
    const aiBaseline = content("ai generated");
    const final = content("ai generated");
    const provenance = buildAiGenerationProvenance(
      final,
      aiBaseline,
      tracking({
        watchedFields: ["short_description"],
        lockedHumanEditedFields: ["catalogue_title"],
        lockedPreservedFields: ["long_description"],
      }),
      "Concise",
    );
    expect(provenance.fields_human_edited_after_generation).toContain("catalogue_title");
    expect(provenance.fields_preserved_from_prior_edit).toEqual(["long_description"]);
  });

  it(
    "a load-and-save cycle with no new edit keeps a human_edited_after_generation field human-edited " +
      "— it must never move back into fields_ai_generated (Bugbot regression: restoreAiGenerationState " +
      "used to treat fields_human_edited_after_generation the same as fields_ai_generated, diffing it " +
      "against the loaded — already-edited — value, which trivially looked 'unchanged' and silently " +
      "reclassified it as untouched AI content)",
    () => {
      const loaded = content("operator's prior edit", { catalogue_title: "operator's prior edit" });
      // Simulate exactly what restoreAiGenerationState does: baseline = loadedContent, tracking from
      // the persisted blob with catalogue_title in lockedHumanEditedFields (not watchedFields).
      const finalContentUnchangedSinceLoad = loaded;
      const provenance = buildAiGenerationProvenance(
        finalContentUnchangedSinceLoad,
        loaded,
        tracking({ lockedHumanEditedFields: ["catalogue_title"] }),
        "Premium",
      );
      expect(provenance.fields_human_edited_after_generation).toContain("catalogue_title");
      expect(provenance.fields_ai_generated).not.toContain("catalogue_title");
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
  it("returns null when there is no source_snapshot, no ai_generation blob, or one missing the service marker", () => {
    expect(restoreAiGenerationState("p1", content("template"), prompts(), null)).toBeNull();
    expect(restoreAiGenerationState("p1", content("template"), prompts(), { some_other_key: 1 })).toBeNull();
    expect(
      restoreAiGenerationState("p1", content("template"), prompts(), {
        ai_generation: { fields_ai_generated: ["catalogue_title"] },
      }),
    ).toBeNull();
  });

  it(
    "splits persisted fields into watchedFields (re-diffable) and locked fields (sticky), instead " +
      "of lumping fields_ai_generated and fields_human_edited_after_generation into one re-diffable " +
      "set (Bugbot regression — see buildAiGenerationProvenance's load-and-save test)",
    () => {
      const loaded = content("loaded from server");
      const snapshot = {
        ai_generation: {
          service: "oasis-ai-chat",
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
      expect(restored?.tracking.watchedFields).toEqual(["catalogue_title"]);
      expect(restored?.tracking.lockedHumanEditedFields).toEqual(["short_description"]);
      expect(restored?.tracking.lockedPreservedFields).toEqual(["long_description"]);
      expect(restored?.tone).toBe("Concise");
    },
  );

  it("restores an all-preserved record too (nothing watched, everything locked-preserved)", () => {
    const loaded = content("loaded from server");
    const snapshot = {
      ai_generation: {
        service: "oasis-ai-chat",
        tone: "Technical",
        fields_ai_generated: [],
        fields_human_edited_after_generation: [],
        fields_preserved_from_prior_edit: [...CATALOGUE_DRAFT_CONTENT_KEYS],
      },
    };
    const restored = restoreAiGenerationState("p1", loaded, prompts(), snapshot);
    expect(restored).not.toBeNull();
    expect(restored?.tracking.watchedFields).toEqual([]);
    expect(restored?.tracking.lockedPreservedFields).toEqual([...CATALOGUE_DRAFT_CONTENT_KEYS]);
  });
});

describe("end-to-end: reload-and-save cycle (restoreAiGenerationState + buildAiGenerationProvenance)", () => {
  // Simulates CatalogueProductStudio.tsx's actual flow: a draft was saved once with real provenance,
  // the studio was reopened (restoreAiGenerationState), and the operator saves again — with or
  // without a further edit. This is the exact defect an independent audit found on top of the round
  // 1-3 Bugbot fixes: the reload path used to lump fields_ai_generated and
  // fields_human_edited_after_generation into one re-diffable set, so an unchanged reload-then-save
  // silently reclassified a human-edited field back into fields_ai_generated.
  const persistedSnapshot = {
    ai_generation: {
      service: "oasis-ai-chat",
      tone: "Premium",
      fields_ai_generated: ["short_description"],
      fields_human_edited_after_generation: ["catalogue_title"],
      fields_preserved_from_prior_edit: CATALOGUE_DRAFT_CONTENT_KEYS.filter(
        (k) => k !== "short_description" && k !== "catalogue_title",
      ),
    },
  };
  const loaded = content("saved text", { catalogue_title: "operator's prior edit" });

  it("an unchanged reload-then-save keeps a human-edited field human-edited, never ai_generated", () => {
    const restored = restoreAiGenerationState("p1", loaded, prompts(), persistedSnapshot);
    expect(restored).not.toBeNull();
    // No new edit — final content is exactly what was loaded.
    const provenance = buildAiGenerationProvenance(loaded, restored!.baseline.content, restored!.tracking, "Premium");
    expect(provenance.fields_human_edited_after_generation).toEqual(["catalogue_title"]);
    expect(provenance.fields_ai_generated).toEqual(["short_description"]);
    expect(provenance.fields_ai_generated).not.toContain("catalogue_title");
  });

  it("a further edit after reload keeps the field human-edited (trivially — it's still different)", () => {
    const restored = restoreAiGenerationState("p1", loaded, prompts(), persistedSnapshot);
    const finalAfterFurtherEdit = { ...loaded, catalogue_title: "operator's newest edit" };
    const provenance = buildAiGenerationProvenance(
      finalAfterFurtherEdit,
      restored!.baseline.content,
      restored!.tracking,
      "Premium",
    );
    expect(provenance.fields_human_edited_after_generation).toContain("catalogue_title");
  });

  it("an untouched AI-generated (watched) field remains ai_generated after reload-then-save", () => {
    const restored = restoreAiGenerationState("p1", loaded, prompts(), persistedSnapshot);
    const provenance = buildAiGenerationProvenance(loaded, restored!.baseline.content, restored!.tracking, "Premium");
    expect(provenance.fields_ai_generated).toContain("short_description");
  });

  it("a watched field edited after reload correctly transitions to human_edited_after_generation", () => {
    const restored = restoreAiGenerationState("p1", loaded, prompts(), persistedSnapshot);
    const finalWithWatchedFieldEdited = { ...loaded, short_description: "operator rewrote this after reload" };
    const provenance = buildAiGenerationProvenance(
      finalWithWatchedFieldEdited,
      restored!.baseline.content,
      restored!.tracking,
      "Premium",
    );
    expect(provenance.fields_human_edited_after_generation).toContain("short_description");
    expect(provenance.fields_ai_generated).not.toContain("short_description");
  });
});
