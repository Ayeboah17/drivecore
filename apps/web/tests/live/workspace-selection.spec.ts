import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
const fixture = "http://127.0.0.1:3201";
const screenshots = resolve(
  process.cwd(),
  "../../documentation/screenshots/workspace-selection",
);
async function capture(page: Page, name: string) {
  await mkdir(screenshots, { recursive: true });
  await page.screenshot({
    animations: "disabled",
    path: resolve(screenshots, `after-${name}.png`),
    fullPage: (await page.getByRole("dialog").count()) === 0,
  });
}
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
test("workspace cards and create dialog support keyboard focus and escape", async ({
  page,
}) => {
  await login(page);
  const cards = page
    .getByRole("list", { name: "Company workspaces" })
    .getByRole("article");
  await expect(cards).toHaveCount(2);
  await expect(cards.first()).toContainText("Company ID: 1");
  await expect(cards.first()).toContainText("ZMW");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const trigger = page.getByRole("button", {
    name: "Create company",
    exact: true,
  });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", {
    name: "Create company",
    exact: true,
  });
  await expect(
    dialog.getByRole("textbox", { name: "Company name", exact: true }),
  ).toBeFocused();
  await expect(
    dialog.getByRole("combobox", { name: "Currency", exact: true }),
  ).toHaveText(/^GHC/);
  for (let index = 0; index < 6; index++) {
    await page.keyboard.press("Tab");
    await expect
      .poll(() =>
        dialog.evaluate((element) => element.contains(document.activeElement)),
      )
      .toBe(true);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await capture(page, "create-dialog-1440-light");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await capture(page, "create-dialog-390-dark");
  await dialog
    .getByRole("button", { name: "Create company", exact: true })
    .click();
  await expect(
    dialog.getByText("Enter a name.", { exact: true }),
  ).toBeVisible();
  await capture(page, "create-validation-390-dark");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await page.getByRole("button", { name: "Account menu", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("menuitem", { name: "Sign out", exact: true }),
  ).toBeVisible();
  await capture(page, "account-menu-390-dark");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Account menu", exact: true }),
  ).toBeFocused();
});
test("pending company creation cannot be dismissed or submitted twice", async ({
  page,
}) => {
  await login(page);
  await page
    .getByRole("button", { name: "Create company", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Create company",
    exact: true,
  });
  await dialog
    .getByRole("textbox", { name: "Company name", exact: true })
    .fill("Pending synthetic company");
  let release = () => {};
  const gate = new Promise<void>((resolveGate) => {
    release = resolveGate;
  });
  await page.route("**/api/backend/api/v1/companies", async (route) => {
    if (route.request().method() === "POST") await gate;
    await route.continue();
  });
  try {
    await dialog
      .getByRole("button", { name: "Create company", exact: true })
      .click();
    await expect(
      dialog.getByRole("button", { name: "Creating…", exact: true }),
    ).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Close", exact: true }),
    ).toHaveCount(0);
    await capture(page, "create-pending");
  } finally {
    release();
    await page.unrouteAll({ behavior: "wait" });
  }
  await expect(
    page.getByRole("heading", { name: "Set up branches", exact: true }),
  ).toBeVisible();
});
test("empty, error and unauthorized states stay honest; member cards invent no metadata", async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/control`, {
    data: { emptyDirectory: true },
  });
  await login(page);
  await expect(
    page.getByRole("heading", { name: "No companies registered", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Company workspaces" }),
  ).toHaveCount(0);
  await capture(page, "empty-admin");
  await request.post(`${fixture}/__test/control`, {
    data: { directoryFailure: true },
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Directory unavailable", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Company workspaces" }),
  ).toHaveCount(0);
  await capture(page, "directory-error");
  await request.post(`${fixture}/__test/control`, { data: { disabled: true } });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Session unavailable", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Your workspace", exact: true }),
  ).toHaveCount(0);
  await capture(page, "unauthorized");
  await request.post(`${fixture}/__test/reset`);
  await login(page, "operations");
  await expect(
    page.getByRole("button", { name: "Create company", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByTestId("workspace-card-1")).not.toContainText(
    "Currency",
  );
  await capture(page, "member");
});
test("directory loading has an accessible state without fake workspace cards", async ({
  page,
}) => {
  let release = () => {};
  const gate = new Promise<void>((resolveGate) => {
    release = resolveGate;
  });
  await page.route("**/api/backend/api/v1/branches?*", async (route) => {
    await gate;
    await route.continue();
  });
  try {
    await login(page);
    await expect(
      page.getByRole("status", { name: "Loading companies", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("list", { name: "Company workspaces" }),
    ).toHaveCount(0);
    await capture(page, "loading");
  } finally {
    release();
    await page.unrouteAll({ behavior: "wait" });
  }
  await expect(page.getByTestId("workspace-card-1")).toBeVisible();
});
test("full live navigation distinguishes planned modules from restricted working features", async ({
  page,
}) => {
  await login(page, "operations");
  await page
    .getByRole("link", { name: "Open workspace: Synthetic One", exact: true })
    .click();
  const nav = page.getByRole("navigation", {
    name: "Main navigation",
    exact: true,
  });
  for (const name of [
    "Dashboard",
    "Operations",
    "Fleet",
    "Customers",
    "Rentals",
    "Maintenance",
    "Inventory",
    "Finance",
    "Procurement",
    "Reports",
    "Administration",
  ])
    await expect(nav.getByText(name, { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
  await capture(page, "live-navigation");
  await nav
    .getByRole("link", { name: "Maintenance · Planned", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Maintenance", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Live data unavailable", exact: true }),
  ).toBeVisible();
  await page.route("**/api/backend/api/v1/auth/me", async (route) => {
    const response = await route.fetch();
    const payload = await response.json();
    payload.data.permissions = [];
    await route.fulfill({ response, json: payload });
  });
  await page.reload();
  await expect(
    nav.locator('[aria-disabled="true"]').filter({ hasText: "Fleet" }),
  ).toBeVisible();
  await expect(
    nav.locator('[aria-disabled="true"]').filter({ hasText: "Customers" }),
  ).toBeVisible();
  await expect(
    nav.getByRole("link", { name: "Fleet", exact: true }),
  ).toHaveCount(0);
  await capture(page, "live-navigation-restricted");
});
