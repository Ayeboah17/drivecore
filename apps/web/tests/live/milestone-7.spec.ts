import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

const fixture = "http://127.0.0.1:4201";

async function login(page: Page, role = "admin") {
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

test("financial settings, multi-vehicle quotation with unpriced guard, discount reject/revise/approve, atomic convert, and hybrid PDF", async ({
  page,
}) => {
  // 1. Company Admin updates VAT (15% -> 16%) and discount threshold (10% -> 8%)
  await login(page, "companyadmin");
  await page.goto("/companies/1/users?branch=all");
  await page.getByRole("tab", { name: "Financial settings", exact: true }).click();
  await page.getByLabel("VAT rate (%)", { exact: true }).fill("16");
  await page
    .getByLabel("Discount approval threshold (%)", { exact: true })
    .fill("8");
  await page.getByRole("button", { name: "Save settings", exact: true }).click();
  await expect(page.getByText("Financial settings updated.")).toBeVisible();

  // 2. Operations opens Rentals -> Quotations and creates a multi-vehicle quote above threshold
  await login(page, "operations");
  await page.goto("/companies/1/rentals?tab=quotations&branch=all");
  await page
    .getByRole("button", { name: "Create quotation", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Create multi-vehicle quotation",
  });

  // Unpriced vehicle SYN-15 is disabled with explicit guidance
  await expect(
    dialog.getByLabel("SYN-15 Unpriced Sedan", { exact: true }),
  ).toBeDisabled();
  await expect(dialog.getByText("Set daily rate first")).toBeVisible();

  // Pick customer & two priced vehicles (SYN-10 + SYN-14)
  await dialog.getByLabel("Customer", { exact: true }).click();
  await page
    .getByRole("option", { name: "Synthetic customer", exact: true })
    .click();
  await dialog.getByLabel("SYN-10 Synthetic Fixture", { exact: true }).check();
  await dialog.getByLabel("SYN-14 Toyota Prado", { exact: true }).check();

  // Move dates to next month to avoid Reservation #500 overlap
  await dialog.getByLabel("Departure", { exact: true }).click();
  const depPicker = page.getByRole("dialog", { name: "Departure", exact: true });
  await depPicker.getByRole("button", { name: "Next month", exact: true }).click();
  await depPicker.getByRole("button", { name: /10, \d{4}/ }).click();
  await depPicker
    .getByRole("button", { name: "Apply date & time", exact: true })
    .click();

  await dialog.getByLabel("Expected return", { exact: true }).click();
  const retPicker = page.getByRole("dialog", {
    name: "Expected return",
    exact: true,
  });
  await retPicker.getByRole("button", { name: "Next month", exact: true }).click();
  await retPicker.getByRole("button", { name: /12, \d{4}/ }).click();
  await retPicker
    .getByRole("button", { name: "Apply date & time", exact: true })
    .click();

  // Enter 12% discount (> 8% threshold) -> warns & enters Pending approval
  await dialog.getByLabel("Discount (%)", { exact: true }).fill("12");
  await expect(dialog).toContainText("exceeds the company approval threshold (8%)");
  await expect(dialog).toContainText("VAT (16%)");
  await dialog
    .getByRole("button", { name: "Submit for discount approval", exact: true })
    .click();

  await expect(page).toHaveURL(/\/companies\/1\/quotations\/\d+/);
  const firstQuoteUrl = page.url();
  await expect(
    page.getByText("Pending approval", { exact: true }).first(),
  ).toBeVisible();
  // Operations cannot approve discount or convert while pending
  await expect(
    page.getByRole("button", { name: "Approve discount", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Convert to reservations", exact: true }),
  ).toHaveCount(0);

  // 3. Finance rejects the discount with notes -> quote stays immutable
  await login(page, "finance");
  await page.goto(firstQuoteUrl);
  await page
    .getByRole("button", { name: "Reject discount", exact: true })
    .click();
  const rejectDialog = page.getByRole("dialog", {
    name: /Reject 12% discount/,
  });
  await rejectDialog
    .getByLabel("Decision notes (optional)", { exact: true })
    .fill("Max 5% allowed for peak season");
  await rejectDialog
    .getByRole("button", { name: "Confirm rejection", exact: true })
    .click();
  await expect(page.getByText("Rejected", { exact: true })).toBeVisible();
  await expect(page.getByText("Max 5% allowed for peak season")).toBeVisible();

  // 4. Operations clicks "Revise as new quote", submits 10% (>8%), Admin approves, and converts atomically into 2 reservations
  await login(page, "operations");
  await page.goto(firstQuoteUrl);
  await page
    .getByRole("button", { name: "Revise as new quote", exact: true })
    .click();
  const reviseDialog = page.getByRole("dialog", {
    name: "Revise as new quotation",
  });
  await reviseDialog.getByLabel("Discount (%)", { exact: true }).fill("10");
  await reviseDialog
    .getByRole("button", { name: "Submit for discount approval", exact: true })
    .click();
  await expect(page).not.toHaveURL(firstQuoteUrl);
  await expect(page).toHaveURL(/\/companies\/1\/quotations\/\d+/);
  const revisedQuoteUrl = page.url();
  const revisedId = revisedQuoteUrl.match(/quotations\/(\d+)/)?.[1];

  await login(page, "companyadmin");
  await page.goto(revisedQuoteUrl);
  await page
    .getByRole("button", { name: "Approve discount", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: /Approve 10% discount/ })
    .getByRole("button", { name: "Confirm approval", exact: true })
    .click();
  await expect(page.getByText("Approved", { exact: true })).toBeVisible();

  await page
    .getByRole("button", { name: "Convert to reservations", exact: true })
    .click();
  await expect(page.getByText(/Converted Quotation #\d+ into 2 reservations\./)).toBeVisible();
  await expect(page.getByText("Converted", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Reservation #\d+/ })).toHaveCount(2);

  // 5. Hybrid PDF modal + server PDF endpoint verification
  await page.getByRole("button", { name: "Export PDF", exact: true }).click();
  const pdfDialog = page.getByRole("dialog", { name: /Official quotation/ });
  await expect(pdfDialog).toContainText("SYN-10");
  await expect(pdfDialog).toContainText("SYN-14");
  await pdfDialog
    .getByRole("button", { name: "Download PDF", exact: true })
    .click();
  await expect(pdfDialog).toContainText(`Downloaded drivecore-quotation-${revisedId}.pdf.`);

  const serverPdf = await page.request.get(
    `/api/backend/api/v1/quotations/${revisedId}/pdf?download=1`,
  );
  expect(serverPdf.status()).toBe(200);
  expect(serverPdf.headers()["content-type"]).toBe("application/pdf");
  expect(serverPdf.headers()["x-content-type-options"]).toBe("nosniff");
  expect(await serverPdf.text()).toContain("%PDF-1.4");
});

test("table column sorting supports 3-state cycle, URL persistence across reload, and multi-page ordering", async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/control`, {
    data: { seedMany: "vehicles" },
  });
  await login(page, "companyadmin");

  // 1. Multi-page Fleet sorting by Daily rate (asc -> desc -> none) + reload persistence
  await page.goto("/companies/1/vehicles?branch=all");
  const dailyRateHeader = page.locator("th", { hasText: "Daily rate" });
  const dailyRateButton = dailyRateHeader.getByRole("button");
  await expect(dailyRateHeader).toHaveAttribute("aria-sort", "none");

  // Click 1: ascending (unpriced / 0 daily rate SYN-11 and SYN-15 appear first)
  await dailyRateButton.click();
  await expect(dailyRateHeader).toHaveAttribute("aria-sort", "ascending");
  await expect(page).toHaveURL(/sort=daily_rate_minor&dir=asc/);
  await expect(page.locator("tbody tr").first()).toContainText("SYN-11");

  // Click 2: descending (SYN-14 with ZMW 650.00 pulls to row 1 across all 30+ vehicles)
  await dailyRateButton.click();
  await expect(dailyRateHeader).toHaveAttribute("aria-sort", "descending");
  await expect(page).toHaveURL(/sort=daily_rate_minor&dir=desc/);
  await expect(page.locator("tbody tr").first()).toContainText("SYN-14");

  // Reload preserves sort state from URL
  await page.reload();
  await expect(dailyRateHeader).toHaveAttribute("aria-sort", "descending");
  await expect(page.locator("tbody tr").first()).toContainText("SYN-14");

  // Click 3: reset to default order
  await dailyRateButton.click();
  await expect(dailyRateHeader).toHaveAttribute("aria-sort", "none");
  await expect(page).not.toHaveURL(/sort=/);

  // 2. Customers table sorting by Name (asc -> desc)
  await page.goto("/companies/1/customers?branch=all");
  const nameHeader = page.locator("th", { hasText: "Name" });
  await nameHeader.getByRole("button").click();
  await expect(nameHeader).toHaveAttribute("aria-sort", "ascending");
  await expect(page.locator("tbody tr").first()).toContainText(
    "Apex Corporate Fleet",
  );
  await nameHeader.getByRole("button").click();
  await expect(nameHeader).toHaveAttribute("aria-sort", "descending");
  await expect(page.locator("tbody tr").first()).toContainText(
    "Synthetic customer",
  );
});
