import { diagnoseSupabaseFailure, formatSupabaseDiagnostic } from "@/lib/supabase/diagnostics";

/** Throw a user-facing error when Supabase authority writes fail (no silent local fallback). */
export function throwSupabaseAuthorityError(context: string, error: unknown): never {
  const failure = diagnoseSupabaseFailure(
    error instanceof Error ? { message: error.message } : (error as { message?: string }),
    context,
  );
  throw new Error(formatSupabaseDiagnostic(failure, context));
}

export function supabaseAuthorityErrorMessage(context: string, error: unknown): string {
  const failure = diagnoseSupabaseFailure(
    error instanceof Error ? { message: error.message } : (error as { message?: string }),
    context,
  );
  return formatSupabaseDiagnostic(failure, context);
}
