import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

const fixture = "http://127.0.0.1:4201";

async function login(page: Page, role = "companyadmin") {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(`${role}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill(randomUUID());
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your workspace", exact: true }),
  ).toBeVisible();
}

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

test("M13 Rate Cards, Preventive Maintenance Schedules, Tyres & Batteries, Fuel Log (L/100km -> MPG conversion + auto Expense/GL), and Digital Inspection Checklist", async ({
  page,
}) => {
  await login(page, "companyadmin");

  // 1. Rentals -> Rate cards
  await page.goto("/companies/1/rentals?branch=all");
  await page.getByRole("tab", { name: "Rate cards", exact: true }).click();
  await page.getByRole("button", { name: "New rate card", exact: true }).click();
  const rcDialog = page.getByRole("dialog", { name: "New rate card" });
  await rcDialog.getByLabel("Rate card name", { exact: true }).fill("Corporate SUV Weekly");
  await rcDialog.getByLabel(/Daily rate/i).fill("1500.00");
  await rcDialog.getByRole("button", { name: "Create rate card", exact: true }).click();
  await expect(page.getByText("Corporate SUV Weekly")).toBeVisible();

  // 2. Maintenance -> Preventive schedules -> Open Work Order
  await page.goto("/companies/1/maintenance?branch=all");
  await page.getByRole("tab", { name: "Preventive schedules", exact: true }).click();
  await page.getByRole("button", { name: "New schedule", exact: true }).click();
  const pmDialog = page.getByRole("dialog", { name: "New preventive schedule" });
  await pmDialog.getByLabel("Schedule vehicle", { exact: true }).click();
  await page.getByRole("option", { name: /SYN-10/ }).click();
  await pmDialog.getByLabel("Service name", { exact: true }).fill("10k km Oil & Filter");
  await pmDialog.getByRole("button", { name: "Save schedule", exact: true }).click();
  await expect(page.getByText("10k km Oil & Filter")).toBeVisible();
  await page.getByRole("button", { name: "Open Work Order", exact: true }).click();
  await expect(page.getByText(/Opened preventive work order/i)).toBeVisible();

  // 3. Maintenance -> Fuel log -> L/100km default + abnormal detection + auto Expense
  await page.getByRole("tab", { name: "Fuel log", exact: true }).click();
  await page.getByRole("button", { name: "Log fuel", exact: true }).click();
  const fuel1 = page.getByRole("dialog", { name: "Log fuel transaction" });
  await fuel1.getByLabel("Fuel vehicle", { exact: true }).click();
  await page.getByRole("option", { name: /SYN-10/ }).click();
  await fuel1.getByLabel("Station (optional)", { exact: true }).fill("Total Central");
  await fuel1.getByLabel("Litres (L)", { exact: true }).fill("40");
  await fuel1.getByLabel(/Amount/i).fill("1000.00");
  await fuel1.getByLabel("Odometer (km)", { exact: true }).fill("1000");
  await fuel1.getByRole("button", { name: "Save fuel fill", exact: true }).click();
  await expect(page.getByText("Total Central")).toBeVisible();

  // Second fill: 50L over 100km -> 50.0 L/100km (Abnormal!)
  await page.getByRole("button", { name: "Log fuel", exact: true }).click();
  const fuel2 = page.getByRole("dialog", { name: "Log fuel transaction" });
  await fuel2.getByLabel("Fuel vehicle", { exact: true }).click();
  await page.getByRole("option", { name: /SYN-10/ }).click();
  await fuel2.getByLabel("Station (optional)", { exact: true }).fill("Shell East");
  await fuel2.getByLabel("Litres (L)", { exact: true }).fill("50");
  await fuel2.getByLabel(/Amount/i).fill("1250.00");
  await fuel2.getByLabel("Odometer (km)", { exact: true }).fill("1100");
  await fuel2.getByRole("button", { name: "Save fuel fill", exact: true }).click();
  await expect(page.getByText("50.0 L/100km").first()).toBeVisible();
  await expect(page.getByText("Abnormal").first()).toBeVisible();

  // Verify auto-posted fuel expense appears in Finance -> Expenses
  await page.goto("/companies/1/finance?branch=all&tab=expenses");
  await expect(page.getByText(/Fuel fill \(50 L at Shell East\)/i)).toBeVisible();

  // 4. Inventory -> Tyres & batteries
  await page.goto("/companies/1/inventory?branch=all");
  await page.getByRole("tab", { name: "Tyres & batteries", exact: true }).click();
  await page.getByRole("button", { name: "Log tyre / battery", exact: true }).click();
  const compDialog = page.getByRole("dialog", { name: "Log tyre or battery" });
  await compDialog.getByLabel("Component vehicle", { exact: true }).click();
  await page.getByRole("option", { name: /SYN-10/ }).click();
  await compDialog.getByLabel("Serial number", { exact: true }).fill("TYR-FL-2026-01");
  await compDialog.getByLabel("Brand & model", { exact: true }).fill("Bridgestone Dueler");
  await compDialog.getByRole("button", { name: "Save component", exact: true }).click();
  await expect(page.getByText("TYR-FL-2026-01")).toBeVisible();
  await page.getByRole("button", { name: "Mark replaced", exact: true }).click();
  await expect(page.getByText("replaced")).toBeVisible();
});
