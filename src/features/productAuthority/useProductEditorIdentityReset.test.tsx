import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, expect, it, vi } from "vitest";
import { useProductEditorIdentityReset } from "./useProductEditorIdentityReset";

vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
afterAll(() => vi.unstubAllGlobals());

it("resets previous-product pricing/MOQ, media, ready flag and draft only on product identity change", async () => {
  const resetEvents: string[] = [];
  let current!: { pricing: string[]; moq: string[]; media: string[]; ready: boolean; draft: string };
  let updateDraft!: (value: string) => void;
  function Harness({ productIdentity }: { productIdentity: string }) {
    const [pricing, setPricing] = useState(["approved-product-A"]);
    const [moq, setMoq] = useState(["moq-product-A"]);
    const [media, setMedia] = useState(["hero-product-A"]);
    const [ready, setReady] = useState(true);
    const [draft, setDraft] = useState("unsaved-product-A");
    updateDraft = setDraft;
    useProductEditorIdentityReset(productIdentity, () => {
      resetEvents.push(productIdentity);
      setPricing([]);
      setMoq([]);
      setMedia([]);
      setReady(false);
      setDraft("");
    });
    current = { pricing, moq, media, ready, draft };
    return null;
  }
  const root = createRoot(document.createElement("div"));
  try {
    await act(async () => {
      root.render(<Harness productIdentity="edit:product-A" />);
    });
    expect(resetEvents).toEqual([]);
    await act(async () => {
      updateDraft("keep draft during same-product tab navigation");
      root.render(<Harness productIdentity="edit:product-A" />);
    });
    expect(resetEvents).toEqual([]);
    expect(current.draft).toContain("keep draft");

    await act(async () => {
      root.render(<Harness productIdentity="create" />);
    });
    expect(resetEvents).toEqual(["create"]);
    expect(current).toEqual({ pricing: [], moq: [], media: [], ready: false, draft: "" });

    await act(async () => {
      root.render(<Harness productIdentity="edit:product-B" />);
    });
    expect(resetEvents).toEqual(["create", "edit:product-B"]);
    expect(current.pricing).toEqual([]);
  } finally {
    await act(async () => {
      root.unmount();
    });
  }
});
