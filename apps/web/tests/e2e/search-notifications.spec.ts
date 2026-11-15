import { test, expect } from "@playwright/test";
test("global search supports records, planned modules, no-results, keyboard and notifications", async ({
  page,
}) => {
  await page.goto("/companies/akwaaba/dashboard?branch=all");
  await page
    .getByRole("button", { name: "Global search", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Search DriveCore" });
  await expect(dialog).toBeVisible();
  const input = dialog.getByRole("combobox");
  await input.fill("Fleet");
  await expect(dialog.getByRole("option", { name: /Fleet/ })).toContainText(
    "Planned",
  );
  await input.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Fleet is planned" }),
  ).toBeVisible();
  await page.keyboard.press("Control+k");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("combobox").fill("AKW-26-4101");
  await expect(
    dialog.getByRole("option", { name: /AKW-26-4101/ }).first(),
  ).toBeVisible();
  await dialog.getByRole("combobox").press("Enter");
  await expect(
    page.getByRole("heading", { name: "AKW-26-4101", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Global search", exact: true })
    .click();
  await dialog.getByRole("combobox").fill("NO-SUCH-RECORD");
  await expect(
    dialog.getByText("No results in this scope", { exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Global search", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "Operational notifications", exact: true })
    .click();
  await expect(
    page.getByText("Read-only mock items · Current branch scope", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: /AKW-26-4101: No vehicle allocated/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "No vehicle allocated", exact: true }),
  ).toBeVisible();
  await page
    .getByText("Development controls · simulated access", { exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Mock scenario", exact: true })
    .selectOption("search-error");
  await page
    .getByRole("button", { name: "Global search", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByText("Search unavailable", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Retry search", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
});
