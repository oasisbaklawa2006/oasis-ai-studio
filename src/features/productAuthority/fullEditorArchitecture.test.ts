import { describe, expect, it } from "vitest";
import {
  buildFullEditorCreatePath,
  buildFullEditorEditPath,
  FULL_EDITOR_CANONICAL_ROUTES,
  FULL_EDITOR_NON_AUTHORITATIVE_ROUTES,
  FULL_EDITOR_TAB_DOMAIN_OWNERSHIP,
  fullEditorFormDraftKey,
  fullEditorTabForReadinessCategory,
  fullEditorTabStorageKey,
  hasFullEditorIdentityConflict,
  resolveFullEditorIdentity,
  resolveFullEditorSavePath,
  resolveFullEditorTabOwner,
  resolveFullEditorTabState,
} from "./fullEditorArchitecture";
import { PRODUCT_EDIT_TABS } from "./productEditTabs";

describe("FULL_EDITOR_CANONICAL_ROUTES", () => {
  it("defines the authoritative create and edit entry paths", () => {
    expect(FULL_EDITOR_CANONICAL_ROUTES.create).toBe("/products/new");
    expect(FULL_EDITOR_CANONICAL_ROUTES.edit).toBe("/products/:id");
    expect(FULL_EDITOR_CANONICAL_ROUTES.mediaDeepLink).toBe("/products/:id/media");
    expect(FULL_EDITOR_CANONICAL_ROUTES.aliasesDeepLink).toBe("/products/:id/aliases");
  });
});

describe("FULL_EDITOR_TAB_DOMAIN_OWNERSHIP", () => {
  it("covers every canonical tab exactly once", () => {
    const ownedTabs = FULL_EDITOR_TAB_DOMAIN_OWNERSHIP.map((entry) => entry.tab).sort();
    expect(ownedTabs).toEqual([...PRODUCT_EDIT_TABS].sort());
  });

  it("assigns downstream owners without Point31 absorbing field domains", () => {
    expect(resolveFullEditorTabOwner("media")?.owner).toBe("Point41");
    expect(resolveFullEditorTabOwner("uom")?.owner).toBe("Point33");
    expect(resolveFullEditorTabOwner("product_truth")?.owner).toBe("Point53");
    expect(resolveFullEditorTabOwner("bogus")).toBeNull();
  });
});

describe("resolveFullEditorIdentity", () => {
  it("resolves create identities for new routes", () => {
    expect(resolveFullEditorIdentity(undefined)).toEqual({ kind: "create", routeId: "new" });
    expect(resolveFullEditorIdentity("new")).toEqual({ kind: "create", routeId: "new" });
    expect(resolveFullEditorIdentity("")).toEqual({ kind: "create", routeId: "new" });
  });

  it("resolves edit identities for persisted product ids", () => {
    expect(resolveFullEditorIdentity("prod-abc")).toEqual({
      kind: "edit",
      routeId: "prod-abc",
      productId: "prod-abc",
    });
  });

  it("fails closed for single-character ids", () => {
    expect(resolveFullEditorIdentity("x").kind).toBe("invalid");
  });
});

describe("hasFullEditorIdentityConflict", () => {
  it("blocks edit saves until the loaded row matches the route id", () => {
    const identity = resolveFullEditorIdentity("prod-1");
    expect(hasFullEditorIdentityConflict(identity, null, false)).toBe(true);
    expect(hasFullEditorIdentityConflict(identity, "prod-1", false)).toBe(false);
    expect(hasFullEditorIdentityConflict(identity, "prod-2", false)).toBe(true);
  });

  it("blocks saves while fetch is pending", () => {
    const createIdentity = resolveFullEditorIdentity("new");
    const editIdentity = resolveFullEditorIdentity("prod-1");
    expect(hasFullEditorIdentityConflict(createIdentity, null, true)).toBe(true);
    expect(hasFullEditorIdentityConflict(editIdentity, "prod-1", true)).toBe(true);
  });
});

describe("resolveFullEditorSavePath", () => {
  const editIdentity = resolveFullEditorIdentity("prod-1");

  it("allows direct write for privileged roles when identity is reconciled", () => {
    expect(
      resolveFullEditorSavePath({
        identity: editIdentity,
        canDirectWrite: true,
        isContributor: false,
        fetchPending: false,
        loadedId: "prod-1",
      }),
    ).toEqual({ kind: "direct_write", allowed: true });
  });

  it("routes contributors to catalogue_product_drafts when direct write is unavailable", () => {
    expect(
      resolveFullEditorSavePath({
        identity: editIdentity,
        canDirectWrite: false,
        isContributor: true,
        fetchPending: false,
        loadedId: "prod-1",
      }),
    ).toEqual({ kind: "contributor_draft", allowed: true });
  });

  it("fails closed for read-only users", () => {
    const result = resolveFullEditorSavePath({
      identity: editIdentity,
      canDirectWrite: false,
      isContributor: false,
      fetchPending: false,
      loadedId: "prod-1",
    });
    expect(result).toEqual({
      kind: "blocked",
      allowed: false,
      reason: "Read-only mode: you do not have permission to save products.",
    });
  });

  it("fails closed on identity conflict", () => {
    const result = resolveFullEditorSavePath({
      identity: editIdentity,
      canDirectWrite: true,
      isContributor: true,
      fetchPending: false,
      loadedId: null,
    });
    expect(result.allowed).toBe(false);
    expect(result.kind).toBe("blocked");
  });

  it("fails closed when direct publish is explicitly unsupported", () => {
    const result = resolveFullEditorSavePath({
      identity: editIdentity,
      canDirectWrite: true,
      isContributor: false,
      fetchPending: false,
      loadedId: "prod-1",
      allowDirectPublish: false,
    });
    expect(result).toEqual({
      kind: "blocked",
      allowed: false,
      reason: "Direct publish is not supported for this product session.",
    });
  });
});

describe("resolveFullEditorTabState", () => {
  it("prefers deep-link tab on first navigation", () => {
    const result = resolveFullEditorTabState({
      rawDeepLinkTab: "media",
      persistedTab: "identity",
      locationKey: "loc-2",
      appliedLocationKey: "loc-1",
    });
    expect(result.initialTab).toBe("media");
    expect(result.shouldApplyDeepLink).toBe(true);
  });

  it("falls back to persisted tab when no deep link is present", () => {
    const result = resolveFullEditorTabState({
      rawDeepLinkTab: null,
      persistedTab: "compliance",
      locationKey: "loc-1",
      appliedLocationKey: "loc-1",
    });
    expect(result.initialTab).toBe("compliance");
    expect(result.shouldApplyDeepLink).toBe(false);
  });

  it("fails closed unknown tabs to identity", () => {
    const result = resolveFullEditorTabState({
      rawDeepLinkTab: "obsolete-tab",
      persistedTab: null,
      locationKey: "loc-1",
      appliedLocationKey: "loc-1",
    });
    expect(result.initialTab).toBe("identity");
  });
});

describe("storage and path helpers", () => {
  it("builds deterministic tab and draft keys", () => {
    expect(fullEditorTabStorageKey("prod-1")).toBe("oasis_product_edit_tab_prod-1");
    expect(fullEditorFormDraftKey(resolveFullEditorIdentity("new"))).toBe(
      "catalogue_product_form_draft_new",
    );
    expect(fullEditorFormDraftKey(resolveFullEditorIdentity("prod-1"))).toBe(
      "catalogue_product_form_draft_prod-1",
    );
  });

  it("builds canonical edit and create paths", () => {
    expect(buildFullEditorCreatePath()).toBe("/products/new");
    expect(buildFullEditorEditPath("prod-1", "media")).toBe("/products/prod-1?tab=media");
    expect(buildFullEditorEditPath("prod-1")).toBe("/products/prod-1");
  });
});

describe("fullEditorTabForReadinessCategory", () => {
  it("maps readiness categories to owned tabs", () => {
    expect(fullEditorTabForReadinessCategory("hero_image")).toBe("media");
    expect(fullEditorTabForReadinessCategory("pricing")).toBe("channels");
    expect(fullEditorTabForReadinessCategory("unknown")).toBe("identity");
  });
});

describe("FULL_EDITOR_NON_AUTHORITATIVE_ROUTES", () => {
  it("lists legacy/stub routes that must not author product truth", () => {
    expect(FULL_EDITOR_NON_AUTHORITATIVE_ROUTES).toContain("/admin/catalogue-builder");
    expect(FULL_EDITOR_NON_AUTHORITATIVE_ROUTES).toContain("/catalogues");
  });
});
