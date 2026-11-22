import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, expect, it, vi } from "vitest";
import { useProductEditorIdentityReset } from "./useProductEditorIdentityReset";
import { useProductEditorLocalDraft } from "./useProductEditorLocalDraft";

vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
afterAll(() => vi.unstubAllGlobals());

it("restores the new product draft before autosave may overwrite it with a prior product", async () => {
  const oldKey = "studio-unit-draft-existing-A";
  const newKey = "studio-unit-draft-create";
  localStorage.setItem(oldKey, JSON.stringify({ product_name: "Old persisted A" }));
  localStorage.setItem(
    newKey,
    JSON.stringify({ product_name: "Existing New draft", sku: "NEW-001" }),
  );
  let current!: Record<string, unknown>;
  function Harness({ identity, draftKey }: { identity: string; draftKey: string }) {
    const [form, setForm] = useState<Record<string, unknown>>({
      product_name: "Unsaved previous-product edit",
      is_catalogue_ready: true,
    });
    useProductEditorIdentityReset(identity, () => {
      setForm({ product_name: "", is_catalogue_ready: false });
    });
    useProductEditorLocalDraft(draftKey, form, setForm);
    current = form;
    return null;
  }
  const root = createRoot(document.createElement("div"));
  try {
    await act(async () => {
      root.render(<Harness identity="edit:A" draftKey={oldKey} />);
    });
    expect(current.product_name).toBe("Old persisted A");

    await act(async () => {
      root.render(<Harness identity="create" draftKey={newKey} />);
    });
    expect(current.product_name).toBe("Existing New draft");
    expect(current.sku).toBe("NEW-001");
    expect(current.is_catalogue_ready).toBe(false);
    const written = JSON.parse(localStorage.getItem(newKey) ?? "{}") as Record<string, unknown>;
    expect(written.product_name).toBe("Existing New draft");
    expect(written.product_name).not.toBe("Old persisted A");
  } finally {
    await act(async () => {
      root.unmount();
    });
    localStorage.removeItem(oldKey);
    localStorage.removeItem(newKey);
  }
});

it("does not overwrite a persisted draft with the empty initial render before hydration", async () => {
  const key = "studio-unit-draft-hydrate-first";
  localStorage.setItem(key, JSON.stringify({ product_name: "Recovered typed draft" }));
  let current!: Record<string, unknown>;
  function Harness() {
    const [form, setForm] = useState<Record<string, unknown>>({ product_name: "" });
    useProductEditorLocalDraft(key, form, setForm);
    current = form;
    return null;
  }
  const root = createRoot(document.createElement("div"));
  try {
    await act(async () => {
      root.render(<Harness />);
    });
    expect(current.product_name).toBe("Recovered typed draft");
    expect(JSON.parse(localStorage.getItem(key) ?? "{}").product_name).toBe(
      "Recovered typed draft",
    );
  } finally {
    await act(async () => {
      root.unmount();
    });
    localStorage.removeItem(key);
  }
});
