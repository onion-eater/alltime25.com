import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const directory = path.dirname(fileURLToPath(import.meta.url));
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
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: "./src/test/setup.ts",
  },
});
