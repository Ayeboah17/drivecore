import { defineConfig } from "@playwright/test";
export default defineConfig({
  outputDir: "./test-results/unit",
  testDir: "./tests/unit",
  fullyParallel: true,
  reporter: "list",
});
