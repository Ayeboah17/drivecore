"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, CarFront, ShieldAlert, TrendingUp } from "lucide-react";
import { useSession } from "@/features/auth/session-provider";
import { useLiveContext } from "@/features/live/context";
import { getDashboardSummary } from "@/features/reports/service";
import { can, formatMoneyMinor, isDriverRole } from "@/lib/api/contracts";
import { DriveCoreDateRangePicker } from "@/components/ui/drivecore-calendar";
import { Skeleton } from "@/components/ui/skeleton";

function localIsoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function defaultLast30Days(): { from: string; to: string } {
  const end = new Date();
  const start = new Date(end.getTime() - 29 * 86_400_000);
  return { from: localIsoDay(start), to: localIsoDay(end) };
}

export function LiveDashboardAnalytics() {
  const { user } = useSession();
  const scope = useLiveContext();
  const [range, setRange] = useState<{ from: string; to: string }>(
    defaultLast30Days,
  );

  const branchId = scope.branch !== "all" ? scope.branch : undefined;
  const from = range.from || undefined;
  const to = range.to || undefined;
  const currency = scope.company?.currency || "ZMW";
  const driverOnly = !!user && isDriverRole(user);
  const canFinance = !!user && can(user, "invoices.view");

  const query = useQuery({
    queryKey: [
      ...scope.key,
      "dashboard",
      "summary",
      branchId ?? "all",
      range.from,
      range.to,
    ],
    queryFn: ({ signal }) =>
      getDashboardSummary(
        { companyId: scope.companyId, branchId, from, to },
        signal,
      ),
    enabled: !!user && !!scope.companyId,
    retry: false,
  });

  // Graceful fallback on pre-PR #13 backends (existing workspace overview cards remain visible)
  if (query.error) return null;

  if (query.isPending || !query.data) {
    return (
      <section aria-label="Loading dashboard metrics" className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      </section>
    );
  }

  const data = query.data;

  if (driverOnly && data.driver_summary) {
    return (
      <section
        aria-label="Driver trip summary"
        className="grid gap-4 sm:grid-cols-2"
      >
        <div className="dc-shadow-card rounded-2xl border bg-surface p-card">
          <p className="text-label text-muted-foreground">Active assigned rentals</p>
          <p className="mt-1 font-mono text-2xl font-extrabold tabular-nums">
            {data.driver_summary.active_rentals}
          </p>
        </div>
        <div className="dc-shadow-card rounded-2xl border bg-surface p-card">
          <p className="text-label text-muted-foreground">Upcoming assigned handovers</p>
          <p className="mt-1 font-mono text-2xl font-extrabold tabular-nums">
            {data.driver_summary.upcoming_rentals}
          </p>
        </div>
      </section>
    );
  }

  const totalVehicles = Math.max(1, data.fleet.total);
  const circumference = 251.3;
  const segRental = (data.fleet.rented / totalVehicles) * circumference;
  const segAvailable = (data.fleet.available / totalVehicles) * circumference;
  const segWorkshop =
    ((data.fleet.maintenance + data.fleet.damaged) / totalVehicles) *
    circumference;

  const maxFunnel = Math.max(
    1,
    data.pipeline.quotations,
    data.pipeline.reservations,
    data.pipeline.active_rentals,
    data.pipeline.issued_invoices,
  );

  const fin = canFinance ? data.finance : null;
  const maxMoney = fin
    ? Math.max(
        1,
        Math.abs(fin.revenue_minor),
        fin.vat_minor,
        fin.expenses_minor,
        Math.abs(fin.net_position_minor),
      )
    : 1;

  return (
    <section aria-label="Live KPI summary and infographics" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Live operational &amp; financial pulse
        </p>
        <DriveCoreDateRangePicker
          from={range.from}
          to={range.to}
          onChange={setRange}
        />
      </div>

      {/* Top KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="dc-shadow-card rounded-2xl border bg-surface p-4">
          <p className="text-label text-muted-foreground">Fleet utilization</p>
          <p className="mt-1 font-mono text-2xl font-extrabold tabular-nums">
            {data.fleet.utilization_pct}%
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {data.fleet.rented} rented · {data.fleet.available} available
          </p>
        </div>
        <div className="dc-shadow-card rounded-2xl border bg-surface p-4">
          <p className="text-label text-muted-foreground">Active rentals</p>
          <p className="mt-1 font-mono text-2xl font-extrabold tabular-nums">
            {data.pipeline.active_rentals}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {data.pipeline.reservations} reservations · {data.pipeline.quotations}{" "}
            quotes
          </p>
        </div>
        {fin ? (
          <>
            <div className="dc-shadow-card rounded-2xl border bg-surface p-4">
              <p className="text-label text-muted-foreground">Period revenue</p>
              <p className="mt-1 font-mono text-xl font-extrabold tabular-nums">
                {formatMoneyMinor(fin.revenue_minor, currency)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Open AR: {formatMoneyMinor(fin.outstanding_ar_minor, currency)}
              </p>
            </div>
            <div className="dc-shadow-card rounded-2xl border bg-surface p-4">
              <p className="text-label text-muted-foreground">Net position</p>
              <p className="mt-1 font-mono text-xl font-extrabold tabular-nums">
                {formatMoneyMinor(fin.net_position_minor, currency)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Expenses: {formatMoneyMinor(fin.expenses_minor, currency)}
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="dc-shadow-card rounded-2xl border bg-surface p-4">
              <p className="text-label text-muted-foreground">Workshop queue</p>
              <p className="mt-1 font-mono text-2xl font-extrabold tabular-nums">
                {data.fleet.maintenance + data.fleet.damaged}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Vehicles in maintenance or damaged
              </p>
            </div>
            <div className="dc-shadow-card rounded-2xl border bg-surface p-4">
              <p className="text-label text-muted-foreground">Low stock SKUs</p>
              <p className="mt-1 font-mono text-2xl font-extrabold tabular-nums">
                {data.approvals.low_stock_parts}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {data.approvals.pending_purchase_orders} POs awaiting approval
              </p>
            </div>
          </>
        )}
      </div>

      {/* 3-Card Infographics Band */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Card 1: Fleet Composition Donut */}
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
              className="size-24 shrink-0"
              role="img"
              aria-label={`Fleet split: ${data.fleet.available} available, ${data.fleet.rented} rented, ${data.fleet.maintenance + data.fleet.damaged} workshop`}
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
            </svg>
            <dl className="flex-1 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Available</dt>
                <dd className="font-mono font-bold tabular-nums">
                  {data.fleet.available}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">On rental</dt>
                <dd className="font-mono font-bold tabular-nums">
                  {data.fleet.rented}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Workshop / Damaged</dt>
                <dd className="font-mono font-bold tabular-nums">
                  {data.fleet.maintenance + data.fleet.damaged}
                </dd>
              </div>
            </dl>
          </div>
        </article>

        {/* Card 2: Revenue / VAT / Expenses OR Action Alerts */}
        {fin ? (
          <article className="dc-shadow-card flex flex-col justify-between space-y-4 rounded-2xl border bg-surface p-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Financial Mix
                </p>
                <h3 className="text-section-heading">
                  Revenue, VAT &amp; Expenses
                </h3>
              </div>
              <span className="flex size-8 items-center justify-center rounded-xl border bg-muted text-muted-foreground">
                <TrendingUp className="size-4" aria-hidden="true" />
              </span>
            </div>
            <div className="space-y-2.5 text-xs">
              {(
                [
                  ["Revenue", fin.revenue_minor, "bg-primary"],
                  ["VAT collected", fin.vat_minor, "bg-link"],
                  ["Expenses", fin.expenses_minor, "bg-warning"],
                ] as const
              ).map(([label, amount, barClass]) => (
                <div key={label} className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-mono font-bold tabular-nums">
                      {formatMoneyMinor(amount, currency)}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${barClass}`}
                      style={{
                        width: `${Math.min(100, Math.round((Math.abs(amount) / maxMoney) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </article>
        ) : (
          <article className="dc-shadow-card flex flex-col justify-between space-y-4 rounded-2xl border bg-surface p-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Attention Queue
                </p>
                <h3 className="text-section-heading">Operational Alerts</h3>
              </div>
              <span className="flex size-8 items-center justify-center rounded-xl border bg-muted text-muted-foreground">
                <ShieldAlert className="size-4" aria-hidden="true" />
              </span>
            </div>
            <ul className="space-y-2 text-xs">
              <li className="flex justify-between">
                <span className="text-muted-foreground">
                  Pending discount approvals
                </span>
                <span className="font-mono font-bold">
                  {data.approvals.pending_discount_quotes}
                </span>
              </li>
              <li className="flex justify-between">
                <span className="text-muted-foreground">
                  Pending PO approvals
                </span>
                <span className="font-mono font-bold">
                  {data.approvals.pending_purchase_orders}
                </span>
              </li>
              <li className="flex justify-between">
                <span className="text-muted-foreground">Low-stock parts</span>
                <span className="font-mono font-bold">
                  {data.approvals.low_stock_parts}
                </span>
              </li>
            </ul>
          </article>
        )}

        {/* Card 3: Quote-to-Cash Funnel */}
        <article className="dc-shadow-card flex flex-col justify-between space-y-4 rounded-2xl border bg-surface p-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Pipeline Funnel
              </p>
              <h3 className="text-section-heading">Quote to Cash</h3>
            </div>
            <span className="flex size-8 items-center justify-center rounded-xl border bg-muted text-muted-foreground">
              <CarFront className="size-4" aria-hidden="true" />
            </span>
          </div>
          <div className="space-y-2 text-xs">
            {(
              [
                ["Quotations", data.pipeline.quotations],
                ["Reservations", data.pipeline.reservations],
                ["Active rentals", data.pipeline.active_rentals],
                ...(canFinance
                  ? ([["Issued invoices", data.pipeline.issued_invoices]] as const)
                  : []),
              ] as const
            ).map(([label, count]) => (
              <div key={label} className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-mono font-bold tabular-nums">{count}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-structural"
                    style={{
                      width: `${Math.min(100, Math.round((count / maxFunnel) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 border-t pt-2.5 text-[11px] text-muted-foreground">
            <Link
              href={`/companies/${scope.companyId}/reports?branch=${encodeURIComponent(scope.branch)}`}
              className="font-semibold text-link hover:underline"
            >
              Open detailed reports →
            </Link>
          </div>
        </article>
      </div>

      {/* SRS §19 Executive Intelligence Band: Credit, Compliance, Operations Alerts, Vehicle Profitability */}
      {data.credit ||
      data.compliance ||
      data.operations_alerts ||
      (canFinance && data.vehicle_profitability?.length) ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {data.credit ? (
            <article className="dc-shadow-card space-y-3 rounded-2xl border bg-surface p-card">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Credit Control
                </p>
                <h3 className="text-section-heading">Credit Exposure</h3>
              </div>
              <dl className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Accounts on hold</dt>
                  <dd className="font-mono font-bold tabular-nums text-danger-foreground">
                    {data.credit.customers_on_hold}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Overdue AR (90+d)</dt>
                  <dd className="font-mono font-bold tabular-nums">
                    {canFinance
                      ? formatMoneyMinor(
                          data.credit.overdue_90_plus_minor,
                          currency,
                        )
                      : "Restricted"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Total receivables</dt>
                  <dd className="font-mono font-bold tabular-nums">
                    {canFinance
                      ? formatMoneyMinor(
                          data.credit.total_receivables_minor,
                          currency,
                        )
                      : "Restricted"}
                  </dd>
                </div>
              </dl>
              <Link
                href={`/companies/${scope.companyId}/finance?tab=credit-control&branch=${encodeURIComponent(scope.branch)}`}
                className="inline-block text-[11px] font-semibold text-link hover:underline"
              >
                Open credit control →
              </Link>
            </article>
          ) : null}

          {data.compliance ? (
            <article className="dc-shadow-card space-y-3 rounded-2xl border bg-surface p-card">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Governance &amp; Safety
                </p>
                <h3 className="text-section-heading">Compliance Expiries</h3>
              </div>
              <dl className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Expired documents</dt>
                  <dd className="font-mono font-bold tabular-nums text-danger-foreground">
                    {data.compliance.expired}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Expiring within 30d</dt>
                  <dd className="font-mono font-bold tabular-nums text-warning-foreground">
                    {data.compliance.expiring_30d}
                  </dd>
                </div>
              </dl>
              <Link
                href={`/companies/${scope.companyId}/operations?tab=compliance&branch=${encodeURIComponent(scope.branch)}`}
                className="inline-block text-[11px] font-semibold text-link hover:underline"
              >
                Open compliance hub →
              </Link>
            </article>
          ) : null}

          {data.operations_alerts ? (
            <article className="dc-shadow-card space-y-3 rounded-2xl border bg-surface p-card">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Workshop &amp; Queue
                </p>
                <h3 className="text-section-heading">Operations Alerts</h3>
              </div>
              <dl className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Pending approvals</dt>
                  <dd className="font-mono font-bold tabular-nums">
                    {data.operations_alerts.pending_approvals}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Overdue returns</dt>
                  <dd className="font-mono font-bold tabular-nums text-warning-foreground">
                    {data.operations_alerts.overdue_returns}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Awaiting inspection</dt>
                  <dd className="font-mono font-bold tabular-nums">
                    {data.operations_alerts.awaiting_inspection}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Accident / repair</dt>
                  <dd className="font-mono font-bold tabular-nums text-danger-foreground">
                    {data.operations_alerts.accident_or_repair}
                  </dd>
                </div>
              </dl>
              <Link
                href={`/companies/${scope.companyId}/operations?tab=approvals&branch=${encodeURIComponent(scope.branch)}`}
                className="inline-block text-[11px] font-semibold text-link hover:underline"
              >
                Review approval queue →
              </Link>
            </article>
          ) : null}

          {canFinance && data.vehicle_profitability?.length ? (
            <article className="dc-shadow-card space-y-3 rounded-2xl border bg-surface p-card">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Asset Economics
                </p>
                <h3 className="text-section-heading">Vehicle Profitability</h3>
              </div>
              <ul className="space-y-1.5 text-xs">
                {data.vehicle_profitability.slice(0, 4).map((vp) => (
                  <li
                    key={vp.vehicle_id}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="truncate font-mono font-semibold">
                      {vp.registration}
                    </span>
                    <span
                      className={`font-mono font-bold tabular-nums ${
                        vp.profit_minor >= 0
                          ? "text-success-foreground"
                          : "text-danger-foreground"
                      }`}
                    >
                      {vp.profit_minor < 0 ? "-" : "+"}
                      {formatMoneyMinor(Math.abs(vp.profit_minor), currency)}
                    </span>
                  </li>
                ))}
              </ul>
              <Link
                href={`/companies/${scope.companyId}/reports?branch=${encodeURIComponent(scope.branch)}`}
                className="inline-block text-[11px] font-semibold text-link hover:underline"
              >
                Full profitability report →
              </Link>
            </article>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
