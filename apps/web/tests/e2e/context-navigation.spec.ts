import { test, expect } from "@playwright/test";
test("scope canonicalization, access profile and direct denial", async ({
  page,
}) => {
  await page.goto("/companies/akwaaba/modules/fleet");
  await expect(page).toHaveURL(/branch=all/);
  await expect(
    page.getByRole("heading", { name: "Fleet is planned" }),
  ).toBeVisible();
  await page
    .getByText("Development controls · simulated access", { exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Mock access profile", exact: true })
    .selectOption("restricted");
  await expect(
    page.getByRole("heading", { name: "Fleet is planned" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Finance · Planned", exact: true }),
  ).toHaveCount(0);
  await page.goto("/companies/akwaaba/modules/fleet?branch=kumasi");
  // Profiles are intentionally in-memory; apply restriction after loading the explicit URL.
  await page
    .getByText("Development controls · simulated access", { exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Mock access profile", exact: true })
    .selectOption("restricted");
  await expect(
    page.getByRole("heading", { name: "Access denied or context unavailable" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Fleet is planned" }),
  ).toHaveCount(0);
});
