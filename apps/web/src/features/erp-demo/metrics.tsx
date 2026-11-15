"use client";
import type { Database, DemoContext } from "@/lib/demo/types";
import {
  rows,
  summary,
  money,
  inRange,
  type Range,
} from "@/lib/demo/selectors";
import { allowed } from "@/lib/demo/permissions";
import { stock, vehicleStatus } from "@/lib/demo/rules";
import { Stat } from "./overview";
import { useDemo } from "./provider";
export function ModuleMetrics({
  db,
  ctx,
  view,
  range,
}: {
  db: Database;
  ctx: DemoContext;
  view: string;
  range: Range;
}) {
  const { now } = useDemo();
  const s = summary(db, ctx, range);
  let cards: { label: string; value: string | number; note?: string }[] = [];
  if (view === "fleet")
    cards = [
      { label: "Vehicles", value: s.vehicles.length },
      { label: "Unallocated vehicles", value: s.available },
      {
        label: "Rented",
        value: s.vehicles.filter((v) => vehicleStatus(db, v, now) === "rented")
          .length,
      },
      {
        label: "Maintenance / damaged",
        value: s.vehicles.filter((v) =>
          ["maintenance", "damaged"].includes(vehicleStatus(db, v, now)),
        ).length,
      },
    ];
  if (view === "customers") {
    const customers = rows(db, ctx, "customer");
    cards = [
      { label: "Customer accounts", value: customers.length },
      {
        label: "Businesses",
        value: customers.filter((c) => c.type === "corporate").length,
      },
      {
        label: "Active accounts",
        value: customers.filter((c) => c.active).length,
      },
    ];
    if (allowed(db, ctx, "finance"))
      cards.push({
        label: "Outstanding balances",
        value: money(db, ctx.companyId, s.outstanding),
      });
  }
  if (view === "maintenance") {
    const work = rows(db, ctx, "workOrder");
    cards = [
      {
        label: "Scheduled work",
        value: work.filter((w) => w.status === "open").length,
      },
      {
        label: "Work in progress",
        value: work.filter((w) => w.status === "in_progress").length,
      },
      {
        label: "Completed service cost",
        value: money(
          db,
          ctx.companyId,
          work
            .filter(
              (w) => w.status === "completed" && inRange(w.completedAt, range),
            )
            .reduce((n, w) => n + w.partsCost + w.labourCost, 0),
        ),
      },
      {
        label: "Recorded downtime hours",
        value: work
          .filter((w) => w.startedAt)
          .reduce(
            (n, w) =>
              n +
              Math.max(
                0,
                (Date.parse(w.completedAt || new Date(now).toISOString()) -
                  Date.parse(w.startedAt)) /
                  3600000,
              ),
            0,
          )
          .toFixed(1),
      },
    ];
  }
  if (view === "inventory") {
    const parts = rows(db, ctx, "part");
    cards = [
      { label: "Parts catalogue", value: parts.length },
      {
        label: "Low stock alerts",
        value: parts.filter((p) => stock(db, p.id) <= p.minimum).length,
      },
      {
        label: "Stock units",
        value: parts.reduce((n, p) => n + stock(db, p.id), 0),
      },
      {
        label: "Standard-cost valuation",
        value: money(db, ctx.companyId, s.inventory),
      },
    ];
  }
  if (view === "finance")
    cards = [
      { label: "Issued revenue", value: money(db, ctx.companyId, s.revenue) },
      { label: "Net receipts", value: money(db, ctx.companyId, s.receipts) },
      { label: "Outstanding", value: money(db, ctx.companyId, s.outstanding) },
      {
        label: "Recorded expenses",
        value: money(db, ctx.companyId, s.expenses),
      },
    ];
  if (view === "procurement") {
    const orders = rows(db, ctx, "purchaseOrder");
    cards = [
      {
        label: "Requests awaiting approval",
        value: orders.filter((o) => o.status === "submitted").length,
      },
      {
        label: "Approved, not received",
        value: orders.filter((o) => o.status === "approved").length,
      },
      {
        label: "Received goods value",
        value: money(
          db,
          ctx.companyId,
          orders
            .filter(
              (o) => o.status === "received" && inRange(o.updatedAt, range),
            )
            .reduce((n, o) => n + o.total, 0),
        ),
      },
    ];
  }
  return cards.length ? (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((c) => (
        <Stat key={c.label} {...c} />
      ))}
    </div>
  ) : null;
}
