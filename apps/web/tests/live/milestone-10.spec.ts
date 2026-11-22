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

test("M10 live dashboard infographics, dispatch-driver messaging, notifications bell, scoped reports and admin-only audit trail", async ({
  page,
}) => {
  // 1. Company Admin sees live Dashboard KPIs + Infographics + Notifications bell + Audit Trail
  await login(page, "companyadmin");
  await page.goto("/companies/1/dashboard?branch=all");
  await expect(page.getByText("Fleet utilization")).toBeVisible();
  await expect(page.getByText("Asset Readiness Split")).toBeVisible();
  await expect(page.getByText("Revenue, VAT & Expenses")).toBeVisible();
  await expect(page.getByText("Quote to Cash")).toBeVisible();

  // Custom calendar date-range picker on Dashboard
  await page.getByRole("button", { name: "Select date range", exact: true }).click();
  const dashCalendar = page.getByRole("dialog", { name: "Filter Date Range" });
  await expect(dashCalendar).toBeVisible();
  await dashCalendar.getByRole("button", { name: "Last 90 days", exact: true }).click();
  await dashCalendar.getByRole("button", { name: "Apply range", exact: true }).click();
  await expect(dashCalendar).toBeHidden();

  // Notifications bell shows 1 unread alert -> Mark all read clears badge
  await page.getByRole("button", { name: /Notifications \(1 unread\)/ }).click();
  await expect(page.getByText(/Rental #600 active handover logged/i)).toBeVisible();
  await page.getByRole("button", { name: "Mark all read", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Mark all read", exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: /Notifications \(0 unread\)/ }),
  ).toBeVisible();

  // Reports -> Financial, Fleet, Custom Calendar Filter, and Audit Trail
  await page.goto("/companies/1/reports?branch=all");
  await expect(page.getByRole("tab", { name: "Financial report" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Fleet & maintenance" })).toBeVisible();
  await page.getByRole("button", { name: "Select date range", exact: true }).click();
  const reportCalendar = page.getByRole("dialog", { name: "Filter Date Range" });
  await expect(reportCalendar).toBeVisible();
  await reportCalendar.getByRole("button", { name: "Last 7 days", exact: true }).click();
  await reportCalendar.getByRole("button", { name: "Apply range", exact: true }).click();
  await expect(reportCalendar).toBeHidden();
  await expect(page).toHaveURL(/from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}/);
  await page.getByRole("tab", { name: "Audit trail", exact: true }).click();
  await expect(page.getByText("rental.handed_over")).toBeVisible();

  // 2. Operations sends a message on Drivers channel -> sees Fleet report but NOT Financial or Audit
  await login(page, "operations");
  await page.goto("/companies/1/dashboard?branch=all");
  await expect(page.getByText("Asset Readiness Split")).toBeVisible();
  await expect(page.getByText("Revenue, VAT & Expenses")).toHaveCount(0);

  await page.getByRole("button", { name: /Messaging & Chat Center/ }).click();
  await page.getByLabel("Message channel", { exact: true }).click();
  await page.getByRole("option", { name: "Drivers", exact: true }).click();
  await page
    .getByLabel("Message text", { exact: true })
    .fill("SYN-10 keys ready at Bay 2");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByText("SYN-10 keys ready at Bay 2")).toBeVisible();
  await page.keyboard.press("Escape");

  await page.goto("/companies/1/reports?branch=all");
  await expect(page.getByRole("tab", { name: "Financial report" })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Audit trail" })).toHaveCount(0);
  const auditDenied = await page.request.get(
    "/api/backend/api/v1/audit-events?company_id=1",
  );
  expect(auditDenied.status()).toBe(403);

  // 3. Active driver sees 1 unread message on Chat Center, reads it, and is blocked from Customers channel
  await login(page, "activedriver");
  await page.goto("/companies/1/dashboard?branch=2");
  await expect(
    page.getByRole("button", { name: /Messaging & Chat Center \(1 unread\)/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /Messaging & Chat Center \(1 unread\)/ })
    .click();
  await expect(page.getByText("SYN-10 keys ready at Bay 2")).toBeVisible();
  await page.getByRole("button", { name: "Mark read", exact: true }).click();
  const forbiddenChan = await page.request.get(
    "/api/backend/api/v1/messages?company_id=1&channel=customers",
  );
  expect(forbiddenChan.status()).toBe(403);
});
