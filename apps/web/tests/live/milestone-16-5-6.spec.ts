import { expect, test } from "@playwright/test";

const fixtureUrl = "http://127.0.0.1:4201";

async function login(
  page: import("@playwright/test").Page,
  email: string,
  dest = "/companies/1/dashboard?branch=all",
) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("demo123456");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/companies/);
  await page.goto(dest);
}

test.describe("Milestone 16.5.6 — Native WebRTC, User Deletion, Role Editor, Email SMTP, Finance Quotes & Hover Nav", () => {
  test.beforeEach(async ({ request }) => {
    await request.post(`${fixtureUrl}/__test/reset`);
    await request.post(`${fixtureUrl}/__test/seed-demo`);
  });

  test("supports 2-peer native DriveCore WebRTC room discovery across two browser contexts", async ({
    browser,
  }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    try {
      await login(pageA, "sysadmin@drivecore.demo");
      await login(pageB, "opsmanager@drivecore.demo");

      // Both join seeded live WebRTC meeting #850
      await pageA.getByRole("button", { name: /Messaging & Chat Center/i }).click();
      await pageA.getByRole("tab", { name: /Meetings/i }).click();
      await pageA
        .locator("article")
        .filter({ hasText: "Daily Accra Dispatch & Fleet Handover Standup" })
        .getByRole("button", { name: /^Join$/i })
        .click();
      await pageA.getByRole("button", { name: /Join DriveCore Room/i }).click();
      await expect(pageA.getByTestId("webrtc-local-tile")).toBeVisible();

      await pageB.getByRole("button", { name: /Messaging & Chat Center/i }).click();
      await pageB.getByRole("tab", { name: /Meetings/i }).click();
      await pageB
        .locator("article")
        .filter({ hasText: "Daily Accra Dispatch & Fleet Handover Standup" })
        .getByRole("button", { name: /^Join$/i })
        .click();
      await pageB.getByRole("button", { name: /Join DriveCore Room/i }).click();
      await expect(pageB.getByTestId("webrtc-local-tile")).toBeVisible();

      // Both peers discover each other through /api/v1/meetings/850/rtc/signals
      await expect(pageA.getByTestId("webrtc-remote-tile-3")).toBeVisible({
        timeout: 8000,
      });
      await expect(pageB.getByTestId("webrtc-remote-tile-1")).toBeVisible({
        timeout: 8000,
      });

      await pageA.getByRole("button", { name: /Leave call/i }).click();
      await pageB.getByRole("button", { name: /Leave call/i }).click();
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });

  test("deletes a user with email confirmation, edits/resets role permissions, and configures company SMTP with provider guide", async ({
    page,
  }) => {
    await login(page, "sysadmin@drivecore.demo", "/companies/1/users?branch=all");

    // 1. Delete Yaw Boateng via email-confirmed dialog
    const driverRow = page.locator("tr").filter({ hasText: "activedriver@drivecore.demo" });
    await expect(driverRow).toBeVisible();
    await driverRow.getByRole("button", { name: /^Delete$/i }).click();

    const confirmBtn = page
      .getByRole("dialog")
      .getByRole("button", { name: /^Delete user$/i });
    await expect(confirmBtn).toBeDisabled();
    await page
      .getByLabel(/Type activedriver@drivecore\.demo to confirm/i)
      .fill("activedriver@drivecore.demo");
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();

    await expect(
      page.getByText(/User removed from company and sessions revoked/i),
    ).toBeVisible();
    await expect(
      page.locator("tr").filter({ hasText: "activedriver@drivecore.demo" }),
    ).toHaveCount(0);

    // 2. Edit Role Permissions for Operations Manager & reset to defaults
    await page.getByRole("button", { name: /Role permissions/i }).click();
    const roleDialog = page.getByRole("dialog");
    await roleDialog.getByRole("button", { name: /Operations Manager/i }).click();
    const invoicesViewBox = roleDialog
      .locator("label")
      .filter({ hasText: /^invoices\.view$/ })
      .getByRole("checkbox");
    await invoicesViewBox.click();
    await roleDialog.getByRole("button", { name: /Save permissions/i }).click();
    await expect(
      roleDialog.getByText(/Saved \d+ permissions for Operations Manager/i),
    ).toBeVisible();

    await roleDialog.getByRole("button", { name: /Reset to defaults/i }).click();
    await expect(
      roleDialog.getByText(/Restored default SRS permissions for Operations Manager/i),
    ).toBeVisible();
    await page.keyboard.press("Escape");

    // 3. Configure Email / SMTP settings with provider setup guide & test email
    await page.goto("/companies/1/users?tab=settings&branch=all");
    await expect(
      page.getByRole("heading", { name: /Email & Invitations \(SMTP Setup\)/i }),
    ).toBeVisible();
    await expect(
      page.getByText(/How to set up Google Workspace \/ Gmail/i),
    ).toBeVisible();

    await page.getByRole("combobox", { name: /Email provider/i }).click();
    await page.getByRole("option", { name: /Resend/i }).click();
    await expect(page.getByText(/How to set up Resend/i)).toBeVisible();
    await expect(page.getByLabel("SMTP host")).toHaveValue("smtp.resend.com");

    await page.getByLabel(/Resend API Key/i).fill("re_live_demo_secret_123");
    await page
      .getByLabel("From email address")
      .fill("invites@drivecore-ghana.demo");
    await page.getByRole("button", { name: /Save email settings/i }).click();
    await expect(
      page.getByText(/Email & SMTP settings saved securely/i),
    ).toBeVisible();

    await page
      .getByLabel(/Verify delivery/i)
      .fill("qa-test@drivecore-ghana.demo");
    await page.getByRole("button", { name: /Send test email/i }).click();
    await expect(
      page.getByText(/Test invitation email queued to qa-test@drivecore-ghana\.demo/i),
    ).toBeVisible();
  });

  test("grants Finance Manager quotations.manage by default, shows hover dropdowns, and hides unauthorized tabs with zero Restricted badges", async ({
    page,
  }) => {
    // 1. Finance Manager has quotations.manage & hover dropdown works
    await login(page, "financemanager@drivecore.demo");
    const mainNav = page.getByRole("navigation", { name: "Main navigation" });
    await expect(mainNav.getByText("Restricted")).toHaveCount(0);
    // Finance Manager lacks Administration access -> completely hidden
    await expect(
      mainNav.getByRole("link", { name: /^Administration$/i }),
    ).toHaveCount(0);

    // Hovering Finance opens DriveCore dropdown menu
    await mainNav.getByRole("link", { name: /^Finance$/i }).hover();
    await expect(
      page.getByRole("menu", { name: /Finance quick links/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: /Credit Control/i }),
    ).toBeVisible();

    // Verify Finance Manager can access Quotations and see "Create quotation" (quotations.manage)
    await page.goto("/companies/1/quotations?branch=all");
    await expect(
      page.getByRole("button", { name: /Create quotation/i }),
    ).toBeVisible();
  });
});
