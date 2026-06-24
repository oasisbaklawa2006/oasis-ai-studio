import { describe, expect, it } from "vitest";

// Mirrors supabase/functions/_shared/metaSignature.ts for unit coverage in Vitest.
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function verifyMetaWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string,
): Promise<boolean> {
  if (!appSecret || !signatureHeader?.startsWith("sha256=")) return false;
  const provided = signatureHeader.slice("sha256=".length).toLowerCase();
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return timingSafeEqualHex(expected, provided);
}

describe("Phase 2F — Meta webhook signature", () => {
  it("accepts valid X-Hub-Signature-256", async () => {
    const secret = "test-app-secret";
    const body = '{"entry":[]}';
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
    const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
    const valid = await verifyMetaWebhookSignature(body, `sha256=${hex}`, secret);
    expect(valid).toBe(true);
  });

  it("rejects tampered body", async () => {
    const secret = "test-app-secret";
    const body = '{"entry":[]}';
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
    const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
    const valid = await verifyMetaWebhookSignature('{"entry":[1]}', `sha256=${hex}`, secret);
    expect(valid).toBe(false);
  });
});
