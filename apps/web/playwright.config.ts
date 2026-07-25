import { defineConfig } from "@playwright/test";

const apiPort = process.env.ALLTIME25_E2E_API_PORT ?? "8000";
const webPort = process.env.ALLTIME25_E2E_WEB_PORT ?? "5173";
const webOrigin = `http://127.0.0.1:${webPort}`;

export default defineConfig({
  testDir: "./e2e",
  outputDir: "../../.playwright/test-results",
  fullyParallel: false,
  forbidOnly: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: webOrigin,
    browserName: "chromium",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command:
        "ALLTIME25_DATABASE_URL=sqlite:///./.playwright/e2e.sqlite3 " +
        "ALLTIME25_CATALOG_ROOT=./.playwright/catalog " +
        `ALLTIME25_ALLOWED_ORIGIN=${webOrigin} ` +
        "apps/api/.venv/bin/python -m uvicorn alltime25.main:app " +
        `--app-dir apps/api/src --host 127.0.0.1 --port ${apiPort}`,
      cwd: "../..",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      url: `http://127.0.0.1:${apiPort}/api/v1/ready`,
    },
    {
      command:
        `npm --prefix apps/web run dev -- --host 127.0.0.1 --port ${webPort}`,
      cwd: "../..",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      url: webOrigin,
    },
  ],
});
