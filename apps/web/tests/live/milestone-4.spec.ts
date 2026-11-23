import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
const fixture = "http://127.0.0.1:4201";
async function login(page: Page, role = "admin") {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(`${role}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill(randomUUID());
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your workspace", exact: true }),
  ).toBeVisible();
}
async function capture(page: Page, name: string) {
  await page.screenshot({
    path: resolve(
      process.cwd(),
      `../../documentation/screenshots/milestone-4/${name}.png`,
    ),
    fullPage: true,
    animations: "disabled",
  });
}
test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

test("directories load scoped collections without cross-company leakage and open record details", async ({
  page,
  request,
}) => {
  await login(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/companies/1/customers?branch=all");
  await expect(
    page.getByRole("table").getByText("Synthetic customer", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Other company customer", { exact: true }),
  ).toHaveCount(0);
  await page.goto("/companies/1/vehicles?branch=all");
  await expect(
    page.getByRole("table").getByText("SYN-10", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("OTH-12", { exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "SYN-10", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "SYN-10", exact: true }),
  ).toBeVisible();
  expect(
    (await (await request.get(`${fixture}/__test/stats`)).json())
      .collectionReads,
  ).toBeGreaterThanOrEqual(2);
});

test("customer create/edit uses exact writable fields, invalidates details and maps field errors", async ({
  page,
  request,
}) => {
  await login(page);
  const writes: { method: string; body: Record<string, unknown> }[] = [];
  let detailReads = 0;
  page.on("request", (r) => {
    if (
      /\/api\/backend\/api\/v1\/customers(?:\/\d+)?$/.test(
        new URL(r.url()).pathname,
      )
    ) {
      if (["POST", "PATCH"].includes(r.method()))
        writes.push({ method: r.method(), body: r.postDataJSON() });
      else detailReads++;
    }
  });
  await page.goto("/companies/1/customers/new?branch=all");
  await page
    .getByRole("button", { name: "Create customer", exact: true })
    .click();
  await expect(page.getByText("Enter a name.", { exact: true })).toBeVisible();
  await page
    .locator("form:visible")
    .getByLabel("Name", { exact: true })
    .fill("Milestone Four Synthetic");
  await request.post(`${fixture}/__test/control`, {
    data: { validation: true },
  });
  await page
    .getByRole("button", { name: "Create customer", exact: true })
    .click();
  await expect(
    page.locator("form:visible").getByLabel("Name", { exact: true }),
  ).toHaveAttribute("aria-invalid", "true");
  await request.post(`${fixture}/__test/control`, {
    data: { validation: false },
  });
  await page
    .getByRole("button", { name: "Create customer", exact: true })
    .dblclick();
  await expect(
    page.getByRole("heading", {
      name: "Milestone Four Synthetic",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Customer information", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Edit customer", exact: true }).click();
  await page
    .locator("form:visible")
    .getByLabel("Email (optional)", { exact: true })
    .fill("invalid");
  await page
    .getByRole("button", { name: "Save customer", exact: true })
    .click();
  await expect(
    page
      .locator("form:visible")
      .getByLabel("Email (optional)", { exact: true }),
  ).toHaveAttribute("aria-invalid", "true");
  await page
    .locator("form:visible")
    .getByLabel("Email (optional)", { exact: true })
    .fill("customer@example.test");
  await page
    .locator("form:visible")
    .getByLabel("Name", { exact: true })
    .fill("Updated Synthetic Customer");
  await capture(page, "customer-edit-light");
  await page
    .getByRole("button", { name: "Save customer", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Updated Synthetic Customer",
      exact: true,
    }),
  ).toBeVisible();
  expect(writes.filter((w) => w.method === "POST")).toHaveLength(2); // rejected validation + one successful double-click
  const patch = writes.find((w) => w.method === "PATCH")!.body;
  expect(Object.keys(patch).sort()).toEqual(["email", "name", "phone", "type"]);
  expect(detailReads).toBeGreaterThanOrEqual(3);
  await capture(page, "customer-detail-light");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await capture(page, "customer-detail-390-dark");
  await expect(page.getByRole("link", { name: /delete/i })).toHaveCount(0);
});

test("vehicle writes persist odometer (km), daily rate, functions and enforce conflicts/rented restrictions", async ({
  page,
  request,
}) => {
  await login(page);
  const writes: Record<string, unknown>[] = [];
  page.on("request", (r) => {
    if (
      ["POST", "PATCH"].includes(r.method()) &&
      /\/api\/backend\/api\/v1\/vehicles(?:\/\d+)?$/.test(
        new URL(r.url()).pathname,
      )
    )
      writes.push(r.postDataJSON());
  });
  await page.goto("/companies/1/vehicles/new?branch=all");
  await page.getByLabel("Registration", { exact: true }).fill("m4-new");
  await page.getByLabel("Make", { exact: true }).fill("Synthetic Make");
  await page.getByLabel("Model", { exact: true }).fill("Synthetic Model");
  await page.getByLabel("Odometer (km)", { exact: true }).fill("4200");
  await page.getByLabel("Daily rate (ZMW) (optional)", { exact: true }).fill("1250.99");
  await page.getByRole("button", { name: "GPS Tracker", exact: true }).click();
  await page
    .getByLabel("Add custom vehicle function", { exact: true })
    .fill("Roof Rack");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByLabel("Year (optional)", { exact: true }).fill("2101");
  await page
    .getByRole("button", { name: "Create vehicle", exact: true })
    .click();
  await expect(
    page.getByText("Enter a whole year from 1900 to 2100.", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Year (optional)", { exact: true }).fill("2024");
  await capture(page, "vehicle-create-light");
  await page
    .getByRole("button", { name: "Create vehicle", exact: true })
    .dblclick();
  await expect(
    page.getByRole("heading", { name: "M4-NEW", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("ZMW 1,250.99", { exact: true })).toBeVisible();
  await expect(page.getByText("4,200 km", { exact: true })).toBeVisible();
  await expect(page.getByText("GPS Tracker", { exact: true })).toBeVisible();
  await expect(page.getByText("Roof Rack", { exact: true })).toBeVisible();
  await page.goto("/companies/1/vehicles/10/edit?branch=all");
  await request.post(`${fixture}/__test/control`, { data: { conflict: true } });
  await page.getByRole("button", { name: "Save vehicle", exact: true }).click();
  await expect(page.locator("form").getByRole("alert")).toContainText(
    "current state prevents",
  );
  await capture(page, "vehicle-conflict-light");
  await request.post(`${fixture}/__test/control`, {
    data: { conflict: false },
  });
  await page.getByLabel("Model", { exact: true }).fill("Preserved Odometer");
  await page.getByRole("button", { name: "Save vehicle", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "SYN-10", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("definition").filter({ hasText: /^Preserved Odometer$/ }),
  ).toBeVisible();
  expect(writes[0]).toMatchObject({
    odometer: 4200,
    odometer_unit: "km",
    daily_rate_minor: 125099,
    functions: ["GPS Tracker", "Roof Rack"],
  });
  const raw = await page.request.get("/api/backend/api/v1/vehicles/10");
  expect((await raw.json()).data.odometer).toBe(10);
  await capture(page, "vehicle-detail-light");
  await page.setViewportSize({ width: 834, height: 1112 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await capture(page, "vehicle-detail-834-light");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await capture(page, "vehicle-detail-390-dark");
  await page.goto("/companies/1/vehicles/10/edit?branch=all");
  await expect(page.getByLabel("Registration", { exact: true })).toBeVisible();
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await page.getByLabel("Registration", { exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Make", { exact: true })).toBeFocused();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await capture(page, "vehicle-edit-390-dark");
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.evaluate(() => document.documentElement.classList.remove("dark"));

  await page.goto("/companies/1/vehicles/11?branch=all");
  await expect(
    page.getByRole("heading", { name: "SYN-11", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Edit vehicle", exact: true }),
  ).toHaveCount(0);
  await capture(page, "vehicle-rented-light");
  await page.goto("/companies/1/vehicles/11/edit?branch=all");
  await expect(
    page.getByRole("heading", {
      name: "Vehicle cannot be edited",
      exact: true,
    }),
  ).toBeVisible();
});

test("record loading, API failure and retry never retain stale details", async ({
  page,
}) => {
  await login(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/backend/api/v1/customers/10", async (route) => {
    await gate;
    await route.fulfill({
      status: 503,
      json: { message: "Synthetic outage", errors: {} },
    });
  });
  try {
    await page.goto("/companies/1/customers/10?branch=all");
    await expect(
      page.getByRole("status", { name: "Loading customer", exact: true }),
    ).toBeVisible();
    await capture(page, "customer-loading-light");
  } finally {
    release();
  }
  await expect(
    page.getByRole("heading", { name: "Record unavailable", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Synthetic customer", exact: true }),
  ).toHaveCount(0);
  await capture(page, "customer-error-light");
  await page.unroute("**/api/backend/api/v1/customers/10");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Synthetic customer", exact: true }),
  ).toBeVisible();
});

test("viewer cannot edit or create, and denied edit URLs do not fetch a record", async ({
  page,
}) => {
  await login(page, "viewer");
  await page.goto("/companies/1/customers?branch=all");
  await expect(
    page.getByRole("table").getByText("Synthetic customer", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Create customer", exact: true }),
  ).toHaveCount(0);
  await page.goto("/companies/1/customers/10?branch=all");
  await expect(
    page.getByRole("heading", { name: "Synthetic customer", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Edit customer", exact: true }),
  ).toHaveCount(0);
  let reads = 0;
  page.on("request", (r) => {
    if (new URL(r.url()).pathname.endsWith("/api/v1/customers/10")) reads++;
  });
  await page.goto("/companies/1/customers/10/edit?branch=all");
  await expect(
    page.getByRole("heading", { name: "Access denied", exact: true }),
  ).toBeVisible();
  expect(reads).toBe(0);
  await capture(page, "customer-access-denied-light");
});

test("obsolete save completion cannot navigate back to the previous company", async ({
  page,
}) => {
  await login(page);
  await page.goto("/companies/1/customers/10/edit?branch=all");
  await page
    .getByLabel("Name", { exact: true })
    .fill("Obsolete Synthetic Save");
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let saved!: () => void;
  const reached = new Promise<void>((resolve) => {
    saved = resolve;
  });
  await page.route("**/api/backend/api/v1/customers/10", async (route) => {
    if (route.request().method() !== "PATCH") return route.continue();
    const response = await route.fetch();
    saved();
    await gate;
    await route.fulfill({ response });
  });
  try {
    await page
      .getByRole("button", { name: "Save customer", exact: true })
      .click();
    await reached;
    await expect(page.getByLabel("Name", { exact: true })).toBeDisabled();
    await page.getByRole("combobox", { name: "Company", exact: true }).click();
    await page
      .getByRole("option", { name: "Synthetic Three", exact: true })
      .click();
    await expect(page).toHaveURL(/\/companies\/3\/dashboard/);
  } finally {
    release();
    await page.unrouteAll({ behavior: "wait" });
  }
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Obsolete Synthetic Save", exact: true }),
  ).toHaveCount(0);
});

test("unexpected record identities are rejected without displaying retained data", async ({
  page,
}) => {
  await login(page);
  await page.goto("/companies/1/customers/10?branch=all");
  await expect(
    page.getByRole("heading", { name: "Synthetic customer", exact: true }),
  ).toBeVisible();
  await page.route("**/api/backend/api/v1/customers/10", async (route) => {
    const response = await route.fetch();
    const payload = await response.json();
    payload.data.id = 12;
    payload.data.name = "Unexpected Synthetic Identity";
    await route.fulfill({ response, json: payload });
  });
  await page
    .getByRole("button", { name: "Refresh record", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Record unavailable", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Unexpected Synthetic Identity",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Synthetic customer", exact: true }),
  ).toHaveCount(0);
});
