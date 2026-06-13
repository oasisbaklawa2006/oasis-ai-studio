export type SupabaseFailureKind =
  | "missing_table"
  | "rls_denied"
  | "auth"
  | "network"
  | "config"
  | "unknown";

export type SupabaseFailure = {
  kind: SupabaseFailureKind;
  message: string;
  code?: string;
  hint?: string;
  ownerAction?: string;
};

type PostgrestLikeError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

export function diagnoseSupabaseFailure(
  error: PostgrestLikeError | null | undefined,
  context: string,
): SupabaseFailure | null {
  if (!error) return null;

  const code = error.code ?? "";
  const message = error.message ?? "Unknown Supabase error";
  const hint = error.hint;
  const lower = message.toLowerCase();

  if (
    code === "42P01" ||
    lower.includes("does not exist") ||
    lower.includes("could not find the table") ||
    lower.includes("schema cache")
  ) {
    return {
      kind: "missing_table",
      code,
      message,
      hint,
      ownerAction:
        "Apply migration `supabase/migrations/20260602160000_catalogue_collections_foundation.sql` on project tcxvcatsqqertcnycuop (Catalogue Builder tables).",
    };
  }

  if (
    code === "42501" ||
    lower.includes("permission denied") ||
    lower.includes("row-level security") ||
    lower.includes("violates row-level security")
  ) {
    return {
      kind: "rls_denied",
      code,
      message,
      hint,
      ownerAction:
        "Confirm authenticated user is a team member (`is_team_member`) and RLS policies exist for catalogue collection tables.",
    };
  }

  if (code === "PGRST301" || lower.includes("jwt") || lower.includes("not authenticated")) {
    return {
      kind: "auth",
      code,
      message,
      hint,
      ownerAction: "Sign in again. Verify Vercel env vars match Central Supabase anon key.",
    };
  }

  if (lower.includes("failed to fetch") || lower.includes("network")) {
    return {
      kind: "network",
      code,
      message,
      hint,
      ownerAction: "Check browser network tab and Supabase project status.",
    };
  }

  return {
    kind: "unknown",
    code,
    message: `${context}: ${message}`,
    hint,
    ownerAction: "Check browser console and Supabase logs for this query.",
  };
}

export function formatSupabaseFailure(failure: SupabaseFailure): string {
  const parts = [failure.message];
  if (failure.code) parts.push(`(code ${failure.code})`);
  if (failure.ownerAction) parts.push(`→ ${failure.ownerAction}`);
  return parts.join(" ");
}
