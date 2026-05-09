const SUPABASE_HOST_PATTERN = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i;

function requireEnv(name: "VITE_SUPABASE_URL" | "VITE_SUPABASE_PUBLISHABLE_KEY"): string {
  const value = import.meta.env[name]?.trim();
  if (!value) throw new Error(`[supabase/env] Missing required env var: ${name}`);
  return value;
}

export const SUPABASE_URL = requireEnv("VITE_SUPABASE_URL");
export const SUPABASE_PUBLISHABLE_KEY = requireEnv("VITE_SUPABASE_PUBLISHABLE_KEY");

if (!SUPABASE_HOST_PATTERN.test(SUPABASE_URL)) {
  throw new Error("[supabase/env] VITE_SUPABASE_URL must be an https://<project-ref>.supabase.co URL.");
}

if (/lovable/i.test(SUPABASE_URL)) {
  throw new Error("[supabase/env] Lovable Cloud URLs are not allowed.");
}
