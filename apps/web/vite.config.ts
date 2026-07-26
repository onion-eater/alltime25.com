import { cp } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const directory = path.dirname(fileURLToPath(import.meta.url));
const catalogRoot = path.resolve(
  directory,
  process.env.ALLTIME25_CATALOG_ROOT ?? "../../catalog",
);
const sitePublicRoot = path.resolve(directory, "public");

export default defineConfig({
  plugins: [
    react(),
    {
      name: "copy-site-public-assets",
      async closeBundle(): Promise<void> {
        await cp(sitePublicRoot, path.resolve(directory, "dist"), {
          recursive: true,
        });
      },
    },
  ],
  publicDir: catalogRoot,
  resolve: {
    alias: {
      "@": path.resolve(directory, "src"),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(directory, "index.html"),
        howItWorks: path.resolve(
          directory,
          "how-it-works/index.html",
        ),
        data: path.resolve(directory, "data/index.html"),
        privacy: path.resolve(directory, "privacy/index.html"),
      },
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: "./src/test/setup.ts",
  },
});
