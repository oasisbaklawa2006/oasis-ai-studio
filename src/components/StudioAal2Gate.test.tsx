import { beforeEach, describe, expect, it, vi } from "vitest";
import { inspectStudioMfa, verifyStudioMfaCode } from "./StudioAal2Gate";

const mfa = vi.hoisted(() => ({
  getAuthenticatorAssuranceLevel: vi.fn(),
  listFactors: vi.fn(),
  challengeAndVerify: vi.fn(),
  enroll: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { mfa } },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
    data: { currentLevel: "aal1", nextLevel: "aal2" }, error: null,
  });
  mfa.listFactors.mockResolvedValue({ data: { totp: [] }, error: null });
  mfa.challengeAndVerify.mockResolvedValue({ data: {}, error: null });
});

describe("Studio AAL2 privileged-console gate", () => {
  it("admits the privileged screen only for an actual AAL2 session", async () => {
    mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: "aal2", nextLevel: "aal2" }, error: null,
    });
    expect(await inspectStudioMfa()).toEqual({ kind: "ready" });
    expect(mfa.listFactors).not.toHaveBeenCalled();
  });

  it("requires a fresh challenge for an enrolled TOTP but AAL1 session", async () => {
    mfa.listFactors.mockResolvedValue({
      data: { totp: [{ id: "factor-1", status: "verified" }] }, error: null,
    });
    expect(await inspectStudioMfa()).toEqual({ kind: "challenge", factorId: "factor-1" });
  });

  it("requires enrollment for accounts without a verified TOTP", async () => {
    expect(await inspectStudioMfa()).toEqual({ kind: "enroll" });
  });

  it("does not treat an unavailable MFA service as authorized", async () => {
    mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: null, error: { message: "unavailable" },
    });
    await expect(inspectStudioMfa()).rejects.toThrow("MFA assurance unavailable");
  });

  it("verifies a real code and then independently checks AAL2", async () => {
    mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: "aal2", nextLevel: "aal2" }, error: null,
    });
    await expect(verifyStudioMfaCode("factor-1", "123456")).resolves.toBeUndefined();
    expect(mfa.challengeAndVerify).toHaveBeenCalledWith({
      factorId: "factor-1", code: "123456",
    });
  });

  it("fails closed if verification finishes but the session is still AAL1", async () => {
    await expect(verifyStudioMfaCode("factor-1", "123456")).rejects.toThrow("not elevated to AAL2");
  });

  it("rejects malformed codes without creating a challenge", async () => {
    await expect(verifyStudioMfaCode("factor-1", "12345")).rejects.toThrow(
      "Enter a valid authenticator code",
    );
    expect(mfa.challengeAndVerify).not.toHaveBeenCalled();
  });

  it("rejects an invalid authenticator response", async () => {
    mfa.challengeAndVerify.mockResolvedValue({
      data: null, error: { message: "invalid OTP" },
    });
    await expect(verifyStudioMfaCode("factor-1", "123456")).rejects.toThrow(
      "Authenticator verification failed",
    );
  });
});
