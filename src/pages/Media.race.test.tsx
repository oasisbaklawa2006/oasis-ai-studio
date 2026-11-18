import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import Media from "./Media";

const mocks = vi.hoisted(() => ({ insert: vi.fn(), load: vi.fn() }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ roles: [] }) }));
vi.mock("@/features/catalogueDrafts/mediaDraftBoundary", () => ({
  IMAGE_MIME_TYPES: ["image/jpeg"],
  useCatalogueMediaWriteMode: () => ({ canMutate: true, writeMode: "direct" }),
}));
vi.mock("@/features/productAuthority/productMediaPersistence", () => ({
  insertProductMediaRow: mocks.insert,
  mediaTypeLabel: (type: string) => type,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => ({
      select: () =>
        table === "product_media" ? { order: mocks.load } : Promise.resolve({ data: [] }),
    }),
  },
}));

const button = (label: string) => {
  const element = Array.from(document.querySelectorAll("button")).find(
    (candidate) => candidate.textContent?.trim() === label,
  );
  if (!element) throw new Error(`Missing button ${label}`);
  return element;
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

it("locks media inputs during URL save and retains the newest library response", async () => {
  const initial = deferred<{ data: unknown[] }>();
  const refresh = deferred<{ data: unknown[] }>();
  const save = deferred<{ ok: true }>();
  mocks.load.mockReset().mockReturnValueOnce(initial.promise).mockReturnValueOnce(refresh.promise);
  mocks.insert.mockReset().mockReturnValueOnce(save.promise);

  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <Media />
        </MemoryRouter>,
      );
    });
    await act(async () => {
      button("Add Media").click();
    });
    const input = document.querySelector<HTMLInputElement>('input[placeholder="https://…"]');
    if (!input) throw new Error("Missing URL input");
    await act(async () => {
      const inputPrototype = Object.getPrototypeOf(input) as HTMLInputElement;
      Reflect.getOwnPropertyDescriptor(inputPrototype, "value")?.set?.call(
        input,
        "https://example.invalid/media.jpg",
      );
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      button("Save URL").click();
    });
    expect(mocks.insert).toHaveBeenCalledOnce();
    expect(input.disabled).toBe(true);
    expect(button("Take photo").disabled).toBe(true);
    expect(button("Save URL").disabled).toBe(true);
    await act(async () => {
      save.resolve({ ok: true });
    });
    expect(mocks.load).toHaveBeenCalledTimes(2);
    await act(async () => {
      refresh.resolve({
        data: [
          {
            id: "new",
            type: "raw_photo",
            file_url: "https://example.invalid/media.jpg",
            alt_text: "Refreshed photo",
          },
        ],
      });
    });
    await act(async () => {
      initial.resolve({ data: [] });
    });
    expect(host.querySelector('img[alt="Refreshed photo"]')).not.toBeNull();
  } finally {
    await act(async () => {
      root.unmount();
    });
    host.remove();
  }
});
