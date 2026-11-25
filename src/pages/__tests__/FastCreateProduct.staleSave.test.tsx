import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  emptyFastCreateDraft,
  FAST_CREATE_DRAFT_STORAGE_KEY,
  type FastCreateDraftSnapshot,
  loadFastCreateDraft,
  saveFastCreateDraft,
} from "@/features/fastCreate/fastCreateDraft";
import { buildHeuristicSuggestions } from "@/features/fastCreate/fastCreateSuggestions";

vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  onApply: null as null | ((next: unknown) => void),
  save: vi.fn(),
  requireSku: vi.fn(),
  enrich: vi.fn(),
  upload: vi.fn(),
  insert: vi.fn(),
  fetchRules: vi.fn(),
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    message: vi.fn(),
  },
}));

vi.mock("sonner", () => ({ toast: h.toast }));

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => h.navigate,
}));

vi.mock("@/contexts/AuthContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/contexts/AuthContext")>()),
  useAuth: () => ({ roles: ["admin"] }),
}));

// The write-mode banner probes Central permissions over the network; keep the test offline.
vi.mock("@/shared/auth/centralPermissions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/auth/centralPermissions")>()),
  canWriteProductsDirectly: async () => false,
  isCatalogueContributor: async () => true,
}));

vi.mock("@/lib/skuCodeRules", () => ({
  fetchActiveSkuCodeRules: h.fetchRules,
}));

vi.mock("@/features/fastCreate/fastCreateSuggestions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/fastCreate/fastCreateSuggestions")>()),
  enrichSuggestionsWithAi: h.enrich,
}));

vi.mock("@/features/fastCreate/uploadFastCreateHero", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/fastCreate/uploadFastCreateHero")>()),
  uploadFastCreateHero: h.upload,
}));

// Keep the real client (other modules wire it at import time) and intercept only the one table
// the page writes directly.
vi.mock("@/integrations/supabase/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/integrations/supabase/client")>();
  const real = actual.supabase;
  const supabase = new Proxy(real, {
    get(target, prop, receiver) {
      if (prop === "from") {
        return (table: string) =>
          table === "sku_code_rules" ? { insert: h.insert } : target.from(table as never);
      }
      return Reflect.get(target, prop, receiver);
    },
  });
  return { ...actual, supabase };
});

vi.mock("@/features/productAuthority/mediaReadiness", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/productAuthority/mediaReadiness")>()),
  probeProductMediaBucket: async () => ({ status: "available", message: "" }),
}));

vi.mock("@/features/fastCreate/saveFastCreateProduct", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/fastCreate/saveFastCreateProduct")>()),
  requireFastCreateSku: h.requireSku,
  saveFastCreateProduct: h.save,
}));

// The real panel needs camera/OCR plumbing. Its only contract with the page is `onApply`, so
// capture the page's handler and let the test invoke it exactly as the panel does.
vi.mock("@/components/FastCreateIntakePanel", () => ({
  FastCreateIntakePanel: ({ onApply }: { onApply: (next: unknown) => void }) => {
    h.onApply = onApply;
    return null;
  },
}));

import FastCreateProduct from "../FastCreateProduct";

function readyDraft(overrides: Partial<FastCreateDraftSnapshot>): FastCreateDraftSnapshot {
  return {
    ...emptyFastCreateDraft(),
    productName: "Misr 15",
    categoryKey: "ready_packs",
    saleType: "retail_ready_pack",
    packagingCode: "PAPERBOX",
    packagingLabel: "Printed Paper Box",
    qtyPerPack: "6",
    mrp: "450",
    heroUrl: "https://x/hero.jpg",
    resolvedSku: "OAS-AS-BKL-ASS-PAPERBOX-0002",
    ...overrides,
  };
}

const ORIGINAL = readyDraft({ productName: "Original draft", resolvedSku: "SKU-ORIGINAL" });
const REPLACEMENT = readyDraft({
  productName: "Intake replacement",
  resolvedSku: "SKU-REPLACEMENT",
});

let host: HTMLDivElement;
let root: Root;

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function createButton(): HTMLButtonElement {
  const button = Array.from(host.querySelectorAll("button")).find((b) =>
    b.textContent?.includes("Create Product Draft"),
  );
  if (!button) throw new Error("Create Product Draft button not rendered");
  return button as HTMLButtonElement;
}

async function mountPageWithOriginalDraft() {
  saveFastCreateDraft(ORIGINAL);
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root.render(
      <MemoryRouter>
        <FastCreateProduct />
      </MemoryRouter>,
    );
  });
  await flush();
}

async function startSaveWithOriginalDraft() {
  await mountPageWithOriginalDraft();
  expect(createButton().disabled).toBe(false);
  await act(async () => {
    createButton().click();
  });
  await flush();
  expect(h.save).toHaveBeenCalledTimes(1);
  expect(createButton().disabled).toBe(true); // saving
}

let finishSave!: (value: unknown) => void;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function buttonByText(text: string, within: ParentNode = document.body): HTMLButtonElement {
  const found = Array.from(within.querySelectorAll("button")).find(
    (b) => b.textContent?.trim() === text,
  );
  if (!found) throw new Error(`Button "${text}" not rendered`);
  return found as HTMLButtonElement;
}

beforeEach(() => {
  sessionStorage.clear();
  for (const fn of [h.navigate, h.toast.success, h.toast.info, h.toast.error, h.toast.warning]) {
    fn.mockReset();
  }
  h.requireSku.mockReset().mockResolvedValue({ sku: "SKU-ORIGINAL" });
  h.save.mockReset().mockImplementation(
    () =>
      new Promise((resolve) => {
        finishSave = resolve;
      }),
  );
  h.enrich.mockReset();
  h.upload.mockReset();
  h.insert.mockReset().mockResolvedValue({ error: null });
  h.fetchRules.mockReset().mockResolvedValue({ rules: [], error: null });
  h.onApply = null;
  vi.stubGlobal(
    "URL",
    Object.assign(URL, {
      createObjectURL: vi.fn(() => "blob:test"),
      revokeObjectURL: vi.fn(),
    }),
  );
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  host.remove();
  sessionStorage.clear();
});

describe("FastCreateProduct stale save vs. intake draft replacement", () => {
  it("an in-flight save that finishes after intake replaces the draft cannot clear it, overwrite its SKU or navigate", async () => {
    await startSaveWithOriginalDraft();

    // Intake replaces the draft while the save is still in flight.
    await act(async () => {
      h.onApply?.(REPLACEMENT);
    });
    await flush();

    // The save button is usable again for the replacement draft (saving was reset).
    expect(createButton().disabled).toBe(false);
    expect(loadFastCreateDraft()?.productName).toBe("Intake replacement");

    // The stale save now resolves with a receipt that would normally clear and navigate.
    await act(async () => {
      finishSave({ id: "product-1", sku: "SKU-ORIGINAL" });
    });
    await flush();

    expect(h.navigate).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(FAST_CREATE_DRAFT_STORAGE_KEY)).not.toBeNull();
    const kept = loadFastCreateDraft();
    expect(kept?.productName).toBe("Intake replacement");
    expect(kept?.resolvedSku).toBe("SKU-REPLACEMENT");
    expect(h.toast.success).not.toHaveBeenCalled();
    expect(h.toast.info).toHaveBeenCalledTimes(1);
  });

  it("ignores a stale save's failure after intake replaced the draft", async () => {
    await startSaveWithOriginalDraft();
    await act(async () => {
      h.onApply?.(REPLACEMENT);
    });
    await flush();
    await act(async () => {
      finishSave(Promise.reject(new Error("stale failure")));
    });
    await flush();
    expect(h.toast.error).not.toHaveBeenCalled();
    expect(createButton().disabled).toBe(false);
    expect(loadFastCreateDraft()?.productName).toBe("Intake replacement");
  });

  it("keeps the normal clear-and-navigate behaviour when intake did not replace the draft", async () => {
    await startSaveWithOriginalDraft();
    await act(async () => {
      finishSave({ id: "product-1", sku: "SKU-ORIGINAL" });
    });
    await flush();
    expect(h.navigate).toHaveBeenCalledWith("/products/product-1");
    expect(sessionStorage.getItem(FAST_CREATE_DRAFT_STORAGE_KEY)).toBeNull();
    expect(h.toast.success).toHaveBeenCalledTimes(1);
  });
});

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("FastCreateProduct other async handlers vs. draft replacement", () => {
  it("a stale Generate suggestions cannot write suggestions or a SKU into the replacement draft", async () => {
    await mountPageWithOriginalDraft();
    const enrich = deferred<ReturnType<typeof buildHeuristicSuggestions>>();
    h.enrich.mockReturnValue(enrich.promise);

    await act(async () => {
      buttonByText("Generate suggestions", host).click();
    });
    await flush();
    expect(h.enrich).toHaveBeenCalledTimes(1);

    await act(async () => {
      h.onApply?.(REPLACEMENT);
    });
    await flush();

    h.requireSku.mockResolvedValue({ sku: "SKU-STALE-GENERATE" });
    await act(async () => {
      enrich.resolve(buildHeuristicSuggestions("Original draft", "ready_packs"));
    });
    await flush();

    const kept = loadFastCreateDraft();
    expect(kept?.productName).toBe("Intake replacement");
    expect(kept?.resolvedSku).toBe("SKU-REPLACEMENT");
    expect(kept?.suggestions).toBeNull();
    // The stale request must not even allocate a SKU, nor announce success for the old draft.
    expect(h.requireSku).not.toHaveBeenCalled();
    expect(h.toast.success).not.toHaveBeenCalled();
    // The replacement draft's own Generate button is usable again.
    expect(buttonByText("Generate suggestions", host).disabled).toBe(false);
  });

  it("a stale Refresh SKU cannot write its SKU into the replacement draft", async () => {
    await mountPageWithOriginalDraft();
    const sku = deferred<{ sku: string }>();
    h.requireSku.mockReturnValue(sku.promise);

    await act(async () => {
      buttonByText("Refresh SKU", host).click();
    });
    await flush();
    expect(h.requireSku).toHaveBeenCalledTimes(1);

    await act(async () => {
      h.onApply?.(REPLACEMENT);
    });
    await flush();
    await act(async () => {
      sku.resolve({ sku: "SKU-STALE-REFRESH" });
    });
    await flush();

    expect(loadFastCreateDraft()?.resolvedSku).toBe("SKU-REPLACEMENT");
  });

  it("a stale Refresh SKU failure cannot null the replacement draft's SKU or show its error", async () => {
    await mountPageWithOriginalDraft();
    const sku = deferred<{ sku: string }>();
    h.requireSku.mockReturnValue(sku.promise);

    await act(async () => {
      buttonByText("Refresh SKU", host).click();
    });
    await flush();
    await act(async () => {
      h.onApply?.(REPLACEMENT);
    });
    await flush();
    await act(async () => {
      sku.reject(new Error("stale SKU failure"));
    });
    await flush();

    expect(loadFastCreateDraft()?.resolvedSku).toBe("SKU-REPLACEMENT");
    expect(host.textContent).not.toContain("stale SKU failure");
  });

  it("a stale hero upload cannot attach its image to the replacement draft", async () => {
    await mountPageWithOriginalDraft();
    const upload = deferred<string>();
    h.upload.mockReturnValue(upload.promise);

    const input = host.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, "files", {
      value: [new File(["x"], "stale.jpg", { type: "image/jpeg" })],
    });
    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await flush();
    expect(h.upload).toHaveBeenCalledTimes(1);

    await act(async () => {
      h.onApply?.(
        readyDraft({ productName: "Intake replacement", heroUrl: "https://x/replacement.jpg" }),
      );
    });
    await flush();
    await act(async () => {
      upload.resolve("https://x/stale-hero.jpg");
    });
    await flush();

    expect(loadFastCreateDraft()?.heroUrl).toBe("https://x/replacement.jpg");
    expect(h.toast.success).not.toHaveBeenCalledWith("Image uploaded");
  });

  it("a stale Add packaging option cannot select its code on the replacement draft", async () => {
    await mountPageWithOriginalDraft();
    const rules = deferred<{ rules: never[]; error: null }>();

    await act(async () => {
      buttonByText("Add option", host).click();
    });
    await flush();
    const dialog = document.body.querySelector('[role="dialog"]') as HTMLElement;
    const [code, label] = Array.from(dialog.querySelectorAll("input"));
    await act(async () => {
      setInputValue(code, "NEWBOX");
      setInputValue(label, "New Box");
    });
    h.fetchRules.mockReturnValue(rules.promise);
    await act(async () => {
      buttonByText("Add option", dialog).click();
    });
    await flush();
    expect(h.insert).toHaveBeenCalledTimes(1);

    await act(async () => {
      h.onApply?.(REPLACEMENT);
    });
    await flush();
    await act(async () => {
      rules.resolve({ rules: [], error: null });
    });
    await flush();

    const kept = loadFastCreateDraft();
    expect(kept?.packagingCode).toBe("PAPERBOX");
    expect(kept?.resolvedSku).toBe("SKU-REPLACEMENT");
  });
});

describe("FastCreateProduct async handlers still work when the draft is unchanged", () => {
  it("Generate suggestions applies suggestions and the resolved SKU to the current draft", async () => {
    await mountPageWithOriginalDraft();
    const enriched = buildHeuristicSuggestions("Original draft", "ready_packs");
    h.enrich.mockResolvedValue(enriched);
    h.requireSku.mockResolvedValue({ sku: "SKU-GENERATED" });

    await act(async () => {
      buttonByText("Generate suggestions", host).click();
    });
    await flush();
    await flush();

    const kept = loadFastCreateDraft();
    expect(kept?.suggestions).not.toBeNull();
    expect(kept?.resolvedSku).toBe("SKU-GENERATED");
    expect(h.toast.success).toHaveBeenCalledWith("Suggestions ready — review, edit, and create.");
    expect(buttonByText("Generate suggestions", host).disabled).toBe(false);
  });

  it("a hero upload attaches to the current draft", async () => {
    await mountPageWithOriginalDraft();
    h.upload.mockResolvedValue("https://x/new-hero.jpg");
    const input = host.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, "files", {
      value: [new File(["x"], "hero.jpg", { type: "image/jpeg" })],
    });
    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await flush();
    expect(loadFastCreateDraft()?.heroUrl).toBe("https://x/new-hero.jpg");
    expect(h.toast.success).toHaveBeenCalledWith("Image uploaded");
  });

  it("a new packaging option is selected on the draft it was added for", async () => {
    await mountPageWithOriginalDraft();
    await act(async () => {
      buttonByText("Add option", host).click();
    });
    await flush();
    const dialog = document.body.querySelector('[role="dialog"]') as HTMLElement;
    const [code, label] = Array.from(dialog.querySelectorAll("input"));
    await act(async () => {
      setInputValue(code, "NEWBOX");
      setInputValue(label, "New Box");
    });
    await act(async () => {
      buttonByText("Add option", dialog).click();
    });
    await flush();
    await flush();
    expect(loadFastCreateDraft()?.packagingCode).toBe("NEWBOX");
  });
});

describe("detached save notice", () => {
  it("never promises navigation that the detached save does not perform", async () => {
    await startSaveWithOriginalDraft();
    await act(async () => {
      h.onApply?.(REPLACEMENT);
    });
    await flush();
    await act(async () => {
      finishSave({ id: "product-1", sku: "SKU-ORIGINAL" });
    });
    await flush();

    expect(h.navigate).not.toHaveBeenCalled();
    const notice = String(h.toast.info.mock.calls[0]?.[0]);
    expect(notice).not.toMatch(/opening/i);
    expect(notice).toContain("SKU-ORIGINAL");
    expect(notice).toMatch(/draft you are working on now was not changed/i);
  });
});

function setSelectValue(select: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  setter?.call(select, value);
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function selectContaining(optionText: string): HTMLSelectElement {
  const found = Array.from(host.querySelectorAll("select")).find((sel) =>
    Array.from(sel.options).some((o) => o.textContent?.includes(optionText)),
  );
  if (!found) throw new Error(`select with option "${optionText}" not rendered`);
  return found;
}

function productNameInput(): HTMLInputElement {
  return host.querySelector('input[placeholder^="Misr 15"]') as HTMLInputElement;
}

const PACKAGING_RULES = [
  { code: "PAPERBOX", label: "Printed Paper Box", code_type: "packaging" },
  { code: "SLEEVE", label: "Sleeve", code_type: "packaging" },
] as never[];

describe("FastCreateProduct async results vs. input changes (same draft)", () => {
  it("a SKU request that finishes after the category changed cannot write its SKU", async () => {
    await mountPageWithOriginalDraft();
    const sku = deferred<{ sku: string }>();
    h.requireSku.mockReturnValue(sku.promise);

    await act(async () => {
      buttonByText("Refresh SKU", host).click();
    });
    await flush();
    await act(async () => {
      setSelectValue(selectContaining("Baklawa"), "baklawa");
    });
    await flush();
    await act(async () => {
      sku.resolve({ sku: "SKU-STALE-CATEGORY" });
    });
    await flush();

    const kept = loadFastCreateDraft();
    expect(kept?.categoryKey).toBe("baklawa");
    expect(kept?.resolvedSku).toBeNull(); // the category change cleared it; the stale one must not return
  });

  it("a SKU request that finishes after the packaging changed cannot write its SKU", async () => {
    h.fetchRules.mockResolvedValue({ rules: PACKAGING_RULES, error: null });
    await mountPageWithOriginalDraft();
    const sku = deferred<{ sku: string }>();
    h.requireSku.mockReturnValue(sku.promise);

    await act(async () => {
      buttonByText("Refresh SKU", host).click();
    });
    await flush();
    await act(async () => {
      setSelectValue(selectContaining("Select packaging"), "SLEEVE");
    });
    await flush();
    await act(async () => {
      sku.resolve({ sku: "SKU-STALE-PACKAGING" });
    });
    await flush();

    const kept = loadFastCreateDraft();
    expect(kept?.packagingCode).toBe("SLEEVE");
    expect(kept?.resolvedSku).toBeNull();
  });

  it("an outdated SKU failure cannot clear a newer valid SKU or show its error", async () => {
    await mountPageWithOriginalDraft();
    const stale = deferred<{ sku: string }>();
    h.requireSku.mockReturnValueOnce(stale.promise).mockResolvedValueOnce({ sku: "SKU-NEWER" });

    await act(async () => {
      buttonByText("Refresh SKU", host).click();
    });
    await flush();
    await act(async () => {
      setSelectValue(selectContaining("Baklawa"), "baklawa");
    });
    await flush();
    await act(async () => {
      buttonByText("Refresh SKU", host).click();
    });
    await flush();
    expect(loadFastCreateDraft()?.resolvedSku).toBe("SKU-NEWER");

    await act(async () => {
      stale.reject(new Error("outdated SKU failure"));
    });
    await flush();

    expect(loadFastCreateDraft()?.resolvedSku).toBe("SKU-NEWER");
    expect(host.textContent).not.toContain("outdated SKU failure");
  });

  it("Create does not write its SKU back after the category changed mid-request, and still saves what it started with", async () => {
    await mountPageWithOriginalDraft();
    const sku = deferred<{ sku: string }>();
    h.requireSku.mockReturnValue(sku.promise);

    await act(async () => {
      createButton().click();
    });
    await flush();
    await act(async () => {
      setSelectValue(selectContaining("Baklawa"), "baklawa");
    });
    await flush();
    await act(async () => {
      sku.resolve({ sku: "SKU-ORIGINAL-CATEGORY" });
    });
    await flush();

    // The save proceeds with the category and SKU it started with ...
    expect(h.save).toHaveBeenCalledTimes(1);
    expect(h.save.mock.calls[0][0]).toMatchObject({
      categoryKey: "ready_packs",
      resolvedSku: "SKU-ORIGINAL-CATEGORY",
    });
    await act(async () => {
      finishSave({ draft: true, draftId: "d1", alreadyPending: true });
    });
    await flush();
    // ... but that SKU is not left behind on the draft whose category is now different.
    const kept = loadFastCreateDraft();
    expect(kept?.categoryKey).toBe("baklawa");
    expect(kept?.resolvedSku).toBeNull();
  });

  it("Generate drops suggestions when the product name changed while they were generating", async () => {
    await mountPageWithOriginalDraft();
    const enrich = deferred<ReturnType<typeof buildHeuristicSuggestions>>();
    h.enrich.mockReturnValue(enrich.promise);

    await act(async () => {
      buttonByText("Generate suggestions", host).click();
    });
    await flush();
    await act(async () => {
      setInputValue(productNameInput(), "Edited product name");
    });
    await flush();
    await act(async () => {
      enrich.resolve(buildHeuristicSuggestions("Original draft", "ready_packs"));
    });
    await flush();

    const kept = loadFastCreateDraft();
    expect(kept?.productName).toBe("Edited product name");
    expect(kept?.suggestions).toBeNull();
    expect(h.requireSku).not.toHaveBeenCalled();
    expect(h.toast.success).not.toHaveBeenCalled();
    expect(h.toast.info).toHaveBeenCalledWith(expect.stringMatching(/discarded/i));
    expect(buttonByText("Generate suggestions", host).disabled).toBe(false);
  });

  it("Generate drops suggestions when the category changed while they were generating", async () => {
    await mountPageWithOriginalDraft();
    const enrich = deferred<ReturnType<typeof buildHeuristicSuggestions>>();
    h.enrich.mockReturnValue(enrich.promise);

    await act(async () => {
      buttonByText("Generate suggestions", host).click();
    });
    await flush();
    await act(async () => {
      setSelectValue(selectContaining("Baklawa"), "baklawa");
    });
    await flush();
    await act(async () => {
      enrich.resolve(buildHeuristicSuggestions("Original draft", "ready_packs"));
    });
    await flush();

    expect(loadFastCreateDraft()?.suggestions).toBeNull();
    expect(h.toast.success).not.toHaveBeenCalled();
  });

  it("Generate announces nothing for stale work when the name changes during its SKU step", async () => {
    await mountPageWithOriginalDraft();
    h.enrich.mockResolvedValue(buildHeuristicSuggestions("Original draft", "ready_packs"));
    const sku = deferred<{ sku: string }>();
    h.requireSku.mockReturnValue(sku.promise);

    await act(async () => {
      buttonByText("Generate suggestions", host).click();
    });
    await flush();
    expect(h.requireSku).toHaveBeenCalledTimes(1);
    await act(async () => {
      setInputValue(productNameInput(), "Edited during SKU step");
    });
    await flush();
    await act(async () => {
      sku.resolve({ sku: "SKU-GENERATE-STALE" });
    });
    await flush();

    expect(h.toast.success).not.toHaveBeenCalled();
    expect(buttonByText("Generate suggestions", host).disabled).toBe(false);
    expect(loadFastCreateDraft()?.productName).toBe("Edited during SKU step");
  });

  it("a slow packaging-option insert does not close or clear a dialog that was reopened meanwhile", async () => {
    await mountPageWithOriginalDraft();
    const insert = deferred<{ error: null }>();
    h.insert.mockReturnValue(insert.promise);

    await act(async () => {
      buttonByText("Add option", host).click();
    });
    await flush();
    let dialog = document.body.querySelector('[role="dialog"]') as HTMLElement;
    let inputs = Array.from(dialog.querySelectorAll("input"));
    await act(async () => {
      setInputValue(inputs[0], "FIRSTBOX");
      setInputValue(inputs[1], "First Box");
    });
    await act(async () => {
      buttonByText("Add option", dialog).click();
    });
    await flush();
    expect(h.insert).toHaveBeenCalledTimes(1);

    // Close the dialog while the insert is pending, then reopen it and start typing again.
    await act(async () => {
      buttonByText("Cancel", dialog).click();
    });
    await flush();
    await act(async () => {
      buttonByText("Add option", host).click();
    });
    await flush();
    dialog = document.body.querySelector('[role="dialog"]') as HTMLElement;
    inputs = Array.from(dialog.querySelectorAll("input"));
    await act(async () => {
      setInputValue(inputs[0], "SECONDBOX");
      setInputValue(inputs[1], "Second Box");
    });

    await act(async () => {
      insert.resolve({ error: null });
    });
    await flush();
    await flush();

    // The first insert is reported, but the reopened dialog and what was typed survive.
    expect(h.toast.success).toHaveBeenCalledWith('Packaging option "First Box" added.');
    dialog = document.body.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog).not.toBeNull();
    const [code, label] = Array.from(dialog.querySelectorAll("input"));
    expect(code.value).toBe("SECONDBOX");
    expect(label.value).toBe("Second Box");
  });
});
