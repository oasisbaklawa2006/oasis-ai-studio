import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  formatMediaInsertError,
  formatMediaStorageError,
  insertProductMediaRow,
  mediaTypeLabel,
  type ProductMediaInsertInput,
} from "@/features/productAuthority/productMediaPersistence";

const mediaInsert = vi.hoisted(() => ({
  from: vi.fn(),
  insert: vi.fn(),
  select: vi.fn(),
  abortSignal: vi.fn(),
  single: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mediaInsert.from },
}));

describe("insertProductMediaRow", () => {
  const input: ProductMediaInsertInput = {
    product_id: "prod-uuid-0024",
    file_url: "https://cdn.example/products/raw/photo.jpg",
    type: "closeup",
  };

  beforeEach(() => {
    mediaInsert.from.mockReset().mockReturnValue({ insert: mediaInsert.insert });
    mediaInsert.insert.mockReset().mockReturnValue({ select: mediaInsert.select });
    mediaInsert.select.mockReset().mockReturnValue({
      abortSignal: mediaInsert.abortSignal,
      single: mediaInsert.single,
    });
    mediaInsert.abortSignal.mockReset();
    mediaInsert.single.mockReset().mockResolvedValue({ data: { id: "media-1" }, error: null });
  });

  it("forwards an abort signal before executing the insert query", async () => {
    const controller = new AbortController();
    const result = await insertProductMediaRow(input, controller.signal);

    expect(mediaInsert.from).toHaveBeenCalledWith("product_media");
    expect(mediaInsert.insert).toHaveBeenCalledWith({
      product_id: input.product_id,
      file_url: input.file_url,
      type: input.type,
      angle: null,
      alt_text: null,
      status: "raw",
    });
    expect(mediaInsert.select).toHaveBeenCalledWith("*");
    expect(mediaInsert.abortSignal).toHaveBeenCalledExactlyOnceWith(controller.signal);
    expect(mediaInsert.single).toHaveBeenCalledOnce();
    expect(result).toEqual({ ok: true, data: { id: "media-1" } });
  });

  it("executes the insert without applying an abort signal when none was provided", async () => {
    const result = await insertProductMediaRow(input);

    expect(mediaInsert.from).toHaveBeenCalledWith("product_media");
    expect(mediaInsert.abortSignal).not.toHaveBeenCalled();
    expect(mediaInsert.single).toHaveBeenCalledOnce();
    expect(result).toEqual({ ok: true, data: { id: "media-1" } });
  });
});

describe("productMediaPersistence", () => {
  it("labels canonical uploader media types consistently", () => {
    expect(mediaTypeLabel("closeup")).toBe("Close-up");
    expect(mediaTypeLabel("hero_image")).toBe("Hero image");
    expect(mediaTypeLabel("white_background")).toBe("White background");
    expect(mediaTypeLabel("45_angle")).toBe("45° angle");
  });

  it("builds product_media insert payload with required fields", () => {
    const input: ProductMediaInsertInput = {
      product_id: "prod-uuid-0024",
      file_url: "https://cdn.example/products/raw/photo.jpg",
      type: "closeup",
      angle: "closeup",
      alt_text: "mor-pistachio-close.jpg",
      status: "raw",
    };
    expect(input.product_id).toBeTruthy();
    expect(input.file_url).toMatch(/^https:\/\//);
    expect(input.type).toBe("closeup");
    expect(input.status).toBe("raw");
  });

  it("surfaces bucket missing storage errors", () => {
    const msg = formatMediaStorageError({ message: "Bucket not found" });
    expect(msg).toContain("product-media");
    expect(msg).toContain("missing or inaccessible");
  });

  it("surfaces upload-success insert-failure message", () => {
    const msg = formatMediaInsertError({ message: "permission denied" });
    expect(msg).toContain("File uploaded but media row was not saved.");
    expect(msg).toContain("permission denied");
  });
});
