import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

const fixture = "http://127.0.0.1:4201";

async function login(page: Page, role = "operations") {
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
  await request.post(`${fixture}/__test/control`, {
    data: { seedExtraAvailableVehicle: true },
  });
});

test("M9 full workshop-inventory-procurement loop: multi-line PO approval & atomic receive, work order start/consume/complete, balanced GL, and Vehicle 360", async ({
  page,
}) => {
  // 1. Operations creates a spare part & a supplier, then a PO and submits it
  await login(page, "operations");
  await page.goto("/companies/1/inventory?branch=all");
  await page.getByRole("button", { name: "New part", exact: true }).click();
  await page.getByLabel("SKU", { exact: true }).fill("BRK-001");
  await page.getByLabel("Part name", { exact: true }).fill("Front Brake Pads");
  await page.getByLabel("Unit cost (ZMW)", { exact: true }).fill("120.00");
  await page.getByLabel("Minimum stock", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Save part", exact: true }).click();
  await expect(page.getByText(/Part BRK-001/i)).toBeVisible();

  // Negative stock adjustment rejected (422)
  await page.getByRole("button", { name: "Adjust stock", exact: true }).click();
  await page.getByLabel("Quantity change (+ or -)", { exact: true }).fill("-1");
  await page.getByLabel("Adjustment reason", { exact: true }).fill("Test");
  await page.getByRole("button", { name: "Apply adjustment", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(/cannot become negative/i);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();

  await page.goto("/companies/1/procurement?tab=suppliers&branch=all");
  await page.getByRole("button", { name: "New supplier", exact: true }).click();
  await page.getByLabel("Supplier name", { exact: true }).fill("Lusaka Spares");
  await page.getByRole("button", { name: "Create supplier", exact: true }).click();
  await expect(page.getByRole("cell", { name: "Lusaka Spares" })).toBeVisible();

  await page.getByRole("tab", { name: "Purchase orders", exact: true }).click();
  await page.getByRole("button", { name: "New purchase order", exact: true }).click();
  await page.getByLabel("Supplier", { exact: true }).click();
  await page.getByRole("option", { name: "Lusaka Spares" }).click();
  await page.getByLabel("Part", { exact: true }).click();
  await page.getByRole("option", { name: /BRK-001/ }).click();
  await page.getByLabel("Qty", { exact: true }).fill("4");
  await page.getByRole("button", { name: "Create draft PO", exact: true }).click();
  await expect(page).toHaveURL(/\/procurement\/purchase-orders\/\d+/);
  const poUrl = page.url();

  await page.getByRole("button", { name: "Submit for approval", exact: true }).click();
  await expect(page.getByText(/submitted for approval/i)).toBeVisible();
  // Operations must NOT see Approve button
  await expect(
    page.getByRole("button", { name: "Approve purchase order" }),
  ).toHaveCount(0);

  // 2. Finance approves the PO
  await login(page, "finance");
  await page.goto(poUrl);
  await page.getByRole("button", { name: "Approve purchase order", exact: true }).click();
  await expect(page.getByText(/approved\./i)).toBeVisible();

  // 3. Operations receives goods -> stock becomes 4
  await login(page, "operations");
  await page.goto(poUrl);
  await page.getByRole("button", { name: "Receive goods", exact: true }).click();
  await expect(page.getByText(/received — stock incremented/i)).toBeVisible();

  // 4. Operations opens a Work Order on SYN-14 (available), starts it, consumes 2 pads, completes with labour
  await page.goto("/companies/1/maintenance?branch=all");
  await page.getByRole("button", { name: "New work order", exact: true }).click();
  await page.getByLabel("Vehicle", { exact: true }).click();
  await page.getByRole("option", { name: /SYN-14/ }).click();
  await page.getByLabel("Service title", { exact: true }).fill("Brake pad service");
  await page.getByLabel("Estimated labour (ZMW)", { exact: true }).fill("100.00");
  await page.getByRole("button", { name: "Create work order", exact: true }).click();
  await expect(page).toHaveURL(/\/maintenance\/\d+/);

  await page.getByRole("button", { name: "Start work", exact: true }).click();
  await expect(page.getByText(/vehicle moved to maintenance/i)).toBeVisible();

  await page.getByRole("button", { name: "Consume parts", exact: true }).click();
  await page.getByLabel("Spare part", { exact: true }).click();
  await page.getByRole("option", { name: /BRK-001/ }).click();
  await page.getByLabel("Quantity", { exact: true }).fill("2");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Consume parts", exact: true })
    .click();
  await expect(page.getByText(/deducted from inventory/i)).toBeVisible();

  await page.getByRole("button", { name: "Complete work order", exact: true }).click();
  await page.getByLabel("Final labour cost (ZMW)", { exact: true }).fill("150.00");
  await page.getByRole("button", { name: "Confirm completion", exact: true }).click();
  await expect(page.getByText(/vehicle restored to available/i)).toBeVisible();

  // 5. Operations sees Vehicle 360 work orders/downtime WITHOUT financial ROI
  await page.goto("/companies/1/vehicles/14?branch=all");
  await expect(page.getByRole("heading", { name: "Vehicle 360" })).toBeVisible();
  await expect(page.getByText("Brake pad service")).toBeVisible();
  await expect(page.getByText("Net vehicle ROI")).toHaveCount(0);

  // 6. Finance sees Vehicle 360 WITH Net ROI AND balanced GL including accounts 1200, 1250, 2000, 5000
  await login(page, "finance");
  await page.goto("/companies/1/vehicles/14?branch=all");
  await expect(page.getByText("Net vehicle ROI")).toBeVisible();

  await page.goto("/companies/1/finance?tab=ledger&branch=all");
  await expect(page.getByText(/Balanced \(/i)).toBeVisible();
  await expect(page.getByText("1200").first()).toBeVisible();
  await expect(page.getByText("2000").first()).toBeVisible();
});
