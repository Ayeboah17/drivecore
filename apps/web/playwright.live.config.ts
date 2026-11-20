import { defineConfig, devices } from "@playwright/test";
const fixturePort = process.env.DRIVECORE_FIXTURE_PORT ?? "4201";
const fixtureOrigin = `http://127.0.0.1:${fixturePort}`;
export default defineConfig({
  testDir: "./tests/live",
  outputDir: "./test-results/live",
  workers: 1,
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3101",
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  projects: [{ name: "chromium-live", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node tests/fixtures/api-server.mjs",
      url: `${fixtureOrigin}/__test/stats`,
      reuseExistingServer: false,
      env: { DRIVECORE_FIXTURE_PORT: fixturePort },
    },
    {
      command: "npm run start -- --port 3101",
      url: "http://127.0.0.1:3101/login",
      reuseExistingServer: false,
      env: {
        DRIVECORE_MODE: "live",
        DRIVECORE_API_ORIGIN: fixtureOrigin,
        DRIVECORE_APP_ORIGIN: "http://127.0.0.1:3101",
        DRIVECORE_SESSION_COOKIE_NAME: "drivecore_test",
        DRIVECORE_API_TIMEOUT_MS: "1500",
      },
    },
  ],
});
