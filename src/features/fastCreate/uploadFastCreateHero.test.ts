import { describe, expect, it, vi } from "vitest";
import { uploadFastCreateHero } from "./uploadFastCreateHero";

const storage = vi.hoisted(() => ({
  upload: vi.fn(),
  getPublicUrl: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: () => storage,
    },
  },
}));

describe("Fast Create pending hero confidentiality (Core #484)", () => {
  it("rejects a valid raw hero before any public Storage upload or URL generation", async () => {
    storage.upload.mockReset();
    storage.getPublicUrl.mockReset();
    const rawHero = new File(["real product photo"], "raw-photo.jpg", { type: "image/jpeg" });
    await expect(uploadFastCreateHero(rawHero)).rejects.toThrow(
      /Unapproved product photography cannot be uploaded into public Storage/,
    );
    expect(storage.upload).not.toHaveBeenCalled();
    expect(storage.getPublicUrl).not.toHaveBeenCalled();
  });

  it("continues to reject unsupported MIME types before staging is available", async () => {
    const executable = new File(["script"], "unsafe.js", { type: "application/javascript" });
    await expect(uploadFastCreateHero(executable)).rejects.toThrow(/unsupported file type/i);
    expect(storage.upload).not.toHaveBeenCalled();
  });
});
