import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

const fixture = "http://127.0.0.1:4201";

async function login(page: Page, role = "companyadmin") {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(`${role}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill(randomUUID());
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

test("M12 Admin email invitations (send, resend token rotation, revoke, accept auto-login), must_change_password gate, profile update, and forgot/reset password", async ({
  page,
  request,
}) => {
  // 1. Company Admin invites a teammate, resends (invalidating old token), then new user accepts & auto-signs in
  await login(page, "companyadmin");
  await expect(
    page.getByRole("heading", { name: "Your workspace", exact: true }),
  ).toBeVisible();

  await page.goto("/companies/1/users?branch=all");
  await page.getByRole("button", { name: "Invite user", exact: true }).click();
  const invDialog = page.getByRole("dialog", { name: "Invite user by email" });
  await expect(invDialog).toBeVisible();
  await invDialog
    .getByLabel("Email address", { exact: true })
    .fill("new.hire@example.test");
  await invDialog
    .getByRole("button", { name: "Send invitation", exact: true })
    .click();
  await expect(invDialog).toBeHidden();

  const firstToken = (
    await (await request.get(`${fixture}/__test/last-invite-token`)).json()
  ).token as string;
  expect(firstToken.length).toBeGreaterThan(16);

  await page
    .getByRole("tab", { name: "Pending invitations", exact: true })
    .click();
  await expect(
    page.getByRole("cell", { name: "new.hire@example.test" }),
  ).toBeVisible();

  // Resend rotates token & invalidates the older link
  await page.getByRole("button", { name: "Resend", exact: true }).click();
  await expect(page.getByText(/Invitation resent to new\.hire@example\.test/i)).toBeVisible();
  const secondToken = (
    await (await request.get(`${fixture}/__test/last-invite-token`)).json()
  ).token as string;
  expect(secondToken).not.toBe(firstToken);

  // Invite a second user & revoke
  await page.getByRole("button", { name: "Invite user", exact: true }).click();
  const invDialog2 = page.getByRole("dialog", { name: "Invite user by email" });
  await invDialog2
    .getByLabel("Email address", { exact: true })
    .fill("revoked.user@example.test");
  await invDialog2
    .getByRole("button", { name: "Send invitation", exact: true })
    .click();
  await expect(
    page.getByRole("cell", { name: "revoked.user@example.test" }),
  ).toBeVisible();
  const revokedToken = (
    await (await request.get(`${fixture}/__test/last-invite-token`)).json()
  ).token as string;
  await page
    .getByRole("row", { name: /revoked\.user@example\.test/ })
    .getByRole("button", { name: "Revoke", exact: true })
    .click();
  await expect(page.getByText(/revoked\.user@example\.test revoked/i)).toBeVisible();

  // Anonymous user checks revoked token -> 410 recovery guidance
  await page.context().clearCookies();
  await page.goto(`/accept-invite?token=${revokedToken}`);
  await expect(
    page.getByRole("heading", { name: "Invitation expired or invalid" }),
  ).toBeVisible();

  // Anonymous user accepts valid secondToken -> auto-signed in to dashboard
  await page.goto(`/accept-invite?token=${secondToken}`);
  await expect(
    page.getByRole("heading", { name: /Accept invitation to Synthetic One/i }),
  ).toBeVisible();
  await page.getByLabel("Full name", { exact: true }).fill("New Fleet Hire");
  await page.getByLabel("Password", { exact: true }).fill("DriveCore2026");
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("DriveCore2026");
  await page
    .getByRole("button", { name: "Create account & sign in", exact: true })
    .click();
  await expect(page).toHaveURL(/\/companies\/1\/dashboard/);

  // 2. Authenticated user updates Display name on /account
  await page.goto("/account");
  await expect(
    page.getByRole("heading", { name: "Account & security" }),
  ).toBeVisible();
  await page.getByLabel("Display name", { exact: true }).fill("Updated Hire Name");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByText("Profile updated.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Account menu" }),
  ).toContainText("Updated Hire Name");

  // 3. Direct-created account with must_change_password=true is locked to /account until rotated
  await login(page, "mustrotate");
  await expect(page).toHaveURL(/\/account\?force_password_change=1/);
  await expect(page.getByText("Password change required")).toBeVisible();

  // Direct API request is blocked with 403 while must_change_password=true
  const blockedApi = await page.request.get(
    "/api/backend/api/v1/customers?company_id=1",
  );
  expect(blockedApi.status()).toBe(403);

  // Attempting to visit /companies/1/dashboard redirects right back to /account
  await page.goto("/companies/1/dashboard?branch=all");
  await expect(page).toHaveURL(/\/account\?force_password_change=1/);

  // Rotate password -> unlocks workspaces
  await page
    .getByLabel("Current password", { exact: true })
    .fill("TempPass1234");
  await page
    .getByLabel("New password", { exact: true })
    .fill("RotatedPass2026");
  await page
    .getByLabel("Confirm new password", { exact: true })
    .fill("RotatedPass2026");
  await page
    .getByRole("button", { name: "Update password", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your workspace", exact: true }),
  ).toBeVisible();

  // 4. Forgot password & Reset password flow
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByRole("link", { name: "Forgot password?", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Reset your password" }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Email", exact: true })
    .fill("companyadmin@example.test");
  await page
    .getByRole("button", { name: "Send reset link", exact: true })
    .click();
  await expect(
    page.getByText(/If an account matches that email, a reset link has been sent/i),
  ).toBeVisible();

  const resetToken = (
    await (await request.get(`${fixture}/__test/last-reset-token`)).json()
  ).token as string;
  await page.goto(
    `/reset-password?token=${resetToken}&email=companyadmin@example.test`,
  );
  await page.getByLabel("New password", { exact: true }).fill("BrandNew2026");
  await page
    .getByLabel("Confirm new password", { exact: true })
    .fill("BrandNew2026");
  await page
    .getByRole("button", { name: "Reset password", exact: true })
    .click();
  await expect(page).toHaveURL(/\/login\?reset=1/);
  await expect(
    page.getByText(/Your password has been reset\. Sign in with your new password\./i),
  ).toBeVisible();
});
