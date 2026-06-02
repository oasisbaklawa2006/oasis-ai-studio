import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { fileURLToPath } from "url";

const repoRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: repoRoot,
  plugins: [react()],
  test: {
    root: repoRoot,
    environment: "jsdom",
    globals: true,
    setupFiles: [path.join(repoRoot, "src/test/setup.ts")],
    include: [path.join(repoRoot, "src/**/*.{test,spec}.{ts,tsx}")],
  },
  resolve: {
    alias: { "@": path.resolve(repoRoot, "./src") },
  },
});
