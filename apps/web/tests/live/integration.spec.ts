import { signOut } from "./helpers";
import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
import { randomUUID } from "node:crypto";
const fixture = "http://127.0.0.1:3201";
async function control(request: APIRequestContext, data: object) {
  await request.post(`${fixture}/__test/control`, { data });
}
async function login(page: Page, role = "operations") {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(`${role}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill(randomUUID());
  let before = "";
  await page.route(
    "**/api/backend/api/v1/auth/login",
    async (route) => {
      before =
        (await page.context().cookies()).find(
          (cookie) => cookie.name === "drivecore_test",
        )?.value ?? "";
      await route.continue();
    },
    { times: 1 },
  );
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your workspace" }),
  ).toBeVisible();
  const after =
    (await page.context().cookies()).find(
      (cookie) => cookie.name === "drivecore_test",
    )?.value ?? "";
  expect(Boolean(before && after && before !== after)).toBe(true);
}
test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});
test("anonymous protection, login rotation, restoration, no mock data and cross-tab logout", async ({
  page,
  context,
}) => {
  await page.goto("/companies/1/dashboard?branch=all");
  await expect(page).toHaveURL(/\/login\?next=/);
  await login(page);
  await expect(
    page.getByRole("link", { name: "Explore full ERP demo", exact: true }),
  ).toHaveAttribute("href", "/demo/erp");
  await page
    .getByRole("link", { name: "Open workspace: Synthetic One" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Live data unavailable" }),
  ).toBeVisible();
  await expect(page.getByText("Mock workspace", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("heading", { name: "Today's departures" }),
  ).toHaveCount(0);
  const cookies = await context.cookies();
  expect(cookies.find((c) => c.name === "drivecore_test")?.httpOnly).toBe(true);
  expect(cookies.find((c) => c.name === "XSRF-TOKEN")?.httpOnly).toBe(false);
  await page.reload();
  await expect(
    page.getByText("Synthetic operator", { exact: true }),
  ).toBeVisible();
  const other = await context.newPage();
  await other.goto("/companies/1/dashboard?branch=all");
  await expect(
    other.getByText("Synthetic operator", { exact: true }),
  ).toBeVisible();
  await signOut(page);
  await expect(page).toHaveURL(/\/login/);
  await expect(other).toHaveURL(/\/login/);
});
test("customer create/edit uses backend records, maps 422, prevents double submission and scopes collections", async ({
  page,
  request,
}) => {
  await login(page);
  await page.goto("/companies/1/customers?branch=all");
  await expect(
    page.getByRole("table").getByText("Synthetic customer", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Other company customer", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("link", { name: "Create customer", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Created synthetic customer");
  await control(request, { validation: true });
  await page
    .getByRole("button", { name: "Create customer", exact: true })
    .click();
  await expect(
    page.getByText("Synthetic name rejection.", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator("form:visible")
      .getByRole("textbox", { name: "Name", exact: true }),
  ).toHaveValue("Created synthetic customer");
  await control(request, { validation: false });
  await page
    .getByRole("button", { name: "Create customer", exact: true })
    .dblclick();
  await expect(
    page.getByRole("heading", {
      name: "Created synthetic customer",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Edit customer", exact: true }).click();
  await expect(page.locator("form:visible")).toHaveCount(1);
  await expect(
    page
      .locator("form:visible")
      .getByText("Company and branch ownership cannot be changed."),
  ).toBeVisible();
  await page
    .locator("form:visible")
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Edited synthetic customer");
  await page.getByRole("button", { name: "Save customer" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Edited synthetic customer",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /delete/i })).toHaveCount(0);
  expect(
    (await (await request.get(`${fixture}/__test/stats`)).json())
      .collectionReads,
  ).toBeGreaterThanOrEqual(1);
  expect(
    (await (await request.get(`${fixture}/__test/stats`)).json())
      .completedWrites,
  ).toBe(2);
});
test("vehicle create/update, duplicate feedback, 409 and rented protection", async ({
  page,
  request,
}) => {
  await login(page);
  await page.goto("/companies/1/vehicles/new?branch=all");
  await page
    .getByRole("textbox", { name: "Registration", exact: true })
    .fill("syn-new");
  await page
    .getByRole("textbox", { name: "Make", exact: true })
    .fill("Synthetic");
  await page.getByRole("textbox", { name: "Model", exact: true }).fill("Test");
  await control(request, { validation: true });
  await page.getByRole("button", { name: "Create vehicle" }).click();
  await expect(
    page.getByText("The registration has already been taken.", { exact: true }),
  ).toBeVisible();
  await control(request, { validation: false });
  await page.getByRole("button", { name: "Create vehicle" }).click();
  await expect(page.getByRole("heading", { name: "SYN-NEW" })).toBeVisible();
  await page.getByRole("link", { name: "Edit vehicle" }).click();
  await control(request, { conflict: true });
  await page.getByRole("button", { name: "Save vehicle" }).click();
  await expect(page.locator("form:visible").getByRole("alert")).toContainText(
    "current state prevents",
  );
  await control(request, { conflict: false });
  await page
    .locator("form:visible")
    .getByRole("textbox", { name: "Model", exact: true })
    .fill("Updated");
  await page.getByRole("button", { name: "Save vehicle" }).click();
  await expect(
    page.getByRole("definition").filter({ hasText: "Updated" }),
  ).toBeVisible();
  await page.goto("/companies/1/vehicles/11/edit?branch=all");
  await expect(
    page.getByRole("heading", { name: "Vehicle cannot be edited" }),
  ).toBeVisible();
});
test("viewer cannot write, inaccessible detail does not display, admin directory spans pages", async ({
  page,
  request,
}) => {
  await login(page, "viewer");
  await page.goto("/companies/1/customers/new?branch=all");
  await expect(
    page.getByRole("heading", { name: "Access denied", exact: true }),
  ).toBeVisible();
  await page.goto("/companies/1/customers/12?branch=all");
  await expect(
    page.getByRole("heading", { name: "Record unavailable" }),
  ).toBeVisible();
  await expect(
    page.getByText("Other company customer", { exact: true }),
  ).toHaveCount(0);
  await signOut(page);
  await login(page, "admin");
  await expect(
    page.getByRole("link", {
      name: "Open workspace: Synthetic Three",
      exact: true,
    }),
  ).toBeVisible();
  expect(
    (await (await request.get(`${fixture}/__test/stats`)).json())
      .collectionReads,
  ).toBe(0);
});
test("directory blocker, empty membership, revoked membership and history do not invent context", async ({
  page,
  request,
}) => {
  await login(page, "unrestricted");
  await page.goto("/companies/1/customers/new?branch=all");
  await expect(
    page.getByRole("button", { name: "Create customer" }),
  ).toBeDisabled();
  await page.goto("/companies/1/dashboard?branch=999");
  await expect(
    page.getByRole("heading", { name: "Context unavailable" }),
  ).toBeVisible();
  await page.goto("/companies/1/dashboard?branch=all");
  await page.goto("/companies/3/dashboard?branch=all");
  await page.goBack();
  await expect(
    page.getByRole("combobox", { name: "Company", exact: true }),
  ).toContainText("Synthetic One");
  await control(request, { revoked: true });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Context unavailable" }),
  ).toBeVisible();
  await signOut(page);
  await control(request, { revoked: false });
  await login(page, "driver");
  await expect(
    page.getByRole("heading", { name: "No accessible companies" }),
  ).toBeVisible();
});
test("session expiry and failed logout are explicit", async ({
  page,
  request,
}) => {
  await login(page);
  await page.goto("/companies/1/dashboard?branch=all");
  await control(request, { logoutFailure: true });
  await signOut(page);
  await expect(
    page.getByRole("alert").filter({ hasText: "unavailable" }),
  ).toBeVisible();
  await expect(page).not.toHaveURL(/\/login/);
  await control(request, { expire: true, logoutFailure: false });
  await page.reload();
  await expect(page).toHaveURL(/\/login/);
  await login(page);
  await control(request, { disabled: true });
  await page.goto("/companies/1/dashboard?branch=all");
  await expect(
    page.getByRole("heading", { name: "Session unavailable" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toHaveCount(0);
});
test("proxy rejects missing CSRF and hostile origins through the actual Next handler", async ({
  request,
}) => {
  const missing = await request.post("/api/backend/api/v1/auth/login", {
    headers: { Origin: "http://127.0.0.1:3101" },
    data: {},
  });
  expect(missing.status()).toBe(419);
  const origin = await request.post("/api/backend/api/v1/auth/login", {
    headers: { Origin: "https://evil.test", "X-XSRF-TOKEN": "synthetic" },
    data: {},
  });
  expect(origin.status()).toBe(403);
  const collection = await request.get("/api/backend/api/v1/customers");
  expect(collection.status()).toBe(400);
  const blocked = await request.get("/api/backend/api/v1/documents/1");
  expect(blocked.status()).toBe(404);
  await request.get("/api/backend/sanctum/csrf-cookie");
  const mismatch = await request.post("/api/backend/api/v1/auth/login", {
    headers: {
      Origin: "http://127.0.0.1:3101",
      "X-XSRF-TOKEN": "incorrect-synthetic",
    },
    data: {},
  });
  expect(mismatch.status()).toBe(419);
});
test("disabled accounts, login status errors and network failure preserve anonymous state", async ({
  page,
  request,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("disabled@example.test");
  await page.getByLabel("Password", { exact: true }).fill(randomUUID());
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByText("The provided credentials are incorrect.", { exact: true }),
  ).toBeVisible();
  for (const status of [419, 426, 429]) {
    await control(request, { loginStatus: status });
    await page.getByLabel("Password", { exact: true }).fill(randomUUID());
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(
      page.getByRole("alert").filter({
        hasText:
          status === 419
            ? "verification"
            : status === 426
              ? "HTTPS"
              : "Too many requests",
      }),
    ).toBeVisible();
  }
  await control(request, { loginStatus: null });
  await page.route("**/api/backend/api/v1/auth/login", (route) =>
    route.abort(),
  );
  await page.getByLabel("Password", { exact: true }).fill(randomUUID());
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText(/Connection failed/)).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
});
test("rapid company changes cancel obsolete detail and mutation responses", async ({
  page,
  request,
}) => {
  await login(page);
  await control(request, { delay: 700 });
  await page.goto("/companies/1/customers/10?branch=all");
  await page.getByRole("combobox", { name: "Company", exact: true }).click();
  await page
    .getByRole("option", { name: "Synthetic Three", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Company", exact: true }),
  ).toContainText("Synthetic Three");
  await expect(
    page.getByRole("heading", { name: "Synthetic customer", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("combobox", { name: "Company", exact: true }).click();
  await page
    .getByRole("option", { name: "Synthetic One", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Company", exact: true }),
  ).toContainText("Synthetic One");
  await expect(
    page.getByRole("heading", { name: "Live data unavailable" }),
  ).toBeVisible();
  await page.goto("/companies/1/customers/10?branch=all");
  await expect(
    page.getByRole("heading", { name: "Synthetic customer", exact: true }),
  ).toBeVisible();
  await control(request, { delay: 0, mutationDelay: 700 });
  await page.getByRole("link", { name: "Edit customer" }).click();
  await page
    .locator("form:visible")
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Obsolete response");
  await page.getByRole("button", { name: "Save customer" }).click();
  await page.getByRole("combobox", { name: "Company", exact: true }).click();
  await page
    .getByRole("option", { name: "Synthetic Three", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await (await request.get(`${fixture}/__test/stats`)).json())
          .completedWrites,
    )
    .toBe(1);
  await expect(
    page.getByRole("combobox", { name: "Company", exact: true }),
  ).toContainText("Synthetic Three");
  await expect(
    page.getByRole("heading", { name: "Obsolete response", exact: true }),
  ).toHaveCount(0);
});
test("live shell preserves light/dark tokens, keyboard navigation and mobile layout", async ({
  page,
}) => {
  await login(page, "admin");
  await page.goto("/companies/1/dashboard?branch=all");
  await expect(page.getByTestId("topbar")).toBeVisible();
  const mainNav = page.getByRole("navigation", {
    name: "Main navigation",
    exact: true,
  });
  await expect(mainNav).toBeVisible();
  const primary = await page.evaluate(() =>
    getComputedStyle(document.documentElement)
      .getPropertyValue("--primary")
      .trim(),
  );
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.classList.contains("dark")),
    )
    .toBe(true);
  await page.reload();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.classList.contains("dark")),
    )
    .toBe(true);
  expect(
    await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue("--primary")
        .trim(),
    ),
  ).toBe(primary);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/live-shell-dark-mobile.png" });
});

test("post-login 401 on auth/me surfaces an explicit session cookie notice", async ({
  page,
}) => {
  let rejectPostLoginMe = false;
  await page.route("**/api/backend/api/v1/auth/me", async (route) => {
    if (rejectPostLoginMe) {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        json: { message: "API request failed.", errors: {} },
      });
      return;
    }
    await route.continue();
  });
  await page.goto("/login");
  rejectPostLoginMe = true;
  await page.getByLabel("Email", { exact: true }).fill("admin@example.test");
  await page.getByLabel("Password", { exact: true }).fill("synthetic");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(
    page.getByRole("alert").filter({ hasText: "SANCTUM_STATEFUL_DOMAINS" }),
  ).toBeVisible();
});
