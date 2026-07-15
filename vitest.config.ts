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
      thresholds: {
        statements: 30,
        branches: 70,
        functions: 60,
        lines: 30,
      },
    },
  },
  resolve: {
    alias: { "@": path.resolve(repoRoot, "./src") },
  },
});
