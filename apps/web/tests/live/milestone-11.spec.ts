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

test("M11 Customer 360, Detailed Stats (Customers/Vehicles/Branches), multi-facet filters, saved views, and operations monetary 403 isolation", async ({
  page,
}) => {
  // 1. Company Admin inspects Customer 360 summary on Customer #10
  await login(page, "companyadmin");
  await page.goto("/companies/1/customers/10?branch=all");
  await expect(
    page.getByRole("heading", { name: "Customer 360 summary" }),
  ).toBeVisible();
  await expect(page.getByText("Total spent (net)")).toBeVisible();
  await expect(page.getByText("Open AR (live)")).toBeVisible();

  // 2. Company Admin opens Reports -> Detailed stats -> Customer stats, sorts by Top spenders, saves a shared monetary view
  await page.goto("/companies/1/reports?branch=all&tab=stats");
  await expect(
    page.getByRole("tab", { name: "Customer stats" }),
  ).toBeVisible();
  await expect(page.getByText("Total spent (period net)")).toBeVisible();

  await page.getByRole("button", { name: "Top spenders", exact: true }).click();
  await expect(page).toHaveURL(/sort=total_spent_minor&dir=desc/);

  await page.getByRole("button", { name: /Saved views/ }).click();
  const svDialog = page.getByRole("dialog", { name: "Saved filter views" });
  await expect(svDialog).toBeVisible();
  await svDialog
    .getByLabel("Save current filters as", { exact: true })
    .fill("VIP Spenders Shared");
  await svDialog
    .getByLabel(/Share with company/i)
    .check();
  await svDialog.getByRole("button", { name: "Save view", exact: true }).click();
  await expect(svDialog.getByText("VIP Spenders Shared")).toBeVisible();
  await page.keyboard.press("Escape");

  // 3. Switch to Vehicle stats & Branch comparison
  await page.getByRole("tab", { name: "Vehicle stats", exact: true }).click();
  await expect(page.getByText("Avg utilization")).toBeVisible();
  await page.getByRole("button", { name: "Idle > 14d", exact: true }).click();
  await expect(page).toHaveURL(/idle_days_min=14/);

  await page.getByRole("tab", { name: "Branch comparison", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "Synthetic branch" }),
  ).toBeVisible();

  // 4. Operations (no invoices.view) sees operational stats only, zero monetary shared views, and gets 403 on monetary filter/sort queries
  await login(page, "operations");
  await page.goto("/companies/1/reports?branch=all&tab=stats");
  await expect(page.getByRole("tab", { name: "Customer stats" })).toBeVisible();
  await expect(page.getByText("Total spent (period net)")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Top spenders", exact: true }),
  ).toHaveCount(0);

  // Monetary shared filter "VIP Spenders Shared" is hidden from operations
  await page.getByRole("button", { name: /Saved views/ }).click();
  const opsSvDialog = page.getByRole("dialog", { name: "Saved filter views" });
  await expect(opsSvDialog).toBeVisible();
  await expect(opsSvDialog.getByText("VIP Spenders Shared")).toHaveCount(0);
  await page.keyboard.press("Escape");

  // Direct monetary filter/sort API calls return 403 for operations
  const spendBlocked = await page.request.get(
    "/api/backend/api/v1/stats/customers?company_id=1&min_spend_minor=100",
  );
  expect(spendBlocked.status()).toBe(403);
  const sortBlocked = await page.request.get(
    "/api/backend/api/v1/stats/customers?company_id=1&sort=total_spent_minor&dir=desc",
  );
  expect(sortBlocked.status()).toBe(403);

  // Operations also sees Customer 360 operational rentals WITHOUT monetary cards
  await page.goto("/companies/1/customers/10?branch=all");
  await expect(
    page.getByRole("heading", { name: "Customer 360 summary" }),
  ).toBeVisible();
  await expect(page.getByText("Total spent (net)")).toHaveCount(0);
});
