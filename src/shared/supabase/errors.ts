export class SupabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabaseConfigError";
  }
}

export function normalizeSupabaseError(error: unknown, fallback = "Unexpected Supabase error") {
  if (error instanceof Error) return error;
  return new SupabaseConfigError(fallback);
}
