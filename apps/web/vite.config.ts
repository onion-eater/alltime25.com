import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const directory = path.dirname(fileURLToPath(import.meta.url));
const apiOrigin = `http://127.0.0.1:${process.env.ALLTIME25_E2E_API_PORT ?? "8000"}`;
const catalogRoot = path.resolve(
  directory,
  process.env.ALLTIME25_CATALOG_ROOT ?? "../../catalog",
);

export default defineConfig({
  plugins: [react()],
  publicDir: catalogRoot,
  resolve: {
    alias: {
      "@": path.resolve(directory, "src"),
    },
  },
  server: {
    proxy: {
      "/api": apiOrigin,
      "/assets/catalogs": apiOrigin,
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: "./src/test/setup.ts",
  },
});
