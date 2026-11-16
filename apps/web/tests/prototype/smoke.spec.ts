import { test, expect } from "@playwright/test";
test("ERP demo opens without credentials/API, navigates all modules and retains browser state", async ({
  page,
}) => {
  const api: string[] = [],
    errors: string[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).pathname.startsWith("/api/")) api.push(r.url());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/demo/erp");
  await page
    .getByRole("button", { name: "Enter ERP demo", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
  for (const name of [
    "Operations",
    "Fleet",
    "Customers",
    "Rentals",
    "Maintenance",
    "Inventory",
    "Finance",
    "Procurement",
    "Reports",
    "Administration",
  ]) {
    await page
      .getByRole("navigation", { name: "Demo navigation", exact: true })
      .getByRole("button", { name, exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
  }
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Administration", exact: true }),
  ).toBeVisible();
  expect(api).toEqual([]);
  expect(errors).toEqual([]);
});
