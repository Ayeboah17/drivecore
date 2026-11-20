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
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableFrame,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  DataTableSkeleton,
  PlateTag,
  StatusDotBadge,
  type ActiveFilterChip,
  type StatusDotTone,
} from "@/components/data/data-table";
import { StatePanel } from "@/components/layout/state-panel";
import { ViewFadeIn } from "@/components/motion/primitives";
import { Button, buttonVariants } from "@/components/ui/button";
import { DriveCoreSelect } from "@/components/ui/drivecore-select";
import {
  nextSortState,
  parseSortParams,
  sortRows,
  type SortDirection,
} from "@/lib/table-sort";
import { listRecords } from "./service";

const CUSTOMER_SORT_KEYS = ["name", "type", "email"] as const;
const VEHICLE_SORT_KEYS = [
  "registration",
  "make",
  "daily_rate_minor",
  "odometer",
  "status",
] as const;

const VEHICLE_STATUS_META: Record<
  Vehicle["status"],
  { label: string; tone: StatusDotTone }
> = {
  available: { label: "Available", tone: "success" },
  rented: { label: "Rented", tone: "info" },
  maintenance: { label: "Maintenance", tone: "warning" },
  damaged: { label: "Damaged", tone: "danger" },
};

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
  const { sort, dir } = parseSortParams(
    searchParams.get("sort"),
    searchParams.get("dir"),
    isCustomers ? CUSTOMER_SORT_KEYS : VEHICLE_SORT_KEYS,
  );

  const base = `/companies/${scope.companyId}/${domain}`;
  const branchSuffix = `?branch=${scope.branch}`;

  function updateQuery(next: {
    q?: string;
    filter?: string;
    page?: number;
    sort?: string;
    dir?: SortDirection | "";
  }) {
    const params = new URLSearchParams();
    params.set("branch", scope.branch);
    const nextQ = (next.q !== undefined ? next.q : rawQ).trim().slice(0, 100);
    const nextFilter = next.filter !== undefined ? next.filter : filter;
    const nextPage = next.page !== undefined ? next.page : 1;
    const nextSort = next.sort !== undefined ? next.sort : sort;
    const nextDir = next.dir !== undefined ? next.dir : dir;
    if (nextQ) params.set("q", nextQ);
    if (nextFilter) params.set(filterParamKey, nextFilter);
    if (nextSort && nextDir) {
      params.set("sort", nextSort);
      params.set("dir", nextDir);
    }
    if (nextPage > 1) params.set("page", String(nextPage));
    scope.navigate(`${base}?${params.toString()}`);
  }

  function handleSort(columnKey: string) {
    const next = nextSortState(sort, dir, columnKey);
    updateQuery({ sort: next.sort, dir: next.dir, page: 1 });
  }

  const directory = useQuery({
    queryKey: [
      ...scope.key,
      domain,
      "list",
      { q: rawQ.trim(), filter, page, sort, dir },
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
          sort: sort || undefined,
          dir: dir || undefined,
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
              <span className="block text-xs font-medium text-muted-foreground">
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
          <DataTableSkeleton
            columns={isCustomers ? 6 : 7}
            label={`Loading ${title.toLowerCase()}`}
          />
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
          <DataTable>
            <DataTableHead>
              {isCustomers ? (
                <tr>
                  <DataTableHeaderCell
                    sortKey="name"
                    activeSort={sort}
                    activeDir={dir}
                    onSort={handleSort}
                  >
                    Name
                  </DataTableHeaderCell>
                  <DataTableHeaderCell
                    sortKey="type"
                    activeSort={sort}
                    activeDir={dir}
                    onSort={handleSort}
                  >
                    Type
                  </DataTableHeaderCell>
                  <DataTableHeaderCell
                    sortKey="email"
                    activeSort={sort}
                    activeDir={dir}
                    onSort={handleSort}
                  >
                    Email
                  </DataTableHeaderCell>
                  <DataTableHeaderCell>Phone</DataTableHeaderCell>
                  <DataTableHeaderCell>Branch</DataTableHeaderCell>
                  <DataTableHeaderCell align="right">Action</DataTableHeaderCell>
                </tr>
              ) : (
                <tr>
                  <DataTableHeaderCell
                    sortKey="registration"
                    activeSort={sort}
                    activeDir={dir}
                    onSort={handleSort}
                  >
                    Registration
                  </DataTableHeaderCell>
                  <DataTableHeaderCell
                    sortKey="make"
                    activeSort={sort}
                    activeDir={dir}
                    onSort={handleSort}
                  >
                    Vehicle
                  </DataTableHeaderCell>
                  <DataTableHeaderCell
                    align="right"
                    sortKey="daily_rate_minor"
                    activeSort={sort}
                    activeDir={dir}
                    onSort={handleSort}
                  >
                    Daily rate
                  </DataTableHeaderCell>
                  <DataTableHeaderCell
                    align="right"
                    sortKey="odometer"
                    activeSort={sort}
                    activeDir={dir}
                    onSort={handleSort}
                  >
                    Odometer
                  </DataTableHeaderCell>
                  <DataTableHeaderCell>Functions</DataTableHeaderCell>
                  <DataTableHeaderCell
                    sortKey="status"
                    activeSort={sort}
                    activeDir={dir}
                    onSort={handleSort}
                  >
                    Status
                  </DataTableHeaderCell>
                  <DataTableHeaderCell align="right">Action</DataTableHeaderCell>
                </tr>
              )}
            </DataTableHead>
            <DataTableBody>
              {isCustomers
                ? sortRows(
                    directory.data.items as Customer[],
                    sort,
                    dir,
                    {
                      name: (c) => c.name,
                      type: (c) => c.type,
                      email: (c) => c.email,
                    },
                  ).map((customer) => (
                    <DataTableRow key={customer.id}>
                      <DataTableCell className="max-w-[16rem]">
                        <Link
                          href={`${base}/${customer.id}${branchSuffix}`}
                          title={customer.name}
                          className="block truncate font-medium text-foreground hover:text-link hover:underline"
                        >
                          {customer.name}
                        </Link>
                      </DataTableCell>
                      <DataTableCell>
                        <StatusDotBadge
                          tone={
                            customer.type === "corporate" ? "info" : "neutral"
                          }
                        >
                          {customer.type === "individual"
                            ? "Individual"
                            : "Corporate"}
                        </StatusDotBadge>
                      </DataTableCell>
                      <DataTableCell className="max-w-[14rem] text-muted-foreground">
                        <span
                          title={customer.email || undefined}
                          className="block truncate"
                        >
                          {customer.email || "—"}
                        </span>
                      </DataTableCell>
                      <DataTableCell numeric className="text-muted-foreground">
                        {customer.phone || "—"}
                      </DataTableCell>
                      <DataTableCell className="text-muted-foreground">
                        {branchName(customer.branch_id)}
                      </DataTableCell>
                      <DataTableCell align="right">
                        <Link
                          href={`${base}/${customer.id}${branchSuffix}`}
                          className="text-xs font-medium text-link hover:underline"
                        >
                          Open
                        </Link>
                      </DataTableCell>
                    </DataTableRow>
                  ))
                : sortRows(
                    directory.data.items as Vehicle[],
                    sort,
                    dir,
                    {
                      registration: (v) => v.registration,
                      make: (v) => `${v.make} ${v.model}`,
                      daily_rate_minor: (v) => v.daily_rate_minor,
                      odometer: (v) => v.odometer,
                      status: (v) => v.status,
                    },
                  ).map((vehicle) => {
                    const statusMeta = VEHICLE_STATUS_META[vehicle.status];
                    return (
                      <DataTableRow key={vehicle.id}>
                        <DataTableCell>
                          <Link
                            href={`${base}/${vehicle.id}${branchSuffix}`}
                            className="inline-block"
                          >
                            <PlateTag className="transition-colors duration-150 group-hover:border-link/50 group-hover:text-link">
                              {vehicle.registration}
                            </PlateTag>
                          </Link>
                        </DataTableCell>
                        <DataTableCell className="max-w-[14rem]">
                          <span className="font-medium">
                            {vehicle.make} {vehicle.model}
                          </span>
                          {vehicle.year ? (
                            <span className="ml-1.5 font-mono text-xs text-muted-foreground tabular-nums">
                              ({vehicle.year})
                            </span>
                          ) : null}
                        </DataTableCell>
                        <DataTableCell
                          align="right"
                          numeric
                          className="font-semibold text-foreground"
                        >
                          {formatMinorCurrency(
                            vehicle.daily_rate_minor,
                            scope.company?.currency,
                          )}
                        </DataTableCell>
                        <DataTableCell
                          align="right"
                          numeric
                          className="text-muted-foreground"
                        >
                          {vehicle.odometer.toLocaleString()}{" "}
                          {vehicle.odometer_unit ?? "km"}
                        </DataTableCell>
                        <DataTableCell>
                          {vehicle.functions.length === 0 ? (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {vehicle.functions.slice(0, 2).map((fn) => (
                                <span
                                  key={fn}
                                  className="rounded-md border border-border/70 bg-muted/35 px-2 py-0.5 text-[11px] font-medium text-foreground"
                                >
                                  {formatVehicleFunction(fn)}
                                </span>
                              ))}
                              {vehicle.functions.length > 2 ? (
                                <span className="rounded-md border border-border/70 bg-muted/35 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                                  +{vehicle.functions.length - 2}
                                </span>
                              ) : null}
                            </div>
                          )}
                        </DataTableCell>
                        <DataTableCell>
                          <StatusDotBadge tone={statusMeta.tone}>
                            {statusMeta.label}
                          </StatusDotBadge>
                        </DataTableCell>
                        <DataTableCell align="right">
                          <Link
                            href={`${base}/${vehicle.id}${branchSuffix}`}
                            className="text-xs font-medium text-link hover:underline"
                          >
                            Open
                          </Link>
                        </DataTableCell>
                      </DataTableRow>
                    );
                  })}
            </DataTableBody>
          </DataTable>
        )}
      </DataTableFrame>
    </ViewFadeIn>
  );
}
