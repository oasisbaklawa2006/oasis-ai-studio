// Test defaults — no service-role keys; not used for live Central sync.
if (!import.meta.env.VITE_SUPABASE_URL) {
  import.meta.env.VITE_SUPABASE_URL = "https://test-project.supabase.co";
}
if (!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY = "test-publishable-key";
}

// Allow catalogue localStorage fallback reads/writes in unit tests only.
import.meta.env.VITE_ALLOW_LOCAL_CATALOGUE_FALLBACK = "true";
import.meta.env.VITE_MEDIA_GOVERNANCE_MODE = "testing";


Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
