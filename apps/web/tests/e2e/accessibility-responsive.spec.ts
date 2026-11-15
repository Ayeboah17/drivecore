import { test, expect } from "@playwright/test";
test("responsive shell, keyboard search, tokens, font loading, dark mode and reduced motion", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/companies/akwaaba/dashboard?branch=all");
  await expect(page.getByTestId("departure-akwaaba-d01")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const font = await page.evaluate(() => ({
    family: getComputedStyle(document.body).fontFamily,
    loaded: [...document.fonts].some(
      (f) => f.family === "Inter" && f.status === "loaded",
    ),
  }));
  expect(font.family).toContain("Inter");
  expect(font.loaded).toBeTruthy();
  await expect(
    page.getByRole("button", { name: "Global search", exact: true }),
  ).toHaveCSS("height", "40px");
  await expect(
    page.getByRole("button", { name: "Global search", exact: true }),
  ).toHaveCSS("border-radius", "7px");
  await page.keyboard.press("Control+k");
  await expect(
    page.getByRole("dialog", { name: "Search DriveCore" }),
  ).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("combobox")).toBeFocused();
  await page.keyboard.press("Escape");
  await page.screenshot({
    path: testInfo.outputPath("desktop-light.png"),
    fullPage: true,
  });
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveCSS("color-scheme", "light");
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
  await page
    .getByRole("button", { name: "Global search", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
  await page.keyboard.press("Escape");
  await page.screenshot({
    path: testInfo.outputPath("desktop-dark.png"),
    fullPage: true,
  });
  await page.evaluate(() => document.documentElement.classList.remove("dark"));
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [1280, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBeTruthy();
    await expect(
      page.getByRole("combobox", { name: "Branch", exact: true }),
    ).toBeVisible();
  }
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCSS("transition-duration", "0s");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Open navigation" }),
  ).toBeFocused();
  await page.screenshot({
    path: testInfo.outputPath("mobile-light.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 640, height: 500 });
  await page.evaluate(() => (document.documentElement.style.zoom = "2"));
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  expect(errors).toEqual([]);
});
