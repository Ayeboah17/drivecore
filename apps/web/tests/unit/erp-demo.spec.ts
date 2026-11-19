import { test, expect } from "@playwright/test";
import { createSeed } from "../../src/lib/demo/seed";
import {
  applyCommand,
  assertAvailable,
  rentalPrice,
  stock,
  invoiceBalance,
  vehicleStatus,
  day,
} from "../../src/lib/demo/rules";
import {
  entities,
  find,
  type Database,
  type DemoContext,
  type Command,
  type Kind,
} from "../../src/lib/demo/types";
import {
  allowed,
  scoped,
  companyOptions,
} from "../../src/lib/demo/permissions";
import { summary, ledger, rows } from "../../src/lib/demo/selectors";
import { MemoryDemoRepository } from "../../src/lib/demo/repository";
const now = "2026-11-15T10:00:00.000Z";
const admin: DemoContext = {
  userId: "user-platform",
  companyId: "co-1",
  branchId: "br-1",
};
const later = (days: number) =>
  new Date(Date.parse(now) + days * day).toISOString();
const run = (db: Database, command: Command, ctx = admin, at = now) =>
  applyCommand(db, ctx, command, at);
const action = (
  db: Database,
  id: string,
  action: Extract<Command, { type: "action" }>["action"],
  values: Record<string, string> = {},
  ctx = admin,
  at = now,
) => run(db, { type: "action", id, action, values }, ctx, at);
function newest<K extends Kind>(db: Database, kind: K) {
  return entities(db, kind).at(-1)!;
}

test("seed has unique IDs, valid ownership and references, coherent totals and every fleet state", () => {
  const db = createSeed(new Date(now));
  expect(new Set(db.entities.map((e) => e.id)).size).toBe(db.entities.length);
  for (const e of db.entities) {
    for (const [key, value] of Object.entries(e))
      if (key.endsWith("Id") && typeof value === "string" && value)
        expect(
          db.entities.some((other) => other.id === value),
          `${e.kind}.${key}=${value}`,
        ).toBe(true);
  }
  expect(entities(db, "customer").length).toBe(36);
  expect(entities(db, "vehicle").length).toBe(32);
  for (const p of entities(db, "part"))
    expect(stock(db, p.id)).toBeGreaterThanOrEqual(0);
  for (const r of entities(db, "reservation")) {
    expect(r.subtotal).toBe(rentalPrice(r.startsAt, r.endsAt, r.dailyRate));
    expect(r.total).toBe(r.subtotal - r.discountAmount + r.vatAmount);
  }
  for (const q of entities(db, "quotation")) {
    expect(q.subtotal).toBe(rentalPrice(q.startsAt, q.endsAt, q.dailyRate));
    expect(q.total).toBe(q.subtotal - q.discountAmount + q.vatAmount);
  }
  expect(
    new Set(
      entities(db, "vehicle").map((v) => vehicleStatus(db, v, Date.parse(now))),
    ),
  ).toEqual(
    new Set([
      "available",
      "reserved",
      "rented",
      "maintenance",
      "damaged",
      "inactive",
    ]),
  );
  const entries = ledger(db, admin);
  expect(entries.reduce((n, e) => n + e.debit - e.credit, 0)).toBe(0);
});
test("price uses started 24-hour blocks, integer minor units and validates periods", () => {
  expect(rentalPrice(now, later(1), 45000)).toBe(45000);
  expect(rentalPrice(now, later(1.01), 45000)).toBe(90000);
  expect(() => rentalPrice(later(1), now, 45000)).toThrow();
  expect(() => rentalPrice("invalid", now, 45000)).toThrow();
});
test("repository CRUD persists mutations, rejects linked deletes and resets to a fresh seed", async () => {
  const repo = new MemoryDemoRepository(createSeed(new Date(now)));
  let db = await repo.execute(admin, {
    type: "save",
    kind: "customer",
    values: {
      branchId: "br-1",
      name: "Synthetic New Customer",
      type: "individual",
      email: "new@example.test",
      phone: "",
      address: "",
      active: "true",
    },
  });
  const customer = newest(db, "customer");
  expect((await repo.load()).entities.some((e) => e.id === customer.id)).toBe(
    true,
  );
  db = await repo.execute(admin, {
    type: "save",
    kind: "customer",
    id: customer.id,
    values: {
      name: "Changed Synthetic",
      type: "corporate",
      email: "",
      phone: "",
      address: "",
      active: "true",
      branchId: "br-2",
      companyId: "co-2",
    },
  });
  expect(find(db, "customer", customer.id)).toMatchObject({
    name: "Changed Synthetic",
    companyId: "co-1",
    branchId: "br-1",
  });
  db = await repo.execute(admin, { type: "delete", id: customer.id });
  expect(db.entities.some((e) => e.id === customer.id)).toBe(false);
  await expect(
    repo.execute(admin, { type: "delete", id: "customer-1-0" }),
  ).rejects.toThrow("linked");
  db = await repo.reset();
  expect(entities(db, "customer")).toHaveLength(36);
  expect(db.revision).toBe(0);
});
test("quotation through return, extension, invoice, payment and refund changes all related records", () => {
  let db = createSeed(new Date(now));
  db = run(db, {
    type: "save",
    kind: "quotation",
    values: {
      branchId: "br-1",
      customerId: "customer-1-3",
      vehicleId: "vehicle-1-2",
      startsAt: now,
      endsAt: later(2),
    },
  });
  const quote = newest(db, "quotation");
  expect(quote.subtotal).toBe(120000);
  expect(quote.vatAmount).toBe(18000);
  expect(quote.total).toBe(138000);
  db = action(db, quote.id, "convert");
  const reservation = newest(db, "reservation");
  db = action(db, reservation.id, "confirm");
  db = action(db, reservation.id, "contract");
  const rental = newest(db, "rental");
  expect(newest(db, "invoice").total).toBe(rental.total);
  db = action(db, rental.id, "handover", {
    odometer: "21900",
    notes: "Synthetic handover checked",
    condition: "Checked",
  });
  expect(vehicleStatus(db, find(db, "vehicle", "vehicle-1-2"))).toBe("rented");
  db = action(db, rental.id, "extend", { endsAt: later(3) });
  expect(find(db, "rental", rental.id).total).toBe(207000);
  db = action(
    db,
    rental.id,
    "return",
    {
      odometer: "22000",
      notes: "Synthetic return checked",
      condition: "available",
      additionalCharge: "25",
    },
    admin,
    later(4),
  );
  expect(find(db, "rental", rental.id)).toMatchObject({
    status: "completed",
    subtotal: 242500,
    vatAmount: 36375,
    total: 278875,
    returnOdometer: 22000,
  });
  expect(find(db, "reservation", reservation.id).status).toBe("completed");
  expect(find(db, "vehicle", "vehicle-1-2").odometer).toBe(22000);
  expect(
    entities(db, "inspection").filter((i) => i.rentalId === rental.id),
  ).toHaveLength(2);
  const invoice = newest(db, "invoice");
  expect(invoice.total).toBe(278875);
  db = action(db, invoice.id, "issue");
  expect(invoiceBalance(db, invoice.id).outstanding).toBe(278875);
  db = action(db, invoice.id, "pay", {
    amount: "2788.75",
    method: "Transfer",
    reference: "DEMO-PAID",
  });
  expect(invoiceBalance(db, invoice.id).outstanding).toBe(0);
  db = action(db, invoice.id, "refund", {
    amount: "28.75",
    reason: "Synthetic agreed credit",
  });
  expect(invoiceBalance(db, invoice.id)).toEqual({
    total: 276000,
    paid: 276000,
    credits: 2875,
    outstanding: 0,
  });
  const entries = ledger(db, admin);
  expect(entries.reduce((n, e) => n + e.debit - e.credit, 0)).toBe(0);
});
test("allocation conflicts, rented/maintenance restrictions and extension collisions are enforced centrally", () => {
  let db = createSeed(new Date(now));
  expect(() => assertAvailable(db, "vehicle-1-4", later(2), later(4))).toThrow(
    "overlapping",
  );
  expect(() =>
    assertAvailable(db, "vehicle-1-4", later(3), later(4)),
  ).not.toThrow();
  expect(() => assertAvailable(db, "vehicle-1-0", later(5), later(6))).toThrow(
    "currently rented",
  );
  expect(() => assertAvailable(db, "vehicle-1-5", later(5), later(6))).toThrow(
    "not available",
  );
  db = run(db, {
    type: "save",
    kind: "reservation",
    values: {
      branchId: "br-1",
      customerId: "customer-1-3",
      vehicleId: "vehicle-1-0",
      startsAt: later(3),
      endsAt: later(5),
    },
  });
  const future = newest(db, "reservation");
  expect(() => action(db, future.id, "confirm")).toThrow("currently rented");
  // A return releases the active allocation; a future booking then blocks extension.
  const returned = action(db, "rental-1-0", "return", {
    odometer: "15100",
    notes: "Checked",
    condition: "available",
    additionalCharge: "0",
  });
  expect(() => action(returned, future.id, "confirm")).not.toThrow();
});
test("cancellations release allocations and reject duplicate or active cancellation", () => {
  let db = createSeed(new Date(now));
  db = action(db, "reservation-1-4", "cancel");
  expect(find(db, "reservation", "reservation-1-4").status).toBe("cancelled");
  expect(() => action(db, "reservation-1-4", "cancel")).toThrow();
  expect(() => action(db, "rental-1-0", "cancel")).toThrow("must be returned");
  db = action(db, "rental-1-3", "cancel");
  expect(find(db, "reservation", "reservation-1-3").status).toBe("cancelled");
});
test("maintenance consumption changes stock, costs, availability and expenses atomically", () => {
  let db = createSeed(new Date(now));
  const before = stock(db, "part-1-2");
  db = action(db, "work-1-1", "start");
  expect(find(db, "vehicle", "vehicle-1-6").condition).toBe("maintenance");
  expect(() =>
    action(db, "work-1-1", "consume", {
      partId: "part-1-2",
      quantity: String(before + 1),
    }),
  ).toThrow("Insufficient");
  expect(stock(db, "part-1-2")).toBe(before);
  db = action(db, "work-1-1", "consume", { partId: "part-1-2", quantity: "1" });
  expect(stock(db, "part-1-2")).toBe(before - 1);
  db = action(db, "work-1-1", "complete");
  expect(find(db, "vehicle", "vehicle-1-6").condition).toBe("available");
  expect(newest(db, "expense").amount).toBe(61500);
  expect(() => action(db, "work-1-1", "complete")).toThrow();
  expect(ledger(db, admin).reduce((n, e) => n + e.debit - e.credit, 0)).toBe(0);
});
test("purchase request, approval and receiving update stock once and enforce approval capability", () => {
  let db = createSeed(new Date(now));
  const before = stock(db, "part-1-1");
  db = action(db, "purchase-1-0", "submit");
  expect(() =>
    action(
      db,
      "purchase-1-0",
      "approve",
      {},
      { ...admin, userId: "user-fleet" },
    ),
  ).toThrow("Approval");
  db = action(db, "purchase-1-0", "approve");
  db = action(db, "purchase-1-0", "receive");
  expect(stock(db, "part-1-1")).toBe(before + 10);
  expect(() => action(db, "purchase-1-0", "receive")).toThrow();
});
test("payments cannot overpay, refunds cannot exceed receipts, and posting retains audit history", () => {
  const db = createSeed(new Date(now));
  const balance = invoiceBalance(db, "invoice-1-0").outstanding;
  expect(() =>
    action(db, "invoice-1-0", "pay", {
      amount: String((balance + 1) / 100),
      reference: "TEST",
      method: "Card",
    }),
  ).toThrow("outstanding");
  expect(() =>
    action(db, "invoice-1-1", "refund", { amount: "1", reason: "Test" }),
  ).toThrow("net recorded");
  expect(() =>
    run(db, { type: "save", kind: "invoice", id: "invoice-1-0", values: {} }),
  ).toThrow("immutable");
});
test("capabilities, account state and company/branch scope are enforced beyond navigation", () => {
  const db = createSeed(new Date(now)),
    viewer = { ...admin, userId: "user-viewer" };
  expect(allowed(db, viewer, "fleet")).toBe(true);
  expect(allowed(db, viewer, "fleet", true)).toBe(false);
  expect(() => action(db, "purchase-1-0", "submit", {}, viewer)).toThrow(
    "cannot perform",
  );
  expect(() =>
    scoped(
      db,
      { ...admin, userId: "user-branch-manager", branchId: "br-2" },
      "vehicle",
    ),
  ).toThrow("branch");
  expect(
    rows(
      db,
      { ...admin, userId: "user-branch-manager", branchId: "all" },
      "vehicle",
    ).every((v) => v.branchId === "br-1"),
  ).toBe(true);
  expect(() =>
    run(
      db,
      {
        type: "save",
        kind: "company",
        values: { name: "Unauthorized", currency: "GHC" },
      },
      { ...admin, userId: "user-company-admin" },
    ),
  ).toThrow("platform");
  expect(companyOptions(db, "user-platform")).toHaveLength(2);
  expect(companyOptions(db, "user-operations")).toHaveLength(1);
  expect(() => action(db, "purchase-3-0", "submit")).toThrow("workspace");
  const stats = summary(db, admin, { from: "", to: "" });
  expect(
    stats.active.every((r) => r.companyId === "co-1" && r.branchId === "br-1"),
  ).toBe(true);
});
test("aborted repository requests apply no mutation", async () => {
  const repo = new MemoryDemoRepository(createSeed(new Date(now)), 50),
    controller = new AbortController();
  const promise = repo.execute(
    admin,
    { type: "action", id: "reservation-1-4", action: "cancel", values: {} },
    controller.signal,
  );
  controller.abort();
  await expect(promise).rejects.toMatchObject({ name: "AbortError" });
  expect(find(await repo.load(), "reservation", "reservation-1-4").status).toBe(
    "confirmed",
  );
});

test("an existing future reservation blocks an active contract extension", () => {
  let db = createSeed(new Date(now));
  db = run(db, {
    type: "save",
    kind: "reservation",
    values: {
      branchId: "br-1",
      customerId: "customer-1-3",
      vehicleId: "vehicle-1-2",
      startsAt: later(3),
      endsAt: later(5),
    },
  });
  const future = newest(db, "reservation");
  db = action(db, future.id, "confirm");
  db = run(db, {
    type: "save",
    kind: "reservation",
    values: {
      branchId: "br-1",
      customerId: "customer-1-4",
      vehicleId: "vehicle-1-2",
      startsAt: now,
      endsAt: later(2),
    },
  });
  const current = newest(db, "reservation");
  db = action(db, current.id, "confirm");
  db = action(db, current.id, "contract");
  const rental = newest(db, "rental");
  db = action(db, rental.id, "handover", {
    odometer: "21900",
    notes: "Checked",
    condition: "Checked",
  });
  expect(() => action(db, rental.id, "extend", { endsAt: later(4) })).toThrow(
    "overlapping",
  );
  expect(find(db, "rental", rental.id).endsAt).toBe(later(2));
});
test("currencies cannot relabel existing transactions, settings are validated, global roles require platform capability", () => {
  const db = createSeed(new Date(now));
  expect(() =>
    run(db, {
      type: "save",
      kind: "company",
      id: "co-1",
      values: { name: "Aster", currency: "USD" },
    }),
  ).toThrow("Currency cannot change");
  expect(() =>
    run(db, {
      type: "save",
      kind: "setting",
      id: "setting-rows-co-1",
      values: { name: "Rows per page", value: "17" },
    }),
  ).toThrow("Rows per page");
  const changed = run(db, {
    type: "save",
    kind: "setting",
    id: "setting-rows-co-1",
    values: { name: "Rows per page", value: "25" },
  });
  expect(find(changed, "setting", "setting-rows-co-1").value).toBe("25");
  expect(() =>
    run(
      db,
      {
        type: "save",
        kind: "role",
        id: "role-viewer",
        values: { name: "Viewer", permissions: "*" },
      },
      { ...admin, userId: "user-company-admin" },
    ),
  ).toThrow("platform");
});
test("changing role capabilities changes command authorization without consulting role names", () => {
  let db = createSeed(new Date(now));
  db = run(db, {
    type: "save",
    kind: "role",
    id: "role-operations",
    values: {
      name: "Still named operations",
      permissions: "dashboard.read,customers.read",
    },
  });
  const ctx = { ...admin, userId: "user-operations" };
  expect(allowed(db, ctx, "customers")).toBe(true);
  expect(allowed(db, ctx, "customers", true)).toBe(false);
  expect(() =>
    run(
      db,
      {
        type: "save",
        kind: "customer",
        values: {
          branchId: "br-1",
          name: "Should fail",
          type: "individual",
          email: "",
          phone: "",
          address: "",
          active: "true",
        },
      },
      ctx,
    ),
  ).toThrow("cannot perform");
});
test("documents retain linked masters and routine inspections preserve odometer integrity", () => {
  let db = createSeed(new Date(now));
  expect(() => run(db, { type: "delete", id: "customer-1-0" })).toThrow(
    "linked",
  );
  expect(() =>
    run(db, {
      type: "save",
      kind: "inspection",
      values: {
        branchId: "br-1",
        vehicleId: "vehicle-1-2",
        odometer: "1",
        condition: "Checked",
        notes: "Synthetic",
      },
    }),
  ).toThrow("odometer");
  db = run(db, {
    type: "save",
    kind: "inspection",
    values: {
      branchId: "br-1",
      vehicleId: "vehicle-1-2",
      odometer: "22000",
      condition: "Checked",
      notes: "Synthetic",
    },
  });
  expect(find(db, "vehicle", "vehicle-1-2").odometer).toBe(22000);
});

test("multi-vehicle quotes, discount threshold approval, VAT, vehicle functions, driver role and messages", () => {
  let db = createSeed(new Date(now));
  const beforeResCount = entities(db, "reservation").length;
  expect(entities(db, "role").some((r) => r.id === "role-driver")).toBe(true);

  db = run(db, {
    type: "save",
    kind: "vehicle",
    values: {
      branchId: "br-1",
      registration: "DEMO-FN-99",
      make: "Aster",
      model: "Tourer",
      category: "SUV",
      year: "2025",
      dailyRate: "500",
      odometer: "1200",
      condition: "available",
      ownership: "owned",
      seats: "7",
      fuel: "Hybrid",
      functions: "GPS Tracker,Automatic,4x4 / AWD",
    },
  });
  const createdVeh = newest(db, "vehicle");
  expect(createdVeh.functions).toEqual([
    "GPS Tracker",
    "Automatic",
    "4x4 / AWD",
  ]);

  db = run(
    db,
    {
      type: "save",
      kind: "quotation",
      values: {
        branchId: "br-1",
        customerId: "customer-1-3",
        vehicleIds: `vehicle-1-2,${createdVeh.id}`,
        startsAt: later(1),
        endsAt: later(3),
        discountPct: "20",
      },
    },
    { ...admin, userId: "user-operations" },
  );
  const quote = newest(db, "quotation");
  expect(quote.status).toBe("pending_approval");
  expect(quote.discountStatus).toBe("pending");
  expect(quote.vehicleIds).toEqual(["vehicle-1-2", createdVeh.id]);
  expect(quote.subtotal).toBe(220000);
  expect(quote.discountAmount).toBe(44000);
  expect(quote.vatAmount).toBe(26400);
  expect(quote.total).toBe(202400);

  expect(() =>
    action(db, quote.id, "convert", {}, { ...admin, userId: "user-operations" }),
  ).toThrow("Discount approval is required");
  expect(() =>
    action(
      db,
      quote.id,
      "approve_discount",
      {},
      { ...admin, userId: "user-operations" },
    ),
  ).toThrow("administrator or finance");

  db = action(
    db,
    quote.id,
    "approve_discount",
    {},
    { ...admin, userId: "user-finance" },
  );
  expect(find(db, "quotation", quote.id).status).toBe("draft");
  db = action(db, quote.id, "convert");
  expect(entities(db, "reservation")).toHaveLength(beforeResCount + 2);

  db = run(
    db,
    {
      type: "save",
      kind: "message",
      values: {
        branchId: "br-1",
        channel: "drivers",
        body: "Deliver DEMO-FN-99 to Airport Bay 1.",
        relatedEntityId: createdVeh.id,
      },
    },
    { ...admin, userId: "user-driver" },
  );
  const msg = newest(db, "message");
  expect(msg.senderId).toBe("user-driver");
  expect(msg.channel).toBe("drivers");
  db = action(db, msg.id, "read", {}, { ...admin, userId: "user-operations" });
  expect(find(db, "message", msg.id).readBy).toContain("user-operations");
});
