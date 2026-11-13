import { test, expect } from "@playwright/test";
test("planned shell navigation, collapse and mobile sheet", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/companies/akwaaba/modules/fleet?branch=all");
  await expect(
    page.getByRole("heading", { name: "Fleet is planned" }),
  ).toBeVisible();
  await expect(page.getByTestId("sidebar")).toHaveCSS("width", "248px");
  await expect(page.getByTestId("topbar")).toHaveCSS("height", "64px");
  await page.getByRole("button", { name: "Toggle sidebar" }).click();
  await expect(page.getByTestId("sidebar")).toHaveCSS("width", "72px");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Maintenance · Planned", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Maintenance is planned" }),
  ).toBeVisible();
});
