import { expect, test, type Page } from "@playwright/test";

const fixture = "http://127.0.0.1:4201";

async function login(page: Page, email: string, password = "secret") {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

test("M16 Exact SRS §3 roles, Mechanic isolation, CRM Lead-to-Quote pipeline, and Privileged TOTP 2FA lifecycle", async ({
  page,
}) => {
  // 1. System Admin / Company Admin sees all 10 exact SRS §3 roles + Driver in Administration -> Users
  await login(page, "companyadmin@example.test");
  await expect(
    page.getByRole("heading", { name: "Your workspace", exact: true }),
  ).toBeVisible();
  await page.goto("/companies/1/users?branch=all");
  await page.getByRole("button", { name: "Invite user", exact: true }).click();
  await page.getByRole("combobox", { name: "Invited user role" }).click();
  await expect(page.getByRole("option", { name: "CEO", exact: true })).toBeVisible();
  await expect(
    page.getByRole("option", { name: "General Manager", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("option", { name: "Business Accounts Manager", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("option", { name: "Mechanic / Technician", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("option", { name: "System Administrator", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("option", { name: "Business Accounts Manager", exact: true })
    .click();
  await page.getByLabel("Email address", { exact: true }).fill("bam@example.test");
  await page.getByRole("button", { name: "Send invitation", exact: true }).click();
  await expect(page.getByText(/Invitation sent to bam@example.test/i)).toBeVisible();

  // 2. Mechanic / Technician role isolation: accesses Maintenance, blocked from Finance
  await login(page, "mechanic@example.test");
  await expect(
    page.getByRole("heading", { name: "Your workspace", exact: true }),
  ).toBeVisible();
  await page.goto("/companies/1/maintenance?branch=all");
  await expect(page.getByRole("heading", { name: "Maintenance" })).toBeVisible();
  await page.goto("/companies/1/finance?branch=all");
  await expect(page.getByRole("heading", { name: "Access denied" })).toBeVisible();

  // 3. Business Accounts Manager runs Lead-to-Quote CRM pipeline in Rentals -> Leads
  await login(page, "businessaccounts@example.test");
  await expect(
    page.getByRole("heading", { name: "Your workspace", exact: true }),
  ).toBeVisible();
  await page.goto("/companies/1/rentals?tab=leads&branch=all");
  await page.getByRole("button", { name: "New lead", exact: true }).click();
  const leadDialog = page.getByRole("dialog", { name: "New CRM lead" });
  await leadDialog.getByLabel("Contact name", { exact: true }).fill("Kwame Boateng");
  await leadDialog
    .getByLabel("Company name (optional)", { exact: true })
    .fill("GoldCoast Mining Ltd");
  await leadDialog.getByLabel("Email", { exact: true }).fill("kwame@goldcoast.test");
  await leadDialog
    .getByLabel("Fleet requirements", { exact: true })
    .fill("3x 4x4 pickups for 30 days");
  await leadDialog.getByLabel(/Est\. value/).fill("45000.00");
  await leadDialog.getByRole("button", { name: "Save lead", exact: true }).click();
  await expect(
    page.getByText("GoldCoast Mining Ltd", { exact: true }),
  ).toBeVisible();

  // Advance stage New -> Contacted -> Convert to quotation (opens pre-filled CreateQuotationDialog)
  await page.getByRole("button", { name: "Contacted", exact: true }).click();
  await expect(page.getByText(/moved to Contacted/)).toBeVisible();
  await page.getByRole("button", { name: "Convert to quotation", exact: true }).click();
  await expect(page.getByRole("dialog", { name: /quotation/i })).toBeVisible();
  await page.keyboard.press("Escape");

  // 4. Privileged TOTP 2FA: Finance Manager enrolls on /account -> 2-step login challenge works
  await login(page, "finance@example.test");
  await expect(
    page.getByRole("heading", { name: "Your workspace", exact: true }),
  ).toBeVisible();
  await page.goto("/account");
  await page
    .getByRole("button", { name: "Set up two-factor authentication", exact: true })
    .click();
  await expect(page.getByRole("img", { name: "Authenticator setup QR matrix" })).toBeVisible();
  await expect(page.getByText("JBSWY3DPEHPK3PXP")).toBeVisible();
  await page
    .getByLabel("Enter 6-digit verification code", { exact: true })
    .fill("123456");
  await page.getByRole("button", { name: "Verify & enable 2FA", exact: true }).click();
  await expect(page.getByText(/Two-factor authentication enabled/i)).toBeVisible();
  await expect(page.getByText("DC1000-990A")).toBeVisible();

  // Sign in again -> triggers 2-step TOTP verification challenge
  await login(page, "finance@example.test");
  await expect(
    page.getByRole("heading", { name: "Two-factor verification" }),
  ).toBeVisible();
  await page.getByLabel("Verification code", { exact: true }).fill("123456");
  await page.getByRole("button", { name: "Verify & sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your workspace", exact: true }),
  ).toBeVisible();

  // 5. Company Admin enables "Require TOTP 2FA for privileged roles" -> unenrolled CEO redirected to /account
  await login(page, "companyadmin@example.test");
  await expect(
    page.getByRole("heading", { name: "Your workspace", exact: true }),
  ).toBeVisible();
  await page.goto("/companies/1/users?tab=settings&branch=all");
  await page.getByRole("checkbox", { name: /Require TOTP 2FA for privileged roles/i }).check();
  await page.getByRole("button", { name: "Save settings", exact: true }).click();
  await expect(page.getByText(/Financial settings updated/i)).toBeVisible();

  await login(page, "ceo@example.test");
  await expect(page).toHaveURL(/\/account\?setup_2fa=1/);
  await expect(
    page.getByText("Two-factor authentication required", { exact: true }),
  ).toBeVisible();
});
