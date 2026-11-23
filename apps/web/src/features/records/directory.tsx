"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  can,
  formatMinorCurrency,
  formatMoneyMinor,
  formatVehicleFunction,
  type Customer,
  type CustomerStatsSummaryMeta,
  type Domain,
  type Vehicle,
  type VehicleStatsSummaryMeta,
} from "@/lib/api/contracts";
import { errorText } from "@/lib/api/client";
import { useSession } from "@/features/auth/session-provider";
import { useLiveContext } from "@/features/live/context";
import { SavedFiltersMenu } from "@/features/stats/saved-filters-menu";
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
import { DriveCoreDateRangePicker } from "@/components/ui/drivecore-calendar";
import { DriveCoreSelect } from "@/components/ui/drivecore-select";
import {
  nextSortState,
  parseSortParams,
  sortRows,
  type SortDirection,
} from "@/lib/table-sort";
import { listRecords } from "./service";

const CUSTOMER_SORT_KEYS_ALL = [
  "name",
  "type",
  "email",
  "rental_count",
  "total_spent_minor",
  "open_ar_minor",
] as const;
const CUSTOMER_SORT_KEYS_OPS = ["name", "type", "email", "rental_count"] as const;
const VEHICLE_SORT_KEYS_ALL = [
  "registration",
  "make",
  "daily_rate_minor",
  "odometer",
  "status",
  "utilization_pct",
  "idle_days",
  "net_roi_minor",
] as const;
const VEHICLE_SORT_KEYS_OPS = [
  "registration",
  "make",
  "daily_rate_minor",
  "odometer",
  "status",
  "utilization_pct",
  "idle_days",
] as const;

const VEHICLE_STATUS_META: Record<
  Vehicle["status"],
  { label: string; tone: StatusDotTone }
> = {
  available: { label: "Available", tone: "success" },
  rented: { label: "Rented", tone: "info" },
  maintenance: { label: "Maintenance", tone: "warning" },
  damaged: { label: "Damaged", tone: "danger" },
  sold: { label: "Sold", tone: "neutral" },
  decommissioned: { label: "Decommissioned", tone: "danger" },
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
  const { user } = useSession();
  const scope = useLiveContext();
  const searchParams = useSearchParams();
  const isCustomers = domain === "customers";
  const canFinance = !!user && can(user, "invoices.view");
  const currency = scope.company?.currency || "ZMW";
  const filterParamKey = isCustomers ? "type" : "status";

  const rawQ = (searchParams.get("q") ?? "").slice(0, 100);
  const rawFilter = searchParams.get(filterParamKey) ?? "";
  const allowedFilters = isCustomers
    ? ["individual", "corporate"]
    : ["available", "rented", "maintenance", "damaged"];
  const filter = allowedFilters.includes(rawFilter) ? rawFilter : "";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const hasOpenAr =
    isCustomers && canFinance && searchParams.get("has_open_ar") === "1";
  const unpricedOnly =
    !isCustomers && searchParams.get("unpriced_only") === "1";
  const rawIdle = searchParams.get("idle_days_min") ?? "";
  const idleDaysMin =
    !isCustomers && /^(?:0|[1-9]\d*)$/.test(rawIdle)
      ? Number(rawIdle)
      : undefined;
  const parsedPage = Number(searchParams.get("page") ?? "1");
  const page =
    Number.isInteger(parsedPage) && parsedPage >= 1 && parsedPage <= 1000000
      ? parsedPage
      : 1;
  const { sort, dir } = parseSortParams(
    searchParams.get("sort"),
    searchParams.get("dir"),
    isCustomers
      ? canFinance
        ? CUSTOMER_SORT_KEYS_ALL
        : CUSTOMER_SORT_KEYS_OPS
      : canFinance
        ? VEHICLE_SORT_KEYS_ALL
        : VEHICLE_SORT_KEYS_OPS,
  );

  const base = `/companies/${scope.companyId}/${domain}`;
  const branchSuffix = `?branch=${scope.branch}`;

  function updateQuery(next: {
    q?: string;
    filter?: string;
    from?: string;
    to?: string;
    has_open_ar?: string;
    unpriced_only?: string;
    idle_days_min?: string;
    page?: number;
    sort?: string;
    dir?: SortDirection | "";
  }) {
    const params = new URLSearchParams();
    params.set("branch", scope.branch);
    const nextQ = (next.q !== undefined ? next.q : rawQ).trim().slice(0, 100);
    const nextFilter = next.filter !== undefined ? next.filter : filter;
    const nextFrom = next.from !== undefined ? next.from : from;
    const nextTo = next.to !== undefined ? next.to : to;
    const nextOpenAr =
      next.has_open_ar !== undefined
        ? next.has_open_ar
        : hasOpenAr
          ? "1"
          : "";
    const nextUnpriced =
      next.unpriced_only !== undefined
        ? next.unpriced_only
        : unpricedOnly
          ? "1"
          : "";
    const nextIdle =
      next.idle_days_min !== undefined
        ? next.idle_days_min
        : idleDaysMin !== undefined
          ? String(idleDaysMin)
          : "";
    const nextPage = next.page !== undefined ? next.page : 1;
    const nextSort = next.sort !== undefined ? next.sort : sort;
    const nextDir = next.dir !== undefined ? next.dir : dir;
    if (nextQ) params.set("q", nextQ);
    if (nextFilter) params.set(filterParamKey, nextFilter);
    if (nextFrom) params.set("from", nextFrom);
    if (nextTo) params.set("to", nextTo);
    if (isCustomers && canFinance && nextOpenAr === "1")
      params.set("has_open_ar", "1");
    if (!isCustomers && nextUnpriced === "1") params.set("unpriced_only", "1");
    if (!isCustomers && nextIdle) params.set("idle_days_min", nextIdle);
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
      {
        q: rawQ.trim(),
        filter,
        from,
        to,
        hasOpenAr,
        unpricedOnly,
        idleDaysMin,
        page,
        sort,
        dir,
      },
    ],
    queryFn: ({ signal }) =>
      listRecords(
        domain,
        {
          companyId: scope.companyId,
          branch: scope.branch,
          q: rawQ,
          filter,
          includeStats: true,
          from: from || undefined,
          to: to || undefined,
          hasOpenAr: hasOpenAr || undefined,
          unpricedOnly: unpricedOnly || undefined,
          idleDaysMin,
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
  if (hasOpenAr) {
    chips.push({
      key: "has_open_ar",
      label: "Has open AR",
      onRemove: () => updateQuery({ has_open_ar: "", page: 1 }),
    });
  }
  if (unpricedOnly) {
    chips.push({
      key: "unpriced_only",
      label: "Unpriced only",
      onRemove: () => updateQuery({ unpriced_only: "", page: 1 }),
    });
  }
  if (idleDaysMin !== undefined) {
    chips.push({
      key: "idle_days_min",
      label: `Idle >= ${idleDaysMin}d`,
      onRemove: () => updateQuery({ idle_days_min: "", page: 1 }),
    });
  }

  const currentFilterDict: Record<string, string> = {};
  if (rawQ.trim()) currentFilterDict.q = rawQ.trim();
  if (filter) currentFilterDict[filterParamKey] = filter;
  if (from) currentFilterDict.from = from;
  if (to) currentFilterDict.to = to;
  if (hasOpenAr) currentFilterDict.has_open_ar = "1";
  if (unpricedOnly) currentFilterDict.unpriced_only = "1";
  if (idleDaysMin !== undefined)
    currentFilterDict.idle_days_min = String(idleDaysMin);
  if (sort && dir) {
    currentFilterDict.sort = sort;
    currentFilterDict.dir = dir;
  }

  const hasStats = !!directory.data?.items.some((r) => !!r.stats);
  const customerSummary = isCustomers
    ? (directory.data?.summary as CustomerStatsSummaryMeta | null | undefined)
    : null;
  const vehicleSummary = !isCustomers
    ? (directory.data?.summary as VehicleStatsSummaryMeta | null | undefined)
    : null;

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

      {customerSummary ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="dc-shadow-card rounded-2xl border bg-surface p-3.5">
            <p className="text-xs text-muted-foreground">Total customers</p>
            <p className="mt-1 font-mono text-xl font-extrabold tabular-nums">
              {customerSummary.total_customers}
            </p>
          </div>
          <div className="dc-shadow-card rounded-2xl border bg-surface p-3.5">
            <p className="text-xs text-muted-foreground">Active rentals</p>
            <p className="mt-1 font-mono text-xl font-extrabold tabular-nums">
              {customerSummary.active_rentals_count}
            </p>
          </div>
          {canFinance && customerSummary.total_spent_minor !== null ? (
            <>
              <div className="dc-shadow-card rounded-2xl border bg-surface p-3.5">
                <p className="text-xs text-muted-foreground">
                  Total spent (net)
                </p>
                <p className="mt-1 font-mono text-xl font-extrabold tabular-nums text-emerald-700 dark:text-emerald-400">
                  {formatMoneyMinor(customerSummary.total_spent_minor, currency)}
                </p>
              </div>
              <div className="dc-shadow-card rounded-2xl border bg-surface p-3.5">
                <p className="text-xs text-muted-foreground">Open AR (live)</p>
                <p className="mt-1 font-mono text-xl font-extrabold tabular-nums text-amber-700 dark:text-amber-400">
                  {formatMoneyMinor(
                    customerSummary.total_open_ar_minor ?? 0,
                    currency,
                  )}
                </p>
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {vehicleSummary ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="dc-shadow-card rounded-2xl border bg-surface p-3.5">
            <p className="text-xs text-muted-foreground">Total vehicles</p>
            <p className="mt-1 font-mono text-xl font-extrabold tabular-nums">
              {vehicleSummary.total_vehicles}
            </p>
          </div>
          <div className="dc-shadow-card rounded-2xl border bg-surface p-3.5">
            <p className="text-xs text-muted-foreground">Avg utilization</p>
            <p className="mt-1 font-mono text-xl font-extrabold tabular-nums">
              {vehicleSummary.avg_utilization_pct}%
            </p>
          </div>
          <div className="dc-shadow-card rounded-2xl border bg-surface p-3.5">
            <p className="text-xs text-muted-foreground">Idle &gt; 14d</p>
            <p className="mt-1 font-mono text-xl font-extrabold tabular-nums">
              {vehicleSummary.idle_over_14d_count}
            </p>
          </div>
          <div className="dc-shadow-card rounded-2xl border bg-surface p-3.5">
            <p className="text-xs text-muted-foreground">Unpriced</p>
            <p className="mt-1 font-mono text-xl font-extrabold tabular-nums">
              {vehicleSummary.unpriced_count}
            </p>
          </div>
          {canFinance && vehicleSummary.total_net_roi_minor !== null ? (
            <div className="dc-shadow-card rounded-2xl border bg-surface p-3.5">
              <p className="text-xs text-muted-foreground">Total net ROI</p>
              <p className="mt-1 font-mono text-xl font-extrabold tabular-nums text-emerald-700 dark:text-emerald-400">
                {formatMoneyMinor(vehicleSummary.total_net_roi_minor, currency)}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      <DataTableFrame
        ariaLabel={`${title} directory`}
        chips={chips}
        onClearAll={
          chips.length > 0
            ? () =>
                updateQuery({
                  q: "",
                  filter: "",
                  from: "",
                  to: "",
                  has_open_ar: "",
                  unpriced_only: "",
                  idle_days_min: "",
                  page: 1,
                })
            : undefined
        }
        toolbar={
          <div className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
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
                  ariaLabel={
                    isCustomers
                      ? "Filter by customer type"
                      : "Filter by vehicle status"
                  }
                  value={filter}
                  onValueChange={(nextFilter) =>
                    updateQuery({ filter: nextFilter, page: 1 })
                  }
                  options={isCustomers ? CUSTOMER_TYPES : VEHICLE_STATUSES}
                />
              </div>
              <DriveCoreDateRangePicker
                from={from}
                to={to}
                onChange={(next) =>
                  updateQuery({ from: next.from, to: next.to, page: 1 })
                }
              />
              <SavedFiltersMenu
                module={domain}
                currentFilters={currentFilterDict}
                onApply={(filters) =>
                  updateQuery({
                    q: filters.q ?? "",
                    filter: filters[filterParamKey] ?? "",
                    from: filters.from ?? "",
                    to: filters.to ?? "",
                    has_open_ar: filters.has_open_ar ?? "",
                    unpriced_only: filters.unpriced_only ?? "",
                    idle_days_min: filters.idle_days_min ?? "",
                    sort: filters.sort ?? "",
                    dir: (filters.dir as SortDirection | "") ?? "",
                    page: 1,
                  })
                }
              />
            </div>

            {hasStats ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {isCustomers ? (
                  <>
                    {canFinance ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 rounded-lg px-2.5 text-xs"
                          onClick={() =>
                            updateQuery({
                              sort: "total_spent_minor",
                              dir: "desc",
                              page: 1,
                            })
                          }
                        >
                          Top spenders
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={hasOpenAr ? "default" : "outline"}
                          className="h-7 rounded-lg px-2.5 text-xs"
                          onClick={() =>
                            updateQuery({
                              has_open_ar: hasOpenAr ? "" : "1",
                              page: 1,
                            })
                          }
                        >
                          Has open AR
                        </Button>
                      </>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant={filter === "corporate" ? "default" : "outline"}
                      className="h-7 rounded-lg px-2.5 text-xs"
                      onClick={() =>
                        updateQuery({
                          filter: filter === "corporate" ? "" : "corporate",
                          page: 1,
                        })
                      }
                    >
                      Corporate
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant={idleDaysMin === 14 ? "default" : "outline"}
                      className="h-7 rounded-lg px-2.5 text-xs"
                      onClick={() =>
                        updateQuery({
                          idle_days_min: idleDaysMin === 14 ? "" : "14",
                          page: 1,
                        })
                      }
                    >
                      Idle &gt; 14d
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={unpricedOnly ? "default" : "outline"}
                      className="h-7 rounded-lg px-2.5 text-xs"
                      onClick={() =>
                        updateQuery({
                          unpriced_only: unpricedOnly ? "" : "1",
                          page: 1,
                        })
                      }
                    >
                      Unpriced
                    </Button>
                    {canFinance ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 rounded-lg px-2.5 text-xs"
                        onClick={() =>
                          updateQuery({
                            sort: "net_roi_minor",
                            dir: "desc",
                            page: 1,
                          })
                        }
                      >
                        Top ROI
                      </Button>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}
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
                  {hasStats ? (
                    <>
                      <DataTableHeaderCell
                        align="right"
                        sortKey="rental_count"
                        activeSort={sort}
                        activeDir={dir}
                        onSort={handleSort}
                      >
                        Rentals
                      </DataTableHeaderCell>
                      {canFinance ? (
                        <>
                          <DataTableHeaderCell
                            align="right"
                            sortKey="total_spent_minor"
                            activeSort={sort}
                            activeDir={dir}
                            onSort={handleSort}
                          >
                            Total spent
                          </DataTableHeaderCell>
                          <DataTableHeaderCell
                            align="right"
                            sortKey="open_ar_minor"
                            activeSort={sort}
                            activeDir={dir}
                            onSort={handleSort}
                          >
                            Open AR
                          </DataTableHeaderCell>
                        </>
                      ) : null}
                    </>
                  ) : null}
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
                  {hasStats ? (
                    <>
                      <DataTableHeaderCell
                        align="right"
                        sortKey="utilization_pct"
                        activeSort={sort}
                        activeDir={dir}
                        onSort={handleSort}
                      >
                        Util %
                      </DataTableHeaderCell>
                      <DataTableHeaderCell
                        align="right"
                        sortKey="idle_days"
                        activeSort={sort}
                        activeDir={dir}
                        onSort={handleSort}
                      >
                        Idle
                      </DataTableHeaderCell>
                      {canFinance ? (
                        <DataTableHeaderCell
                          align="right"
                          sortKey="net_roi_minor"
                          activeSort={sort}
                          activeDir={dir}
                          onSort={handleSort}
                        >
                          Net ROI
                        </DataTableHeaderCell>
                      ) : null}
                    </>
                  ) : null}
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
                      rental_count: (c) => c.stats?.rental_count ?? 0,
                      total_spent_minor: (c) => c.stats?.total_spent_minor ?? 0,
                      open_ar_minor: (c) => c.stats?.open_ar_minor ?? 0,
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
                      {hasStats ? (
                        <>
                          <DataTableCell align="right" numeric>
                            {customer.stats?.rental_count ?? 0}
                          </DataTableCell>
                          {canFinance ? (
                            <>
                              <DataTableCell
                                align="right"
                                numeric
                                className="font-semibold text-emerald-700 dark:text-emerald-400"
                              >
                                {customer.stats?.total_spent_minor !== null &&
                                customer.stats?.total_spent_minor !== undefined
                                  ? formatMoneyMinor(
                                      customer.stats.total_spent_minor,
                                      currency,
                                    )
                                  : "—"}
                              </DataTableCell>
                              <DataTableCell
                                align="right"
                                numeric
                                className={
                                  (customer.stats?.open_ar_minor ?? 0) > 0
                                    ? "font-semibold text-amber-700 dark:text-amber-400"
                                    : "text-muted-foreground"
                                }
                              >
                                {customer.stats?.open_ar_minor !== null &&
                                customer.stats?.open_ar_minor !== undefined
                                  ? formatMoneyMinor(
                                      customer.stats.open_ar_minor,
                                      currency,
                                    )
                                  : "—"}
                              </DataTableCell>
                            </>
                          ) : null}
                        </>
                      ) : null}
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
                      utilization_pct: (v) => v.stats?.utilization_pct ?? 0,
                      idle_days: (v) => v.stats?.idle_days ?? 0,
                      net_roi_minor: (v) => v.stats?.net_roi_minor ?? 0,
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
                        {hasStats ? (
                          <>
                            <DataTableCell align="right" numeric>
                              {vehicle.stats?.utilization_pct ?? 0}%
                            </DataTableCell>
                            <DataTableCell align="right" numeric>
                              {vehicle.stats?.idle_days !== null &&
                              vehicle.stats?.idle_days !== undefined
                                ? `${vehicle.stats.idle_days}d`
                                : "—"}
                            </DataTableCell>
                            {canFinance ? (
                              <DataTableCell
                                align="right"
                                numeric
                                className="font-semibold"
                              >
                                {formatMoneyMinor(
                                  vehicle.stats?.net_roi_minor ?? 0,
                                  currency,
                                )}
                              </DataTableCell>
                            ) : null}
                          </>
                        ) : null}
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
