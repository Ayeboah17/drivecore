import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
const screenshotDirectory = resolve(
  process.cwd(),
  "../../documentation/screenshots/workspace-selection",
);
test("workspace selection visual captures with synthetic data", async ({
  page,
  request,
}) => {
  await request.post("http://127.0.0.1:4201/__test/reset");
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("admin@example.test");
  await page.getByLabel("Password", { exact: true }).fill(randomUUID());
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/companies$/);
  await expect(page.getByText("Synthetic One", { exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await mkdir(screenshotDirectory, { recursive: true });
  const phase =
    process.env.DRIVECORE_WORKSPACE_CAPTURE === "before" ? "before" : "after";
  for (const [width, height] of [
    [1440, 900],
    [1920, 1080],
    [834, 1112],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    for (const theme of ["light", "dark"]) {
      await page.evaluate(
        (dark) => document.documentElement.classList.toggle("dark", dark),
        theme === "dark",
      );
      const surface = await page.evaluate(() => {
        const swatch = document.createElement("span");
        swatch.style.backgroundColor = "var(--surface)";
        document.body.append(swatch);
        const color = getComputedStyle(swatch).backgroundColor;
        swatch.remove();
        return color;
      });
      await expect(page.getByTestId("workspace-card-1")).toHaveCSS(
        "background-color",
        surface,
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        animations: "disabled",
        path: resolve(screenshotDirectory, `${phase}-${width}-${theme}.png`),
        fullPage: true,
      });
    }
  }
});
