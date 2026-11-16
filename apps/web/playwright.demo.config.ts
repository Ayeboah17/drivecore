import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/prototype",
  outputDir: "./test-results/prototype",
  workers: 1,
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3102",
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  projects: [
    { name: "prototype-chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "prototype-firefox",
      use: { ...devices["Desktop Firefox"] },
      testMatch: /smoke.spec.ts/,
    },
    {
      name: "prototype-webkit",
      use: { ...devices["Desktop Safari"] },
      testMatch: /smoke.spec.ts/,
    },
  ],
  webServer: {
    command: "npm run start -- --port 3102",
    url: "http://127.0.0.1:3102/demo/erp",
    reuseExistingServer: false,
    env: { DRIVECORE_MODE: "live", DRIVECORE_API_ORIGIN: "" },
  },
});
