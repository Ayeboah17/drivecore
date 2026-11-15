import { test, expect } from "@playwright/test";
test("explicit demo cannot submit live resource forms", async ({ page }) => {
  for (const domain of ["customers", "vehicles"]) {
    await page.goto(`/companies/akwaaba/${domain}/new?branch=all`);
    await expect(
      page.getByRole("heading", { name: "Live feature unavailable in demo" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /create customer|create vehicle/i }),
    ).toHaveCount(0);
  }
});
