"use client";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import type { Database, DemoContext, Entity } from "@/lib/demo/types";
import { allowed } from "@/lib/demo/permissions";
import {
  rows,
  summary,
  label,
  money,
  inRange,
  dayKey,
  ledger,
  type Range,
} from "@/lib/demo/selectors";
import { invoiceBalance, stock } from "@/lib/demo/rules";
import { exportCsv } from "./table";
import { selectClass } from "./form";
import { useDemo } from "./provider";
export function Stat({
  label: caption,
  value,
  note,
}: {
  label: string;
  value: string | number;
  note?: string;
}) {
  return (
    <section className="space-y-2 rounded-card border bg-surface p-card">
      <h2 className="text-label text-muted-foreground">{caption}</h2>
      <p className="text-page-title tabular-nums">{value}</p>
      {note ? <p className="text-label text-muted-foreground">{note}</p> : null}
    </section>
  );
}
function Trend({
  title,
  points,
  currency,
}: {
  title: string;
  points: { label: string; value: number }[];
  currency?: boolean;
}) {
  const max = Math.max(1, ...points.map((p) => Math.abs(p.value)));
  return (
    <section className="min-w-0 space-y-4 rounded-card border bg-surface p-card">
      <h2 className="text-section-heading">{title}</h2>
      <svg
        role="img"
        aria-label={`${title}: ${points.map((p) => `${p.label} ${currency ? (p.value / 100).toFixed(2) : p.value}`).join(", ")}`}
        viewBox="0 0 560 180"
        className="w-full"
      >
        <line x1="24" x2="548" y1="90" y2="90" stroke="var(--border)" />
        {points.map((p, i) => {
          const height = (Math.abs(p.value) / max) * 65;
          return (
            <g key={p.label}>
              <rect
                x={30 + i * 74}
                y={p.value >= 0 ? 90 - height : 90}
                width="44"
                height={height}
                rx="3"
                fill={
                  p.value < 0
                    ? "var(--danger)"
                    : i === points.length - 1
                      ? "var(--primary)"
                      : "var(--muted-foreground)"
                }
              >
                <title>
                  {p.label}: {currency ? (p.value / 100).toFixed(2) : p.value}
                </title>
              </rect>
              <text
                x={52 + i * 74}
                y="168"
                textAnchor="middle"
                fontSize="12"
                fill="var(--muted-foreground)"
              >
                {p.label}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="text-label text-muted-foreground">
        Derived from scoped demo records.{" "}
        {currency
          ? "Cash receipts less refunds; no currency conversion."
          : "Contracts created per day."}
      </p>
    </section>
  );
}
function Queue({
  title,
  records,
  onOpen,
}: {
  title: string;
  records: Entity[];
  onOpen: (e: Entity) => void;
}) {
  return (
    <section className="space-y-3 rounded-card border bg-surface p-card">
      <h2 className="text-section-heading">{title}</h2>
      {!records.length ? (
        <p className="text-sm text-muted-foreground">
          No records in this window.
        </p>
      ) : (
        <ul className="divide-y">
          {records.slice(0, 5).map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between gap-3 py-3"
            >
              <span className="min-w-0 truncate text-sm">{label(e)}</span>
              <Button variant="ghost" size="sm" onClick={() => onOpen(e)}>
                Open
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
export function Overview({
  db,
  ctx,
  range,
  onOpen,
  operational = false,
}: {
  db: Database;
  ctx: DemoContext;
  range: Range;
  onOpen: (e: Entity) => void;
  operational?: boolean;
}) {
  const { now } = useDemo();
  const s = summary(db, ctx, range);
  const departures = rows(db, ctx, "rental").filter(
    (r) =>
      r.status === "draft" &&
      Date.parse(r.endsAt) > now &&
      Date.parse(r.startsAt) < now + 2 * 86400000,
  );
  const returns = s.active.filter(
    (r) =>
      Date.parse(r.endsAt) >= now && Date.parse(r.endsAt) < now + 2 * 86400000,
  );
  const work = rows(db, ctx, "workOrder").filter((w) =>
    ["open", "in_progress"].includes(w.status),
  );
  const days = Array.from({ length: 7 }, (_, i) =>
    dayKey(now - (6 - i) * 86400000),
  );
  const receipts = days.map((date) => ({
    label: date.slice(5),
    value:
      rows(db, ctx, "payment")
        .filter(
          (p) => dayKey(p.createdAt) === date && inRange(p.createdAt, range),
        )
        .reduce((n, p) => n + p.amount, 0) -
      rows(db, ctx, "refund")
        .filter(
          (p) => dayKey(p.createdAt) === date && inRange(p.createdAt, range),
        )
        .reduce((n, p) => n + p.amount, 0),
  }));
  const rentalTrend = days.map((date) => ({
    label: date.slice(5),
    value: rows(db, ctx, "rental").filter(
      (r) => dayKey(r.createdAt) === date && inRange(r.createdAt, range),
    ).length,
  }));
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {allowed(db, ctx, "rentals") ? (
          <>
            <Stat label="Active rentals" value={s.active.length} />
            <Stat
              label="Overdue returns"
              value={s.overdue.length}
              note="Active contracts past expected return"
            />
          </>
        ) : null}
        {allowed(db, ctx, "fleet") ? (
          <>
            <Stat label="Available vehicles" value={s.available} />
            <Stat
              label="Fleet utilization"
              value={`${s.utilization}%`}
              note="Active rentals / non-inactive fleet"
            />
          </>
        ) : null}
        {!operational && allowed(db, ctx, "finance") ? (
          <>
            <Stat
              label="Issued revenue"
              value={money(db, ctx.companyId, s.revenue)}
              note="Issued invoices less sales credits"
            />
            <Stat
              label="Net receipts"
              value={money(db, ctx.companyId, s.receipts)}
            />
            <Stat
              label="Outstanding invoices"
              value={money(db, ctx.companyId, s.outstanding)}
            />
            <Stat
              label="Recorded expenses"
              value={money(db, ctx.companyId, s.expenses)}
            />
          </>
        ) : null}
      </div>
      {!operational ? (
        <div className="grid gap-6 xl:grid-cols-2">
          {allowed(db, ctx, "finance") ? (
            <Trend
              title="Cash receipt trend · last 7 days"
              points={receipts}
              currency
            />
          ) : null}
          {allowed(db, ctx, "rentals") ? (
            <Trend
              title="Rental contract trend · last 7 days"
              points={rentalTrend}
            />
          ) : null}
        </div>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-2">
        {allowed(db, ctx, "rentals") ? (
          <>
            <Queue
              title="Upcoming departures · next 48 hours"
              records={departures}
              onOpen={onOpen}
            />
            <Queue
              title="Expected returns · next 48 hours"
              records={returns}
              onOpen={onOpen}
            />
            <Queue
              title="Overdue returns"
              records={s.overdue}
              onOpen={onOpen}
            />
          </>
        ) : null}
        {allowed(db, ctx, "maintenance") ? (
          <Queue title="Maintenance alerts" records={work} onOpen={onOpen} />
        ) : null}
      </div>
      {!operational && allowed(db, ctx, "administration") ? (
        <Queue
          title="Recent activity"
          records={rows(db, ctx, "audit").sort((a, b) =>
            b.createdAt.localeCompare(a.createdAt),
          )}
          onOpen={onOpen}
        />
      ) : null}
      <p className="text-label text-muted-foreground">
        Date filters apply to revenue, receipts, expenses and trend records.
        Current availability and operational queues reflect the current demo
        state. All business and accounting behavior is a prototype simulation.
      </p>
    </div>
  );
}
const reportTypes = [
  { id: "revenue", label: "Revenue", module: "finance" },
  { id: "rentals", label: "Rental performance", module: "rentals" },
  { id: "utilization", label: "Fleet utilization", module: "fleet" },
  { id: "availability", label: "Vehicle availability", module: "fleet" },
  { id: "customers", label: "Customer activity", module: "customers" },
  { id: "maintenance", label: "Maintenance costs", module: "maintenance" },
  { id: "inventory", label: "Inventory", module: "inventory" },
  { id: "expenses", label: "Expenses", module: "finance" },
  { id: "outstanding", label: "Outstanding invoices", module: "finance" },
] as const;
export function Reports({
  db,
  ctx,
  range,
  selected,
  onSelect,
  ledgerOnly = false,
}: {
  db: Database;
  ctx: DemoContext;
  range: Range;
  selected: string;
  onSelect: (report: string) => void;
  ledgerOnly?: boolean;
}) {
  const reports = reportTypes.filter((r) => allowed(db, ctx, r.module));
  const current = reports.find((r) => r.id === selected) ?? reports[0];
  let headers: string[] = [],
    data: (string | number)[][] = [];
  const name = (id: string) => db.entities.find((e) => e.id === id);
  const m = (n: number) => money(db, ctx.companyId, n);
  if (ledgerOnly) {
    headers = ["Date", "Account", "Debit", "Credit", "Reference"];
    data = ledger(db, ctx)
      .filter((e) => inRange(e.date, range))
      .map((e) => [
        new Date(e.date).toLocaleDateString(),
        e.account,
        m(e.debit),
        m(e.credit),
        e.reference,
      ]);
  } else if (current?.id === "revenue") {
    headers = ["Invoice", "Customer", "Issued total", "Paid", "Outstanding"];
    data = rows(db, ctx, "invoice")
      .filter((i) => i.status === "issued" && inRange(i.updatedAt, range))
      .map((i) => [
        i.description,
        label(name(i.customerId)!),
        m(i.total),
        m(invoiceBalance(db, i.id).paid),
        m(invoiceBalance(db, i.id).outstanding),
      ]);
  } else if (current?.id === "rentals") {
    headers = ["Contract", "Status", "Expected return", "Contract total"];
    data = rows(db, ctx, "rental")
      .filter((r) => inRange(r.createdAt, range))
      .map((r) => [
        label(r),
        r.status,
        new Date(r.endsAt).toLocaleString(),
        m(r.total),
      ]);
  } else if (current?.id === "utilization" || current?.id === "availability") {
    headers = ["Vehicle", "Category", "Status", "Rental days in range"];
    data = rows(db, ctx, "vehicle").map((v) => {
      const days = rows(db, ctx, "rental")
        .filter((r) => r.vehicleId === v.id && r.status !== "cancelled")
        .reduce((n, r) => {
          const start = Math.max(
              Date.parse(r.startsAt),
              range.from
                ? new Date(`${range.from}T00:00:00`).getTime()
                : Date.parse(r.startsAt),
            ),
            end = Math.min(
              Date.parse(r.returnedAt || r.endsAt),
              range.to
                ? new Date(`${range.to}T23:59:59.999`).getTime()
                : Date.parse(r.returnedAt || r.endsAt),
            );
          return n + Math.max(0, (end - start) / 86400000);
        }, 0);
      return [
        v.registration,
        v.category,
        vehicleStatusForReport(db, v),
        days.toFixed(1),
      ];
    });
  } else if (current?.id === "customers") {
    headers = ["Customer", "Type", "Rentals", "Contact"];
    data = rows(db, ctx, "customer").map((c) => [
      c.name,
      c.type,
      rows(db, ctx, "rental").filter(
        (r) => r.customerId === c.id && inRange(r.createdAt, range),
      ).length,
      c.email,
    ]);
  } else if (current?.id === "maintenance") {
    headers = ["Work order", "Status", "Parts", "Labour", "Downtime hours"];
    data = rows(db, ctx, "workOrder")
      .filter((w) => inRange(w.createdAt, range))
      .map((w) => [
        w.title,
        w.status,
        m(w.partsCost),
        m(w.labourCost),
        w.startedAt
          ? Math.max(
              0,
              (Date.parse(w.completedAt || new Date().toISOString()) -
                Date.parse(w.startedAt)) /
                3600000,
            ).toFixed(1)
          : "0",
      ]);
  } else if (current?.id === "inventory") {
    headers = ["Part", "SKU", "Stock", "Minimum", "Standard-cost value"];
    data = rows(db, ctx, "part").map((p) => [
      p.name,
      p.sku,
      stock(db, p.id),
      p.minimum,
      m(stock(db, p.id) * p.unitCost),
    ]);
  } else if (current?.id === "expenses") {
    headers = ["Expense", "Category", "Amount", "Date"];
    data = rows(db, ctx, "expense")
      .filter((e) => inRange(e.createdAt, range))
      .map((e) => [
        e.description,
        e.category,
        m(e.amount),
        new Date(e.createdAt).toLocaleDateString(),
      ]);
  } else if (current?.id === "outstanding") {
    headers = ["Invoice", "Customer", "Due", "Outstanding"];
    data = rows(db, ctx, "invoice")
      .filter(
        (i) =>
          invoiceBalance(db, i.id).outstanding > 0 &&
          inRange(i.createdAt, range),
      )
      .map((i) => [
        i.description,
        label(name(i.customerId)!),
        new Date(i.dueAt).toLocaleDateString(),
        m(invoiceBalance(db, i.id).outstanding),
      ]);
  }
  const s = summary(db, ctx, range);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        {!ledgerOnly ? (
          <label className="w-full max-w-sm space-y-2 text-label">
            Report
            <select
              className={selectClass}
              value={current?.id ?? ""}
              onChange={(e) => onSelect(e.target.value)}
            >
              {reports.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <h2 className="text-section-heading">Demo accounting ledger</h2>
        )}
        <Button
          variant="outline"
          onClick={() =>
            exportCsv(
              ledgerOnly ? "demo-ledger" : `demo-${current?.id}`,
              headers,
              data,
            )
          }
          disabled={!data.length}
        >
          Export CSV
        </Button>
      </div>
      {current?.module === "finance" && !ledgerOnly ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Issued revenue" value={m(s.revenue)} />
          <Stat label="Net receipts" value={m(s.receipts)} />
          <Stat label="Outstanding" value={m(s.outstanding)} />
        </div>
      ) : null}
      <section className="overflow-hidden rounded-card border bg-surface">
        <Table>
          <TableHeader>
            <TableRow>
              {headers.map((h) => (
                <TableHead key={h}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, i) => (
              <TableRow key={i}>
                {row.map((c, j) => (
                  <TableCell key={j}>{c}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!data.length ? (
          <p className="p-card text-sm text-muted-foreground">
            No records match this report and date range.
          </p>
        ) : null}
      </section>
      <p className="text-label text-muted-foreground">
        Local synthetic records only. Historical utilization uses allocated
        contract days, not telematics. Inventory is current standard-cost
        valuation; date filters apply to dated transactions. This ledger is a
        balanced demonstration, not certified accounting or tax advice.
      </p>
    </div>
  );
}
import { vehicleStatus as vehicleStatusForReport } from "@/lib/demo/rules";
