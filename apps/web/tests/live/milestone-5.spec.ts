import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

const fixture = "http://127.0.0.1:3201";

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

test("customers and fleet directories support server pagination beyond 25 rows, search, exact filters, chips, and out-of-range recovery", async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/control`, {
    data: { seedMany: "customers" },
  });
  await request.post(`${fixture}/__test/control`, {
    data: { seedMany: "vehicles" },
  });
  await login(page, "admin");

  await page.goto("/companies/1/customers?branch=all");
  await expect(page.getByText("29 records · Page 1 of 2")).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("29 records · Page 2 of 2")).toBeVisible();

  await page.getByRole("searchbox").fill("Needle Customer 27");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByText("1 record · Page 1 of 1")).toBeVisible();
  await expect(
    page.getByRole("table").getByText("Needle Customer 27", { exact: true }),
  ).toBeVisible();

  await page
    .getByRole("combobox", { name: "Filter by customer type", exact: true })
    .click();
  await page.getByRole("option", { name: "Individual", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "No matching customers", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Clear search and filters", exact: true })
    .click();
  await expect(page.getByText("29 records · Page 1 of 2")).toBeVisible();

  await page.goto("/companies/1/vehicles?branch=all&page=9");
  await expect(
    page.getByRole("heading", { name: "Page out of range", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back to page 1", exact: true }).click();
  await expect(page.getByText("29 records · Page 1 of 2")).toBeVisible();

  await page
    .getByRole("combobox", { name: "Filter by vehicle status", exact: true })
    .click();
  await page.getByRole("option", { name: "Maintenance", exact: true }).click();
  await expect(page.getByText("27 records · Page 1 of 2")).toBeVisible();
  await expect(
    page.getByRole("table").getByText("NED-001", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Status: Maintenance")).toBeVisible();
});

test("vehicle detail shows Not set for zero daily rate, validates decreasing odometer, and supports custom functions + suggestions", async ({
  page,
}) => {
  await login(page, "admin");
  await page.goto("/companies/1/vehicles/11?branch=all");
  await expect(page.getByText("Not set", { exact: true })).toBeVisible();
  await expect(page.getByText("50 km", { exact: true })).toBeVisible();

  await page.goto("/companies/1/vehicles/10/edit?branch=all");
  await page.getByLabel("Odometer (km)", { exact: true }).fill("5");
  await page.getByRole("button", { name: "Save vehicle", exact: true }).click();
  await expect(
    page.getByText("Odometer cannot decrease.", { exact: true }),
  ).toBeVisible();

  await page.getByLabel("Odometer (km)", { exact: true }).fill("150");
  await page
    .getByLabel("Daily rate (ZMW) (optional)", { exact: true })
    .fill("0");
  await page
    .getByRole("button", { name: "Remove GPS Tracker", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Remove Automatic", exact: true })
    .click();
  await page
    .getByLabel("Add custom vehicle function", { exact: true })
    .fill("Armored Glass");
  // Saving auto-commits pending draft text without needing to click Add first
  await page.getByRole("button", { name: "Save vehicle", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "SYN-10", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Not set", { exact: true })).toBeVisible();
  await expect(page.getByText("150 km", { exact: true })).toBeVisible();
  await expect(page.getByText("Armored Glass", { exact: true })).toBeVisible();

  // Visit fleet directory so cached vehicles surface "Armored Glass" as a suggestion on new vehicle form
  await page.goto("/companies/1/vehicles?branch=all");
  await expect(page.getByRole("table")).toContainText("Armored Glass");
  await page.getByRole("link", { name: "Create vehicle", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Armored Glass", exact: true }),
  ).toBeVisible();

  // Clear functions completely and confirm "None selected"
  await page.goto("/companies/1/vehicles/10/edit?branch=all");
  await page
    .getByRole("button", { name: "Remove Armored Glass", exact: true })
    .click();
  await page.getByRole("button", { name: "Save vehicle", exact: true }).click();
  await expect(page.getByText("None selected", { exact: true })).toBeVisible();
});

test("company admin manages users, creates a driver, views role permissions, and sees self/409 protections", async ({
  page,
}) => {
  await login(page, "companyadmin");
  await page
    .getByRole("link", { name: "Open workspace: Synthetic One", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Main navigation", exact: true })
    .getByRole("link", { name: "Administration", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Administration", exact: true }),
  ).toBeVisible();

  const table = page.getByRole("table");
  await expect(table).toContainText("Synthetic operator");
  await expect(table).toContainText("You");
  await expect(table).toContainText("Protected");
  await expect(table).toContainText("Fleet Driver");

  await page
    .getByRole("button", { name: "Role permissions", exact: true })
    .click();
  const rolesDialog = page.getByRole("dialog", { name: "Role permissions" });
  await expect(rolesDialog).toContainText("companies.view");
  await expect(rolesDialog).toContainText("Driver");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page
    .getByRole("button", { name: "Create user", exact: true })
    .click();
  const createDialog = page.getByRole("dialog", { name: "Create user" });
  await createDialog.getByLabel("Name", { exact: true }).fill("Kwame Mensah");
  await createDialog
    .getByLabel("Email", { exact: true })
    .fill("kwame@example.test");
  await createDialog.getByLabel("Role", { exact: true }).click();
  await page.getByRole("option", { name: "Driver", exact: true }).click();
  await createDialog.getByLabel("Password", { exact: true }).fill("short");
  await createDialog
    .getByLabel("Confirm password", { exact: true })
    .fill("short");
  await createDialog
    .getByRole("button", { name: "Create user", exact: true })
    .click();
  await expect(
    createDialog.getByText("Password must be at least 12 characters."),
  ).toBeVisible();

  await createDialog
    .getByLabel("Password", { exact: true })
    .fill("StrongPass1234");
  await createDialog
    .getByLabel("Confirm password", { exact: true })
    .fill("StrongPass1234");
  await createDialog
    .getByRole("button", { name: "Create user", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("User created: Kwame Mensah.")).toBeVisible();
  await expect(table).toContainText("Kwame Mensah");

  await page
    .getByRole("combobox", { name: "Filter by role", exact: true })
    .click();
  await page.getByRole("option", { name: "Driver", exact: true }).click();
  await expect(table).toContainText("Kwame Mensah");
  await expect(table).not.toContainText("Branch Viewer");
  await page.getByRole("button", { name: "Clear all", exact: true }).click();

  const driverRow = page.getByRole("row", { name: /Fleet Driver/ });
  await driverRow
    .getByRole("button", { name: "Edit access", exact: true })
    .click();
  const editDialog = page.getByRole("dialog");
  await editDialog.getByLabel("Account status", { exact: true }).click();
  await page
    .getByRole("option", { name: "Inactive (revokes tokens)", exact: true })
    .click();
  await expect(
    editDialog.getByText(/revokes active API tokens/i),
  ).toBeVisible();
  await editDialog
    .getByRole("button", { name: "Save access", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Updated access for Fleet Driver.")).toBeVisible();

  const sharedRow = page.getByRole("row", { name: /Shared Operator/ });
  await sharedRow
    .getByRole("button", { name: "Edit access", exact: true })
    .click();
  const conflictDialog = page.getByRole("dialog");
  await conflictDialog.getByLabel("Role", { exact: true }).click();
  await page.getByRole("option", { name: "Viewer", exact: true }).click();
  await conflictDialog
    .getByRole("button", { name: "Save access", exact: true })
    .click();
  await expect(conflictDialog.getByRole("alert")).toContainText(
    "multi-company user",
  );
  await page.keyboard.press("Escape");
});

test("branch-scoped admin is denied user administration and assigned driver opens dashboard cleanly", async ({
  page,
}) => {
  await login(page, "restrictedadmin");
  await page.goto("/companies/1/users?branch=2");
  await expect(
    page.getByRole("heading", { name: "Access denied", exact: true }),
  ).toBeVisible();

  await page.context().clearCookies();
  await login(page, "activedriver");
  await page
    .getByRole("link", { name: "Open workspace: Synthetic One", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
  const nav = page.getByRole("navigation", {
    name: "Main navigation",
    exact: true,
  });
  await expect(
    nav.locator('[aria-disabled="true"]').filter({ hasText: "Administration" }),
  ).toBeVisible();
  await expect(
    nav.locator('[aria-disabled="true"]').filter({ hasText: "Fleet" }),
  ).toBeVisible();
});
