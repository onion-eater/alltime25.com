import { defineConfig, devices } from "@playwright/test";

const webPort = process.env.ALLTIME25_E2E_WEB_PORT ?? "4173";
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
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],
  webServer: {
    command:
      `npm --prefix apps/web run preview -- --host 127.0.0.1 --port ${webPort}`,
    cwd: "../..",
    reuseExistingServer: false,
    timeout: 120_000,
    url: webOrigin,
  },
});
