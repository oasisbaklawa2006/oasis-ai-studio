import path from "node:path";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    {
      name: "oasis-build-identity",
      transformIndexHtml(html) {
        const commit = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? "local";
        return html.replace(
          "</head>",
          `    <meta name="oasis-build-commit" content="${commit}" />\n  </head>`,
        );
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("/react/") || id.includes("/react-dom/") || id.includes("react-router")) {
            return "react-vendor";
          }
          if (id.includes("@supabase")) return "supabase-vendor";
          if (id.includes("@radix-ui") || id.includes("cmdk") || id.includes("vaul")) {
            return "ui-vendor";
          }
          if (id.includes("@tanstack")) return "query-vendor";
          if (id.includes("jspdf")) return "pdf-vendor";
          if (id.includes("recharts") || id.includes("d3-")) return "charts-vendor";
          if (id.includes("react-hook-form") || id.includes("@hookform") || id.includes("zod")) {
            return "forms-vendor";
          }
          if (id.includes("lucide-react")) return "icons-vendor";
          return undefined;
        },
      },
    },
  },
}));
