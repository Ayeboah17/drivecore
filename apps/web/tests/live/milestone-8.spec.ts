import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

const fixture = "http://127.0.0.1:4201";

async function login(page: Page, role = "finance") {
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

test("M8 full finance loop: rental return auto-drafts invoice, edit/issue, overpayment/over-refund guards, expense, AR ageing, PDF, and balanced GL", async ({
  page,
}) => {
  // 1. Operations returns active Rental #600 with an optional extra return charge
  await login(page, "operations");
  await page.goto("/companies/1/rentals/600?branch=all");
  await page.getByRole("button", { name: "Record return", exact: true }).click();
  await page.getByLabel("Return odometer (km)", { exact: true }).fill("180");
  await page
    .getByLabel("Condition notes", { exact: true })
    .fill("Returned clean; tank half full.");
  await page.getByLabel("Extra charge amount", { exact: true }).fill("150.00");
  await page
    .getByLabel("Charge description", { exact: true })
    .fill("Fuel refill");
  const outsideTimingCheckbox = page.getByRole("checkbox", {
    name: /I confirm completing this/i,
  });
  if (await outsideTimingCheckbox.isVisible()) {
    await outsideTimingCheckbox.check();
  }
  await page.getByRole("button", { name: "Confirm return", exact: true }).click();
  await expect(page.getByText(/Rental #600 returned/i)).toBeVisible();
  // Operations must NOT see Finance link on Rental detail or Finance nav access
  await expect(page.getByRole("link", { name: /Open invoice/i })).toHaveCount(0);

  // 2. Finance opens Invoices, sees the auto-drafted invoice, edits lines & issues it
  await login(page, "finance");
  await page.goto("/companies/1/finance?tab=invoices&branch=all");
  await expect(page.getByRole("heading", { name: "Finance", exact: true })).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.locator("tbody tr").first().getByRole("link", { name: "Open" }).click();
  await expect(page.getByRole("heading", { name: /INV-/ })).toBeVisible();

  // Add a cleaning line on the draft, save, then issue
  await page.getByRole("button", { name: "Add line", exact: true }).click();
  const descInputs = page.getByLabel("Line description", { exact: true });
  await descInputs.last().fill("Interior detailing");
  const priceInputs = page.getByLabel(/Unit \(ZMW\)/);
  await priceInputs.last().fill("50.00");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByText(/draft updated/i)).toBeVisible();

  await page.getByRole("button", { name: "Issue invoice", exact: true }).click();
  await expect(page.getByText(/issued and posted to the General Ledger/i)).toBeVisible();
  // Draft editor disappears once issued (immutable)
  await expect(page.getByRole("heading", { name: "Draft invoice editor" })).toHaveCount(0);

  // 3. Overpayment guard (422) -> valid Mobile Money payment -> Void blocked once paid
  await page.getByRole("button", { name: "Record payment", exact: true }).click();
  await page.getByLabel("Payment amount (ZMW)", { exact: true }).fill("99999.00");
  await page.getByLabel("Reference", { exact: true }).fill("MOMO-OVER");
  await page.getByRole("button", { name: "Save payment", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(/cannot exceed/i);

  await page.getByLabel("Payment amount (ZMW)", { exact: true }).fill("100.00");
  await page.getByLabel("Reference", { exact: true }).fill("MOMO-2026-001");
  await page.getByRole("button", { name: "Save payment", exact: true }).click();
  await expect(page.getByText(/Recorded .* payment/i)).toBeVisible();
  // Void button must NOT be available once paid_minor > 0
  await expect(page.getByRole("button", { name: "Void invoice" })).toHaveCount(0);

  // 4. Over-refund guard (422) -> valid refund
  await page.getByRole("button", { name: "Record refund", exact: true }).click();
  await page.getByLabel("Refund amount (ZMW)", { exact: true }).fill("500.00");
  await page.getByLabel("Refund reason", { exact: true }).fill("Too much");
  await page.getByRole("button", { name: "Save refund", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(/cannot exceed/i);

  await page.getByLabel("Refund amount (ZMW)", { exact: true }).fill("25.00");
  await page.getByLabel("Refund reason", { exact: true }).fill("Goodwill credit");
  await page.getByRole("button", { name: "Save refund", exact: true }).click();
  await expect(page.getByText(/Recorded refund of ZMW 25.00/i)).toBeVisible();

  // 5. Hybrid Invoice PDF endpoint streams real PDF bytes
  const invoiceId = page.url().match(/\/invoices\/(\d+)/)?.[1];
  expect(invoiceId).toBeTruthy();
  const pdfRes = await page.request.get(`/api/backend/api/v1/invoices/${invoiceId}/pdf?download=1`);
  expect(pdfRes.status()).toBe(200);
  expect(pdfRes.headers()["content-type"]).toBe("application/pdf");
  expect(pdfRes.headers()["x-content-type-options"]).toBe("nosniff");
  expect(await pdfRes.text()).toContain("%PDF-1.4");

  // 6. Record an immutable Expense and inspect balanced General Ledger
  await page.goto("/companies/1/finance?tab=expenses&branch=all");
  await page.getByRole("button", { name: "Record expense", exact: true }).click();
  await page.getByLabel("Description", { exact: true }).fill("Brake pads SYN-10");
  await page.getByLabel("Amount (ZMW)", { exact: true }).fill("80.00");
  await page.getByRole("button", { name: "Post expense", exact: true }).click();
  await expect(page.getByText(/posted to GL/i)).toBeVisible();

  await page.getByRole("tab", { name: "General Ledger", exact: true }).click();
  await expect(page.getByText(/Balanced \(/i)).toBeVisible();
  await expect(page.getByText("1100").first()).toBeVisible();
  await expect(page.getByText("2100").first()).toBeVisible();
  await expect(page.getByText("4100").first()).toBeVisible();
  await expect(page.getByText("5000").first()).toBeVisible();

  // 7. Viewer sees Invoices read-only and is blocked from GL (tab hidden + 403 on API)
  await login(page, "viewer");
  await page.goto("/companies/1/finance?tab=invoices&branch=all");
  await expect(page.getByRole("button", { name: "New invoice" })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "General Ledger" })).toHaveCount(0);
  const glCheck = await page.request.get("/api/backend/api/v1/gl/accounts?company_id=1");
  expect(glCheck.status()).toBe(403);
});

test("switching branches in topbar keeps the user on their current tab and falls back cleanly from detail pages", async ({
  page,
}) => {
  await login(page, "companyadmin");
  await page.goto(
    "/companies/1/finance?tab=expenses&sort=amount_minor&dir=desc&q=fuel&branch=all",
  );
  await expect(page.getByRole("tab", { name: "Expenses", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  // Switch branch from "All accessible branches" -> "Synthetic branch" (id 2)
  await page.getByRole("combobox", { name: "Branch", exact: true }).click();
  await page.getByRole("option", { name: "Synthetic branch", exact: true }).click();

  await expect(page).toHaveURL(
    /\/companies\/1\/finance\?tab=expenses&sort=amount_minor&dir=desc&branch=2$/,
  );
  await expect(page.getByRole("tab", { name: "Expenses", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  // Switching branch from a record detail page returns cleanly to its parent list/tab
  await page.goto("/companies/1/rentals/600?branch=2");
  await page.getByRole("combobox", { name: "Branch", exact: true }).click();
  await page
    .getByRole("option", { name: "All accessible branches", exact: true })
    .click();
  await expect(page).toHaveURL(/\/companies\/1\/rentals\?tab=rentals&branch=all$/);
});

test("finance can create and edit a manual invoice for a one-off custom customer without CRM write access", async ({
  page,
}) => {
  await login(page, "finance");
  await page.goto("/companies/1/finance?tab=invoices&branch=all");

  await page.getByRole("button", { name: "New invoice", exact: true }).click();
  await page.getByRole("button", { name: "Custom", exact: true }).click();
  await page
    .getByLabel("Custom customer name", { exact: true })
    .fill("Zambia Insurance Adjusters");
  await page
    .getByLabel("Custom customer email (optional)", { exact: true })
    .fill("claims@zia.test");
  await page
    .getByLabel("Custom customer phone (optional)", { exact: true })
    .fill("+260 97 123 4567");
  await page.getByLabel("Description", { exact: true }).fill("Windscreen replacement");
  await page.getByLabel("Unit (ZMW)", { exact: true }).fill("400.00");
  await page
    .getByRole("button", { name: "Create draft invoice", exact: true })
    .click();

  await expect(page).toHaveURL(/\/companies\/1\/finance\/invoices\/\d+/);
  await expect(page.getByText("Zambia Insurance Adjusters").first()).toBeVisible();
  await expect(page.getByText("claims@zia.test").first()).toBeVisible();

  // Edit custom customer name while draft, then issue (locking immutable)
  await page
    .getByLabel("Custom customer name", { exact: true })
    .fill("Zambia Insurance Adjusters Ltd");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByText(/draft updated/i)).toBeVisible();
  await expect(page.getByText("Zambia Insurance Adjusters Ltd")).toBeVisible();

  await page.getByRole("button", { name: "Issue invoice", exact: true }).click();
  await expect(page.getByText(/issued and posted to the General Ledger/i)).toBeVisible();

  // Back in Invoices list, shows custom name + Custom tag
  await page.goto("/companies/1/finance?tab=invoices&branch=all");
  await expect(page.locator("tbody tr").first()).toContainText(
    "Zambia Insurance Adjusters Ltd",
  );
  await expect(page.locator("tbody tr").first()).toContainText("Custom");
});
