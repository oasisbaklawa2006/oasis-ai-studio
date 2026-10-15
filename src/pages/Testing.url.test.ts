import { describe, expect, it } from "vitest";
import { safeAttachmentUrl } from "@/lib/safeAttachmentUrl";

describe("safeAttachmentUrl", () => {
  it("allows only absolute HTTPS attachment URLs", () => {
    expect(safeAttachmentUrl("https://storage.example.com/report.pdf")).toBe(
      "https://storage.example.com/report.pdf",
    );
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,unsafe",
    "http://example.com/report.pdf",
    "/report.pdf",
  ])("rejects %s", (value) => {
    expect(safeAttachmentUrl(value)).toBeNull();
  });
});
