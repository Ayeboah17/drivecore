"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  formatMinorCurrency,
  formatVehicleFunction,
  type Customer,
  type Domain,
  type Vehicle,
} from "@/lib/api/contracts";
import { errorText } from "@/lib/api/client";
import { useLiveContext } from "@/features/live/context";
import {
  DataSearchForm,
  DataTableFrame,
  type ActiveFilterChip,
} from "@/components/data/data-table";
import { StatePanel } from "@/components/layout/state-panel";
import { ViewFadeIn } from "@/components/motion/primitives";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { DriveCoreSelect } from "@/components/ui/drivecore-select";
import { Skeleton } from "@/components/ui/skeleton";
import { VehicleStatus } from "./presentation";
import { listRecords } from "./service";

const CUSTOMER_TYPES = [
  { value: "", label: "All customer types" },
  { value: "individual", label: "Individual" },
  { value: "corporate", label: "Corporate" },
] as const;

const VEHICLE_STATUSES = [
  { value: "", label: "All vehicle statuses" },
  { value: "available", label: "Available" },
  { value: "rented", label: "Rented" },
  { value: "maintenance", label: "Maintenance" },
  { value: "damaged", label: "Damaged" },
] as const;

export function RecordDirectory({
  domain,
  canManage,
}: {
  domain: Domain;
  canManage: boolean;
}) {
  const scope = useLiveContext();
  const searchParams = useSearchParams();
  const isCustomers = domain === "customers";
  const filterParamKey = isCustomers ? "type" : "status";

  const rawQ = (searchParams.get("q") ?? "").slice(0, 100);
  const rawFilter = searchParams.get(filterParamKey) ?? "";
  const allowedFilters = isCustomers
    ? ["individual", "corporate"]
    : ["available", "rented", "maintenance", "damaged"];
  const filter = allowedFilters.includes(rawFilter) ? rawFilter : "";
  const parsedPage = Number(searchParams.get("page") ?? "1");
  const page =
    Number.isInteger(parsedPage) && parsedPage >= 1 && parsedPage <= 1000000
      ? parsedPage
      : 1;

  const base = `/companies/${scope.companyId}/${domain}`;
  const branchSuffix = `?branch=${scope.branch}`;

  function updateQuery(next: {
    q?: string;
    filter?: string;
    page?: number;
  }) {
    const params = new URLSearchParams();
    params.set("branch", scope.branch);
    const nextQ = (next.q !== undefined ? next.q : rawQ).trim().slice(0, 100);
    const nextFilter = next.filter !== undefined ? next.filter : filter;
    const nextPage = next.page !== undefined ? next.page : 1;
    if (nextQ) params.set("q", nextQ);
    if (nextFilter) params.set(filterParamKey, nextFilter);
    if (nextPage > 1) params.set("page", String(nextPage));
    scope.navigate(`${base}?${params.toString()}`);
  }

  const directory = useQuery({
    queryKey: [
      ...scope.key,
      domain,
      "list",
      { q: rawQ.trim(), filter, page },
    ],
    queryFn: ({ signal }) =>
      listRecords(
        domain,
        {
          companyId: scope.companyId,
          branch: scope.branch,
          q: rawQ,
          filter,
          page,
        },
        signal,
      ),
    staleTime: 0,
  });

  const branchName = (branchId: number) =>
    scope.directory?.branches.find((b) => b.id === branchId)?.name ??
    `Branch #${branchId}`;

  const chips: ActiveFilterChip[] = [];
  if (rawQ.trim()) {
    chips.push({
      key: "q",
      label: `Search: ${rawQ.trim()}`,
      onRemove: () => updateQuery({ q: "", page: 1 }),
    });
  }
  if (filter) {
    const label =
      (isCustomers ? CUSTOMER_TYPES : VEHICLE_STATUSES).find(
        (opt) => opt.value === filter,
      )?.label ?? filter;
    chips.push({
      key: filterParamKey,
      label: `${isCustomers ? "Type" : "Status"}: ${label}`,
      onRemove: () => updateQuery({ filter: "", page: 1 }),
    });
  }

  const title = isCustomers ? "Customers" : "Fleet";
  const singular = isCustomers ? "customer" : "vehicle";

  return (
    <ViewFadeIn className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-page-title font-extrabold tracking-tight">
            {title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isCustomers
              ? "Scoped customer directory with server-side search and type filtering"
              : "Scoped fleet directory with daily rates, kilometre odometers, and capability functions"}{" "}
            for {scope.company?.name}.
          </p>
        </div>
        {canManage ? (
          <Link
            className={buttonVariants()}
            href={`${base}/new${branchSuffix}`}
          >
            Create {singular}
          </Link>
        ) : null}
      </div>

      <DataTableFrame
        ariaLabel={`${title} directory`}
        chips={chips}
        onClearAll={
          chips.length > 0
            ? () => updateQuery({ q: "", filter: "", page: 1 })
            : undefined
        }
        toolbar={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <DataSearchForm
              label={`Search ${title.toLowerCase()}`}
              placeholder={
                isCustomers
                  ? "Search name, email, or phone…"
                  : "Search registration, make, or model…"
              }
              defaultValue={rawQ}
              formKey={`${scope.companyId}:${scope.branch}:${domain}:${rawQ}`}
              onSubmitQuery={(nextQ) => updateQuery({ q: nextQ, page: 1 })}
            />
            <div className="w-full space-y-1.5 sm:w-52">
              <span className="block text-label font-semibold">
                {isCustomers ? "Customer type" : "Vehicle status"}
              </span>
              <DriveCoreSelect
                ariaLabel={isCustomers ? "Filter by customer type" : "Filter by vehicle status"}
                value={filter}
                onValueChange={(nextFilter) =>
                  updateQuery({ filter: nextFilter, page: 1 })
                }
                options={isCustomers ? CUSTOMER_TYPES : VEHICLE_STATUSES}
              />
            </div>
          </div>
        }
        footer={
          directory.data ? (
            <>
              <span className="font-mono text-xs tabular-nums">
                {directory.data.total}{" "}
                {directory.data.total === 1 ? "record" : "records"} · Page{" "}
                {directory.data.page} of {directory.data.lastPage}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={page <= 1 || directory.isFetching}
                  onClick={() => updateQuery({ page: Math.max(1, page - 1) })}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={
                    page >= directory.data.lastPage || directory.isFetching
                  }
                  onClick={() => updateQuery({ page: page + 1 })}
                >
                  Next
                </Button>
              </div>
            </>
          ) : undefined
        }
      >
        {directory.isPending ? (
          <div
            role="status"
            aria-label={`Loading ${title.toLowerCase()}`}
            className="space-y-3 p-card"
          >
            <p className="text-sm text-muted-foreground">
              Loading {title.toLowerCase()}…
            </p>
            {[0, 1, 2, 3].map((row) => (
              <Skeleton key={row} className="h-11 w-full rounded-xl" />
            ))}
          </div>
        ) : directory.error ? (
          <div className="p-card">
            <StatePanel
              title={`${title} unavailable`}
              onRetry={() => {
                void directory.refetch();
              }}
            >
              {errorText(directory.error)}
            </StatePanel>
          </div>
        ) : directory.data.items.length === 0 ? (
          <div className="p-card">
            {page > 1 && directory.data.total > 0 ? (
              <StatePanel title="Page out of range">
                <div className="space-y-3">
                  <p>
                    No {title.toLowerCase()} exist on page {page}.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => updateQuery({ page: 1 })}
                  >
                    Back to page 1
                  </Button>
                </div>
              </StatePanel>
            ) : chips.length > 0 ? (
              <StatePanel title={`No matching ${title.toLowerCase()}`}>
                <div className="space-y-3">
                  <p>
                    No {title.toLowerCase()} matched the active search or
                    filter criteria in this workspace scope.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => updateQuery({ q: "", filter: "", page: 1 })}
                  >
                    Clear search and filters
                  </Button>
                </div>
              </StatePanel>
            ) : (
              <StatePanel title={`No ${title.toLowerCase()} yet`}>
                <p>
                  No {title.toLowerCase()} have been recorded in this workspace
                  scope yet.
                </p>
              </StatePanel>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-structural text-xs font-semibold uppercase tracking-wider text-structural-foreground">
                {isCustomers ? (
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Branch</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                ) : (
                  <tr>
                    <th className="px-4 py-3">Registration</th>
                    <th className="px-4 py-3">Vehicle</th>
                    <th className="px-4 py-3">Daily rate</th>
                    <th className="px-4 py-3">Odometer</th>
                    <th className="px-4 py-3">Functions</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                )}
              </thead>
              <tbody className="divide-y">
                {isCustomers
                  ? (directory.data.items as Customer[]).map((customer) => (
                      <tr
                        key={customer.id}
                        className="transition-colors hover:bg-muted/35"
                      >
                        <td className="px-4 py-3 font-semibold">
                          <Link
                            href={`${base}/${customer.id}${branchSuffix}`}
                            className="text-foreground hover:text-link hover:underline"
                          >
                            {customer.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="font-mono text-xs">
                            {customer.type === "individual"
                              ? "Individual"
                              : "Corporate"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {customer.email || "—"}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground tabular-nums">
                          {customer.phone || "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {branchName(customer.branch_id)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`${base}/${customer.id}${branchSuffix}`}
                            className="text-xs font-semibold text-link hover:underline"
                          >
                            Open
                          </Link>
                        </td>
                      </tr>
                    ))
                  : (directory.data.items as Vehicle[]).map((vehicle) => (
                      <tr
                        key={vehicle.id}
                        className="transition-colors hover:bg-muted/35"
                      >
                        <td className="px-4 py-3">
                          <Link
                            href={`${base}/${vehicle.id}${branchSuffix}`}
                            className="inline-block rounded-md bg-structural px-2 py-0.5 font-mono text-xs font-bold text-structural-foreground hover:opacity-90"
                          >
                            {vehicle.registration}
                          </Link>
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {vehicle.make} {vehicle.model}
                          {vehicle.year ? (
                            <span className="ml-1.5 font-mono text-xs text-muted-foreground tabular-nums">
                              ({vehicle.year})
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs font-semibold tabular-nums">
                          {formatMinorCurrency(
                            vehicle.daily_rate_minor,
                            scope.company?.currency,
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground tabular-nums">
                          {vehicle.odometer.toLocaleString()}{" "}
                          {vehicle.odometer_unit ?? "km"}
                        </td>
                        <td className="px-4 py-3">
                          {vehicle.functions.length === 0 ? (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {vehicle.functions.slice(0, 2).map((fn) => (
                                <span
                                  key={fn}
                                  className="rounded-full border bg-muted/40 px-2 py-0.5 text-[11px] font-medium"
                                >
                                  {formatVehicleFunction(fn)}
                                </span>
                              ))}
                              {vehicle.functions.length > 2 ? (
                                <span className="rounded-full border bg-muted/40 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                                  +{vehicle.functions.length - 2}
                                </span>
                              ) : null}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <VehicleStatus status={vehicle.status} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`${base}/${vehicle.id}${branchSuffix}`}
                            className="text-xs font-semibold text-link hover:underline"
                          >
                            Open
                          </Link>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        )}
      </DataTableFrame>
    </ViewFadeIn>
  );
}
