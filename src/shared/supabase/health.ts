import { SUPABASE_URL } from "./env";

export function getSupabaseProjectRef() {
  try {
    const url = new URL(SUPABASE_URL);
    return url.hostname.split(".")[0] ?? "";
  } catch {
    return "";
  }
}

export function assertExpectedProjectRef(expectedRef: string) {
  const actual = getSupabaseProjectRef();
  if (!actual) throw new Error("[supabase/health] Could not determine Supabase project ref.");
  if (actual !== expectedRef) {
    throw new Error(`[supabase/health] Supabase project ref mismatch. Expected ${expectedRef}, got ${actual}.`);
  }
}
