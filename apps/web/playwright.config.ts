import { defineConfig } from "@playwright/test";

const apiPort = process.env.BLIND50_E2E_API_PORT ?? "8000";
const webPort = process.env.BLIND50_E2E_WEB_PORT ?? "5173";
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
        "BLIND50_DATABASE_URL=sqlite:///./.playwright/e2e.sqlite3 " +
        "BLIND50_CATALOG_ROOT=./.playwright/catalog " +
        `BLIND50_ALLOWED_ORIGIN=${webOrigin} ` +
        "apps/api/.venv/bin/python -m uvicorn blind50.main:app " +
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
