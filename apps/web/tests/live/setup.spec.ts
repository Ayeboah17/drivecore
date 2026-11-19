import { signOut } from "./helpers";
import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
const fixture = "http://127.0.0.1:3201";
async function login(page: Page, role: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(`${role}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill(randomUUID());
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your workspace" }),
  ).toBeVisible();
}
test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});
test("empty platform admin creates company, branch and customer with refreshed context", async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/control`, {
    data: { emptyDirectory: true },
  });
  await login(page, "admin");
  await expect(
    page.getByRole("heading", { name: "No companies registered" }),
  ).toBeVisible();
  const companyForm = page.getByRole("region", {
    name: "Create company",
    exact: true,
  });
  await page
    .getByRole("button", { name: "Create company", exact: true })
    .click();
  await companyForm
    .getByRole("textbox", { name: "Company name" })
    .fill("Synthetic Startup");
  const currency = companyForm.getByRole("combobox", {
    name: "Currency",
    exact: true,
  });
  await expect(currency).toHaveText(/^GHC/);
  await currency.click();
  await expect(page.getByRole("option")).toHaveText([
    "USD",
    "EUR",
    "GHC",
    "ZMW",
  ]);
  await page.getByRole("option", { name: "ZMW", exact: true }).click();
  await expect(currency).toHaveText(/^ZMW/);
  await request.post(`${fixture}/__test/control`, {
    data: { setupValidation: true },
  });
  await companyForm
    .getByRole("button", { name: "Create company", exact: true })
    .click();
  await expect(companyForm.getByRole("alert")).toContainText(
    "Synthetic company rejection.",
  );
  await request.post(`${fixture}/__test/control`, {
    data: { setupValidation: false },
  });
  await companyForm
    .getByRole("button", { name: "Create company", exact: true })
    .dblclick();
  await expect(
    page.getByRole("heading", { name: "Set up branches", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Company", exact: true }),
  ).toContainText("Synthetic Startup");
  await expect(
    page.getByRole("heading", { name: "No branches yet" }),
  ).toBeVisible();
  const branchForm = page.getByRole("region", {
    name: "Create branch",
    exact: true,
  });
  await branchForm
    .getByRole("textbox", { name: "Branch name", exact: true })
    .fill("Synthetic Main");
  await page.screenshot({ path: "test-results/setup-branch-light.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/setup-branch-dark-mobile.png" });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.evaluate(() => document.documentElement.classList.remove("dark"));
  await branchForm
    .getByRole("button", { name: "Create branch", exact: true })
    .dblclick();
  await expect(branchForm.getByRole("status")).toContainText(
    "Branch created: Synthetic Main",
  );
  expect(
    (await (await request.get(`${fixture}/__test/stats`)).json())
      .completedWrites,
  ).toBe(2);
  await branchForm
    .getByRole("link", { name: "Create customer", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("First synthetic customer");
  await page
    .getByRole("button", { name: "Create customer", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "First synthetic customer" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "First synthetic customer" }),
  ).toBeVisible();
});
test("company admin can create branch but not company; restricted member cannot set up branches", async ({
  page,
  request,
}) => {
  await login(page, "companyadmin");
  await expect(
    page.getByRole("region", { name: "Create company" }),
  ).toHaveCount(0);
  await page
    .getByRole("link", {
      name: "Set up branches for Synthetic One",
      exact: true,
    })
    .click();
  const form = page.getByRole("region", { name: "Create branch", exact: true });
  await form
    .getByRole("textbox", { name: "Branch name" })
    .fill("Synthetic branch");
  await form
    .getByRole("button", { name: "Create branch", exact: true })
    .click();
  await expect(form.getByRole("alert")).toContainText(
    "The name has already been taken.",
  );
  await form
    .getByRole("textbox", { name: "Branch name" })
    .fill("New synthetic branch");
  await form
    .getByRole("button", { name: "Create branch", exact: true })
    .click();
  await expect(form.getByRole("status")).toContainText("Branch created");
  await signOut(page);
  await login(page, "restrictedadmin");
  await expect(
    page.getByRole("link", { name: "Set up branches for Synthetic One" }),
  ).toHaveCount(0);
  await page.goto("/companies/1/setup?branch=all");
  await expect(
    page.getByRole("heading", { name: "Branch setup unavailable" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create branch", exact: true }),
  ).toHaveCount(0);
  expect(
    (await (await request.get(`${fixture}/__test/stats`)).json())
      .completedWrites,
  ).toBe(1);
});
test("empty non-admin sees membership guidance and no company creation", async ({
  page,
}) => {
  await login(page, "driver");
  await expect(
    page.getByText(/Your account has no company memberships/),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Create company" }),
  ).toHaveCount(0);
});

test("successful creation followed by a directory outage cannot be resubmitted", async ({
  page,
  request,
}) => {
  await login(page, "admin");
  await page
    .getByRole("button", { name: "Create company", exact: true })
    .click();
  const form = page.getByRole("region", {
    name: "Create company",
    exact: true,
  });
  await form
    .getByRole("textbox", { name: "Company name" })
    .fill("Saved synthetic company");
  await expect(
    form.getByRole("combobox", { name: "Currency", exact: true }),
  ).toHaveText(/^GHC/);
  await request.post(`${fixture}/__test/control`, {
    data: { directoryFailure: true },
  });
  await form
    .getByRole("button", { name: "Create company", exact: true })
    .click();
  await expect(form.getByRole("status")).toContainText(
    "Company created: Saved synthetic company",
  );
  await expect(form.getByRole("alert")).toContainText(
    "Created successfully, but the directory could not be refreshed",
  );
  await expect(
    form.getByRole("button", { name: "Create company", exact: true }),
  ).toHaveCount(0);
  expect(
    (await (await request.get(`${fixture}/__test/stats`)).json())
      .completedWrites,
  ).toBe(1);
  await request.post(`${fixture}/__test/control`, {
    data: { directoryFailure: false },
  });
  await form
    .getByRole("button", { name: "Refresh directory", exact: true })
    .click();
  await expect(page.getByTestId("workspace-card-20")).toBeVisible();
  await form
    .getByRole("link", { name: "Set up branches", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Set up branches", exact: true }),
  ).toBeVisible();
});

test("branchless live company stays in setup across refresh and direct dashboard URLs", async ({
  page,
}) => {
  await login(page, "admin");
  await page
    .getByRole("button", { name: "Create company", exact: true })
    .click();
  await page
    .getByLabel("Company name", { exact: true })
    .fill("Branchless Synthetic");
  await page
    .getByRole("region", { name: "Create company", exact: true })
    .getByRole("button", { name: "Create company", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Set up branches", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({
    path: "../../documentation/screenshots/workflow-dashboard/after-live-setup-1440-light.png",
    fullPage: true,
  });
  const id = new URL(page.url()).pathname.split("/")[2];
  await page.goto(`/companies/${id}/dashboard?branch=all`);
  await expect(
    page.getByRole("heading", { name: "Set up branches", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Company setup" }),
  ).toContainText("Branchless Synthetic");
  const form = page.getByRole("region", { name: "Create branch", exact: true });
  await form
    .getByLabel("Branch name", { exact: true })
    .fill("First Synthetic Branch");
  await form
    .getByRole("button", { name: "Create branch", exact: true })
    .click();
  await expect(form.getByRole("status")).toContainText("Branch created");
  await form
    .getByRole("button", { name: "Create another branch", exact: true })
    .click();
  await form
    .getByLabel("Branch name", { exact: true })
    .fill("Second Synthetic Branch");
  await form
    .getByRole("button", { name: "Create branch", exact: true })
    .click();
  await expect(form.getByRole("status")).toContainText(
    "Second Synthetic Branch",
  );
  await page.screenshot({
    path: "../../documentation/screenshots/workflow-dashboard/after-live-setup-ready.png",
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "Continue to dashboard", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create company", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Set up branches", exact: true }),
  ).toBeVisible();
});
