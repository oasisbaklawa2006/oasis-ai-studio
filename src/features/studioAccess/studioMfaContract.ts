import { supabase } from "@/integrations/supabase/client";

export type StudioMfaStage =
  | { kind: "checking" | "ready" | "enroll" | "error" }
  | { kind: "challenge"; factorId: string }
  | { kind: "enroll_confirm"; factorId: string; qr: string; secret: string };

/** Read actual Supabase Auth assurance, never infer AAL2 from a Core role or an enrolled factor. */
export async function inspectStudioMfa(): Promise<StudioMfaStage> {
  const level = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (level.error || !level.data) throw new Error("MFA assurance unavailable.");
  if (level.data.currentLevel === "aal2") return { kind: "ready" };

  const factors = await supabase.auth.mfa.listFactors();
  if (factors.error || !factors.data) throw new Error("MFA factor listing unavailable.");
  const verified = factors.data.totp?.find((factor) => factor.status === "verified");
  return verified ? { kind: "challenge", factorId: verified.id } : { kind: "enroll" };
}

/** A successful OTP is not an authorization decision: the refreshed session must be AAL2. */
export async function verifyStudioMfaCode(factorId: string, code: string): Promise<void> {
  if (!factorId || !/^[0-9]{6,8}$/.test(code)) throw new Error("Enter a valid authenticator code.");
  const verified = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (verified.error) throw new Error("Authenticator verification failed. Try a fresh code.");
  const level = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (level.error || level.data?.currentLevel !== "aal2") {
    throw new Error("The session was not elevated to AAL2. Retry verification.");
  }
}
