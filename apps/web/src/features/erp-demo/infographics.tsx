"use client";

import { motion } from "motion/react";
import { Activity, ShieldAlert, TrendingUp } from "lucide-react";
import { allowed } from "@/lib/demo/permissions";
import { money, rows, summary, type Range } from "@/lib/demo/selectors";
import { vehicleStatus } from "@/lib/demo/rules";
import type { Database, DemoContext } from "@/lib/demo/types";

/** Visual KPI infographics band rendered directly beneath the Dashboard KPI grid. */
export function KpiInfographicsBand({
  db,
  ctx,
  range,
}: {
  db: Database;
  ctx: DemoContext;
  range: Range;
}) {
  const s = summary(db, ctx, range);
  const canFinance = allowed(db, ctx, "finance");
  const canRentals = allowed(db, ctx, "rentals");
  const quotes = canRentals ? rows(db, ctx, "quotation") : [];
  const reservations = canRentals ? rows(db, ctx, "reservation") : [];
  const rentals = canRentals ? rows(db, ctx, "rental") : [];
  const invoices = canFinance ? rows(db, ctx, "invoice") : [];

  const totalVehicles = Math.max(1, s.vehicles.length);
  const onRental = s.active.length;
  const available = s.available;
  const workshop = s.vehicles.filter((v) =>
    ["maintenance", "damaged"].includes(vehicleStatus(db, v)),
  ).length;
  const other = Math.max(0, s.vehicles.length - onRental - available - workshop);

  const circumference = 251.3; // r = 40 -> 2 * pi * 40
  const segRental = (onRental / totalVehicles) * circumference;
  const segAvailable = (available / totalVehicles) * circumference;
  const segWorkshop = (workshop / totalVehicles) * circumference;

  const totalVat = invoices
    .filter((i) => i.status === "issued")
    .reduce((sum, i) => sum + i.vatAmount, 0);
  const netPos = Math.max(0, s.revenue - s.expenses);
  const maxMoney = Math.max(1, s.revenue, s.expenses, totalVat, netPos);

  const pendingApprovals = quotes.filter(
    (q) => q.status === "pending_approval",
  ).length;
  const funnelMax = Math.max(
    1,
    quotes.length,
    reservations.length,
    rentals.length,
    invoices.length,
  );

  return (
    <section
      aria-label="KPI infographics"
      className="grid gap-5 lg:grid-cols-3"
    >
      {/* Infographic 1: Fleet Operational Donut */}
      <article className="dc-shadow-card flex flex-col justify-between space-y-4 rounded-2xl border bg-surface p-card">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Fleet Composition
            </p>
            <h3 className="text-section-heading">Asset Readiness Split</h3>
          </div>
          <span className="flex size-8 items-center justify-center rounded-xl border bg-muted text-muted-foreground">
            <Activity className="size-4" aria-hidden="true" />
          </span>
        </div>

        <div className="flex items-center gap-5">
          <svg
            viewBox="0 0 110 110"
            className="size-28 shrink-0"
            role="img"
            aria-label={`Fleet split: ${available} available, ${onRental} on rental, ${workshop} in workshop`}
          >
            <circle
              cx="55"
              cy="55"
              r="40"
              fill="none"
              stroke="var(--border)"
              strokeWidth="12"
            />
            <circle
              cx="55"
              cy="55"
              r="40"
              fill="none"
              stroke="var(--primary)"
              strokeWidth="12"
              strokeDasharray={`${segRental} ${circumference}`}
              transform="rotate(-90 55 55)"
            />
            <circle
              cx="55"
              cy="55"
              r="40"
              fill="none"
              stroke="var(--success)"
              strokeWidth="12"
              strokeDasharray={`${segAvailable} ${circumference}`}
              strokeDashoffset={-segRental}
              transform="rotate(-90 55 55)"
            />
            <circle
              cx="55"
              cy="55"
              r="40"
              fill="none"
              stroke="var(--warning)"
              strokeWidth="12"
              strokeDasharray={`${segWorkshop} ${circumference}`}
              strokeDashoffset={-(segRental + segAvailable)}
              transform="rotate(-90 55 55)"
            />
            <text
              x="55"
              y="52"
              textAnchor="middle"
              className="fill-foreground font-mono text-sm font-extrabold"
            >
              {s.utilization}%
            </text>
            <text
              x="55"
              y="66"
              textAnchor="middle"
              className="fill-muted-foreground text-[9px] font-semibold"
            >
              UTILIZED
            </text>
          </svg>

          <dl className="min-w-0 flex-1 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <dt className="flex items-center gap-1.5 text-muted-foreground">
                <span className="size-2.5 rounded-full bg-primary" />
                On rental
              </dt>
              <dd className="font-mono font-bold tabular-nums">{onRental}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="flex items-center gap-1.5 text-muted-foreground">
                <span className="size-2.5 rounded-full bg-success" />
                Available
              </dt>
              <dd className="font-mono font-bold tabular-nums">{available}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="flex items-center gap-1.5 text-muted-foreground">
                <span className="size-2.5 rounded-full bg-warning" />
                Workshop
              </dt>
              <dd className="font-mono font-bold tabular-nums">{workshop}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="flex items-center gap-1.5 text-muted-foreground">
                <span className="size-2.5 rounded-full bg-border" />
                Other / Reserved
              </dt>
              <dd className="font-mono font-bold tabular-nums">{other}</dd>
            </div>
          </dl>
        </div>
      </article>

      {/* Infographic 2: Financial & VAT Comparison */}
      <article className="dc-shadow-card flex flex-col justify-between space-y-4 rounded-2xl border bg-surface p-card">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Financial Mix
            </p>
            <h3 className="text-section-heading">Revenue, VAT & Costs</h3>
          </div>
          <span className="flex size-8 items-center justify-center rounded-xl border bg-muted text-muted-foreground">
            <TrendingUp className="size-4" aria-hidden="true" />
          </span>
        </div>

        {canFinance ? (
          <div className="space-y-3">
            {[
              {
                label: "Issued Revenue (incl. VAT)",
                value: s.revenue,
                color: "bg-structural",
              },
              {
                label: "VAT Payable (15%)",
                value: totalVat,
                color: "bg-warning",
              },
              {
                label: "Operating Expenses",
                value: s.expenses,
                color: "bg-primary",
              },
              {
                label: "Net Operating Surplus",
                value: netPos,
                color: "bg-success",
              },
            ].map((bar) => (
              <div key={bar.label} className="space-y-1 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{bar.label}</span>
                  <span className="font-mono font-bold tabular-nums">
                    {money(db, ctx.companyId, bar.value)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: `${Math.max(4, Math.round((bar.value / maxMoney) * 100))}%`,
                    }}
                    transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
                    className={`h-full rounded-full ${bar.color}`}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed p-4 text-xs text-muted-foreground">
            Financial revenue and VAT totals are restricted for the active demo
            role.
          </p>
        )}
      </article>

      {/* Infographic 3: Quote-to-Cash Funnel & Discount Governance */}
      <article className="dc-shadow-card flex flex-col justify-between space-y-4 rounded-2xl border bg-surface p-card">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Pipeline Velocity
            </p>
            <h3 className="text-section-heading">Quote-to-Cash Funnel</h3>
          </div>
          {pendingApprovals > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-warning bg-warning/10 px-2 py-0.5 font-mono text-[10px] font-bold text-warning-foreground">
              <ShieldAlert className="size-3" aria-hidden="true" />
              {pendingApprovals} discount pending
            </span>
          ) : null}
        </div>

        <div className="space-y-2.5 text-xs">
          {[
            { name: "Quotations", count: quotes.length },
            { name: "Reservations", count: reservations.length },
            { name: "Rental Contracts", count: rentals.length },
            { name: "Invoices", count: invoices.length },
          ].map((step, i) => (
            <div key={step.name} className="space-y-1">
              <div className="flex justify-between">
                <span className="font-medium text-foreground">{step.name}</span>
                <span className="font-mono font-bold tabular-nums">
                  {step.count}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  style={{
                    width: `${Math.max(8, Math.round((step.count / funnelMax) * 100))}%`,
                  }}
                  className={`h-full rounded-full ${
                    i === 0
                      ? "bg-structural"
                      : i === 1
                        ? "bg-muted-foreground"
                        : i === 2
                          ? "bg-primary"
                          : "bg-success"
                  }`}
                />
              </div>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
