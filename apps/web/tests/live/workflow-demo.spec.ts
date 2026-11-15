import { test, expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
const folder = resolve(
  process.cwd(),
  "../../documentation/screenshots/workflow-dashboard",
);
async function capture(page: Page, name: string) {
  await mkdir(folder, { recursive: true });
  await page.screenshot({
    path: resolve(folder, `${name}.png`),
    animations: "disabled",
    fullPage: (await page.getByRole("dialog").count()) === 0,
  });
}
async function enter(page: Page) {
  await page.goto("/demo/workflow");
  await page.getByRole("button", { name: "Enter demo", exact: true }).click();
}
async function company(page: Page, name = "Fictional Fleet") {
  await page.getByLabel("Company name", { exact: true }).fill(name);
  await page
    .getByRole("button", { name: "Create demo company", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Set up your workspace" }),
  ).toBeVisible();
}
async function branch(page: Page, name = "Fictional Main") {
  await page.getByLabel("Branch name", { exact: true }).fill(name);
  await page
    .getByRole("button", { name: "Create demo branch", exact: true })
    .click();
  await expect(page.getByRole("list", { name: "Demo branches" })).toContainText(
    name,
  );
}
async function open(page: Page) {
  await page
    .getByRole("button", { name: "Open workspace", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
}
test("demo remains reachable from a failed live session and sign-in", async ({
  page,
}) => {
  await page.route("**/api/backend/api/v1/auth/me", (r) =>
    r.fulfill({
      status: 503,
      json: { message: "Synthetic outage", errors: {} },
    }),
  );
  await page.goto("/companies");
  await page
    .getByRole("link", { name: "Try workflow demo", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Enter demo", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toHaveCount(0);
});
test("demo setup, records, refresh, company isolation, history and reset never call the API", async ({
  page,
}) => {
  const api: string[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).pathname.startsWith("/api/")) api.push(r.method());
  });
  await enter(page);
  await expect(page.getByLabel("Currency", { exact: true })).toHaveValue("GHC");
  await expect(
    page.getByLabel("Currency", { exact: true }).getByRole("option"),
  ).toHaveText(["USD", "EUR", "GHC", "ZMW"]);
  await page.getByLabel("Company name", { exact: true }).fill("");
  await page
    .getByRole("button", { name: "Create demo company", exact: true })
    .click();
  await expect(page.getByText("Enter a name.", { exact: true })).toBeVisible();
  await company(page);
  await expect(
    page.getByRole("button", { name: "Open workspace", exact: true }),
  ).toBeDisabled();
  await page.reload();
  await expect(
    page.getByRole("paragraph").filter({ hasText: /^Fictional Fleet$/ }),
  ).toBeVisible();
  await branch(page);
  await branch(page, "Second Branch");
  await page.setViewportSize({ width: 1440, height: 900 });
  await capture(page, "after-demo-setup-1440-light");
  await open(page);
  await expect(
    page
      .getByRole("heading", { name: "Demo customers", exact: true })
      .locator(".."),
  ).toContainText("0");
  await capture(page, "after-demo-dashboard-empty-1440-light");
  await page
    .getByRole("button", { name: "Create customer", exact: true })
    .click();
  await page
    .getByLabel("Customer name", { exact: true })
    .fill("Unfinished fictional customer");
  await page
    .getByRole("combobox", { name: "Record branch", exact: true })
    .selectOption({ label: "Second Branch" });
  await expect(page.getByLabel("Customer name", { exact: true })).toHaveValue(
    "Unfinished fictional customer",
  );
  await page
    .getByRole("combobox", { name: "Record branch", exact: true })
    .selectOption({ label: "Fictional Main" });
  await page
    .getByLabel("Customer name", { exact: true })
    .fill("Example Customer");
  await page.getByLabel("Email (optional)", { exact: true }).fill("invalid");
  await page
    .getByRole("button", { name: "Create demo customer", exact: true })
    .click();
  await expect(
    page.getByLabel("Email (optional)", { exact: true }),
  ).toHaveAttribute("aria-invalid", "true");
  await page
    .getByLabel("Email (optional)", { exact: true })
    .fill("fictional@example.test");
  await page
    .getByRole("button", { name: "Create demo customer", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Create vehicle", exact: true })
    .click();
  await page.getByLabel("Year (optional)", { exact: true }).fill("1899");
  await page
    .getByRole("button", { name: "Create demo vehicle", exact: true })
    .click();
  await expect(
    page.getByText("Enter a whole year from 1900 to 2100.", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Year (optional)", { exact: true }).fill("2024");
  await page.getByLabel("Registration", { exact: true }).fill("demo-001");
  await page
    .getByRole("button", { name: "Create demo vehicle", exact: true })
    .click();
  await capture(page, "after-demo-dashboard-1440-light");
  await page.getByRole("link", { name: "Fleet", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "DEMO-001", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Create vehicle", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Create demo vehicle", exact: true })
    .click();
  await expect(page.locator("p[role=alert]")).toContainText(
    "registration already exists",
  );
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "Customers", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Example Customer", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Branch scope", exact: true })
    .selectOption({ label: "Second Branch" });
  await expect(
    page.getByText("No demo records in this scope.", { exact: false }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Example Customer", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Create company", exact: true })
    .click();
  await company(page, "Another Fictional Company");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Open workspace", exact: true }),
  ).toBeDisabled();
  await branch(page, "Other Main");
  await open(page);
  await page.getByRole("link", { name: "Customers", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Example Customer", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Company", exact: true })
    .selectOption({ label: "Fictional Fleet" });
  await page.reload();
  await expect(
    page
      .getByRole("heading", { name: "Demo customers", exact: true })
      .locator(".."),
  ).toContainText("1");
  await page.getByRole("button", { name: "Reset demo", exact: true }).click();
  await page.getByRole("button", { name: "Keep demo", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reset demo", exact: true }).click();
  await page
    .getByRole("button", { name: "Reset demo records", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Enter demo", exact: true }),
  ).toBeVisible();
  expect(api).toEqual([]);
});
test("demo is keyboard accessible offline, responsive and supports dark mode", async ({
  page,
  context,
}) => {
  await page.goto("/login");
  await page
    .getByRole("link", {
      name: "Try workflow demo — no login needed",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Enter demo", exact: true }).focus();
  await page.keyboard.press("Enter");
  await context.setOffline(true);
  await company(page);
  await branch(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await capture(page, "after-demo-setup-390-light");
  await open(page);
  for (const width of [1920, 834, 390]) {
    await page.setViewportSize({ width, height: width === 834 ? 1112 : 900 });
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    await capture(page, `after-demo-dashboard-${width}-light`);
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await capture(page, "after-demo-dashboard-390-dark");
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Customers", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Create customer", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Record branch", exact: true }),
  ).toBeFocused();
  await capture(page, "after-demo-customer-dialog-390-dark");
  await page.keyboard.press("Escape");
  await context.setOffline(false);
});
test("demo storage changes and reset synchronize across tabs", async ({
  page,
  context,
}) => {
  await enter(page);
  await company(page);
  const other = await context.newPage();
  await other.goto(page.url());
  await branch(page);
  await expect(
    other.getByRole("list", { name: "Demo branches" }),
  ).toContainText("Fictional Main");
  await other.getByRole("button", { name: "Reset demo", exact: true }).click();
  await other
    .getByRole("button", { name: "Reset demo records", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Enter demo", exact: true }),
  ).toBeVisible();
});
test("corrupt or blocked demo storage is explicit and does not silently overwrite records", async ({
  page,
}) => {
  await page.goto("/demo/workflow");
  await page.evaluate(() =>
    localStorage.setItem("drivecore.workflow-demo.v1", "invalid saved data"),
  );
  await page.reload();
  await expect(page.locator("p[role=alert]")).toContainText(
    "Saved demo data could not be read",
  );
  expect(
    await page.evaluate(() =>
      localStorage.getItem("drivecore.workflow-demo.v1"),
    ),
  ).toBe("invalid saved data");
  await page.getByRole("button", { name: "Reset demo", exact: true }).click();
  await page
    .getByRole("button", { name: "Reset demo records", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Enter demo", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Unavailable", "QuotaExceededError");
    };
  });
  await page.getByRole("button", { name: "Enter demo", exact: true }).click();
  await expect(page.locator("p[role=alert]")).toContainText(
    "storage is unavailable",
  );
});

test("demo validates direct context URLs and branch uniqueness without leaking another scope", async ({
  page,
}) => {
  await enter(page);
  await company(page);
  await branch(page);
  await branch(page);
  await expect(page.locator("p[role=alert]")).toContainText(
    "branch with this name already exists",
  );
  const url = new URL(page.url());
  url.searchParams.set("view", "dashboard");
  url.searchParams.set("branch", "missing-branch");
  await page.goto(url.pathname + url.search);
  await expect(
    page.getByRole("heading", {
      name: "Demo context unavailable",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create customer", exact: true }),
  ).toHaveCount(0);
  url.searchParams.set("company", "missing-company");
  url.searchParams.set("branch", "all");
  await page.goto(url.pathname + url.search);
  await expect(
    page.getByRole("heading", {
      name: "Demo context unavailable",
      exact: true,
    }),
  ).toBeVisible();
});
