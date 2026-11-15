import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  outputDir: "./test-results/browser",
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
      testMatch: /milestone-2.spec.ts/,
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
      testMatch: /milestone-2.spec.ts/,
    },
  ],
  webServer: {
    command: "npm run start -- --port 3100",
    env: { DRIVECORE_MODE: "demo", DRIVECORE_API_ORIGIN: "" },
    url: "http://127.0.0.1:3100",
    reuseExistingServer: !process.env.CI,
  },
});
