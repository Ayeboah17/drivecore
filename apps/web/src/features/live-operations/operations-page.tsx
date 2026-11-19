"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CarFront, ClipboardCheck, FileText } from "lucide-react";
import { useSession } from "@/features/auth/session-provider";
import { useLiveContext } from "@/features/live/context";
import { DocumentsDirectory } from "@/features/documents/documents-panel";
import { listRentals } from "@/features/rentals/service";
import { useLiveEntityLookup } from "@/features/rentals/entity-lookup";
import {
  can,
  canAccessOperations,
  isDriverRole,
  type Rental,
} from "@/lib/api/contracts";
import { errorText } from "@/lib/api/client";
import { StatePanel } from "@/components/layout/state-panel";
import { ViewFadeIn } from "@/components/motion/primitives";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

function isOverdue(rental: Rental, resolvedEndsAt?: string | null): boolean {
  const endsAt = resolvedEndsAt ?? rental.ends_at;
  if (rental.status !== "active" || !endsAt) return false;
  const ts = Date.parse(endsAt);
  return !Number.isNaN(ts) && ts < Date.now();
}

function QueueCard({
  title,
  emptyText,
  items,
  companyId,
  branch,
  lookup,
  highlightOverdue = false,
}: {
  title: string;
  emptyText: string;
  items: Rental[];
  companyId: string;
  branch: string;
  lookup: ReturnType<typeof useLiveEntityLookup>;
  highlightOverdue?: boolean;
}) {
  return (
    <section className="dc-shadow-card overflow-hidden rounded-2xl border bg-surface">
      <div className="flex items-center justify-between border-b bg-muted/20 px-5 py-3.5">
        <h2 className="text-section-heading">{title}</h2>
        <span className="rounded-md bg-structural px-2 py-0.5 font-mono text-xs font-bold text-structural-foreground tabular-nums">
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="p-5 text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="divide-y">
          {items.map((rental) => {
            const window = lookup.reservationWindow(rental);
            const overdue = highlightOverdue && isOverdue(rental, window.ends_at);
            const veh = lookup.vehicleDisplay(rental);
            const vehHref = lookup.vehicleHref(rental.vehicle_id);
            const custName = lookup.customerName(rental);
            const custHref = lookup.customerHref(rental);
            const driver = lookup.driverDisplay(rental);
            return (
              <li
                key={rental.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-sm transition-colors hover:bg-muted/35"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {vehHref ? (
                      <Link
                        href={vehHref}
                        title={veh.full}
                        className="group inline-flex min-w-0 items-center gap-2"
                      >
                        <span className="rounded-md bg-structural px-2 py-0.5 font-mono text-xs font-bold text-structural-foreground group-hover:text-link group-hover:underline">
                          {veh.registration}
                        </span>
                        {veh.makeModel ? (
                          <span className="max-w-[12rem] truncate text-xs font-medium text-muted-foreground group-hover:text-link group-hover:underline">
                            {veh.makeModel}
                          </span>
                        ) : null}
                      </Link>
                    ) : (
                      <>
                        <span className="rounded-md bg-structural px-2 py-0.5 font-mono text-xs font-bold text-structural-foreground">
                          {veh.registration}
                        </span>
                        {veh.makeModel ? (
                          <span
                            title={veh.makeModel}
                            className="max-w-[12rem] truncate text-xs font-medium text-muted-foreground"
                          >
                            {veh.makeModel}
                          </span>
                        ) : null}
                      </>
                    )}
                    <span className="font-semibold">
                      Rental #{rental.id}
                    </span>
                    {overdue ? (
                      <Badge
                        variant="outline"
                        className="border-danger text-danger-foreground"
                      >
                        Overdue
                      </Badge>
                    ) : null}
                  </div>
                  <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
                    {custHref ? (
                      <Link
                        href={custHref}
                        title={custName}
                        className="max-w-[14rem] truncate font-medium text-link hover:underline"
                      >
                        {custName}
                      </Link>
                    ) : (
                      <span
                        title={custName}
                        className="max-w-[14rem] truncate"
                      >
                        {custName}
                      </span>
                    )}
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex min-w-0 items-center gap-1">
                      <span>Driver:</span>
                      {driver.href ? (
                        <Link
                          href={driver.href}
                          title={driver.name}
                          className="max-w-[10rem] truncate font-medium text-link hover:underline"
                        >
                          {driver.name}
                        </Link>
                      ) : (
                        <span
                          title={driver.name}
                          className="max-w-[10rem] truncate"
                        >
                          {driver.name}
                        </span>
                      )}
                    </span>
                    {window.ends_at ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>
                          Due {new Date(window.ends_at).toLocaleString()}
                        </span>
                      </>
                    ) : null}
                  </p>
                </div>
                <Link
                  href={`/companies/${companyId}/rentals/${rental.id}?branch=${branch}`}
                  className="shrink-0 text-xs font-semibold text-link hover:underline"
                >
                  Open contract
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function LiveOperationsPage() {
  const { user } = useSession();
  const scope = useLiveContext();
  const searchParams = useSearchParams();

  const driverOnly = !!user && isDriverRole(user);
  const allowed = !!user && canAccessOperations(user);
  const canViewDocs = !!user && can(user, "documents.view");
  const canUploadDocs = !!user && can(user, "documents.manage");
  const canViewDispatch =
    !!user && (can(user, "rentals.view") || driverOnly);

  const requestedTab = searchParams.get("tab") ?? "";
  const activeTab: "dispatch" | "documents" =
    !canViewDispatch && canViewDocs
      ? "documents"
      : requestedTab === "documents" && canViewDocs
        ? "documents"
        : "dispatch";

  const draftRentals = useQuery({
    queryKey: [...scope.key, "operations", "draft-rentals", driverOnly],
    queryFn: ({ signal }) =>
      listRentals(
        {
          companyId: scope.companyId,
          branch: scope.branch,
          status: "draft",
        },
        signal,
      ),
    enabled: allowed && activeTab === "dispatch" && canViewDispatch,
    staleTime: 0,
  });

  const activeRentals = useQuery({
    queryKey: [...scope.key, "operations", "active-rentals", driverOnly],
    queryFn: ({ signal }) =>
      listRentals(
        {
          companyId: scope.companyId,
          branch: scope.branch,
          status: "active",
        },
        signal,
      ),
    enabled: allowed && activeTab === "dispatch" && canViewDispatch,
    staleTime: 0,
  });

  const draftItems = draftRentals.data?.items ?? [];
  const activeItems = activeRentals.data?.items ?? [];
  const allDispatchItems = allowed ? [...draftItems, ...activeItems] : [];
  const lookup = useLiveEntityLookup({
    customerIds: allDispatchItems.map((r) => r.customer_id),
    vehicleIds: allDispatchItems.map((r) => r.vehicle_id),
    reservationIds: allDispatchItems
      .filter((r) => (!r.customer_name && !r.customer_id) || !r.ends_at)
      .map((r) => r.reservation_id),
    driverIds: allDispatchItems.map((r) => r.driver_user_id),
  });

  if (!allowed) {
    return (
      <StatePanel title="Access denied">
        Your account does not have permission to access live dispatch or
        documents.
      </StatePanel>
    );
  }

  function switchTab(next: "dispatch" | "documents") {
    scope.navigate(
      `/companies/${scope.companyId}/operations?tab=${next}&branch=${scope.branch}`,
    );
  }

  const overdueCount = activeItems.filter((item) =>
    isOverdue(item, lookup.reservationWindow(item).ends_at),
  ).length;

  return (
    <ViewFadeIn className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-page-title font-extrabold tracking-tight">
              Operations
            </h1>
            {driverOnly ? (
              <span className="rounded-md bg-structural px-2 py-0.5 font-mono text-[11px] font-semibold uppercase text-structural-foreground">
                Driver dispatch
              </span>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {driverOnly
              ? "Your assigned vehicle handovers and active returns"
              : "Live dispatch desk, overdue return monitoring, and private documents vault"}{" "}
            for {scope.company?.name}.
          </p>
        </div>
      </div>

      {canViewDispatch && canViewDocs ? (
        <div
          role="tablist"
          aria-label="Operations sections"
          className="inline-flex rounded-xl border bg-muted/40 p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "dispatch"}
            onClick={() => switchTab("dispatch")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === "dispatch"
                ? "bg-surface text-foreground shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ClipboardCheck className="size-3.5" aria-hidden="true" />
            Dispatch desk
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "documents"}
            onClick={() => switchTab("documents")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === "documents"
                ? "bg-surface text-foreground shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileText className="size-3.5" aria-hidden="true" />
            Documents
          </button>
        </div>
      ) : null}

      {activeTab === "documents" && canViewDocs ? (
        <DocumentsDirectory canUpload={canUploadDocs} />
      ) : (
        <div className="space-y-6">
          <section
            aria-label="Dispatch summary"
            className="grid gap-4 sm:grid-cols-3"
          >
            <article className="dc-shadow-card rounded-2xl border bg-surface p-card">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <span>Due for handover</span>
                <ClipboardCheck className="size-4 text-link" aria-hidden="true" />
              </div>
              <p className="mt-2 font-mono text-2xl font-extrabold tabular-nums">
                {draftRentals.isPending ? "…" : draftRentals.data?.total ?? 0}
              </p>
            </article>
            <article className="dc-shadow-card rounded-2xl border bg-surface p-card">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <span>Active on rental</span>
                <CarFront className="size-4 text-link" aria-hidden="true" />
              </div>
              <p className="mt-2 font-mono text-2xl font-extrabold tabular-nums">
                {activeRentals.isPending ? "…" : activeRentals.data?.total ?? 0}
              </p>
            </article>
            <article className="dc-shadow-card rounded-2xl border bg-surface p-card">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <span>Overdue returns</span>
                <AlertTriangle
                  className="size-4 text-danger-foreground"
                  aria-hidden="true"
                />
              </div>
              <p className="mt-2 font-mono text-2xl font-extrabold tabular-nums">
                {activeRentals.isPending ? "…" : overdueCount}
              </p>
            </article>
          </section>

          {draftRentals.isPending || activeRentals.isPending ? (
            <div role="status" className="grid gap-6 lg:grid-cols-2">
              <Skeleton className="h-44 rounded-2xl" />
              <Skeleton className="h-44 rounded-2xl" />
            </div>
          ) : draftRentals.error || activeRentals.error ? (
            <StatePanel
              title="Dispatch queues unavailable"
              onRetry={() => {
                void draftRentals.refetch();
                void activeRentals.refetch();
              }}
            >
              {errorText(draftRentals.error ?? activeRentals.error)}
            </StatePanel>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              <QueueCard
                title={
                  driverOnly
                    ? "Your upcoming handovers"
                    : "Pending handovers (draft contracts)"
                }
                emptyText="No draft rentals awaiting handover."
                items={draftItems}
                companyId={scope.companyId}
                branch={scope.branch}
                lookup={lookup}
              />
              <QueueCard
                title={
                  driverOnly
                    ? "Your active returns"
                    : "Active & overdue returns"
                }
                emptyText="No active rentals currently out on dispatch."
                items={activeItems}
                companyId={scope.companyId}
                branch={scope.branch}
                lookup={lookup}
                highlightOverdue
              />
            </div>
          )}
        </div>
      )}
    </ViewFadeIn>
  );
}
