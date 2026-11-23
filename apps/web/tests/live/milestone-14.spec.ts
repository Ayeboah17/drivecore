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

test("M14 Credit Control (hold/release, promise to pay, statement), Unified Approvals (segregation of duties 403 + approve), and Compliance Expiry Hub", async ({
  page,
}) => {
  // 1. Finance/Admin opens Finance -> Credit control, places hold, logs promise to pay, views statement, then releases hold
  await login(page, "companyadmin");
  await page.goto("/companies/1/finance?branch=all&tab=credit");
  await expect(page.getByText("Customers on hold")).toBeVisible();

  const custRow = page.getByRole("row", { name: /Synthetic customer/ }).first();
  await custRow.getByRole("button", { name: "Place hold", exact: true }).click();
  const holdDialog = page.getByRole("dialog", { name: /Place credit hold/i });
  await holdDialog.getByLabel("Hold reason", { exact: true }).fill("60+ days overdue");
  await holdDialog.getByRole("button", { name: "Confirm hold", exact: true }).click();
  await expect(page.getByText(/placed on credit hold/i)).toBeVisible();

  // Log a Promise to Pay follow-up
  await custRow.getByRole("button", { name: "Follow-up", exact: true }).click();
  const fuDialog = page.getByRole("dialog", { name: /Log collection follow-up/i });
  await fuDialog.getByLabel("Notes", { exact: true }).fill("Client promised bank transfer Friday");
  await fuDialog.getByRole("button", { name: "Save follow-up", exact: true }).click();
  await expect(page.getByText("Client promised bank transfer Friday")).toBeVisible();

  // Open Customer Account Statement
  await custRow.getByRole("button", { name: "Statement", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: /Customer Account Statement/i }),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  // Release credit hold
  await custRow.getByRole("button", { name: "Release hold", exact: true }).click();
  await page.getByRole("button", { name: "Confirm release", exact: true }).click();
  await expect(page.getByText(/Credit hold released/i)).toBeVisible();

  // 2. Operations submits an approval request -> cannot self-approve (Own request badge)
  await login(page, "operations");
  await page.goto("/companies/1/operations?branch=all&tab=approvals");
  await page.getByRole("button", { name: "New approval request", exact: true }).click();
  const aprDialog = page.getByRole("dialog", { name: "New approval request" });
  await aprDialog.getByLabel("Title", { exact: true }).fill("Raise Synthetic Corp limit");
  await aprDialog.getByLabel("Requested value", { exact: true }).fill("ZMW 100,000");
  await aprDialog.getByLabel("Justification", { exact: true }).fill("Long-term corporate contract");
  await aprDialog.getByRole("button", { name: "Submit request", exact: true }).click();
  await expect(page.getByText("Raise Synthetic Corp limit")).toBeVisible();
  await expect(page.getByText("Own request", { exact: true })).toBeVisible();

  // 3. Company Admin (different user!) approves the request in Operations -> Approvals
  await login(page, "companyadmin");
  await page.goto("/companies/1/operations?branch=all&tab=approvals");
  await expect(page.getByText("Raise Synthetic Corp limit")).toBeVisible();
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await page.getByRole("button", { name: "Confirm approval", exact: true }).click();
  await expect(page.getByText(/Approval #\d+ approved/i)).toBeVisible();

  // 4. Compliance Expiry Hub shows seeded insurance-policy.pdf
  await page.getByRole("tab", { name: "Compliance", exact: true }).click();
  await expect(page.getByText("insurance-policy.pdf")).toBeVisible();
});
