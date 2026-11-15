import { test, expect, type Page } from "@playwright/test";
async function select(page: Page, label: string, option: string) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}
test("company switching clears old data, resets branch, and survives A-B-A plus history", async ({
  page,
}) => {
  await page.goto(
    "/companies/akwaaba/dashboard?branch=accra&depFilter=blocked",
  );
  await expect(page.getByTestId("departure-akwaaba-d01")).toBeVisible();
  await page
    .getByText("Development controls · simulated access", { exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Mock scenario", exact: true })
    .selectOption("slow");
  await select(page, "Company", "Sankofa Mobility");
  await expect(page).toHaveURL(/companies\/sankofa\/dashboard\?branch=all$/);
  await expect(page.getByTestId("departure-akwaaba-d01")).toHaveCount(0);
  await select(page, "Company", "Akwaaba Vehicle Rental");
  await expect(page).toHaveURL(/companies\/akwaaba\/dashboard\?branch=all$/);
  await expect(page.getByTestId("departure-akwaaba-d01")).toBeVisible();
  await page.waitForTimeout(1400); // Intentionally exceed the mock request delay to catch late writes.
  await expect(page.locator("[data-testid^=departure-sankofa]")).toHaveCount(0);
  await page.goBack();
  await expect(page.getByTestId("departure-sankofa-d01")).toBeVisible();
  await expect(page.locator("[data-testid^=departure-akwaaba]")).toHaveCount(0);
  await page.goForward();
  await expect(page.getByTestId("departure-akwaaba-d01")).toBeVisible();
});
test("branch selection and explicit bookmarks take precedence over defaults", async ({
  page,
}) => {
  await page.goto("/companies/akwaaba/dashboard?branch=all");
  await expect(page.getByTestId("departure-akwaaba-d01")).toBeVisible();
  await select(page, "Branch", "Kumasi Central");
  await expect(page).toHaveURL(/branch=kumasi/);
  await expect(page.getByTestId("departure-akwaaba-d02")).toBeVisible();
  await expect(page.getByTestId("departure-akwaaba-d01")).toHaveCount(0);
  await page.evaluate(() =>
    localStorage.setItem("drivecore.v1.company", "sankofa"),
  );
  await page.reload();
  await expect(page).toHaveURL(/companies\/akwaaba\/dashboard\?branch=kumasi/);
  await expect(page.getByTestId("departure-akwaaba-d02")).toBeVisible();
  await page
    .getByText("Development controls · simulated access", { exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Mock access profile", exact: true })
    .selectOption("restricted");
  await expect(
    page.getByRole("heading", { name: "Access denied or context unavailable" }),
  ).toBeVisible();
  await expect(page.locator("[data-testid^=departure-]")).toHaveCount(0);
});
test("search clears on context changes and refresh failures retain only same-scope records", async ({
  page,
}) => {
  await page.goto("/companies/akwaaba/dashboard?branch=all");
  await expect(page.getByTestId("departure-akwaaba-d01")).toBeVisible();
  await page
    .getByText("Development controls · simulated access", { exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Mock scenario", exact: true })
    .selectOption("slow");
  await page
    .getByRole("button", { name: "Global search", exact: true })
    .click();
  await page.getByRole("dialog").getByRole("combobox").fill("AKW");
  await expect(page.getByText("Searching…", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await select(page, "Company", "Sankofa Mobility");
  await page
    .getByRole("button", { name: "Global search", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("combobox")).toHaveValue("");
  await page.waitForTimeout(2600);
  await expect(page.getByRole("dialog")).not.toContainText("AKW-26");
  await page.keyboard.press("Escape");
  await page
    .getByRole("combobox", { name: "Mock scenario", exact: true })
    .selectOption("refresh-error");
  await expect(page.getByTestId("departure-sankofa-d01")).toBeVisible();
  await page.getByRole("button", { name: "Refresh queues" }).click();
  await expect(
    page.getByText(/Refresh failed · showing stale departures/),
  ).toBeVisible();
  await expect(page.getByTestId("departure-sankofa-d01")).toBeVisible();
});
