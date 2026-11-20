import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

const fixture = "http://127.0.0.1:4201";

async function login(page: Page, role = "admin") {
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

test("full reservation -> rental contract -> driver assignment -> handover -> extend (409 conflict + success) -> return lifecycle", async ({
  page,
  request,
}) => {
  await login(page, "companyadmin");
  await page
    .getByRole("link", { name: "Open workspace: Synthetic One", exact: true })
    .click();

  await page
    .getByRole("navigation", { name: "Main navigation", exact: true })
    .getByRole("link", { name: "Rentals", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Rentals", exact: true }),
  ).toBeVisible();

  // Start contract from confirmed Reservation #500 (starts_at already passed, ends_at in +48h)
  const row500 = page.getByRole("row", { name: /#500/ });
  await row500
    .getByRole("button", { name: "Start contract", exact: true })
    .click();
  const startDialog = page.getByRole("dialog", {
    name: "Create rental contract",
  });
  await startDialog.getByLabel("Assign driver (optional)", { exact: true }).click();
  await page.getByRole("option", { name: /Fleet Driver/ }).click();
  await startDialog
    .getByRole("button", { name: "Create contract", exact: true })
    .click();

  await expect(page.getByRole("heading", { name: /Rental #\d+/ })).toBeVisible();
  await expect(page.getByText("Fleet Driver", { exact: true })).toBeVisible();

  // Complete handover (Reservation #500 started 2h ago -> outside ±30 min window)
  await page
    .getByRole("button", { name: "Complete handover", exact: true })
    .click();
  const handoverDialog = page.getByRole("dialog", { name: "Complete handover" });
  await expect(
    handoverDialog.getByText("Outside ±30 minute scheduled window"),
  ).toBeVisible();
  await handoverDialog
    .getByLabel("Handover odometer (km)", { exact: true })
    .fill("120");
  await handoverDialog
    .getByLabel("Condition notes", { exact: true })
    .fill("Full tank, clean interior");
  // Submitting without ticking confirmation checkbox is blocked
  await handoverDialog
    .getByRole("button", { name: "Confirm handover", exact: true })
    .click();
  await expect(handoverDialog.getByRole("alert")).toContainText("±30 minute");
  await handoverDialog
    .getByLabel(
      "I confirm completing this handover outside the ±30 minute scheduled window.",
      { exact: true },
    )
    .check();
  await handoverDialog
    .getByRole("button", { name: "Confirm handover", exact: true })
    .click();
  await expect(page.getByText(/handed over/i)).toBeVisible();
  await expect(page.getByText("120 km", { exact: true })).toBeVisible();

  // Extend rental: first trigger 409 overlap conflict, then succeed
  await request.post(`${fixture}/__test/control`, {
    data: { extendConflict: true },
  });
  await page
    .getByRole("button", { name: "Extend rental", exact: true })
    .click();
  const extendDialog = page.getByRole("dialog", { name: "Extend active rental" });
  await extendDialog
    .getByLabel("New expected return", { exact: true })
    .click();
  const pickerDialog = page.getByRole("dialog", {
    name: "New expected return",
    exact: true,
  });
  await pickerDialog
    .getByRole("button", { name: "Next month", exact: true })
    .click();
  await pickerDialog.getByRole("button", { name: /15, \d{4}/ }).click();
  await pickerDialog
    .getByRole("button", { name: "Apply date & time", exact: true })
    .click();
  await extendDialog
    .getByRole("button", { name: "Confirm extension", exact: true })
    .click();
  await expect(extendDialog.getByRole("alert")).toContainText("overlaps");

  await request.post(`${fixture}/__test/control`, {
    data: { extendConflict: false },
  });
  await extendDialog
    .getByRole("button", { name: "Confirm extension", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText(/extended/i)).toBeVisible();

  // Record return -> maintenance condition (scheduled return is next month -> outside ±30 min)
  await page
    .getByRole("button", { name: "Record return", exact: true })
    .click();
  const returnDialog = page.getByRole("dialog", {
    name: "Record vehicle return",
  });
  await expect(
    returnDialog.getByText("Outside ±30 minute scheduled window"),
  ).toBeVisible();
  await returnDialog
    .getByLabel("Return odometer (km)", { exact: true })
    .fill("310");
  await returnDialog
    .getByLabel("Returned vehicle condition", { exact: true })
    .click();
  await page.getByRole("option", { name: "Maintenance", exact: true }).click();
  await returnDialog
    .getByLabel("Condition notes", { exact: true })
    .fill("Minor brake squeak, inspect before next hire");
  await returnDialog
    .getByLabel(
      "I confirm completing this return outside the ±30 minute scheduled window.",
      { exact: true },
    )
    .check();
  await returnDialog
    .getByRole("button", { name: "Confirm return", exact: true })
    .click();
  await expect(page.getByText(/returned\./i)).toBeVisible();
  await expect(page.getByText("310 km", { exact: true })).toBeVisible();
});

test("reservation cancellation works on uncontracted confirmed bookings and documents upload/download in Operations & Vehicle detail", async ({
  page,
}) => {
  await login(page, "admin");

  await page.goto("/companies/1/reservations/500?branch=all");
  await expect(
    page.getByRole("heading", { name: "Reservation #500", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Cancel reservation", exact: true })
    .click();
  await expect(page.getByText("Reservation #500 cancelled.")).toBeVisible();
  await expect(page.getByText("Cancelled", { exact: true })).toBeVisible();

  // Operations Dispatch Desk + Documents tab
  await page.goto("/companies/1/operations?branch=all");
  await expect(
    page.getByRole("heading", { name: "Operations", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Overdue", { exact: true })).toBeVisible();
  await expect(page.getByText("Rental #600", { exact: true })).toBeVisible();

  await page.getByRole("tab", { name: "Documents", exact: true }).click();
  await expect(page.getByText("insurance-policy.pdf")).toBeVisible();

  // Upload a real multipart PDF via the modal
  await page
    .getByRole("button", { name: "Upload document", exact: true })
    .click();
  const uploadDialog = page.getByRole("dialog", { name: "Upload document" });
  await uploadDialog
    .getByLabel("Document file (PDF, JPG, or PNG, max 10 MB)", { exact: true })
    .setInputFiles({
      name: "handover-checklist.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF"),
    });
  await uploadDialog
    .getByRole("button", { name: "Upload document", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByText("Uploaded handover-checklist.pdf."),
  ).toBeVisible();
  await expect(
    page.getByText("handover-checklist.pdf", { exact: true }),
  ).toBeVisible();

  // Streamed binary download via BFF proxy
  const downloadRes = await page.request.get("/api/backend/api/v1/documents/700");
  expect(downloadRes.status()).toBe(200);
  expect(downloadRes.headers()["content-type"]).toBe("application/pdf");
  expect(downloadRes.headers()["x-content-type-options"]).toBe("nosniff");
  expect(await downloadRes.text()).toContain("%PDF-1.4");

  // Embedded Documents panel on Vehicle #10 detail page
  await page.goto("/companies/1/vehicles/10?branch=all");
  await expect(
    page.getByRole("region", { name: "Linked documents" }),
  ).toContainText("insurance-policy.pdf");
});

test("assigned driver sees only their own rentals on Operations/Rentals, is blocked from unassigned contracts, and can complete return + upload photo", async ({
  page,
}) => {
  await login(page, "activedriver");
  await page
    .getByRole("link", { name: "Open workspace: Synthetic One", exact: true })
    .click();

  await page
    .getByRole("navigation", { name: "Main navigation", exact: true })
    .getByRole("link", { name: "Operations", exact: true })
    .click();
  await expect(page.getByText("Driver dispatch", { exact: true })).toBeVisible();
  await expect(page.getByText("Rental #600", { exact: true })).toBeVisible();
  await expect(page.getByText("Rental #601", { exact: true })).toHaveCount(0);

  // Direct URL to unassigned Rental #601 is denied
  await page.goto("/companies/1/rentals/601?branch=2");
  await expect(
    page.getByRole("heading", { name: "Rental unavailable", exact: true }),
  ).toBeVisible();

  // Assigned Rental #600 allows photo upload and return transition
  await page.goto("/companies/1/rentals/600?branch=2");
  await expect(
    page.getByRole("heading", { name: "Rental #600", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Extend rental", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Assign driver", exact: true }),
  ).toHaveCount(0);
  // Restricted driver role does not get broken links to Customers, Fleet, or Users
  await expect(page.locator('main a[href*="/customers/"]')).toHaveCount(0);
  await expect(page.locator('main a[href*="/vehicles/"]')).toHaveCount(0);
  await expect(page.locator('main a[href*="/users?"]')).toHaveCount(0);

  await page
    .getByRole("button", { name: "Upload document", exact: true })
    .click();
  const uploadDialog = page.getByRole("dialog", { name: "Upload document" });
  await uploadDialog
    .getByLabel("Document file (PDF, JPG, or PNG, max 10 MB)", { exact: true })
    .setInputFiles({
      name: "return-bumper.png",
      mimeType: "image/png",
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    });
  await uploadDialog
    .getByRole("button", { name: "Upload document", exact: true })
    .click();
  await expect(page.getByText("Uploaded return-bumper.png.")).toBeVisible();

  await page
    .getByRole("button", { name: "Record return", exact: true })
    .click();
  const returnDialog = page.getByRole("dialog", {
    name: "Record vehicle return",
  });
  await expect(
    returnDialog.getByText("Outside ±30 minute scheduled window"),
  ).toBeVisible();
  await returnDialog
    .getByLabel("Return odometer (km)", { exact: true })
    .fill("95");
  await returnDialog
    .getByLabel("Condition notes", { exact: true })
    .fill("Returned cleanly to branch");
  await returnDialog
    .getByLabel(
      "I confirm completing this return outside the ±30 minute scheduled window.",
      { exact: true },
    )
    .check();
  await returnDialog
    .getByRole("button", { name: "Confirm return", exact: true })
    .click();
  await expect(page.getByText("Rental #600 returned.")).toBeVisible();
  await expect(page.getByText("95 km", { exact: true })).toBeVisible();
});

test("inline new customer + immediate rental start, humanized 422 errors, and resolved vehicle/customer labels without backend summary fields", async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/control`, {
    data: { stripSummaryFields: true },
  });

  await login(page, "companyadmin");
  await page.goto("/companies/1/rentals?branch=all");

  // Even without backend summary fields, Reservations table resolves Customer full name + Vehicle reg/make/model
  const row500 = page.getByRole("row", { name: /#500/ });
  await expect(row500).toContainText("Synthetic customer");
  await expect(row500).toContainText("SYN-10");
  await expect(row500).toContainText("Synthetic Fixture");

  // Open Create reservation modal & add a new customer inline
  await page
    .getByRole("button", { name: "Create reservation", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Create reservation" });

  await dialog
    .getByRole("button", { name: "+ New customer", exact: true })
    .click();
  const longCustomerName =
    "Very Long Synthetic Corporate Customer Holdings Limited";
  await dialog.getByLabel("Full name", { exact: true }).fill(longCustomerName);
  await dialog.getByLabel("Customer type", { exact: true }).click();
  await page.getByRole("option", { name: "Corporate", exact: true }).click();
  await dialog
    .getByLabel("Email (optional)", { exact: true })
    .fill("corp@holdings.test");
  await dialog
    .getByRole("button", { name: "Save customer", exact: true })
    .click();

  await expect(
    dialog.getByText(`Customer "${longCustomerName}" added and selected.`),
  ).toBeVisible();

  // Select available vehicle SYN-10
  await dialog.getByLabel("Available vehicle", { exact: true }).click();
  await page
    .getByRole("option", { name: "SYN-10 · Synthetic Fixture", exact: true })
    .click();

  // Opt in to start rental contract immediately & create a new driver inline
  await dialog
    .getByLabel("Also start rental contract immediately", { exact: true })
    .check();
  await dialog
    .getByRole("button", { name: "+ New driver", exact: true })
    .click();
  await dialog
    .getByLabel("Driver full name", { exact: true })
    .fill("Inline Dispatch Driver");
  await dialog
    .getByLabel("Driver email", { exact: true })
    .fill("inline.driver@example.test");
  await dialog.getByRole("button", { name: "Generate", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Save driver", exact: true })
    .click();
  await expect(
    dialog.getByText('Driver "Inline Dispatch Driver" added and selected.'),
  ).toBeVisible();

  // Default window overlaps Reservation #500 -> triggers 422 with raw vehicle_id key & text; UI must humanize it
  await dialog
    .getByRole("button", {
      name: "Create reservation & start contract",
      exact: true,
    })
    .click();
  const alert = dialog.getByRole("alert");
  await expect(alert).toBeVisible();
  await expect(alert).toContainText(
    "Vehicle: Vehicle could not be booked for this period.",
  );
  await expect(alert).not.toContainText("vehicle_id");

  // Move departure & expected return to a non-overlapping window next month
  await dialog.getByLabel("Departure", { exact: true }).click();
  const depPicker = page.getByRole("dialog", {
    name: "Departure",
    exact: true,
  });
  await depPicker
    .getByRole("button", { name: "Next month", exact: true })
    .click();
  await depPicker.getByRole("button", { name: /10, \d{4}/ }).click();
  await depPicker
    .getByRole("button", { name: "Apply date & time", exact: true })
    .click();

  await dialog.getByLabel("Expected return", { exact: true }).click();
  const retPicker = page.getByRole("dialog", {
    name: "Expected return",
    exact: true,
  });
  await retPicker
    .getByRole("button", { name: "Next month", exact: true })
    .click();
  await retPicker.getByRole("button", { name: /12, \d{4}/ }).click();
  await retPicker
    .getByRole("button", { name: "Apply date & time", exact: true })
    .click();

  await dialog
    .getByRole("button", {
      name: "Create reservation & start contract",
      exact: true,
    })
    .click();

  // Lands directly on the newly created Rental detail page with resolved names, driver, & vehicle make/model/plate
  await expect(page).toHaveURL(/\/companies\/1\/rentals\/\d+/);
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: /Rental #\d+/ })).toBeVisible();
  await expect(
    main.getByRole("link", { name: longCustomerName, exact: true }).first(),
  ).toBeVisible();
  await expect(
    main.getByRole("link", { name: "SYN-10 Synthetic Fixture", exact: true }).first(),
  ).toBeVisible();
  await expect(
    main.getByRole("link", { name: "Inline Dispatch Driver", exact: true }),
  ).toBeVisible();

  // Early handover (departure is next month -> outside ±30 min) warns, requires checkbox, then succeeds
  await page
    .getByRole("button", { name: "Complete handover", exact: true })
    .click();
  const earlyHandoverDialog = page.getByRole("dialog", {
    name: "Complete handover",
  });
  await expect(
    earlyHandoverDialog.getByText("Outside ±30 minute scheduled window"),
  ).toBeVisible();
  await expect(earlyHandoverDialog).toContainText("more than 30 minutes early");
  await earlyHandoverDialog
    .getByLabel("Handover odometer (km)", { exact: true })
    .fill("25");
  await earlyHandoverDialog
    .getByLabel("Condition notes", { exact: true })
    .fill("Early pickup approved");
  await earlyHandoverDialog
    .getByLabel(
      "I confirm completing this handover outside the ±30 minute scheduled window.",
      { exact: true },
    )
    .check();
  await earlyHandoverDialog
    .getByRole("button", { name: "Confirm handover", exact: true })
    .click();
  await expect(page.getByText(/handed over/i)).toBeVisible();

  // Clicking Customer, Vehicle, and Driver navigates to their records
  const rentalUrl = page.url();
  await main
    .getByRole("link", { name: longCustomerName, exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/companies\/1\/customers\/\d+/);
  await expect(
    page.getByRole("heading", { name: longCustomerName, exact: true }),
  ).toBeVisible();

  await page.goto(rentalUrl);
  await main
    .getByRole("link", { name: "SYN-10 Synthetic Fixture", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/companies\/1\/vehicles\/10/);
  await expect(page.getByRole("heading", { name: /SYN-10/ })).toBeVisible();

  await page.goto(rentalUrl);
  await main
    .getByRole("link", { name: "Inline Dispatch Driver", exact: true })
    .click();
  await expect(page).toHaveURL(/\/companies\/1\/users\?.*role=driver/);
  await expect(page.getByText("Inline Dispatch Driver")).toBeVisible();

  // Operations Dispatch desk also renders clickable Customer, Vehicle, and Driver links
  await page.goto("/companies/1/operations?branch=all");
  await expect(
    page.getByRole("link", { name: longCustomerName, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Inline Dispatch Driver", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /SYN-10/ }).first()).toBeVisible();
});
