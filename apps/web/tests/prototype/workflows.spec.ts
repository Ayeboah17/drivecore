import { test, expect, type Page } from "@playwright/test";
import type { Database } from "../../src/lib/demo/types";
import { resolve } from "node:path";
const route = (
  view = "dashboard",
  tab = "",
  id = "",
  user = "user-platform",
  company = "co-1",
  branch = "br-1",
) =>
  `/demo/erp?${new URLSearchParams({ demo: "1", user, company, branch, view, tab, id })}`;
async function open(page: Page, view = "dashboard", tab = "", id = "") {
  await page.goto(route(view, tab, id));
  await expect(
    page.getByRole("heading", {
      name:
        view === "fleet"
          ? "Fleet"
          : view.charAt(0).toUpperCase() + view.slice(1),
      exact: true,
    }),
  ).toBeVisible();
}
async function save(page: Page) {
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save demo change", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
async function transition(
  page: Page,
  name: string,
  values: Record<string, string> = {},
) {
  await page.getByRole("button", { name, exact: true }).click();
  const dialog = page.getByRole("dialog");
  for (const [key, value] of Object.entries(values))
    await dialog.getByLabel(key, { exact: true }).fill(value);
  await save(page);
}
async function data(page: Page): Promise<Database> {
  return page.evaluate(
    () =>
      new Promise<Database>((resolve, reject) => {
        const request = indexedDB.open("drivecore-erp-demo-v1", 1);
        request.onsuccess = () => {
          const db = request.result,
            tx = db.transaction("snapshots", "readonly"),
            read = tx.objectStore("snapshots").get("main");
          read.onsuccess = () => resolve(read.result);
          read.onerror = () => reject(new Error("Synthetic demo read failed"));
          tx.oncomplete = () => db.close();
        };
        request.onerror = () =>
          reject(new Error("Synthetic demo storage unavailable"));
      }),
  );
}
async function capture(page: Page, name: string) {
  if (process.env.DRIVECORE_CAPTURE_SCREENSHOTS !== '1') return;
  if (!(await page.getByRole("dialog").count()))
    await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: resolve(
      process.cwd(),
      `../../documentation/screenshots/erp-prototype/${name}.png`,
    ),
    animations: "disabled",
    fullPage: (await page.getByRole("dialog").count()) === 0,
  });
}

test("every module has real demo records, working search/pagination and scoped context", async ({
  page,
}) => {
  const api: string[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).pathname.startsWith("/api/")) api.push(r.url());
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(
    route("customers", "customer", "", "user-platform", "co-1", "all"),
  );
  await expect(
    page.getByText("18 records · Page 1 of 2", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    page.getByText("18 records · Page 2 of 2", { exact: true }),
  ).toBeVisible();
  await page.getByRole("searchbox").fill("Business 10");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(
    page.getByText("1 records · Page 1 of 1", { exact: true }),
  ).toBeVisible();
  await page.getByRole("searchbox").fill("NO-SYNTHETIC-MATCH");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "No matching records", exact: true }),
  ).toBeVisible();
  await capture(page, "customers-empty-light");
  await page
    .getByRole("button", { name: "Clear search and status", exact: true })
    .click();
  for (const view of [
    "dashboard",
    "operations",
    "fleet",
    "customers",
    "rentals",
    "maintenance",
    "inventory",
    "finance",
    "procurement",
    "reports",
    "administration",
  ]) {
    await open(page, view);
    await capture(page, `${view}-1440-light`);
  }
  await open(page, "fleet");
  await page
    .getByRole("combobox", { name: "Company", exact: true })
    .selectOption("co-2");
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Demo navigation" })
    .getByRole("button", { name: "Fleet", exact: true })
    .click();
  await expect(page.getByRole("table")).not.toContainText("DEMO-1001");
  await expect(page.getByRole("table")).toContainText("DEMO-3001");
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
  expect(api).toEqual([]);
});

test("customer and fleet CRUD persists through reload; document metadata is attached locally", async ({
  page,
}) => {
  await open(page, "customers", "customer");
  await page
    .getByRole("button", { name: "Create customer", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Name", { exact: true })
    .fill("A Fictional Prototype Customer");
  await dialog
    .getByLabel("Email (optional)", { exact: true })
    .fill("prototype@example.test");
  await save(page);
  await expect(
    page.getByRole("heading", {
      name: "A Fictional Prototype Customer",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit record", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Phone (optional)", { exact: true })
    .fill("+000 000 111");
  await save(page);
  await page.reload();
  await expect(page.getByText("+000 000 111", { exact: true })).toBeVisible();
  const customer = (await data(page)).entities.find(
    (e) => e.kind === "customer" && e.name === "A Fictional Prototype Customer",
  )!;
  await open(page, "fleet", "vehicle");
  await page
    .getByRole("button", { name: "Create vehicle", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  for (const [label, value] of Object.entries({
    Registration: "proto-999",
    Make: "Prototype",
    Model: "Example",
    Year: "2025",
    "Daily rate": "600",
    "Odometer (demo km)": "1000",
    Seats: "5",
  }))
    await dialog.getByLabel(label, { exact: true }).fill(value);
  await save(page);
  await expect(
    page.getByRole("heading", { name: "PROTO-999", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit record", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Model", { exact: true })
    .fill("Edited Example");
  await save(page);
  await page.reload();
  await expect(page.getByText("Edited Example", { exact: true })).toBeVisible();
  await open(page, "fleet", "document");
  await page
    .getByRole("button", { name: "Create document metadata", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Name", { exact: true })
    .fill("Synthetic metadata only.pdf");
  await dialog
    .getByLabel("Related record", { exact: true })
    .selectOption(customer.id);
  await save(page);
  await expect(
    page.getByRole("heading", {
      name: "Synthetic metadata only.pdf",
      exact: true,
    }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export metadata", exact: true })
    .click();
  expect((await download).suggestedFilename()).toBe(
    "synthetic-document-metadata.json",
  );
  await open(page, "customers", "customer", customer.id);
  await page
    .getByRole("button", { name: "Delete unlinked record", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save demo change", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "linked",
  );
  await page.keyboard.press("Escape");
});

test("quotation becomes a reservation and contract, then handover, extension and return update finance and fleet", async ({
  page,
}) => {
  await open(page, "rentals", "quotation");
  await page
    .getByRole("button", { name: "Create quotation", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Vehicle", { exact: true })
    .selectOption("vehicle-1-2");
  await save(page);
  await transition(page, "Convert to reservation");
  let db = await data(page);
  const reservation = db.entities
    .filter((e) => e.kind === "reservation")
    .at(-1)!;
  await open(page, "rentals", "reservation", reservation.id);
  await transition(page, "Confirm reservation");
  await transition(page, "Create rental contract");
  db = await data(page);
  const rental = db.entities.filter((e) => e.kind === "rental").at(-1)!;
  await open(page, "rentals", "rental", rental.id);
  await transition(page, "Complete handover", {
    "Condition notes": "Synthetic checked handover",
  });
  await expect(page.getByText("active", { exact: true }).first()).toBeVisible();
  await page
    .getByRole("button", { name: "Extend rental", exact: true })
    .click();
  const later = new Date(Date.now() + 2 * 86400000);
  const local = new Date(later.getTime() - later.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
  await page
    .getByRole("dialog")
    .getByLabel("New expected return", { exact: true })
    .fill(local);
  await save(page);
  await transition(page, "Record return", {
    "Condition notes": "Synthetic checked return",
    "Additional agreed charge": "25",
  });
  db = await data(page);
  expect(db.entities.find((e) => e.id === rental.id)).toMatchObject({
    status: "completed",
  });
  expect(db.entities.find((e) => e.id === "vehicle-1-2")).toMatchObject({
    condition: "available",
  });
  const invoice = db.entities
    .filter((e) => e.kind === "invoice" && e.rentalId === rental.id)
    .at(-1)!;
  await open(page, "finance", "invoice", invoice.id);
  await transition(page, "Issue invoice");
  await transition(page, "Record payment", {
    Amount: String((invoice as { total: number }).total / 100),
    "Payment reference": "DEMO-SETTLEMENT",
  });
  await expect(page.getByText("paid", { exact: true }).first()).toBeVisible();
  await transition(page, "Refund & credit", {
    Amount: "10",
    "Refund reason": "Agreed synthetic credit",
  });
  await capture(page, "settled-invoice-light");
  expect(
    (await data(page)).entities.filter(
      (e) => e.kind === "inspection" && e.rentalId === rental.id,
    ),
  ).toHaveLength(2);
});

test("maintenance consumption and purchase receipt change actual persisted inventory", async ({
  page,
}) => {
  await open(page, "maintenance", "workOrder", "work-1-1");
  await transition(page, "Start work");
  await page
    .getByRole("button", { name: "Consume parts", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Part", { exact: true }).selectOption("part-1-2");
  await dialog.getByLabel("Quantity", { exact: true }).fill("9999");
  await dialog
    .getByRole("button", { name: "Save demo change", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText("Insufficient stock");
  await dialog.getByLabel("Quantity", { exact: true }).fill("1");
  await save(page);
  await transition(page, "Complete work");
  let db = await data(page);
  expect(db.entities.find((e) => e.id === "vehicle-1-6")).toMatchObject({
    condition: "available",
  });
  expect(
    db.entities.some(
      (e) => e.kind === "expense" && e.workOrderId === "work-1-1",
    ),
  ).toBe(true);
  await open(page, "procurement", "purchaseOrder", "purchase-1-0");
  await transition(page, "Submit purchase request");
  await transition(page, "Approve order");
  await transition(page, "Receive goods");
  db = await data(page);
  expect(
    db.entities.filter(
      (e) => e.kind === "movement" && e.purchaseOrderId === "purchase-1-0",
    ),
  ).toHaveLength(1);
  await page.reload();
  await expect(
    page.getByText("received", { exact: true }).first(),
  ).toBeVisible();
  await capture(page, "received-order-light");
});

test("roles guard direct pages and actions, and branch context cannot be forged", async ({
  page,
}) => {
  await page.goto(route("fleet", "vehicle", "", "user-viewer"));
  await expect(
    page.getByRole("heading", { name: "Fleet", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create vehicle", exact: true }),
  ).toHaveCount(0);
  await page.goto(route("fleet", "vehicle", "vehicle-1-2", "user-viewer"));
  await expect(
    page.getByRole("button", { name: "Edit record", exact: true }),
  ).toHaveCount(0);
  await page.goto(route("finance", "invoice", "", "user-operations"));
  await expect(
    page.getByRole("heading", { name: "Demo access denied", exact: true }),
  ).toBeVisible();
  await page.goto(
    route("fleet", "vehicle", "", "user-branch-manager", "co-1", "br-2"),
  );
  await expect(
    page.getByRole("heading", {
      name: "Demo context unavailable",
      exact: true,
    }),
  ).toBeVisible();
  await page.goto(route("fleet", "vehicle", "vehicle-3-2"));
  await expect(
    page.getByRole("heading", { name: "Demo record unavailable", exact: true }),
  ).toBeVisible();
});

test("offline changes, cross-tab sync, reset and responsive keyboard UI work without API traffic", async ({
  page,
  context,
}) => {
  const calls: string[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).pathname.startsWith("/api/")) calls.push(r.url());
  });
  await open(page, "customers", "customer");
  const other = await context.newPage();
  await other.goto(route("customers", "customer"));
  await expect(
    other.getByRole("heading", { name: "Customers", exact: true }),
  ).toBeVisible();
  await context.setOffline(true);
  await page
    .getByRole("button", { name: "Create customer", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Name", { exact: true })
    .fill("A Cross-tab Synthetic");
  await save(page);
  await expect(other.getByRole("table")).toContainText("A Cross-tab Synthetic");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page
    .getByRole("button", { name: "Use dark theme", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await capture(page, "customer-detail-390-dark");
  await page
    .getByRole("button", { name: "Open demo navigation", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Fleet", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Fleet", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Create vehicle", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByLabel("Branch", { exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("dialog").getByLabel("Registration", { exact: true }),
  ).toBeFocused();
  await capture(page, "vehicle-form-390-dark");
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Reset demo data", exact: true })
    .click();
  await page.getByRole("button", { name: "Keep changes", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Fleet", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Reset demo data", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Restore demo data", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
  await expect(other.getByRole("table")).not.toContainText(
    "A Cross-tab Synthetic",
  );
  expect(calls).toEqual([]);
  await capture(page, "dashboard-390-dark");
  await context.setOffline(false);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
});

test("administration creates a company and branch, changes application settings, and assigns a custom role", async ({
  page,
}) => {
  test.setTimeout(60000);
  await open(page, "administration", "setting", "setting-rows-co-1");
  await page.getByRole("button", { name: "Edit record", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Value", { exact: true })
    .fill("25");
  await save(page);
  await page.goto(
    route("customers", "customer", "", "user-platform", "co-1", "all"),
  );
  await expect(
    page.getByText("18 records · Page 1 of 1", { exact: true }),
  ).toBeVisible();
  await open(page, "administration", "role");
  await page.getByRole("button", { name: "Create role", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Name", { exact: true })
    .fill("Customer observer demo");
  await dialog
    .getByRole("checkbox", { name: "dashboard.read", exact: true })
    .check();
  await dialog
    .getByRole("checkbox", { name: "customers.read", exact: true })
    .check();
  await save(page);
  const role = (await data(page)).entities
    .filter((e) => e.kind === "role")
    .at(-1)!;
  await open(page, "administration", "user");
  await page.getByRole("button", { name: "Create user", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name", { exact: true }).fill("Demo custom observer");
  await dialog
    .getByLabel("Email", { exact: true })
    .fill("observer@example.test");
  await dialog.getByLabel("Role", { exact: true }).selectOption(role.id);
  await save(page);
  const user = (await data(page)).entities
    .filter((e) => e.kind === "user")
    .at(-1)!;
  await page
    .getByRole("combobox", { name: "Demo account", exact: true })
    .selectOption(user.id);
  await page
    .getByRole("navigation", { name: "Demo navigation", exact: true })
    .getByRole("button", { name: "Customers", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Create customer", exact: true }),
  ).toHaveCount(0);
  await expect(
    page
      .getByRole("navigation", { name: "Demo navigation" })
      .getByRole("button", { name: "Finance", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Demo account", exact: true })
    .selectOption("user-platform");
  await open(page, "administration", "company");
  await page
    .getByRole("button", { name: "Create company", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Name", { exact: true })
    .fill("New Synthetic Company");
  await expect(dialog.getByLabel("Currency", { exact: true })).toHaveValue(
    "GHC",
  );
  await save(page);
  await expect(
    page.getByRole("button", { name: "Create branch", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Create branch", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Name", { exact: true })
    .fill("New Synthetic Branch");
  await save(page);
  await expect(
    page.getByRole("heading", { name: "New Synthetic Branch", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("combobox", { name: "Company", exact: true }),
  ).toHaveValue(
    (await data(page)).entities.filter((e) => e.kind === "company").at(-1)!.id,
  );
});

test("inventory, supplier, procurement and expense forms write linked records; reports export scoped CSV", async ({
  page,
}) => {
  await open(page, "inventory", "part");
  await page.getByRole("button", { name: "Create part", exact: true }).click();
  let dialog = page.getByRole("dialog");
  for (const [label, value] of Object.entries({
    Name: "Prototype test part",
    SKU: "DEMO-NEW-PART",
    "Standard unit cost": "20",
    "Minimum stock": "3",
  }))
    await dialog.getByLabel(label, { exact: true }).fill(value);
  await save(page);
  const part = (await data(page)).entities
    .filter((e) => e.kind === "part")
    .at(-1)!;
  await transition(page, "Adjust stock", {
    "Signed quantity adjustment": "5",
    "Adjustment reason": "Synthetic opening count",
  });
  await open(page, "procurement", "supplier");
  await page
    .getByRole("button", { name: "Create supplier", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Name", { exact: true })
    .fill("Prototype synthetic supplier");
  await save(page);
  const supplier = (await data(page)).entities
    .filter((e) => e.kind === "supplier")
    .at(-1)!;
  await open(page, "procurement", "purchaseOrder");
  await page
    .getByRole("button", { name: "Create purchase order", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Supplier", { exact: true })
    .selectOption(supplier.id);
  await dialog.getByLabel("Part", { exact: true }).selectOption(part.id);
  await dialog.getByLabel("Quantity", { exact: true }).fill("4");
  await dialog.getByLabel("Unit cost", { exact: true }).fill("20");
  await save(page);
  await transition(page, "Submit purchase request");
  await transition(page, "Approve order");
  await transition(page, "Receive goods");
  await open(page, "finance", "expense");
  await page
    .getByRole("button", { name: "Create expense", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Description", { exact: true })
    .fill("Synthetic fuel expense");
  await dialog.getByLabel("Amount", { exact: true }).fill("25");
  await save(page);
  await expect(
    page.getByRole("heading", { name: "Synthetic fuel expense", exact: true }),
  ).toBeVisible();
  await open(page, "reports");
  await page
    .getByRole("combobox", { name: "Report", exact: true })
    .selectOption("expenses");
  await expect(page.getByRole("table")).toContainText("Synthetic fuel expense");
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV", exact: true }).click();
  expect((await downloaded).suggestedFilename()).toBe("demo-expenses.csv");
});

test("corrupt persisted data requires an explicit reset and recovers without a backend", async ({
  page,
}) => {
  await open(page);
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open("drivecore-erp-demo-v1", 1);
        req.onsuccess = () => {
          const db = req.result,
            tx = db.transaction("snapshots", "readwrite");
          tx.objectStore("snapshots").put({ version: 999 }, "main");
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () =>
            reject(new Error("Synthetic corruption setup failed"));
        };
      }),
  );
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Demo storage unavailable",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Reset incompatible demo data", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Restore demo data", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
  expect((await data(page)).version).toBe(1);
});
