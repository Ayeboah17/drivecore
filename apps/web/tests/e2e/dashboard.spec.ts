import { test, expect } from "@playwright/test";
test("dashboard filters, pagination, empty and partial failure", async ({
  page,
}) => {
  await page.goto("/companies/akwaaba/dashboard?branch=all");
  await expect(
    page.getByRole("heading", { name: "Today's departures", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("departure-akwaaba-d01")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Operational summary" }),
  ).toContainText("12 individual issues");
  await page.getByRole("button", { name: "Next departures page" }).click();
  await expect(page).toHaveURL(/depPage=2/);
  await expect(
    page.getByText("14 departures · Page 2 of 2", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Departure filter", { exact: true })
    .selectOption("soon");
  await expect(page).not.toHaveURL(/depPage=2/);
  await expect(
    page.getByText("7 departures · Page 1 of 1", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Find in departures").fill("NOT-FOUND");
  await expect(
    page.getByRole("heading", { name: "No matching departures" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear departure filters" }).click();
  await page
    .getByText("Development controls · simulated access", { exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Mock scenario", exact: true })
    .selectOption("returns-error");
  await expect(
    page.getByRole("heading", { name: "Returns unavailable" }),
  ).toBeVisible();
  await expect(page.getByTestId("departure-akwaaba-d01")).toBeVisible();
  await page
    .getByRole("combobox", { name: "Mock scenario", exact: true })
    .selectOption("empty");
  await expect(
    page.getByRole("heading", { name: "No departures today" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "No returns today" }),
  ).toBeVisible();
});
