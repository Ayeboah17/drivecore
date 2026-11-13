import { test, expect } from "@playwright/test";
test("read-only details restore the originating queue and planned resolution", async ({
  page,
}) => {
  await page.goto("/companies/akwaaba/dashboard?branch=all&depPage=2");
  const booking = page
    .locator("[data-testid^=departure-akwaaba-d]")
    .first()
    .getByRole("link")
    .first();
  const reference = await booking.innerText();
  await booking.click();
  await expect(
    page.getByRole("heading", { name: reference.trim(), exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to dashboard queue" }).click();
  await expect(page).toHaveURL(/depPage=2/);
  await page.goto("/companies/akwaaba/blockers/akwaaba-d01-b1?branch=all");
  await expect(
    page.getByRole("heading", { name: "No vehicle allocated", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Operations · Planned", exact: true })
    .last()
    .click();
  await expect(
    page.getByRole("heading", { name: "Operations is planned" }),
  ).toBeVisible();
});
test("wrong company, wrong branch and unavailable records reveal no details", async ({
  page,
}) => {
  for (const url of [
    "/companies/sankofa/departures/akwaaba-d01?branch=all",
    "/companies/akwaaba/departures/akwaaba-d02?branch=accra",
    "/companies/akwaaba/departures/unknown?branch=all",
  ]) {
    await page.goto(url);
    await expect(
      page.getByRole("heading", { name: "Departure unavailable", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "AKW-26-4101", exact: true }),
    ).toHaveCount(0);
  }
});
