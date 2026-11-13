import { test, expect } from "@playwright/test";
test("application entry, planned destinations, details and company reset", async ({
  page,
}) => {
  await page.goto("/companies");
  await expect(page).toHaveURL(/companies\/akwaaba\/dashboard\?branch=all/);
  await expect(
    page.getByRole("heading", { name: "Today's departures", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Fleet · Planned", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Fleet is planned" }),
  ).toBeVisible();
  await page.goto("/companies/akwaaba/departures/akwaaba-d01?branch=all");
  await expect(
    page.getByRole("heading", { name: "AKW-26-4101", exact: true }),
  ).toBeVisible();
  await page.getByRole("combobox", { name: "Company", exact: true }).click();
  await page
    .getByRole("option", { name: "Sankofa Mobility", exact: true })
    .click();
  await expect(page).toHaveURL(/companies\/sankofa\/dashboard\?branch=all$/);
  await expect(page.getByTestId("departure-sankofa-d01")).toBeVisible();
  await expect(page.getByTestId("departure-akwaaba-d01")).toHaveCount(0);
  await page
    .getByText("Development controls · simulated access", { exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Mock access profile", exact: true })
    .selectOption("noAccess");
  await expect(
    page.getByRole("heading", { name: "Access denied or context unavailable" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Return to workspace", exact: true })
    .click();
  await expect(
    page.getByText("No companies are accessible to this simulated profile.", {
      exact: true,
    }),
  ).toBeVisible();
});
