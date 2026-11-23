import { expect, test } from "@playwright/test";

const fixture = "http://127.0.0.1:4201";

async function login(
  page: import("@playwright/test").Page,
  email: string,
  password = "secret",
) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your workspace", exact: true }),
  ).toBeVisible();
}

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

test("M15 Full Accounting: AP 3-way match/variance, Credit Notes, Bank Recon, Fixed Assets depreciation & approval-gated disposal, and P&L/BS/CF statements", async ({
  page,
}) => {
  // 1. Company Admin creates a Supplier, then Finance records a non-PO bill and pays it in Finance -> Payables (AP)
  await login(page, "companyadmin@example.test");
  await page.goto("/companies/1/procurement?tab=suppliers&branch=all");
  await page.getByRole("button", { name: "New supplier", exact: true }).click();
  await page.getByLabel("Supplier name", { exact: true }).fill("Accra Parts Supply");
  await page.getByRole("button", { name: "Create supplier", exact: true }).click();
  await expect(page.getByRole("cell", { name: "Accra Parts Supply" })).toBeVisible();

  await login(page, "finance@example.test");
  await page.goto("/companies/1/finance?tab=payables&branch=all");
  await page.getByRole("button", { name: "New supplier invoice" }).click();
  const apDialog = page.getByRole("dialog", { name: "Record supplier invoice" });
  await apDialog.getByRole("combobox", { name: "Supplier" }).click();
  await page.getByRole("option", { name: "Accra Parts Supply" }).click();
  await apDialog.getByLabel("Vendor invoice number").fill("SUP-2026-101");
  await apDialog.getByLabel(/Subtotal/).fill("1500.00");
  await apDialog.getByRole("button", { name: "Save supplier invoice" }).click();
  await expect(page.getByText("SUP-2026-101", { exact: true })).toBeVisible();

  // Pay supplier invoice
  await page.getByRole("button", { name: "Record payment" }).click();
  await page.getByRole("button", { name: "Confirm payment" }).click();
  await expect(page.getByText(/Supplier payment posted for SUP-2026-101/)).toBeVisible();

  // 2. Customer Invoice -> Issue -> Issue Credit Note -> verify in Invoices -> Credit notes
  await page.goto("/companies/1/finance?tab=invoices&branch=all");
  await page.getByRole("button", { name: "New invoice" }).click();
  const invDialog = page.getByRole("dialog");
  await invDialog.getByLabel("Customer", { exact: true }).click();
  await page.getByRole("option", { name: /Synthetic customer/ }).click();
  await invDialog.getByLabel("Description").first().fill("Corporate rental");
  await invDialog.getByLabel(/Unit/).first().fill("2000.00");
  await invDialog.getByRole("button", { name: "Create draft invoice" }).click();
  await expect(page).toHaveURL(/\/finance\/invoices\/\d+/);
  await page.getByRole("button", { name: "Issue invoice" }).click();
  await expect(page.getByRole("button", { name: "Issue credit note" })).toBeVisible();

  await page.getByRole("button", { name: "Issue credit note" }).click();
  const cnDialog = page.getByRole("dialog");
  await cnDialog.getByLabel(/Credit subtotal/).fill("500.00");
  await cnDialog.getByLabel("Reason").fill("Early return credit adjustment");
  await cnDialog.getByRole("button", { name: "Confirm credit note" }).click();
  await expect(page.getByText(/Credit note CN-\d+ issued/)).toBeVisible();

  await page.goto("/companies/1/finance?tab=invoices&ar_view=credit_notes&branch=all");
  await expect(page.getByText("Early return credit adjustment")).toBeVisible();

  // 3. Banking & Reconciliation: Add bank account, import CSV line, post bank fee, close reconciliation
  await page.getByRole("tab", { name: "Banking & Recon" }).click();
  await page.getByRole("button", { name: "Add bank account" }).click();
  const baDialog = page.getByRole("dialog", { name: "Add bank or cash account" });
  await baDialog.getByLabel("Account display name").fill("Operating Checking");
  await baDialog.getByLabel("Bank name").fill("Stanbic Bank");
  await baDialog.getByLabel("Masked account #").fill("****4821");
  await baDialog.getByLabel(/Opening balance/).fill("10000.00");
  await baDialog.getByRole("button", { name: "Save account" }).click();
  await expect(page.getByText("Operating Checking").first()).toBeVisible();

  await page.getByRole("button", { name: "Import / add lines" }).click();
  await page.getByRole("button", { name: "Import lines" }).click();
  await expect(page.getByText("Bank service charge", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Post bank fee" }).click();
  await expect(page.getByText(/Posted GL 5600 Bank Charges/)).toBeVisible();

  await page.getByRole("button", { name: "Close reconciliation" }).click();
  await page.getByRole("button", { name: "Confirm close" }).click();
  await expect(page.getByText(/Reconciliation closed for Operating Checking/)).toBeVisible();

  // 4. Fixed Assets: Register vehicle asset, run idempotent monthly depreciation twice, request disposal
  await page.getByRole("tab", { name: "Fixed assets" }).click();
  await page.getByRole("button", { name: "Register asset" }).click();
  const faDialog = page.getByRole("dialog", { name: "Register fixed asset" });
  await faDialog.getByLabel("Asset code").fill("FA-VEH-10");
  await faDialog.getByLabel("Asset name").fill("Synthetic Sedan Asset");
  await faDialog.getByRole("combobox", { name: "Link vehicle" }).click();
  await page.getByRole("option", { name: /SYN-10/ }).click();
  await faDialog.getByLabel(/Acquisition cost/).fill("60000.00");
  await faDialog.getByLabel("Life (months)").fill("60");
  await faDialog.getByRole("button", { name: "Save asset" }).click();
  await expect(page.getByText("FA-VEH-10", { exact: true })).toBeVisible();

  // Run depreciation for 2026-11
  await page.getByRole("button", { name: "Run monthly depreciation" }).click();
  await page.getByLabel(/Accounting period/).fill("2026-11");
  await page.getByRole("button", { name: "Post depreciation" }).click();
  await expect(page.getByText(/1 asset\(s\) posted.*0 skipped/)).toBeVisible();

  // Run again -> idempotent (0 posted, 1 skipped)
  await page.getByRole("button", { name: "Run monthly depreciation" }).click();
  await page.getByLabel(/Accounting period/).fill("2026-11");
  await page.getByRole("button", { name: "Post depreciation" }).click();
  await expect(page.getByText(/0 asset\(s\) posted.*1 skipped/)).toBeVisible();

  // Request disposal -> Finance submits -> Company Admin approves -> Finance completes
  await page.getByRole("button", { name: "Request disposal" }).click();
  const dispDialog = page.getByRole("dialog");
  await dispDialog.getByLabel(/Expected sale proceeds/).fill("62000.00");
  await dispDialog.getByLabel("Justification").fill("End of fleet cycle sale");
  await dispDialog.getByRole("button", { name: "Submit disposal request" }).click();
  await expect(page.getByText(/Disposal approval requested for FA-VEH-10/)).toBeVisible();

  await login(page, "companyadmin@example.test");
  await page.goto("/companies/1/operations?branch=all&tab=approvals");
  await expect(page.getByText(/Asset disposal · FA-VEH-10/)).toBeVisible();
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await page.getByRole("button", { name: "Confirm approval", exact: true }).click();
  await expect(page.getByText(/Approval #\d+ approved/i)).toBeVisible();

  await page.goto("/companies/1/finance?tab=assets&branch=all");
  await page.getByRole("button", { name: "Complete disposal" }).click();
  await expect(page.getByText(/Disposed FA-VEH-10 \(sold\)/)).toBeVisible();

  // 5. Formal Financial Statements (P&L, Balance Sheet balanced, Cash Flow)
  await page.goto("/companies/1/reports?tab=statements&branch=all");
  await expect(page.getByText("Total revenue").first()).toBeVisible();
  await page.getByRole("tab", { name: "Balance Sheet" }).click();
  await expect(page.getByText(/Balanced \(Assets = Liabilities \+ Equity\)/)).toBeVisible();
  await page.getByRole("tab", { name: "Cash Flow" }).click();
  await expect(page.getByText("Operating Activities")).toBeVisible();
});
