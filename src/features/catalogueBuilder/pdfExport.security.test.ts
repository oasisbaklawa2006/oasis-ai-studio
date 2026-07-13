import { afterEach, describe, expect, it, vi } from "vitest";
import { imageAsDataUrl } from "./pdfExport";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PDF image ingestion safety", () => {
  it("rejects unsupported URL schemes before fetch", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await expect(imageAsDataUrl("file:///etc/passwd")).resolves.toBeNull();
    await expect(imageAsDataUrl("javascript:alert(1)")).resolves.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects an oversized data URL before decoding", async () => {
    const oversized = `data:image/webp;base64,${"A".repeat(2_700_000)}`;
    await expect(imageAsDataUrl(oversized)).resolves.toBeNull();
  });

  it("rejects a declared oversized remote image before reading its body", async () => {
    const cancel = vi.fn();
    const response = new Response(new ReadableStream({ cancel }), {
      status: 200,
      headers: {
        "content-type": "image/webp",
        "content-length": "2000001",
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    await expect(imageAsDataUrl(`${window.location.origin}/poison.webp`)).resolves.toBeNull();
  });

  it("cancels a chunked image once the received-byte ceiling is crossed", async () => {
    const cancel = vi.fn();
    const response = {
      ok: true,
      headers: new Headers({ "content-type": "image/webp" }),
      body: {
        getReader: () => ({
          read: vi.fn().mockResolvedValueOnce({
            done: false,
            value: new Uint8Array(2_000_001),
          }),
          cancel,
        }),
      },
    } as unknown as Response;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    await expect(imageAsDataUrl(`${window.location.origin}/chunked.webp`)).resolves.toBeNull();
    expect(cancel).toHaveBeenCalledWith("image_too_large");
  });

  it("rejects remote image origins outside the configured media allowlist", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await expect(imageAsDataUrl("https://tracking.example/operator.webp")).resolves.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("forbids redirects that could escape the approved media origin", async () => {
    const fetchSpy = vi.fn().mockRejectedValue(new TypeError("redirect mode is set to error"));
    vi.stubGlobal("fetch", fetchSpy);
    await expect(imageAsDataUrl(`${window.location.origin}/redirect.webp`)).resolves.toBeNull();
    expect(fetchSpy).toHaveBeenCalledWith(
      `${window.location.origin}/redirect.webp`,
      expect.objectContaining({ credentials: "omit", redirect: "error" }),
    );
  });
});
