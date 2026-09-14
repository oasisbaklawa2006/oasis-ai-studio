/**
 * Point 43 — Benchmark photography governance canonical contract.
 * Translates internal luxury-catalogue benchmark qualities into Oasis-owned neutral constraints.
 * Sits on Point 42 family authority — no parallel taxonomy. Fail-closed on conflicts with
 * exact-product fidelity, packaging/text preservation, Point 42 slots, or downstream QA.
 * No image generation. Third-party benchmark labels are internal provenance only — never
 * customer-facing or product authority.
 */
import type { CatalogueDraftPromptKey } from "@/features/catalogueAiStudio/catalogueDraftTypes";
import {
  buildControlledPhotographyFamilyContract,
  type ControlledPhotographyFamilyContract,
  type ControlledPhotographyFamilyKey,
  resolveControlledPhotographyFamily,
} from "./controlledPhotographyFamilies";
import type { MediaAssetType, ProductMediaContext } from "./types";

/** Oasis-neutral constraint domains — derived from internal benchmark reference, not brand copy. */
export type BenchmarkConstraintDomain =
  | "composition"
  | "lighting"
  | "product_fidelity"
  | "packaging_text_preservation"
  | "background"
  | "crop_occupancy";

/** Authority keys that reject conflicting benchmark or operator requests — fail-closed. */
export type BenchmarkConflictAuthority =
  | "exact_product_fidelity"
  | "packaging_text_preservation"
  | "point42_required_slots"
  | "downstream_qa_authority";

export type BenchmarkGovernanceConstraint = {
  id: string;
  domain: BenchmarkConstraintDomain;
  label: string;
  /** Oasis-owned neutral rule text — safe for operator display. */
  rule: string;
  /** Internal benchmark provenance — never surfaced to buyers or catalogue copy. */
  benchmarkProvenance: "luxury_catalogue_reference";
  /** Conflict authorities that reject requests violating this constraint. */
  protectedBy: readonly BenchmarkConflictAuthority[];
};

export type FamilyBenchmarkOverlay = {
  familyKey: ControlledPhotographyFamilyKey;
  /** Slot-specific benchmark requirements layered on Point 42 required slots. */
  slotRequirements: Partial<
    Record<
      MediaAssetType,
      {
        composition?: string;
        lighting?: string;
        background?: string;
        cropOccupancy?: string;
        packagingText?: string;
      }
    >
  >;
};

export type BenchmarkPhotographyGovernanceContract = {
  schema: "point43_v1";
  familyKey: ControlledPhotographyFamilyKey;
  label: string;
  /** Universal Oasis-neutral constraints — apply to every family. */
  universalConstraints: readonly BenchmarkGovernanceConstraint[];
  /** Family-specific overlay on Point 42 slot requirements. */
  familyOverlay: FamilyBenchmarkOverlay;
  /** Upstream authorities — Point 43 does not re-derive slots. */
  upstreamAuthority: {
    photographyFamilies: "point42";
    readinessProfiles: "readinessProfiles.ts";
    mediaAuthority: "mediaAuthorityContract.ts";
  };
  /** Downstream programme boundaries — not implemented in Point 43. */
  downstreamAuthority: {
    mobileCamera: "point44";
    enhancement: "point45";
    qa: "point46";
    outputs: "point47";
  };
};

export type BenchmarkGovernanceResolution =
  | {
      ok: true;
      contract: BenchmarkPhotographyGovernanceContract;
      familyContract: ControlledPhotographyFamilyContract;
    }
  | { ok: false; error: "unknown_family" | "family_resolution_failed"; message: string };

export type BenchmarkInstructionValidation =
  | { ok: true; sanitizedInstruction: string }
  | {
      ok: false;
      error: "forbidden_brand_reference" | "conflicts_with_authority" | "empty_instruction";
      message: string;
      conflictAuthority: BenchmarkConflictAuthority;
    };

export type BenchmarkGovernanceCensus = {
  schema: "point43_census_v1";
  baselineSha: string;
  predecessorSha: string;
  universalConstraintCount: number;
  familyOverlayCount: number;
  surfaces: {
    point42Families: string;
    imagePromptTemplates: string;
    imagePromptComposer: string;
    catalogueMediaSlots: string;
    mediaAuthority: string;
    cssStyling: string;
  };
  bateelBrandAudit: {
    customerFacingLeaks: readonly string[];
    internalReferenceOnly: readonly string[];
    remediation: string;
  };
  downstreamPoints: Record<string, string>;
};

/** Universal Oasis-neutral constraints — luxury-catalogue benchmark translated to owned rules. */
export const UNIVERSAL_BENCHMARK_CONSTRAINTS: readonly BenchmarkGovernanceConstraint[] = [
  {
    id: "composition_centered_hero",
    domain: "composition",
    label: "Centered product composition",
    rule: "Product must be centered with clear visual hierarchy; no competing props unless slot is lifestyle.",
    benchmarkProvenance: "luxury_catalogue_reference",
    protectedBy: ["exact_product_fidelity", "point42_required_slots"],
  },
  {
    id: "lighting_soft_even",
    domain: "lighting",
    label: "Soft even studio lighting",
    rule: "Use soft, even studio lighting; avoid harsh shadows or colour casts that alter product appearance.",
    benchmarkProvenance: "luxury_catalogue_reference",
    protectedBy: ["exact_product_fidelity"],
  },
  {
    id: "product_fidelity_exact",
    domain: "product_fidelity",
    label: "Exact product fidelity",
    rule: "Preserve exact product shape, colour, count, and arrangement — no generative alteration of the product itself.",
    benchmarkProvenance: "luxury_catalogue_reference",
    protectedBy: ["exact_product_fidelity", "downstream_qa_authority"],
  },
  {
    id: "packaging_text_preserve",
    domain: "packaging_text_preservation",
    label: "Packaging and label text preservation",
    rule: "All existing packaging, label, and carton text must remain legible and unmodified — no added or removed text.",
    benchmarkProvenance: "luxury_catalogue_reference",
    protectedBy: ["packaging_text_preservation", "downstream_qa_authority"],
  },
  {
    id: "background_neutral_clean",
    domain: "background",
    label: "Clean neutral background",
    rule: "Use clean neutral backgrounds for catalogue and hero slots; lifestyle slots may use contextual settings without brand impersonation.",
    benchmarkProvenance: "luxury_catalogue_reference",
    protectedBy: ["exact_product_fidelity"],
  },
  {
    id: "crop_occupancy_catalogue",
    domain: "crop_occupancy",
    label: "Catalogue crop and frame occupancy",
    rule: "Square slots use 1:1 centred crop; hero slots fill frame without clipping product; close-ups show texture without cropping identity.",
    benchmarkProvenance: "luxury_catalogue_reference",
    protectedBy: ["point42_required_slots"],
  },
  {
    id: "no_text_overlay",
    domain: "packaging_text_preservation",
    label: "No generative text overlay",
    rule: "Never add price tags, promotional text, watermarks, or synthetic label copy to any product image.",
    benchmarkProvenance: "luxury_catalogue_reference",
    protectedBy: ["packaging_text_preservation", "downstream_qa_authority"],
  },
];

/** Family-specific benchmark overlays — keyed to Point 42 readiness slots, not a parallel taxonomy. */
export const FAMILY_BENCHMARK_OVERLAYS: Record<
  ControlledPhotographyFamilyKey,
  FamilyBenchmarkOverlay
> = {
  baklawa_small_sweets: {
    familyKey: "baklawa_small_sweets",
    slotRequirements: {
      primary_image: {
        composition: "Centered hero with full product visible",
        lighting: "Soft even studio light",
        background: "Clean neutral ivory or white",
        cropOccupancy: "Product fills 60–75% of frame",
      },
      catalogue_image: {
        composition: "Square 1:1 centred",
        background: "Pure white or neutral",
        cropOccupancy: "Full product within safe margins",
      },
      close_up_image: {
        composition: "Macro texture detail",
        lighting: "Natural soft light, shallow depth of field",
        cropOccupancy: "Texture visible without losing product identity",
      },
    },
  },
  gift_box: {
    familyKey: "gift_box",
    slotRequirements: {
      pack_front_image: {
        composition: "Closed pack front-facing, centred",
        packagingText: "All label and box text legible and unmodified",
        background: "Clean neutral surface",
      },
      open_pack_image: {
        composition: "Open pack showing contents arrangement",
        packagingText: "Interior label text preserved if visible",
        lighting: "Soft even light revealing contents",
      },
      primary_image: {
        composition: "Hero of closed pack or arranged contents",
        background: "Neutral luxury catalogue tone",
      },
    },
  },
  export_pack: {
    familyKey: "export_pack",
    slotRequirements: {
      label_front_image: {
        composition: "Label front flat and legible",
        packagingText: "HSN, weight, and regulatory text must remain readable",
        lighting: "Even light without glare on label",
      },
      packaging_reference: {
        composition: "Full retail pack reference shot",
        packagingText: "All export label fields preserved",
      },
      master_carton_image: {
        composition: "Master carton front with shipping marks visible",
        packagingText: "Carton markings and barcodes unmodified",
      },
    },
  },
  hamper: {
    familyKey: "hamper",
    slotRequirements: {
      hamper_arrangement_image: {
        composition: "Full hamper arrangement, contents visible",
        lighting: "Warm natural daylight tone",
        cropOccupancy: "Arrangement fills frame without clipping basket edge",
      },
      close_up_image: {
        composition: "Detail of key contents or texture",
        lighting: "Soft natural light",
      },
      primary_image: {
        composition: "Hero of closed or presented hamper",
        background: "Contextual table setting allowed — no third-party brand props",
      },
    },
  },
  general: {
    familyKey: "general",
    slotRequirements: {
      primary_image: {
        composition: "Centered hero shot",
        background: "Clean neutral background",
        lighting: "Soft even studio lighting",
      },
    },
  },
};

/** Forbidden third-party brand references in operator instructions — internal benchmark only. */
const FORBIDDEN_BRAND_PATTERNS: readonly { pattern: RegExp; label: string }[] = [
  { pattern: /\bbateel\b/i, label: "third-party brand name" },
  { pattern: /\bgodiva\b/i, label: "third-party brand name" },
  { pattern: /\bpatchi\b/i, label: "third-party brand name" },
];

/** Instruction patterns that conflict with protected authorities — fail-closed. */
const AUTHORITY_CONFLICT_PATTERNS: readonly {
  pattern: RegExp;
  authority: BenchmarkConflictAuthority;
  message: string;
}[] = [
  {
    pattern:
      /\b(add|overlay|insert|generate|create)\b.{0,30}\b(text|label|price|watermark|logo|brand)\b/i,
    authority: "packaging_text_preservation",
    message:
      "Cannot add generative text, labels, or watermarks — conflicts with packaging/text preservation.",
  },
  {
    pattern: /\b(remove|erase|hide|blur|obscure)\b.{0,30}\b(text|label|packaging)\b/i,
    authority: "packaging_text_preservation",
    message: "Cannot remove or obscure existing packaging or label text.",
  },
  {
    pattern:
      /\b(change|alter|modify|recolor|reshape|replace)\b.{0,30}\b(product|item|sweet|piece|count)\b/i,
    authority: "exact_product_fidelity",
    message:
      "Cannot alter exact product shape, colour, or count — conflicts with product fidelity.",
  },
  {
    pattern:
      /\b(skip|omit|without|no)\b.{0,20}\b(hero|close-?up|packaging|label|white.?background|square)\b/i,
    authority: "point42_required_slots",
    message: "Cannot skip Point 42 required photography slots.",
  },
  {
    pattern: /\b(auto.?approve|bypass.?qa|ignore.?quality)\b/i,
    authority: "downstream_qa_authority",
    message: "Cannot bypass downstream QA authority (Point 46).",
  },
];

export function buildBenchmarkPhotographyGovernanceContract(
  familyKey: ControlledPhotographyFamilyKey,
): BenchmarkPhotographyGovernanceContract {
  const familyContract = buildControlledPhotographyFamilyContract(familyKey);

  return {
    schema: "point43_v1",
    familyKey,
    label: familyContract.label,
    universalConstraints: UNIVERSAL_BENCHMARK_CONSTRAINTS,
    familyOverlay: FAMILY_BENCHMARK_OVERLAYS[familyKey],
    upstreamAuthority: {
      photographyFamilies: "point42",
      readinessProfiles: "readinessProfiles.ts",
      mediaAuthority: "mediaAuthorityContract.ts",
    },
    downstreamAuthority: {
      mobileCamera: "point44",
      enhancement: "point45",
      qa: "point46",
      outputs: "point47",
    },
  };
}

/** Fail-closed resolution — requires successful Point 42 family resolution first. */
export function resolveBenchmarkPhotographyGovernance(
  product: ProductMediaContext,
): BenchmarkGovernanceResolution {
  const familyResolved = resolveControlledPhotographyFamily(product);
  if (!familyResolved.ok) {
    return {
      ok: false,
      error: "family_resolution_failed",
      message: familyResolved.message,
    };
  }

  return {
    ok: true,
    contract: buildBenchmarkPhotographyGovernanceContract(familyResolved.profile),
    familyContract: familyResolved.contract,
  };
}

/**
 * Validate an operator instruction appended to a governed image prompt.
 * Fail-closed on brand impersonation and authority conflicts. No image generation.
 */
export function validateBenchmarkOperatorInstruction(
  instruction: string,
  _context?: {
    familyKey?: ControlledPhotographyFamilyKey;
    promptKey?: CatalogueDraftPromptKey;
  },
): BenchmarkInstructionValidation {
  const trimmed = instruction.trim();
  if (!trimmed) {
    return {
      ok: false,
      error: "empty_instruction",
      message: "Instruction is empty.",
      conflictAuthority: "exact_product_fidelity",
    };
  }

  for (const { pattern, label } of FORBIDDEN_BRAND_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        ok: false,
        error: "forbidden_brand_reference",
        message: `Instruction references ${label} — internal benchmark only, not permitted in operator prompts.`,
        conflictAuthority: "exact_product_fidelity",
      };
    }
  }

  for (const { pattern, authority, message } of AUTHORITY_CONFLICT_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        ok: false,
        error: "conflicts_with_authority",
        message,
        conflictAuthority: authority,
      };
    }
  }

  return { ok: true, sanitizedInstruction: trimmed };
}

/** Returns constraints protecting a given authority — for policy tests and census. */
export function constraintsForAuthority(
  authority: BenchmarkConflictAuthority,
): BenchmarkGovernanceConstraint[] {
  return UNIVERSAL_BENCHMARK_CONSTRAINTS.filter((c) => c.protectedBy.includes(authority));
}

/** Slot-specific benchmark requirements for a family + readiness slot — null when no overlay. */
export function benchmarkSlotRequirements(
  familyKey: ControlledPhotographyFamilyKey,
  slot: MediaAssetType,
): FamilyBenchmarkOverlay["slotRequirements"][MediaAssetType] | null {
  const overlay = FAMILY_BENCHMARK_OVERLAYS[familyKey];
  return overlay.slotRequirements[slot] ?? null;
}

/** Programme census of benchmark governance surfaces and Bateel brand-safety audit. */
export function buildBenchmarkPhotographyGovernanceCensus(
  baselineSha: string,
  predecessorSha: string,
): BenchmarkGovernanceCensus {
  return {
    schema: "point43_census_v1",
    baselineSha,
    predecessorSha,
    universalConstraintCount: UNIVERSAL_BENCHMARK_CONSTRAINTS.length,
    familyOverlayCount: Object.keys(FAMILY_BENCHMARK_OVERLAYS).length,
    surfaces: {
      point42Families: "src/features/mediaReadiness/controlledPhotographyFamilies.ts",
      imagePromptTemplates:
        "src/features/catalogueAiStudio/catalogueContentGenerators.ts (IMAGE_PROMPT_BLOCK_META)",
      imagePromptComposer:
        "src/features/catalogueAiStudio/catalogueContentGenerators.ts (composeCatalogueImagePrompt)",
      catalogueMediaSlots: "src/features/catalogueAiStudio/catalogueMediaSlots.ts",
      mediaAuthority: "src/features/mediaReadiness/mediaAuthorityContract.ts",
      cssStyling: "src/index.css (luxury catalogue styling — no photo governance)",
    },
    bateelBrandAudit: {
      customerFacingLeaks: [],
      internalReferenceOnly: [
        "docs/PR_SEQUENCE.md — PR-09 Bateel UI rebuild (separate programme track)",
        "controlledPhotographyFamilies.ts downstreamAuthority.bateelGovernance key (internal routing only)",
      ],
      remediation:
        "CSS comments neutralized to 'luxury catalogue'; no Bateel in product authority, prompts, or buyer-facing copy",
    },
    downstreamPoints: {
      point44: "src/features/mediaReadiness/guidedMobileCameraCapture.ts",
      point45: "Photo enhancement — separate",
      point46: "Photography QA scoring — separate",
      point47: "Photography output formats — separate",
    },
  };
}
