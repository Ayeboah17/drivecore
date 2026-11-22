"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  CarFront,
  Download,
  SlidersHorizontal,
  UsersRound,
} from "lucide-react";
import { useSession } from "@/features/auth/session-provider";
import { useLiveContext } from "@/features/live/context";
import {
  listBranchStats,
  listCustomerStats,
  listVehicleStats,
} from "@/features/stats/service";
import { SavedFiltersMenu } from "@/features/stats/saved-filters-menu";
import { errorText } from "@/lib/api/client";
import {
  can,
  formatMinorCurrency,
  formatMoneyMinor,
  parseMajorToMinor,
  type SavedFilterModule,
} from "@/lib/api/contracts";
import { downloadCsv } from "@/lib/csv";
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
} from "@/components/data/data-table";
import { StatePanel } from "@/components/layout/state-panel";
import { Button } from "@/components/ui/button";
import { DriveCoreDateRangePicker } from "@/components/ui/drivecore-calendar";
import { DriveCoreSelect } from "@/components/ui/drivecore-select";
import { Input } from "@/components/ui/input";
import { nextSortState, parseSortParams, type SortDirection } from "@/lib/table-sort";

type StatsView = "customers" | "vehicles" | "branches";

const CUSTOMER_STAT_SORTS_ALL = [
  "name",
  "type",
  "rental_count",
  "total_spent_minor",
  "open_ar_minor",
  "last_rental_at",
] as const;

const CUSTOMER_STAT_SORTS_OPS = [
  "name",
  "type",
  "rental_count",
  "last_rental_at",
] as const;

const VEHICLE_STAT_SORTS_ALL = [
  "registration",
  "daily_rate_minor",
  "rental_count",
  "utilization_pct",
  "idle_days",
  "revenue_minor",
  "net_roi_minor",
] as const;

const VEHICLE_STAT_SORTS_OPS = [
  "registration",
  "daily_rate_minor",
  "rental_count",
  "utilization_pct",
  "idle_days",
] as const;

function parseOptNonNegInt(raw: string | null): number | undefined {
  if (!raw || !/^(?:0|[1-9]\d*)$/.test(raw)) return undefined;
  const n = Number(raw);
  return Number.isSafeInteger(n) ? n : undefined;
}

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString();
}

export function DetailedStatsPanel() {
  const { user } = useSession();
  const scope = useLiveContext();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const canCustomers = !!user && can(user, "customers.view");
  const canVehicles = !!user && can(user, "vehicles.view");
  const canFinance = !!user && can(user, "invoices.view");
  const currency = scope.company?.currency || "ZMW";
  const branchId = scope.branch !== "all" ? scope.branch : undefined;
  const suffix = `?branch=${scope.branch}`;

  const rawView = searchParams.get("view");
  const view: StatsView =
    rawView === "customers" && canCustomers
      ? "customers"
      : rawView === "vehicles" && canVehicles
        ? "vehicles"
        : rawView === "branches"
          ? "branches"
          : canCustomers
            ? "customers"
            : canVehicles
              ? "vehicles"
              : "branches";

  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const rawQ = (searchParams.get("q") ?? "").slice(0, 100);
  const rawPage = Number(searchParams.get("page") ?? "1");
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;

  // Customer facets
  const customerType = searchParams.get("type") ?? "";
  const minSpendMinor = canFinance
    ? parseOptNonNegInt(searchParams.get("min_spend_minor"))
    : undefined;
  const maxSpendMinor = canFinance
    ? parseOptNonNegInt(searchParams.get("max_spend_minor"))
    : undefined;
  const hasOpenAr = canFinance && searchParams.get("has_open_ar") === "1";

  // Vehicle facets
  const vehicleStatus = searchParams.get("status") ?? "";
  const minRateMinor = parseOptNonNegInt(searchParams.get("min_rate_minor"));
  const maxRateMinor = parseOptNonNegInt(searchParams.get("max_rate_minor"));
  const functionsRaw = searchParams.get("functions") ?? "";
  const functionsList = functionsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const idleDaysMin = parseOptNonNegInt(searchParams.get("idle_days_min"));
  const unpricedOnly = searchParams.get("unpriced_only") === "1";

  const allowedSorts =
    view === "customers"
      ? canFinance
        ? CUSTOMER_STAT_SORTS_ALL
        : CUSTOMER_STAT_SORTS_OPS
      : canFinance
        ? VEHICLE_STAT_SORTS_ALL
        : VEHICLE_STAT_SORTS_OPS;

  const { sort, dir } = parseSortParams(
    searchParams.get("sort"),
    searchParams.get("dir"),
    allowedSorts,
  );

  const [minMajorInput, setMinMajorInput] = useState(
    minSpendMinor !== undefined ? (minSpendMinor / 100).toString() : "",
  );
  const [maxMajorInput, setMaxMajorInput] = useState(
    maxSpendMinor !== undefined ? (maxSpendMinor / 100).toString() : "",
  );
  const [idleInput, setIdleInput] = useState(
    idleDaysMin !== undefined ? String(idleDaysMin) : "",
  );
  const [rangeError, setRangeError] = useState<string | null>(null);

  function updateQuery(
    updates: Record<string, string | number | undefined>,
    resetViewFacets = false,
  ) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("tab", "stats");
    if (resetViewFacets) {
      for (const k of [
        "q",
        "type",
        "min_spend_minor",
        "max_spend_minor",
        "has_open_ar",
        "status",
        "min_rate_minor",
        "max_rate_minor",
        "functions",
        "idle_days_min",
        "unpriced_only",
        "sort",
        "dir",
        "page",
      ]) {
        next.delete(k);
      }
    }
    for (const [k, v] of Object.entries(updates)) {
      if (v === undefined || v === "" || (k === "page" && v === 1)) {
        next.delete(k);
      } else {
        next.set(k, String(v));
      }
    }
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  function handleSort(columnKey: string) {
    const next = nextSortState(sort, dir, columnKey);
    updateQuery({ sort: next.sort, dir: next.dir, page: 1 });
  }

  function applySpendBounds() {
    setRangeError(null);
    const minM = minMajorInput.trim()
      ? parseMajorToMinor(minMajorInput.trim())
      : undefined;
    const maxM = maxMajorInput.trim()
      ? parseMajorToMinor(maxMajorInput.trim())
      : undefined;
    if (
      (minMajorInput.trim() && minM === null) ||
      (maxMajorInput.trim() && maxM === null)
    ) {
      setRangeError("Enter valid non-negative monetary amounts.");
      return;
    }
    if (
      minM !== undefined &&
      minM !== null &&
      maxM !== undefined &&
      maxM !== null &&
      minM > maxM
    ) {
      setRangeError("Minimum spend cannot exceed maximum spend.");
      return;
    }
    updateQuery({
      min_spend_minor: minM === undefined || minM === null ? "" : String(minM),
      max_spend_minor: maxM === undefined || maxM === null ? "" : String(maxM),
      page: 1,
    });
  }

  function applyIdleBound() {
    setRangeError(null);
    const trimmed = idleInput.trim();
    if (trimmed && !/^(?:0|[1-9]\d*)$/.test(trimmed)) {
      setRangeError("Idle days must be a non-negative whole number.");
      return;
    }
    updateQuery({ idle_days_min: trimmed || "", page: 1 });
  }

  const customerQuery = useQuery({
    queryKey: [
      ...scope.key,
      "stats",
      "customers",
      {
        branchId: branchId ?? "all",
        from,
        to,
        customerType,
        minSpendMinor,
        maxSpendMinor,
        hasOpenAr,
        q: rawQ,
        page,
        sort,
        dir,
      },
    ],
    queryFn: ({ signal }) =>
      listCustomerStats(
        {
          companyId: scope.companyId,
          branchId,
          type: customerType || undefined,
          from: from || undefined,
          to: to || undefined,
          minSpendMinor,
          maxSpendMinor,
          hasOpenAr,
          q: rawQ,
          page,
          sort: sort || undefined,
          dir: (dir || undefined) as SortDirection | undefined,
        },
        signal,
      ),
    enabled: canCustomers && view === "customers",
    retry: false,
  });

  const vehicleQuery = useQuery({
    queryKey: [
      ...scope.key,
      "stats",
      "vehicles",
      {
        branchId: branchId ?? "all",
        from,
        to,
        vehicleStatus,
        minRateMinor,
        maxRateMinor,
        functionsRaw,
        idleDaysMin,
        unpricedOnly,
        q: rawQ,
        page,
        sort,
        dir,
      },
    ],
    queryFn: ({ signal }) =>
      listVehicleStats(
        {
          companyId: scope.companyId,
          branchId,
          status: vehicleStatus || undefined,
          from: from || undefined,
          to: to || undefined,
          minRateMinor,
          maxRateMinor,
          functions: functionsList.length ? functionsList : undefined,
          idleDaysMin,
          unpricedOnly,
          q: rawQ,
          page,
          sort: sort || undefined,
          dir: (dir || undefined) as SortDirection | undefined,
        },
        signal,
      ),
    enabled: canVehicles && view === "vehicles",
    retry: false,
  });

  const branchQuery = useQuery({
    queryKey: [...scope.key, "stats", "branches", branchId ?? "all", from, to],
    queryFn: ({ signal }) =>
      listBranchStats(
        {
          companyId: scope.companyId,
          branchId,
          from: from || undefined,
          to: to || undefined,
        },
        signal,
      ),
    enabled: view === "branches",
    retry: false,
  });

  const savedModule: SavedFilterModule =
    view === "customers"
      ? "stats_customers"
      : view === "vehicles"
        ? "stats_vehicles"
        : "stats_branches";

  const currentFilterDict: Record<string, string> = {};
  for (const k of [
    "from",
    "to",
    "q",
    "type",
    "min_spend_minor",
    "max_spend_minor",
    "has_open_ar",
    "status",
    "min_rate_minor",
    "max_rate_minor",
    "functions",
    "idle_days_min",
    "unpriced_only",
    "sort",
    "dir",
  ]) {
    const val = searchParams.get(k);
    if (val) currentFilterDict[k] = val;
  }

  function handleExportCsv() {
    if (view === "customers" && customerQuery.data) {
      downloadCsv(
        `drivecore-customer-stats-co${scope.companyId}.csv`,
        [
          "Customer",
          "Type",
          "Email",
          "Rentals",
          "Last rental",
          ...(canFinance
            ? ["Total spent (net)", "Total invoiced", "Open AR (live)", "Avg rental"]
            : []),
        ],
        customerQuery.data.items.map((c) => [
          c.name,
          c.type,
          c.email ?? "",
          c.stats?.rental_count ?? 0,
          c.stats?.last_rental_at ?? "",
          ...(canFinance
            ? [
                ((c.stats?.total_spent_minor ?? 0) / 100).toFixed(2),
                ((c.stats?.total_invoiced_minor ?? 0) / 100).toFixed(2),
                ((c.stats?.open_ar_minor ?? 0) / 100).toFixed(2),
                ((c.stats?.avg_rental_value_minor ?? 0) / 100).toFixed(2),
              ]
            : []),
        ]),
      );
    } else if (view === "vehicles" && vehicleQuery.data) {
      downloadCsv(
        `drivecore-vehicle-stats-co${scope.companyId}.csv`,
        [
          "Registration",
          "Vehicle",
          "Status",
          "Daily rate",
          "Rentals",
          "Utilization %",
          "Idle days",
          "Total km",
          ...(canFinance ? ["Revenue", "Expenses", "Net ROI"] : []),
        ],
        vehicleQuery.data.items.map((v) => [
          v.registration,
          `${v.make} ${v.model}`,
          v.status,
          (v.daily_rate_minor / 100).toFixed(2),
          v.stats?.rental_count ?? 0,
          v.stats?.utilization_pct ?? 0,
          v.stats?.idle_days ?? "",
          v.stats?.total_km_driven ?? 0,
          ...(canFinance
            ? [
                ((v.stats?.revenue_minor ?? 0) / 100).toFixed(2),
                ((v.stats?.expense_minor ?? 0) / 100).toFixed(2),
                ((v.stats?.net_roi_minor ?? 0) / 100).toFixed(2),
              ]
            : []),
        ]),
      );
    } else if (view === "branches" && branchQuery.data) {
      downloadCsv(
        `drivecore-branch-stats-co${scope.companyId}.csv`,
        [
          "Branch",
          "Fleet size",
          "Utilization %",
          "Rentals",
          "Work orders",
          "Downtime (hrs)",
          ...(canFinance
            ? ["Revenue", "Expenses", "Net position", "Open AR (live)"]
            : []),
        ],
        branchQuery.data.map((b) => [
          b.branch_name,
          b.fleet_total,
          b.utilization_pct,
          b.rental_count,
          b.work_order_count,
          b.downtime_hours,
          ...(canFinance
            ? [
                ((b.revenue_minor ?? 0) / 100).toFixed(2),
                ((b.expenses_minor ?? 0) / 100).toFixed(2),
                ((b.net_position_minor ?? 0) / 100).toFixed(2),
                ((b.open_ar_minor ?? 0) / 100).toFixed(2),
              ]
            : []),
        ]),
      );
    }
  }

  const chips: ActiveFilterChip[] = [];
  if (rawQ.trim()) {
    chips.push({
      key: "q",
      label: `Search: ${rawQ.trim()}`,
      onRemove: () => updateQuery({ q: "", page: 1 }),
    });
  }
  if (view === "customers") {
    if (customerType) {
      chips.push({
        key: "type",
        label: `Type: ${customerType}`,
        onRemove: () => updateQuery({ type: "", page: 1 }),
      });
    }
    if (minSpendMinor !== undefined) {
      chips.push({
        key: "min_spend",
        label: `Min spend: ${formatMoneyMinor(minSpendMinor, currency)}`,
        onRemove: () => {
          setMinMajorInput("");
          updateQuery({ min_spend_minor: "", page: 1 });
        },
      });
    }
    if (maxSpendMinor !== undefined) {
      chips.push({
        key: "max_spend",
        label: `Max spend: ${formatMoneyMinor(maxSpendMinor, currency)}`,
        onRemove: () => {
          setMaxMajorInput("");
          updateQuery({ max_spend_minor: "", page: 1 });
        },
      });
    }
    if (hasOpenAr) {
      chips.push({
        key: "open_ar",
        label: "Has open AR",
        onRemove: () => updateQuery({ has_open_ar: "", page: 1 }),
      });
    }
  } else if (view === "vehicles") {
    if (vehicleStatus) {
      chips.push({
        key: "status",
        label: `Status: ${vehicleStatus}`,
        onRemove: () => updateQuery({ status: "", page: 1 }),
      });
    }
    if (idleDaysMin !== undefined) {
      chips.push({
        key: "idle",
        label: `Idle >= ${idleDaysMin}d`,
        onRemove: () => {
          setIdleInput("");
          updateQuery({ idle_days_min: "", page: 1 });
        },
      });
    }
    if (unpricedOnly) {
      chips.push({
        key: "unpriced",
        label: "Unpriced only",
        onRemove: () => updateQuery({ unpriced_only: "", page: 1 }),
      });
    }
    if (functionsList.length) {
      chips.push({
        key: "functions",
        label: `Functions: ${functionsList.join(", ")}`,
        onRemove: () => updateQuery({ functions: "", page: 1 }),
      });
    }
  }

  return (
    <div className="space-y-5">
      {/* Sub-view switcher + Calendar + Saved Views + CSV */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-surface p-4">
        <div
          role="tablist"
          aria-label="Detailed stats views"
          className="flex flex-wrap gap-1.5"
        >
          {canCustomers ? (
            <button
              type="button"
              role="tab"
              aria-selected={view === "customers"}
              onClick={() => updateQuery({ view: "customers" }, true)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                view === "customers"
                  ? "bg-primary text-primary-foreground"
                  : "border bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              <UsersRound className="size-3.5" aria-hidden="true" />
              Customer stats
            </button>
          ) : null}
          {canVehicles ? (
            <button
              type="button"
              role="tab"
              aria-selected={view === "vehicles"}
              onClick={() => updateQuery({ view: "vehicles" }, true)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                view === "vehicles"
                  ? "bg-primary text-primary-foreground"
                  : "border bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              <CarFront className="size-3.5" aria-hidden="true" />
              Vehicle stats
            </button>
          ) : null}
          <button
            type="button"
            role="tab"
            aria-selected={view === "branches"}
            onClick={() => updateQuery({ view: "branches" }, true)}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
              view === "branches"
                ? "bg-primary text-primary-foreground"
                : "border bg-background text-muted-foreground hover:text-foreground"
            }`}
          >
            <Building2 className="size-3.5" aria-hidden="true" />
            Branch comparison
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DriveCoreDateRangePicker
            from={from}
            to={to}
            onChange={(next) =>
              updateQuery({ from: next.from, to: next.to, page: 1 })
            }
          />
          <SavedFiltersMenu
            module={savedModule}
            currentFilters={currentFilterDict}
            onApply={(filters) => {
              const nextUpdates: Record<string, string | number | undefined> = {
                view,
                page: 1,
                from: filters.from ?? "",
                to: filters.to ?? "",
                ...filters,
              };
              updateQuery(nextUpdates, true);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            className="h-control gap-1.5 rounded-xl px-3 text-xs"
          >
            <Download className="size-3.5" aria-hidden="true" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* CUSTOMERS STATS VIEW */}
      {view === "customers" ? (
        <div className="space-y-4">
          {customerQuery.data?.summary ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="dc-shadow-card rounded-2xl border bg-surface p-4">
                <p className="text-xs text-muted-foreground">Matching customers</p>
                <p className="mt-1 font-mono text-xl font-extrabold tabular-nums">
                  {customerQuery.data.summary.total_customers}
                </p>
              </div>
              <div className="dc-shadow-card rounded-2xl border bg-surface p-4">
                <p className="text-xs text-muted-foreground">Active rentals</p>
                <p className="mt-1 font-mono text-xl font-extrabold tabular-nums">
                  {customerQuery.data.summary.active_rentals_count}
                </p>
              </div>
              {canFinance &&
              customerQuery.data.summary.total_spent_minor !== null ? (
                <>
                  <div className="dc-shadow-card rounded-2xl border bg-surface p-4">
                    <p className="text-xs text-muted-foreground">
                      Total spent (period net)
                    </p>
                    <p className="mt-1 font-mono text-xl font-extrabold tabular-nums text-emerald-700 dark:text-emerald-400">
                      {formatMoneyMinor(
                        customerQuery.data.summary.total_spent_minor,
                        currency,
                      )}
                    </p>
                  </div>
                  <div className="dc-shadow-card rounded-2xl border bg-surface p-4">
                    <p className="text-xs text-muted-foreground">
                      Open AR (live)
                    </p>
                    <p className="mt-1 font-mono text-xl font-extrabold tabular-nums text-amber-700 dark:text-amber-400">
                      {formatMoneyMinor(
                        customerQuery.data.summary.total_open_ar_minor ?? 0,
                        currency,
                      )}
                    </p>
                  </div>
                </>
              ) : null}
            </div>
          ) : null}

          {/* Quick preset chips */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
              <SlidersHorizontal className="size-3.5" aria-hidden="true" />
              Presets:
            </span>
            {canFinance ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-xl text-xs"
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
                  className="rounded-xl text-xs"
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
              variant={customerType === "corporate" ? "default" : "outline"}
              className="rounded-xl text-xs"
              onClick={() =>
                updateQuery({
                  type: customerType === "corporate" ? "" : "corporate",
                  page: 1,
                })
              }
            >
              Corporate
            </Button>
          </div>

          <DataTableFrame
            ariaLabel="Customer detailed stats"
            chips={chips}
            onClearAll={
              chips.length
                ? () => {
                    setMinMajorInput("");
                    setMaxMajorInput("");
                    updateQuery({ view: "customers" }, true);
                  }
                : undefined
            }
            toolbar={
              <div className="space-y-3">
                <div className="flex flex-wrap items-end gap-3">
                  <DataSearchForm
                    label="Search customer stats"
                    placeholder="Search customer name, email…"
                    defaultValue={rawQ}
                    formKey={`stats-cust:${rawQ}`}
                    onSubmitQuery={(nextQ) => updateQuery({ q: nextQ, page: 1 })}
                  />
                  <div className="w-44 space-y-1">
                    <span className="block text-xs font-medium text-muted-foreground">
                      Customer type
                    </span>
                    <DriveCoreSelect
                      ariaLabel="Filter stats by customer type"
                      value={customerType}
                      onValueChange={(v) => updateQuery({ type: v, page: 1 })}
                      options={[
                        { value: "", label: "All types" },
                        { value: "individual", label: "Individual" },
                        { value: "corporate", label: "Corporate" },
                      ]}
                    />
                  </div>
                  {canFinance ? (
                    <>
                      <div className="w-36 space-y-1">
                        <label
                          htmlFor="stats-min-spend"
                          className="block text-xs font-medium text-muted-foreground"
                        >
                          Min spend ({currency})
                        </label>
                        <Input
                          id="stats-min-spend"
                          inputMode="decimal"
                          placeholder="0.00"
                          value={minMajorInput}
                          onChange={(e) => setMinMajorInput(e.target.value)}
                        />
                      </div>
                      <div className="w-36 space-y-1">
                        <label
                          htmlFor="stats-max-spend"
                          className="block text-xs font-medium text-muted-foreground"
                        >
                          Max spend ({currency})
                        </label>
                        <Input
                          id="stats-max-spend"
                          inputMode="decimal"
                          placeholder="Any"
                          value={maxMajorInput}
                          onChange={(e) => setMaxMajorInput(e.target.value)}
                        />
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={applySpendBounds}
                      >
                        Apply spend
                      </Button>
                    </>
                  ) : null}
                </div>
                {rangeError ? (
                  <p role="alert" className="text-xs text-destructive">
                    {rangeError}
                  </p>
                ) : null}
              </div>
            }
            footer={
              customerQuery.data ? (
                <>
                  <span className="font-mono text-xs tabular-nums">
                    {customerQuery.data.total} customers · Page{" "}
                    {customerQuery.data.page} of {customerQuery.data.lastPage}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={page <= 1 || customerQuery.isFetching}
                      onClick={() => updateQuery({ page: page - 1 })}
                    >
                      Previous
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={
                        page >= customerQuery.data.lastPage ||
                        customerQuery.isFetching
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
            {customerQuery.isPending ? (
              <DataTableSkeleton
                columns={canFinance ? 7 : 5}
                label="Loading customer stats"
              />
            ) : customerQuery.error || !customerQuery.data ? (
              <div className="p-card">
                <StatePanel title="Customer stats unavailable">
                  {errorText(customerQuery.error)}
                </StatePanel>
              </div>
            ) : customerQuery.data.items.length === 0 ? (
              <div className="p-card">
                <StatePanel title="No matching customers">
                  Adjust the date range or filter criteria to inspect customer
                  spend and rental rollups.
                </StatePanel>
              </div>
            ) : (
              <DataTable>
                <DataTableHead>
                  <tr>
                    <DataTableHeaderCell
                      sortKey="name"
                      activeSort={sort}
                      activeDir={dir}
                      onSort={handleSort}
                    >
                      Customer
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
                      align="right"
                      sortKey="rental_count"
                      activeSort={sort}
                      activeDir={dir}
                      onSort={handleSort}
                    >
                      Rentals
                    </DataTableHeaderCell>
                    <DataTableHeaderCell
                      sortKey="last_rental_at"
                      activeSort={sort}
                      activeDir={dir}
                      onSort={handleSort}
                    >
                      Last rental
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
                          Open AR (live)
                        </DataTableHeaderCell>
                      </>
                    ) : null}
                    <DataTableHeaderCell align="right">Action</DataTableHeaderCell>
                  </tr>
                </DataTableHead>
                <DataTableBody>
                  {customerQuery.data.items.map((c) => (
                    <DataTableRow key={c.id}>
                      <DataTableCell className="font-medium">
                        <Link
                          href={`/companies/${scope.companyId}/customers/${c.id}${suffix}`}
                          className="text-foreground hover:text-link hover:underline"
                        >
                          {c.name}
                        </Link>
                      </DataTableCell>
                      <DataTableCell>
                        <StatusDotBadge
                          tone={c.type === "corporate" ? "info" : "neutral"}
                        >
                          {c.type === "corporate" ? "Corporate" : "Individual"}
                        </StatusDotBadge>
                      </DataTableCell>
                      <DataTableCell align="right" numeric>
                        {c.stats?.rental_count ?? 0}
                      </DataTableCell>
                      <DataTableCell className="text-muted-foreground">
                        {fmtDate(c.stats?.last_rental_at)}
                      </DataTableCell>
                      {canFinance ? (
                        <>
                          <DataTableCell
                            align="right"
                            numeric
                            className="font-semibold text-emerald-700 dark:text-emerald-400"
                          >
                            {c.stats?.total_spent_minor !== null &&
                            c.stats?.total_spent_minor !== undefined
                              ? formatMoneyMinor(
                                  c.stats.total_spent_minor,
                                  currency,
                                )
                              : "—"}
                          </DataTableCell>
                          <DataTableCell
                            align="right"
                            numeric
                            className={
                              (c.stats?.open_ar_minor ?? 0) > 0
                                ? "font-semibold text-amber-700 dark:text-amber-400"
                                : "text-muted-foreground"
                            }
                          >
                            {c.stats?.open_ar_minor !== null &&
                            c.stats?.open_ar_minor !== undefined
                              ? formatMoneyMinor(
                                  c.stats.open_ar_minor,
                                  currency,
                                )
                              : "—"}
                          </DataTableCell>
                        </>
                      ) : null}
                      <DataTableCell align="right">
                        <Link
                          href={`/companies/${scope.companyId}/customers/${c.id}${suffix}`}
                          className="text-xs font-medium text-link hover:underline"
                        >
                          Open 360
                        </Link>
                      </DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            )}
          </DataTableFrame>
        </div>
      ) : null}

      {/* VEHICLE STATS VIEW */}
      {view === "vehicles" ? (
        <div className="space-y-4">
          {vehicleQuery.data?.summary ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="dc-shadow-card rounded-2xl border bg-surface p-4">
                <p className="text-xs text-muted-foreground">Matching vehicles</p>
                <p className="mt-1 font-mono text-xl font-extrabold tabular-nums">
                  {vehicleQuery.data.summary.total_vehicles}
                </p>
              </div>
              <div className="dc-shadow-card rounded-2xl border bg-surface p-4">
                <p className="text-xs text-muted-foreground">Avg utilization</p>
                <p className="mt-1 font-mono text-xl font-extrabold tabular-nums">
                  {vehicleQuery.data.summary.avg_utilization_pct}%
                </p>
              </div>
              <div className="dc-shadow-card rounded-2xl border bg-surface p-4">
                <p className="text-xs text-muted-foreground">Idle &gt; 14d</p>
                <p className="mt-1 font-mono text-xl font-extrabold tabular-nums">
                  {vehicleQuery.data.summary.idle_over_14d_count}
                </p>
              </div>
              <div className="dc-shadow-card rounded-2xl border bg-surface p-4">
                <p className="text-xs text-muted-foreground">Unpriced</p>
                <p className="mt-1 font-mono text-xl font-extrabold tabular-nums">
                  {vehicleQuery.data.summary.unpriced_count}
                </p>
              </div>
              {canFinance &&
              vehicleQuery.data.summary.total_net_roi_minor !== null ? (
                <div className="dc-shadow-card rounded-2xl border bg-surface p-4">
                  <p className="text-xs text-muted-foreground">Total net ROI</p>
                  <p className="mt-1 font-mono text-xl font-extrabold tabular-nums text-emerald-700 dark:text-emerald-400">
                    {formatMoneyMinor(
                      vehicleQuery.data.summary.total_net_roi_minor,
                      currency,
                    )}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
              <SlidersHorizontal className="size-3.5" aria-hidden="true" />
              Presets:
            </span>
            <Button
              type="button"
              size="sm"
              variant={idleDaysMin === 14 ? "default" : "outline"}
              className="rounded-xl text-xs"
              onClick={() => {
                const next = idleDaysMin === 14 ? "" : "14";
                setIdleInput(next);
                updateQuery({ idle_days_min: next, page: 1 });
              }}
            >
              Idle &gt; 14d
            </Button>
            <Button
              type="button"
              size="sm"
              variant={unpricedOnly ? "default" : "outline"}
              className="rounded-xl text-xs"
              onClick={() =>
                updateQuery({ unpriced_only: unpricedOnly ? "" : "1", page: 1 })
              }
            >
              Unpriced
            </Button>
            {canFinance ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-xl text-xs"
                onClick={() =>
                  updateQuery({ sort: "net_roi_minor", dir: "desc", page: 1 })
                }
              >
                Top ROI
              </Button>
            ) : null}
          </div>

          <DataTableFrame
            ariaLabel="Vehicle detailed stats"
            chips={chips}
            onClearAll={
              chips.length
                ? () => {
                    setIdleInput("");
                    updateQuery({ view: "vehicles" }, true);
                  }
                : undefined
            }
            toolbar={
              <div className="flex flex-wrap items-end gap-3">
                <DataSearchForm
                  label="Search vehicle stats"
                  placeholder="Registration, make, model…"
                  defaultValue={rawQ}
                  formKey={`stats-veh:${rawQ}`}
                  onSubmitQuery={(nextQ) => updateQuery({ q: nextQ, page: 1 })}
                />
                <div className="w-44 space-y-1">
                  <span className="block text-xs font-medium text-muted-foreground">
                    Status
                  </span>
                  <DriveCoreSelect
                    ariaLabel="Filter vehicle stats by status"
                    value={vehicleStatus}
                    onValueChange={(v) => updateQuery({ status: v, page: 1 })}
                    options={[
                      { value: "", label: "All statuses" },
                      { value: "available", label: "Available" },
                      { value: "rented", label: "Rented" },
                      { value: "maintenance", label: "Maintenance" },
                      { value: "damaged", label: "Damaged" },
                    ]}
                  />
                </div>
                <div className="w-32 space-y-1">
                  <label
                    htmlFor="stats-idle-days"
                    className="block text-xs font-medium text-muted-foreground"
                  >
                    Min idle days
                  </label>
                  <Input
                    id="stats-idle-days"
                    inputMode="numeric"
                    placeholder="e.g. 14"
                    value={idleInput}
                    onChange={(e) => setIdleInput(e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={applyIdleBound}
                >
                  Apply idle
                </Button>
              </div>
            }
            footer={
              vehicleQuery.data ? (
                <>
                  <span className="font-mono text-xs tabular-nums">
                    {vehicleQuery.data.total} vehicles · Page{" "}
                    {vehicleQuery.data.page} of {vehicleQuery.data.lastPage}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={page <= 1 || vehicleQuery.isFetching}
                      onClick={() => updateQuery({ page: page - 1 })}
                    >
                      Previous
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={
                        page >= vehicleQuery.data.lastPage ||
                        vehicleQuery.isFetching
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
            {vehicleQuery.isPending ? (
              <DataTableSkeleton
                columns={canFinance ? 8 : 6}
                label="Loading vehicle stats"
              />
            ) : vehicleQuery.error || !vehicleQuery.data ? (
              <div className="p-card">
                <StatePanel title="Vehicle stats unavailable">
                  {errorText(vehicleQuery.error)}
                </StatePanel>
              </div>
            ) : vehicleQuery.data.items.length === 0 ? (
              <div className="p-card">
                <StatePanel title="No matching vehicles">
                  Adjust filters or date range to inspect vehicle utilization
                  and ROI.
                </StatePanel>
              </div>
            ) : (
              <DataTable>
                <DataTableHead>
                  <tr>
                    <DataTableHeaderCell
                      sortKey="registration"
                      activeSort={sort}
                      activeDir={dir}
                      onSort={handleSort}
                    >
                      Registration
                    </DataTableHeaderCell>
                    <DataTableHeaderCell>Vehicle</DataTableHeaderCell>
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
                      sortKey="rental_count"
                      activeSort={sort}
                      activeDir={dir}
                      onSort={handleSort}
                    >
                      Rentals
                    </DataTableHeaderCell>
                    <DataTableHeaderCell
                      align="right"
                      sortKey="utilization_pct"
                      activeSort={sort}
                      activeDir={dir}
                      onSort={handleSort}
                    >
                      Utilization
                    </DataTableHeaderCell>
                    <DataTableHeaderCell
                      align="right"
                      sortKey="idle_days"
                      activeSort={sort}
                      activeDir={dir}
                      onSort={handleSort}
                    >
                      Idle days
                    </DataTableHeaderCell>
                    {canFinance ? (
                      <>
                        <DataTableHeaderCell
                          align="right"
                          sortKey="revenue_minor"
                          activeSort={sort}
                          activeDir={dir}
                          onSort={handleSort}
                        >
                          Revenue
                        </DataTableHeaderCell>
                        <DataTableHeaderCell
                          align="right"
                          sortKey="net_roi_minor"
                          activeSort={sort}
                          activeDir={dir}
                          onSort={handleSort}
                        >
                          Net ROI
                        </DataTableHeaderCell>
                      </>
                    ) : null}
                  </tr>
                </DataTableHead>
                <DataTableBody>
                  {vehicleQuery.data.items.map((v) => (
                    <DataTableRow key={v.id}>
                      <DataTableCell>
                        <Link
                          href={`/companies/${scope.companyId}/vehicles/${v.id}${suffix}`}
                        >
                          <PlateTag>{v.registration}</PlateTag>
                        </Link>
                      </DataTableCell>
                      <DataTableCell className="font-medium">
                        {v.make} {v.model}
                      </DataTableCell>
                      <DataTableCell align="right" numeric>
                        {formatMinorCurrency(v.daily_rate_minor, currency)}
                      </DataTableCell>
                      <DataTableCell align="right" numeric>
                        {v.stats?.rental_count ?? 0}
                      </DataTableCell>
                      <DataTableCell align="right" numeric>
                        {v.stats?.utilization_pct ?? 0}%
                      </DataTableCell>
                      <DataTableCell align="right" numeric>
                        {v.stats?.idle_days !== null &&
                        v.stats?.idle_days !== undefined
                          ? `${v.stats.idle_days}d`
                          : "—"}
                      </DataTableCell>
                      {canFinance ? (
                        <>
                          <DataTableCell align="right" numeric>
                            {formatMoneyMinor(
                              v.stats?.revenue_minor ?? 0,
                              currency,
                            )}
                          </DataTableCell>
                          <DataTableCell
                            align="right"
                            numeric
                            className="font-semibold"
                          >
                            {formatMoneyMinor(
                              v.stats?.net_roi_minor ?? 0,
                              currency,
                            )}
                          </DataTableCell>
                        </>
                      ) : null}
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            )}
          </DataTableFrame>
        </div>
      ) : null}

      {/* BRANCH COMPARISON VIEW */}
      {view === "branches" ? (
        <DataTableFrame ariaLabel="Branch comparison stats">
          {branchQuery.isPending ? (
            <DataTableSkeleton
              columns={canFinance ? 9 : 6}
              label="Loading branch comparison"
            />
          ) : branchQuery.error || !branchQuery.data ? (
            <div className="p-card">
              <StatePanel title="Branch comparison unavailable">
                {errorText(branchQuery.error)}
              </StatePanel>
            </div>
          ) : branchQuery.data.length === 0 ? (
            <div className="p-card">
              <StatePanel title="No branches in scope">
                No branch metrics matched your active workspace scope.
              </StatePanel>
            </div>
          ) : (
            <DataTable>
              <DataTableHead>
                <tr>
                  <DataTableHeaderCell>Branch</DataTableHeaderCell>
                  <DataTableHeaderCell align="right">Fleet</DataTableHeaderCell>
                  <DataTableHeaderCell align="right">
                    Utilization
                  </DataTableHeaderCell>
                  <DataTableHeaderCell align="right">Rentals</DataTableHeaderCell>
                  <DataTableHeaderCell align="right">
                    Work orders
                  </DataTableHeaderCell>
                  <DataTableHeaderCell align="right">
                    Downtime (hrs)
                  </DataTableHeaderCell>
                  {canFinance ? (
                    <>
                      <DataTableHeaderCell align="right">
                        Revenue
                      </DataTableHeaderCell>
                      <DataTableHeaderCell align="right">
                        Expenses
                      </DataTableHeaderCell>
                      <DataTableHeaderCell align="right">
                        Open AR (live)
                      </DataTableHeaderCell>
                    </>
                  ) : null}
                </tr>
              </DataTableHead>
              <DataTableBody>
                {branchQuery.data.map((b) => (
                  <DataTableRow key={b.branch_id}>
                    <DataTableCell className="font-semibold">
                      {b.branch_name}
                    </DataTableCell>
                    <DataTableCell align="right" numeric>
                      {b.fleet_total}
                    </DataTableCell>
                    <DataTableCell align="right" numeric>
                      {b.utilization_pct}%
                    </DataTableCell>
                    <DataTableCell align="right" numeric>
                      {b.rental_count}
                    </DataTableCell>
                    <DataTableCell align="right" numeric>
                      {b.work_order_count}
                    </DataTableCell>
                    <DataTableCell align="right" numeric>
                      {b.downtime_hours}
                    </DataTableCell>
                    {canFinance ? (
                      <>
                        <DataTableCell align="right" numeric>
                          {formatMoneyMinor(b.revenue_minor ?? 0, currency)}
                        </DataTableCell>
                        <DataTableCell align="right" numeric>
                          {formatMoneyMinor(b.expenses_minor ?? 0, currency)}
                        </DataTableCell>
                        <DataTableCell align="right" numeric>
                          {formatMoneyMinor(b.open_ar_minor ?? 0, currency)}
                        </DataTableCell>
                      </>
                    ) : null}
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          )}
        </DataTableFrame>
      ) : null}
    </div>
  );
}
