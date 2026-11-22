"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CalendarRange, Landmark, Receipt, TrendingUp } from "lucide-react";
import { useSession } from "@/features/auth/session-provider";
import { useLiveContext } from "@/features/live/context";
import { getCustomerSummary } from "@/features/stats/service";
import { can, formatMoneyMinor } from "@/lib/api/contracts";
import { Skeleton } from "@/components/ui/skeleton";

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString();
}

export function Customer360Panel({ customerId }: { customerId: string }) {
  const { user } = useSession();
  const scope = useLiveContext();
  const canFinance = !!user && can(user, "invoices.view");
  const currency = scope.company?.currency || "ZMW";
  const suffix = `?branch=${scope.branch}`;

  const query = useQuery({
    queryKey: [...scope.key, "customers", customerId, "summary"],
    queryFn: ({ signal }) => getCustomerSummary(customerId, signal),
    enabled: !!user && !!scope.companyId && !!customerId,
    retry: false,
  });

  // Graceful fallback on pre-PR #14 backends
  if (query.error) return null;

  if (query.isPending || !query.data) {
    return (
      <section aria-label="Loading customer summary" className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: canFinance ? 4 : 2 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      </section>
    );
  }

  const s = query.data;

  return (
    <section
      aria-label="Customer 360 summary"
      className="dc-shadow-card space-y-5 rounded-2xl border bg-surface p-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5">
          <h2 className="flex items-center gap-2 text-base font-bold tracking-tight">
            <TrendingUp className="size-4 text-link" aria-hidden="true" />
            Customer 360 summary
          </h2>
          <p className="text-xs text-muted-foreground">
            Lifetime rental activity{canFinance ? " and financial position" : ""}.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-muted/20 p-3.5">
          <p className="text-xs text-muted-foreground">Rentals</p>
          <p className="mt-1 font-mono text-xl font-extrabold tabular-nums">
            {s.rental_count}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Last rental: {fmtDate(s.last_rental_at)}
          </p>
        </div>

        {canFinance && s.total_spent_minor !== null ? (
          <>
            <div className="rounded-xl border bg-muted/20 p-3.5">
              <p className="text-xs text-muted-foreground">Total spent (net)</p>
              <p className="mt-1 font-mono text-xl font-extrabold tabular-nums text-emerald-700 dark:text-emerald-400">
                {formatMoneyMinor(s.total_spent_minor, currency)}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Payments minus refunds
              </p>
            </div>
            <div className="rounded-xl border bg-muted/20 p-3.5">
              <p className="text-xs text-muted-foreground">Total invoiced</p>
              <p className="mt-1 font-mono text-xl font-extrabold tabular-nums">
                {formatMoneyMinor(s.total_invoiced_minor ?? 0, currency)}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Avg rental:{" "}
                {formatMoneyMinor(s.avg_rental_value_minor ?? 0, currency)}
              </p>
            </div>
            <div className="rounded-xl border bg-muted/20 p-3.5">
              <p className="text-xs text-muted-foreground">Open AR (live)</p>
              <p
                className={`mt-1 font-mono text-xl font-extrabold tabular-nums ${
                  (s.open_ar_minor ?? 0) > 0
                    ? "text-amber-700 dark:text-amber-400"
                    : ""
                }`}
              >
                {formatMoneyMinor(s.open_ar_minor ?? 0, currency)}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Current unpaid balance
              </p>
            </div>
          </>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <CalendarRange className="size-3.5" aria-hidden="true" />
            Recent rentals
          </h3>
          {s.recent_rentals.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No rentals recorded for this customer yet.
            </p>
          ) : (
            <ul className="divide-y rounded-xl border">
              {s.recent_rentals.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-xs"
                >
                  <Link
                    href={`/companies/${scope.companyId}/rentals/${r.id}${suffix}`}
                    className="font-mono font-semibold text-link hover:underline"
                  >
                    Rental #{r.id}
                    {r.vehicle_registration
                      ? ` · ${r.vehicle_registration}`
                      : ""}
                  </Link>
                  <span className="capitalize text-muted-foreground">
                    {r.status} · {fmtDate(r.started_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {canFinance ? (
          <div className="space-y-2">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Landmark className="size-3.5" aria-hidden="true" />
              Recent invoices
            </h3>
            {s.recent_invoices.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No invoices issued for this customer yet.
              </p>
            ) : (
              <ul className="divide-y rounded-xl border">
                {s.recent_invoices.map((inv) => (
                  <li
                    key={inv.id}
                    className="flex items-center justify-between gap-2 px-3 py-2 text-xs"
                  >
                    <Link
                      href={`/companies/${scope.companyId}/finance/invoices/${inv.id}${suffix}`}
                      className="inline-flex items-center gap-1.5 font-mono font-semibold text-link hover:underline"
                    >
                      <Receipt className="size-3" aria-hidden="true" />
                      {inv.invoice_number || `INV-${inv.id}`}
                    </Link>
                    <span className="font-mono tabular-nums text-muted-foreground">
                      {formatMoneyMinor(inv.total_minor, currency)}
                      {inv.outstanding_minor > 0
                        ? ` · Due ${formatMoneyMinor(inv.outstanding_minor, currency)}`
                        : ` · ${inv.status}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
