import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vitest/config";

const repoRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: repoRoot,
  plugins: [react()],
  test: {
    root: repoRoot,
    environment: "jsdom",
    globals: true,
    setupFiles: [path.join(repoRoot, "src/test/setup.ts")],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html", "lcov"],
      reportsDirectory: path.join(repoRoot, "coverage"),
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.d.ts",
        "src/**/*.test.{ts,tsx}",
        "src/**/*.spec.{ts,tsx}",
        "src/test/**",
        "src/integrations/supabase/types.ts",
      ],
      // Vitest 4's V8 remapper changed denominator semantics on unchanged source.
      // 180 files / 1,597 tests pass on both main b54da43 (Vitest 3) and PR #296
      // (Vitest 4); branch coverage is 77.53% -> 42.85%, and function coverage
      // is 76.97% -> 43.65%. These 40% floors preserve a *tighter* fraction
      // of the migrated baseline (93% branches, 92% functions) than the old
      // 70%/60% floors (90%/78%). Keep include/exclude scope unchanged.
      thresholds: {
        statements: 30,
        branches: 40,
        functions: 40,
        lines: 30,
      },
    },
  },
  resolve: {
    alias: { "@": path.resolve(repoRoot, "./src") },
  },
});
