import { type ReactNode, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  type StudioMfaStage,
  inspectStudioMfa,
  verifyStudioMfaCode,
} from "@/features/studioAccess/studioMfaContract";
import { supabase } from "@/integrations/supabase/client";

/** Only the privileged Users & Access screen requires step-up; Core is authoritative for all writes. */
export function StudioAal2Gate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [stage, setStage] = useState<StudioMfaStage>({ kind: "checking" });
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    setStage({ kind: "checking" });
    setCode("");
    setError(null);
    if (!userId) {
      setStage({ kind: "error" });
      return;
    }
    void inspectStudioMfa()
      .then((next) => {
        if (current) setStage(next);
      })
      .catch(() => {
        if (current) setStage({ kind: "error" });
      });
    return () => {
      current = false;
    };
  }, [userId]);

  const retry = async () => {
    if (busy) return;
    setError(null);
    setStage({ kind: "checking" });
    try {
      setStage(await inspectStudioMfa());
    } catch {
      setStage({ kind: "error" });
    }
  };

  const enroll = async () => {
    if (busy || stage.kind !== "enroll") return;
    setBusy(true);
    setError(null);
    try {
      const response = await supabase.auth.mfa.enroll({ factorType: "totp" });
      if (response.error || !response.data?.totp?.qr_code) {
        throw new Error("TOTP enrollment could not be started.");
      }
      setStage({
        kind: "enroll_confirm",
        factorId: response.data.id,
        qr: response.data.totp.qr_code,
        secret: response.data.totp.secret,
      });
    } catch {
      setError("Authenticator enrollment failed. Retry or contact an authorized administrator.");
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (busy || !["challenge", "enroll_confirm"].includes(stage.kind)) return;
    if (stage.kind !== "challenge" && stage.kind !== "enroll_confirm") return;
    setBusy(true);
    setError(null);
    try {
      await verifyStudioMfaCode(stage.factorId, code.trim());
      setCode("");
      setStage({ kind: "ready" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Authenticator verification failed.");
    } finally {
      setBusy(false);
    }
  };

  if (stage.kind === "ready") return <>{children}</>;

  return (
    <section
      aria-label="AI Studio privileged access verification"
      className="mx-auto max-w-xl space-y-4 rounded-lg border bg-card p-6"
    >
      <h1 className="font-display text-2xl">Verify privileged Studio access</h1>
      {stage.kind === "checking" && <p role="status">Checking your authentication level…</p>}
      {stage.kind === "error" && (
        <>
          <p role="alert">Could not verify the required AAL2 session. Access remains closed.</p>
          <button type="button" className="underline" onClick={() => void retry()}>
            Retry security check
          </button>
        </>
      )}
      {stage.kind === "enroll" && (
        <>
          <p>
            No verified authenticator is enrolled for this account. A TOTP factor is required before
            changing staff access. This cannot be bypassed by a global admin role.
          </p>
          <button
            type="button"
            disabled={busy}
            className="rounded-md border px-4 py-2"
            onClick={() => void enroll()}
          >
            {busy ? "Starting…" : "Set up authenticator"}
          </button>
        </>
      )}
      {stage.kind === "enroll_confirm" && (
        <>
          <p>
            Scan this QR code using your authenticator app. The setup key is sensitive; do not share
            it or include it in screenshots.
          </p>
          <img
            src={stage.qr}
            alt="Private TOTP enrollment QR code"
            className="h-48 w-48 rounded-md border bg-white p-2"
          />
          <p className="text-xs">
            If scanning is unavailable, enter this private setup key manually in your authenticator
            app:
          </p>
          <code className="block break-all rounded bg-muted p-3 text-xs">{stage.secret}</code>
        </>
      )}
      {(stage.kind === "challenge" || stage.kind === "enroll_confirm") && (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void verify();
          }}
        >
          <label htmlFor="studio-mfa-code" className="block text-sm font-medium">
            Authenticator code
          </label>
          <input
            id="studio-mfa-code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6,8}"
            autoComplete="one-time-code"
            maxLength={8}
            value={code}
            required
            onChange={(event) => setCode(event.target.value.replace(/[^0-9]/g, ""))}
            className="w-full rounded-md border bg-background px-3 py-2"
          />
          <button
            type="submit"
            disabled={busy || !/^[0-9]{6,8}$/.test(code)}
            className="rounded-md border px-4 py-2"
          >
            {busy ? "Verifying…" : "Verify and continue"}
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
