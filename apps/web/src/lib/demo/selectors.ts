import {
  entities,
  valueOf,
  type Database,
  type DemoContext,
  type Entity,
  type Kind,
} from "./types";
import { inScope, authorizedContext, allowed, kindModule } from "./permissions";
import { invoiceBalance, stock, vehicleStatus } from "./rules";
export function rows<K extends Kind>(db: Database, ctx: DemoContext, kind: K) {
  authorizedContext(db, ctx);
  if (!allowed(db, ctx, kindModule[kind])) return [];
  return entities(db, kind).filter((e) => inScope(db, ctx, e));
}
export function label(e: Entity) {
  for (const key of [
    "name",
    "registration",
    "title",
    "description",
    "reference",
    "sku",
    "action",
  ]) {
    const v = valueOf(e, key);
    if (typeof v === "string" && v) return v;
  }
  return `${e.kind} ${e.id.slice(0, 12)}`;
}
export function displayStatus(db: Database, e: Entity) {
  if (e.kind === "vehicle") return vehicleStatus(db, e);
  if (e.kind === "invoice") {
    if (e.status !== "issued") return e.status;
    const b = invoiceBalance(db, e.id);
    return b.outstanding === 0 ? "paid" : b.paid > 0 ? "partial" : "unpaid";
  }
  if (
    e.kind === "rental" &&
    e.status === "active" &&
    Date.parse(e.endsAt) < Date.now()
  )
    return "overdue";
  if (e.kind === "part")
    return stock(db, e.id) <= e.minimum ? "low stock" : "in stock";
  if ("status" in e) return e.status;
  if ("active" in e) return e.active ? "active" : "inactive";
  if (e.kind === "notification") return e.read ? "read" : "unread";
  return "";
}
export function money(db: Database, companyId: string, minor: number) {
  const currency =
    entities(db, "company").find((c) => c.id === companyId)?.currency ?? "GHC";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}
export interface Range {
  from: string;
  to: string;
}
export function dayKey(value: string | number) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function inRange(date: string, range: Range) {
  return (
    (!range.from || dayKey(date) >= range.from) &&
    (!range.to || dayKey(date) <= range.to)
  );
}
export function summary(db: Database, ctx: DemoContext, range: Range) {
  const vehicles = rows(db, ctx, "vehicle"),
    rentals = rows(db, ctx, "rental"),
    invoices = rows(db, ctx, "invoice"),
    payments = rows(db, ctx, "payment").filter((p) =>
      inRange(p.createdAt, range),
    ),
    refunds = rows(db, ctx, "refund").filter((p) =>
      inRange(p.createdAt, range),
    ),
    expenses = rows(db, ctx, "expense").filter((p) =>
      inRange(p.createdAt, range),
    );
  const active = rentals.filter((r) => r.status === "active"),
    overdue = active.filter((r) => Date.parse(r.endsAt) < Date.now());
  return {
    vehicles,
    active,
    overdue,
    available: vehicles.filter((v) => vehicleStatus(db, v) === "available")
      .length,
    utilization: vehicles.filter((v) => v.condition !== "inactive").length
      ? Math.round(
          (active.length /
            vehicles.filter((v) => v.condition !== "inactive").length) *
            100,
        )
      : 0,
    revenue:
      invoices
        .filter((i) => i.status === "issued" && inRange(i.updatedAt, range))
        .reduce((n, i) => n + i.total, 0) -
      refunds.reduce((n, r) => n + r.amount, 0),
    receipts:
      payments.reduce((n, p) => n + p.amount, 0) -
      refunds.reduce((n, p) => n + p.amount, 0),
    outstanding: invoices.reduce(
      (n, i) => n + invoiceBalance(db, i.id).outstanding,
      0,
    ),
    expenses: expenses.reduce((n, e) => n + e.amount, 0),
    inventory: rows(db, ctx, "part").reduce(
      (n, p) => n + stock(db, p.id) * p.unitCost,
      0,
    ),
  };
}
export interface LedgerRow {
  id: string;
  date: string;
  account: string;
  debit: number;
  credit: number;
  reference: string;
}
export function ledger(db: Database, ctx: DemoContext): LedgerRow[] {
  const result: LedgerRow[] = [];
  const entry = (e: Entity, account: string, debit: number, credit: number) =>
    result.push({
      id: `${e.id}-${result.length}`,
      date:
        e.kind === "invoice" && e.status === "issued"
          ? e.updatedAt
          : e.createdAt,
      account,
      debit,
      credit,
      reference: label(e),
    });
  const pair = (e: Entity, debit: string, credit: string, amount: number) => {
    entry(e, debit, amount, 0);
    entry(e, credit, 0, amount);
  };
  for (const i of rows(db, ctx, "invoice"))
    if (i.status === "issued") {
      if (i.vatAmount > 0 && i.vatAmount <= i.total) {
        entry(i, "Accounts receivable", i.total, 0);
        entry(i, "Rental revenue", 0, i.total - i.vatAmount);
        entry(i, "VAT payable", 0, i.vatAmount);
      } else {
        pair(i, "Accounts receivable", "Rental revenue", i.total);
      }
    }
  for (const p of rows(db, ctx, "payment"))
    pair(p, "Cash / bank", "Accounts receivable", p.amount);
  for (const r of rows(db, ctx, "refund")) {
    pair(r, "Accounts receivable", "Cash / bank", r.amount);
    pair(r, "Sales credits", "Accounts receivable", r.amount);
  }
  for (const e of rows(db, ctx, "expense")) {
    const work = entities(db, "workOrder").find((w) => w.id === e.workOrderId);
    const parts = work?.partsCost ?? 0;
    entry(e, "Expenses", e.amount, 0);
    if (parts) entry(e, "Maintenance work in progress", 0, parts);
    entry(e, "Cash / bank", 0, e.amount - parts);
  }
  for (const m of entities(db, "movement").filter((e) => inScope(db, ctx, e))) {
    const total = Math.abs(m.quantity) * m.unitCost;
    if (m.purchaseOrderId) pair(m, "Inventory", "Supplier payables", total);
    else if (m.workOrderId)
      pair(m, "Maintenance work in progress", "Inventory", total);
    else if (m.quantity >= 0)
      pair(m, "Inventory", "Opening / stock adjustments", total);
    else pair(m, "Opening / stock adjustments", "Inventory", total);
  }
  return result.sort((a, b) => b.date.localeCompare(a.date));
}
export function related(db: Database, ctx: DemoContext, target: Entity) {
  return db.entities.filter(
    (e) =>
      e.id !== target.id &&
      inScope(db, ctx, e) &&
      allowed(db, ctx, kindModule[e.kind]) &&
      Object.entries(e).some(
        ([key, value]) => key.endsWith("Id") && value === target.id,
      ),
  );
}
