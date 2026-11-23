"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarPlus,
  CarFront,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  FileText,
  UserCheck,
  X,
  XCircle,
} from "lucide-react";
import { useSession } from "@/features/auth/session-provider";
import { useLiveContext } from "@/features/live/context";
import { EntityDocumentsPanel } from "@/features/documents/documents-panel";
import {
  LiveDocumentPdfModal,
  type LivePdfDocument,
} from "@/features/pdf/live-pdf-modal";
import { CreateQuotationDialog } from "@/features/quotations/create-quotation-dialog";
import { QuotationsDirectorySection } from "@/features/quotations/quotations-page";
import { RateCardsPanel } from "@/features/operations-srs/rate-cards-panel";
import { LeadsPanel } from "@/features/crm/leads-panel";
import {
  can,
  canAccessLeads,
  canAccessRentals,
  isDriverRole,
  type Rental,
  type Reservation,
} from "@/lib/api/contracts";
import { ApiError, errorText } from "@/lib/api/client";
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
import { Button } from "@/components/ui/button";
import { DriveCoreSelect } from "@/components/ui/drivecore-select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AssignDriverDialog,
  CreateReservationDialog,
  ExtendRentalDialog,
  HandoverReturnDialog,
  StartRentalDialog,
} from "./dialogs";
import { useLiveEntityLookup } from "./entity-lookup";
import {
  nextSortState,
  parseSortParams,
  sortRows,
  type SortDirection,
} from "@/lib/table-sort";
import {
  cancelReservation,
  getRental,
  getReservation,
  listRentals,
  listReservations,
} from "./service";

const RESERVATION_STATUS_TONES: Record<Reservation["status"], StatusDotTone> = {
  confirmed: "success",
  completed: "neutral",
  cancelled: "danger",
};

const RENTAL_STATUS_TONES: Record<Rental["status"], StatusDotTone> = {
  draft: "warning",
  active: "success",
  returned: "neutral",
};

const QUOTATION_SORT_KEYS = [
  "id",
  "customer_name",
  "total_minor",
  "status",
] as const;
const RESERVATION_SORT_KEYS = [
  "id",
  "customer_name",
  "vehicle_registration",
  "starts_at",
  "status",
] as const;
const RENTAL_SORT_KEYS = [
  "id",
  "vehicle_registration",
  "customer_name",
  "driver_name",
  "status",
] as const;

function fmtDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

export function RentalsDirectoryPage({
  defaultTab = "reservations",
}: {
  defaultTab?: "quotations" | "reservations" | "contracts";
} = {}) {
  const { user } = useSession();
  const scope = useLiveContext();
  const searchParams = useSearchParams();
  const client = useQueryClient();

  const driverOnly = !!user && isDriverRole(user);
  const canViewLeads = !!user && canAccessLeads(user);
  const canViewQuotations = !!user && can(user, "quotations.view");
  const canManageQuotations = !!user && can(user, "quotations.manage");
  const canViewReservations = !!user && can(user, "reservations.view");
  const canManageReservations = !!user && can(user, "reservations.manage");
  const canViewRentals = !!user && (can(user, "rentals.view") || driverOnly);
  const canManageRentals = !!user && can(user, "rentals.manage");
  const allowed = !!user && canAccessRentals(user);

  const requestedTab = searchParams.get("tab") ?? defaultTab;
  const activeTab:
    | "leads"
    | "quotations"
    | "reservations"
    | "contracts"
    | "rate_cards" = driverOnly
    ? "contracts"
    : requestedTab === "leads" && canViewLeads
      ? "leads"
      : requestedTab === "rate_cards" && (canViewRentals || canViewQuotations)
        ? "rate_cards"
        : requestedTab === "quotations" && canViewQuotations
          ? "quotations"
          : requestedTab === "contracts" && canViewRentals
            ? "contracts"
            : canViewReservations
              ? "reservations"
              : canViewQuotations
                ? "quotations"
                : "contracts";

  const rawQ = (searchParams.get("q") ?? "").slice(0, 100);
  const rawStatus = searchParams.get("status") ?? "";
  const validStatuses =
    activeTab === "quotations"
      ? [
          "draft",
          "pending_approval",
          "approved",
          "rejected",
          "cancelled",
          "converted",
        ]
      : activeTab === "reservations"
        ? ["confirmed", "cancelled", "completed"]
        : ["draft", "active", "returned"];
  const status = validStatuses.includes(rawStatus) ? rawStatus : "";
  const parsedPage = Number(searchParams.get("page") ?? "1");
  const page =
    Number.isInteger(parsedPage) && parsedPage >= 1 && parsedPage <= 1000000
      ? parsedPage
      : 1;
  const allowedSortKeys =
    activeTab === "quotations"
      ? QUOTATION_SORT_KEYS
      : activeTab === "reservations"
        ? RESERVATION_SORT_KEYS
        : RENTAL_SORT_KEYS;
  const { sort, dir } = parseSortParams(
    searchParams.get("sort"),
    searchParams.get("dir"),
    allowedSortKeys,
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [createQuoteOpen, setCreateQuoteOpen] = useState(false);
  const [startTarget, setStartTarget] = useState<Reservation | null>(null);
  const [notice, setNotice] = useState("");

  const base = `/companies/${scope.companyId}/rentals`;
  const branchSuffix = `?branch=${scope.branch}`;

  function updateQuery(next: {
    tab?: "leads" | "quotations" | "reservations" | "contracts" | "rate_cards";
    q?: string;
    status?: string;
    page?: number;
    sort?: string;
    dir?: SortDirection | "";
  }) {
    const params = new URLSearchParams();
    params.set("branch", scope.branch);
    const nextTab = next.tab ?? activeTab;
    params.set("tab", nextTab);
    const tabChanged = next.tab !== undefined && next.tab !== activeTab;
    const nextQ = (next.q !== undefined ? next.q : rawQ).trim().slice(0, 100);
    const nextStatus = next.status !== undefined ? next.status : status;
    const nextPage = next.page !== undefined ? next.page : 1;
    const nextSort = tabChanged
      ? ""
      : next.sort !== undefined
        ? next.sort
        : sort;
    const nextDir = tabChanged
      ? ""
      : next.dir !== undefined
        ? next.dir
        : dir;
    if (nextQ) params.set("q", nextQ);
    if (nextStatus) params.set("status", nextStatus);
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

  const reservationsQuery = useQuery({
    queryKey: [
      ...scope.key,
      "reservations",
      "list",
      { q: rawQ.trim(), status, page, sort, dir },
    ],
    queryFn: ({ signal }) =>
      listReservations(
        {
          companyId: scope.companyId,
          branch: scope.branch,
          q: rawQ,
          status: status || undefined,
          page,
          sort: sort || undefined,
          dir: dir || undefined,
        },
        signal,
      ),
    enabled: allowed && activeTab === "reservations" && canViewReservations,
    staleTime: 0,
  });

  const rentalsQuery = useQuery({
    queryKey: [
      ...scope.key,
      "rentals",
      "list",
      { q: rawQ.trim(), status, page, driverOnly, sort, dir },
    ],
    queryFn: ({ signal }) =>
      listRentals(
        {
          companyId: scope.companyId,
          branch: scope.branch,
          q: rawQ,
          status: status || undefined,
          page,
          sort: sort || undefined,
          dir: dir || undefined,
        },
        signal,
      ),
    enabled: allowed && activeTab === "contracts" && canViewRentals,
    staleTime: 0,
  });

  const reservationItems = reservationsQuery.data?.items ?? [];
  const rentalItems = rentalsQuery.data?.items ?? [];
  const lookup = useLiveEntityLookup({
    customerIds: allowed
      ? [
          ...reservationItems.map((r) => r.customer_id),
          ...rentalItems.map((r) => r.customer_id),
        ]
      : [],
    vehicleIds: allowed
      ? [
          ...reservationItems.map((r) => r.vehicle_id),
          ...rentalItems.map((r) => r.vehicle_id),
        ]
      : [],
    reservationIds: allowed
      ? rentalItems
          .filter((r) => !r.customer_name && !r.customer_id)
          .map((r) => r.reservation_id)
      : [],
    driverIds: allowed ? rentalItems.map((r) => r.driver_user_id) : [],
  });

  if (!allowed) {
    return (
      <StatePanel title="Access denied">
        Your account does not have permission to view reservations or rental
        contracts.
      </StatePanel>
    );
  }

  const chips: ActiveFilterChip[] = [];
  if (rawQ.trim()) {
    chips.push({
      key: "q",
      label: `Search: ${rawQ.trim()}`,
      onRemove: () => updateQuery({ q: "", page: 1 }),
    });
  }
  if (status) {
    chips.push({
      key: "status",
      label: `Status: ${status.charAt(0).toUpperCase() + status.slice(1)}`,
      onRemove: () => updateQuery({ status: "", page: 1 }),
    });
  }

  const statusOptions =
    activeTab === "reservations"
      ? [
          { value: "", label: "All statuses" },
          { value: "confirmed", label: "Confirmed" },
          { value: "completed", label: "Completed" },
          { value: "cancelled", label: "Cancelled" },
        ]
      : [
          { value: "", label: "All statuses" },
          { value: "draft", label: "Draft (awaiting handover)" },
          { value: "active", label: "Active (on rental)" },
          { value: "returned", label: "Returned" },
        ];

  const activeQuery =
    activeTab === "reservations" ? reservationsQuery : rentalsQuery;

  return (
    <ViewFadeIn className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-page-title font-extrabold tracking-tight">
              Rentals
            </h1>
            {driverOnly ? (
              <span className="rounded-md bg-structural px-2 py-0.5 font-mono text-[11px] font-semibold uppercase text-structural-foreground">
                Assigned to you
              </span>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {driverOnly
              ? "Assigned rental contracts for handover, return, and photo uploads"
              : "Live quotations, vehicle reservations, rental contracts, driver assignment, extensions, and returns"}{" "}
            for {scope.company?.name}.
          </p>
        </div>
        {!driverOnly ? (
          <div className="flex flex-wrap items-center gap-2">
            {canManageQuotations ? (
              <Button
                type="button"
                variant={activeTab === "quotations" ? "default" : "outline"}
                onClick={() => setCreateQuoteOpen(true)}
                className="gap-1.5"
              >
                <FileSpreadsheet className="size-4" aria-hidden="true" />
                Create quotation
              </Button>
            ) : null}
            {canManageReservations ? (
              <Button
                type="button"
                variant={activeTab === "quotations" ? "outline" : "default"}
                onClick={() => setCreateOpen(true)}
                className="gap-1.5"
              >
                <CalendarPlus className="size-4" aria-hidden="true" />
                Create reservation
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {!driverOnly &&
      [canViewQuotations, canViewReservations, canViewRentals].filter(Boolean)
        .length > 1 ? (
        <div
          role="tablist"
          aria-label="Rentals sections"
          className="flex flex-wrap gap-1.5 rounded-2xl border bg-surface p-1.5"
        >
          {(
            [
              ...(canViewLeads ? ([["leads", "Leads"]] as const) : []),
              ...(canViewQuotations ? ([["quotations", "Quotations"]] as const) : []),
              ...(canViewReservations
                ? ([["reservations", "Reservations"]] as const)
                : []),
              ...(canViewRentals
                ? ([["contracts", "Rental contracts"]] as const)
                : []),
              ...(canViewRentals || canViewQuotations
                ? ([["rate_cards", "Rate cards"]] as const)
                : []),
            ] as const
          ).map(([key, text]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={activeTab === key}
              onClick={() =>
                updateQuery({ tab: key, q: "", status: "", page: 1 })
              }
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors ${
                activeTab === key
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              }`}
            >
              {key === "leads" ? (
                <UserCheck className="size-3.5" aria-hidden="true" />
              ) : key === "quotations" ? (
                <FileText className="size-3.5" aria-hidden="true" />
              ) : key === "reservations" ? (
                <CalendarPlus className="size-3.5" aria-hidden="true" />
              ) : key === "contracts" ? (
                <CarFront className="size-3.5" aria-hidden="true" />
              ) : (
                <FileSpreadsheet className="size-3.5" aria-hidden="true" />
              )}
              {text}
            </button>
          ))}
        </div>
      ) : null}

      {notice ? (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-2xl border border-success bg-success/10 px-4 py-3 text-sm text-success-foreground"
        >
          <span>{notice}</span>
          <button
            type="button"
            aria-label="Dismiss notice"
            onClick={() => setNotice("")}
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {activeTab === "leads" ? (
        <LeadsPanel />
      ) : activeTab === "rate_cards" ? (
        <RateCardsPanel
          canManage={canManageRentals || canManageQuotations}
        />
      ) : activeTab === "quotations" ? (
        <QuotationsDirectorySection
          q={rawQ}
          status={status}
          page={page}
          sort={sort}
          dir={dir}
          onUpdateQuery={(next) => updateQuery({ tab: "quotations", ...next })}
        />
      ) : (
      <DataTableFrame
        ariaLabel={
          activeTab === "reservations"
            ? "Reservations directory"
            : "Rental contracts directory"
        }
        chips={chips}
        onClearAll={
          chips.length > 0
            ? () => updateQuery({ q: "", status: "", page: 1 })
            : undefined
        }
        toolbar={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <DataSearchForm
              label={
                activeTab === "reservations"
                  ? "Search reservations"
                  : "Search rental contracts"
              }
              placeholder="Search customer, vehicle registration, or notes…"
              defaultValue={rawQ}
              formKey={`${scope.companyId}:${scope.branch}:${activeTab}:${rawQ}`}
              onSubmitQuery={(nextQ) => updateQuery({ q: nextQ, page: 1 })}
            />
            <div className="w-full space-y-1.5 sm:w-56">
              <span className="block text-label font-semibold">Status</span>
              <DriveCoreSelect
                ariaLabel="Filter by status"
                value={status}
                onValueChange={(nextStatus) =>
                  updateQuery({ status: nextStatus, page: 1 })
                }
                options={statusOptions}
              />
            </div>
          </div>
        }
        footer={
          activeQuery.data ? (
            <>
              <span className="font-mono text-xs tabular-nums">
                {activeQuery.data.total}{" "}
                {activeQuery.data.total === 1 ? "record" : "records"} · Page{" "}
                {activeQuery.data.page} of {activeQuery.data.lastPage}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={page <= 1 || activeQuery.isFetching}
                  onClick={() => updateQuery({ page: Math.max(1, page - 1) })}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={
                    page >= activeQuery.data.lastPage || activeQuery.isFetching
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
        {activeQuery.isPending ? (
          <DataTableSkeleton columns={6} label="Loading records" />
        ) : activeQuery.error ? (
          <div className="p-card">
            <StatePanel
              title="Directory unavailable"
              onRetry={() => {
                void activeQuery.refetch();
              }}
            >
              {errorText(activeQuery.error)}
            </StatePanel>
          </div>
        ) : activeQuery.data.items.length === 0 ? (
          <div className="p-card">
            <StatePanel
              title={
                chips.length > 0
                  ? "No matching records"
                  : activeTab === "reservations"
                    ? "No reservations yet"
                    : driverOnly
                      ? "No assigned rentals"
                      : "No rental contracts yet"
              }
            >
              {chips.length > 0 ? (
                <div className="space-y-3">
                  <p>No records matched your search or status filter.</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => updateQuery({ q: "", status: "", page: 1 })}
                  >
                    Clear search and filters
                  </Button>
                </div>
              ) : (
                <p>
                  {driverOnly
                    ? "Rentals assigned to your account will appear here."
                    : "Records created in this company and branch scope will appear here."}
                </p>
              )}
            </StatePanel>
          </div>
        ) : activeTab === "reservations" ? (
          <DataTable>
            <DataTableHead>
              <tr>
                <DataTableHeaderCell
                  sortKey="id"
                  activeSort={sort}
                  activeDir={dir}
                  onSort={handleSort}
                >
                  Reservation
                </DataTableHeaderCell>
                <DataTableHeaderCell
                  sortKey="customer_name"
                  activeSort={sort}
                  activeDir={dir}
                  onSort={handleSort}
                >
                  Customer
                </DataTableHeaderCell>
                <DataTableHeaderCell
                  sortKey="vehicle_registration"
                  activeSort={sort}
                  activeDir={dir}
                  onSort={handleSort}
                >
                  Vehicle
                </DataTableHeaderCell>
                <DataTableHeaderCell
                  sortKey="starts_at"
                  activeSort={sort}
                  activeDir={dir}
                  onSort={handleSort}
                >
                  Period
                </DataTableHeaderCell>
                <DataTableHeaderCell
                  sortKey="status"
                  activeSort={sort}
                  activeDir={dir}
                  onSort={handleSort}
                >
                  Status
                </DataTableHeaderCell>
                <DataTableHeaderCell align="right">Actions</DataTableHeaderCell>
              </tr>
            </DataTableHead>
            <DataTableBody>
              {sortRows(reservationItems, sort, dir, {
                id: (r) => r.id,
                customer_name: (r) => lookup.customerName(r),
                vehicle_registration: (r) => lookup.vehicleDisplay(r).registration,
                starts_at: (r) => Date.parse(r.starts_at),
                status: (r) => r.status,
              }).map((res) => {
                const custName = lookup.customerName(res);
                const custHref = lookup.customerHref(res);
                const veh = lookup.vehicleDisplay(res);
                const vehHref = lookup.vehicleHref(res.vehicle_id);
                return (
                  <DataTableRow key={res.id}>
                    <DataTableCell numeric>
                      <Link
                        href={`/companies/${scope.companyId}/reservations/${res.id}${branchSuffix}`}
                        className="font-semibold text-foreground hover:text-link hover:underline"
                      >
                        #{res.id}
                      </Link>
                    </DataTableCell>
                    <DataTableCell className="max-w-[14rem]">
                      {custHref ? (
                        <Link
                          href={custHref}
                          title={custName}
                          className="block truncate font-medium text-link hover:underline"
                        >
                          {custName}
                        </Link>
                      ) : (
                        <span
                          title={custName}
                          className="block truncate font-medium"
                        >
                          {custName}
                        </span>
                      )}
                    </DataTableCell>
                    <DataTableCell className="max-w-[16rem]">
                      {vehHref ? (
                        <Link
                          href={vehHref}
                          title={veh.full}
                          className="group/veh flex min-w-0 flex-col gap-0.5"
                        >
                          <PlateTag className="group-hover/veh:border-link/50 group-hover/veh:text-link">
                            {veh.registration}
                          </PlateTag>
                          {veh.makeModel ? (
                            <span className="truncate text-xs text-muted-foreground group-hover/veh:text-link group-hover/veh:underline">
                              {veh.makeModel}
                            </span>
                          ) : null}
                        </Link>
                      ) : (
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <PlateTag>{veh.registration}</PlateTag>
                          {veh.makeModel ? (
                            <span
                              title={veh.makeModel}
                              className="truncate text-xs text-muted-foreground"
                            >
                              {veh.makeModel}
                            </span>
                          ) : null}
                        </div>
                      )}
                    </DataTableCell>
                    <DataTableCell numeric className="text-muted-foreground">
                      <div>{fmtDate(res.starts_at)}</div>
                      <div>→ {fmtDate(res.ends_at)}</div>
                    </DataTableCell>
                    <DataTableCell>
                      <StatusDotBadge tone={RESERVATION_STATUS_TONES[res.status]}>
                        {res.status.charAt(0).toUpperCase() +
                          res.status.slice(1)}
                      </StatusDotBadge>
                    </DataTableCell>
                    <DataTableCell align="right">
                      <div className="inline-flex items-center gap-2">
                        {res.status === "confirmed" &&
                        !res.has_rental &&
                        canManageRentals ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setStartTarget(res)}
                            className="transition-transform duration-150 ease-out active:scale-[0.98]"
                          >
                            Start contract
                          </Button>
                        ) : null}
                        <Link
                          href={`/companies/${scope.companyId}/reservations/${res.id}${branchSuffix}`}
                          className="text-xs font-medium text-link hover:underline"
                        >
                          Open
                        </Link>
                      </div>
                    </DataTableCell>
                  </DataTableRow>
                );
              })}
            </DataTableBody>
          </DataTable>
        ) : (
          <DataTable>
            <DataTableHead>
              <tr>
                <DataTableHeaderCell
                  sortKey="id"
                  activeSort={sort}
                  activeDir={dir}
                  onSort={handleSort}
                >
                  Contract
                </DataTableHeaderCell>
                <DataTableHeaderCell
                  sortKey="vehicle_registration"
                  activeSort={sort}
                  activeDir={dir}
                  onSort={handleSort}
                >
                  Vehicle
                </DataTableHeaderCell>
                <DataTableHeaderCell
                  sortKey="customer_name"
                  activeSort={sort}
                  activeDir={dir}
                  onSort={handleSort}
                >
                  Customer
                </DataTableHeaderCell>
                <DataTableHeaderCell
                  sortKey="driver_name"
                  activeSort={sort}
                  activeDir={dir}
                  onSort={handleSort}
                >
                  Driver
                </DataTableHeaderCell>
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
            </DataTableHead>
            <DataTableBody>
              {sortRows(rentalItems, sort, dir, {
                id: (r) => r.id,
                vehicle_registration: (r) => lookup.vehicleDisplay(r).registration,
                customer_name: (r) => lookup.customerName(r),
                driver_name: (r) => {
                  const name = lookup.driverDisplay(r).name;
                  return name === "Unassigned" ? null : name;
                },
                status: (r) => r.status,
              }).map((rental) => {
                const custName = lookup.customerName(rental);
                const custHref = lookup.customerHref(rental);
                const veh = lookup.vehicleDisplay(rental);
                const vehHref = lookup.vehicleHref(rental.vehicle_id);
                const driver = lookup.driverDisplay(rental);
                return (
                  <DataTableRow key={rental.id}>
                    <DataTableCell numeric>
                      <Link
                        href={`${base}/${rental.id}${branchSuffix}`}
                        className="font-semibold text-foreground hover:text-link hover:underline"
                      >
                        Rental #{rental.id}
                      </Link>
                    </DataTableCell>
                    <DataTableCell className="max-w-[16rem]">
                      {vehHref ? (
                        <Link
                          href={vehHref}
                          title={veh.full}
                          className="group/veh flex min-w-0 flex-col gap-0.5"
                        >
                          <PlateTag className="group-hover/veh:border-link/50 group-hover/veh:text-link">
                            {veh.registration}
                          </PlateTag>
                          {veh.makeModel ? (
                            <span className="truncate text-xs text-muted-foreground group-hover/veh:text-link group-hover/veh:underline">
                              {veh.makeModel}
                            </span>
                          ) : null}
                        </Link>
                      ) : (
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <PlateTag>{veh.registration}</PlateTag>
                          {veh.makeModel ? (
                            <span
                              title={veh.makeModel}
                              className="truncate text-xs text-muted-foreground"
                            >
                              {veh.makeModel}
                            </span>
                          ) : null}
                        </div>
                      )}
                    </DataTableCell>
                    <DataTableCell className="max-w-[14rem]">
                      {custHref ? (
                        <Link
                          href={custHref}
                          title={custName}
                          className="block truncate font-medium text-link hover:underline"
                        >
                          {custName}
                        </Link>
                      ) : (
                        <span
                          title={custName}
                          className="block truncate font-medium"
                        >
                          {custName}
                        </span>
                      )}
                    </DataTableCell>
                    <DataTableCell className="max-w-[12rem] text-xs text-muted-foreground">
                      {driver.href ? (
                        <Link
                          href={driver.href}
                          title={driver.name}
                          className="block truncate font-medium text-link hover:underline"
                        >
                          {driver.name}
                        </Link>
                      ) : (
                        <span
                          title={driver.name}
                          className="block truncate"
                        >
                          {driver.name}
                        </span>
                      )}
                    </DataTableCell>
                    <DataTableCell>
                      <StatusDotBadge tone={RENTAL_STATUS_TONES[rental.status]}>
                        {rental.status.charAt(0).toUpperCase() +
                          rental.status.slice(1)}
                      </StatusDotBadge>
                    </DataTableCell>
                    <DataTableCell align="right">
                      <Link
                        href={`${base}/${rental.id}${branchSuffix}`}
                        className="text-xs font-medium text-link hover:underline"
                      >
                        Manage
                      </Link>
                    </DataTableCell>
                  </DataTableRow>
                );
              })}
            </DataTableBody>
          </DataTable>
        )}
      </DataTableFrame>
      )}

      <CreateQuotationDialog
        open={createQuoteOpen}
        onOpenChange={setCreateQuoteOpen}
        onCreated={(created) => {
          void client.invalidateQueries({
            queryKey: [...scope.key, "quotations"],
          });
          scope.navigate(
            `/companies/${scope.companyId}/quotations/${created.id}${branchSuffix}`,
          );
        }}
      />

      <CreateReservationDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(created, rental, warning) => {
          void client.invalidateQueries({
            queryKey: [...scope.key, "reservations"],
          });
          if (rental) {
            void client.invalidateQueries({
              queryKey: [...scope.key, "rentals"],
            });
            scope.navigate(`${base}/${rental.id}${branchSuffix}`);
            return;
          }
          setNotice(
            warning || `Reservation #${created.id} created.`,
          );
        }}
      />

      <StartRentalDialog
        reservation={startTarget}
        onClose={() => setStartTarget(null)}
        onCreated={(created) => {
          void client.invalidateQueries({
            queryKey: [...scope.key, "reservations"],
          });
          void client.invalidateQueries({
            queryKey: [...scope.key, "rentals"],
          });
          scope.navigate(`${base}/${created.id}${branchSuffix}`);
        }}
      />
    </ViewFadeIn>
  );
}

export function ReservationDetailPage() {
  const { reservationId } = useParams<{ reservationId: string }>();
  const { user } = useSession();
  const scope = useLiveContext();
  const client = useQueryClient();

  const valid =
    /^[1-9]\d*$/.test(reservationId ?? "") &&
    Number.isSafeInteger(Number(reservationId));
  const canView = !!user && can(user, "reservations.view");
  const canCancel = !!user && can(user, "reservations.manage");
  const canCreateRental = !!user && can(user, "rentals.manage");

  const [startOpen, setStartOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState("");

  const query = useQuery({
    queryKey: [...scope.key, "reservations", reservationId],
    queryFn: ({ signal }) =>
      getReservation(reservationId, scope.companyId, scope.branch, signal),
    enabled: valid && canView,
    staleTime: 0,
  });

  const lookup = useLiveEntityLookup({
    customerIds: query.data ? [query.data.customer_id] : [],
    vehicleIds: query.data ? [query.data.vehicle_id] : [],
  });

  const backHref = `/companies/${scope.companyId}/rentals?tab=reservations&branch=${scope.branch}`;

  if (!valid) {
    return (
      <StatePanel title="Page unavailable" href={backHref} linkLabel="Back to rentals">
        The reservation URL is invalid.
      </StatePanel>
    );
  }
  if (!canView) {
    return (
      <StatePanel title="Access denied">
        Your account does not have permission to view reservations.
      </StatePanel>
    );
  }
  if (query.isPending) {
    return (
      <div role="status" className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-44 w-full rounded-2xl" />
      </div>
    );
  }
  if (query.error || !query.data) {
    return (
      <StatePanel
        title="Reservation unavailable"
        onRetry={() => {
          void query.refetch();
        }}
      >
        {errorText(query.error)}
      </StatePanel>
    );
  }

  const res = query.data;
  const resCustomerName = lookup.customerName(res);
  const resVehicle = lookup.vehicleDisplay(res);
  const resBranchName = scope.directory?.branches.find(
    (b) => b.id === res.branch_id,
  )?.name;
  const resPdfDoc: LivePdfDocument = {
    kind: "reservation",
    id: res.id,
    status: res.status,
    companyName: scope.company?.name ?? `Company #${res.company_id}`,
    branchName: resBranchName,
    currency: scope.company?.currency || "ZMW",
    customerName: resCustomerName,
    createdAt: res.created_at,
    startsAt: res.starts_at,
    endsAt: res.ends_at,
    lines: [
      {
        label: resVehicle.full,
        detail: `Reservation #${res.id}`,
      },
    ],
    serverPdfPath: `api/v1/reservations/${res.id}/pdf`,
  };

  async function handleCancel() {
    if (cancelling) return;
    setCancelling(true);
    setError(null);
    const ac = new AbortController();
    try {
      await cancelReservation(res.id, ac.signal);
      setNotice(`Reservation #${res.id} cancelled.`);
      await client.invalidateQueries({
        queryKey: [...scope.key, "reservations"],
      });
    } catch (failure) {
      setError(failure);
    } finally {
      setCancelling(false);
    }
  }

  return (
    <ViewFadeIn className="space-y-6">
      <Link className="inline-block text-sm text-link hover:underline" href={backHref}>
        Back to reservations
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-page-title font-extrabold tracking-tight">
              Reservation #{res.id}
            </h1>
            <StatusDotBadge tone={RESERVATION_STATUS_TONES[res.status]}>
              {res.status.charAt(0).toUpperCase() + res.status.slice(1)}
            </StatusDotBadge>
          </div>
          <p
            title={`${resCustomerName} · ${resVehicle.full}`}
            className="max-w-xl truncate text-sm text-muted-foreground"
          >
            {resCustomerName} · {resVehicle.full}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setPdfOpen(true)}
            className="gap-1.5"
          >
            <FileText className="size-4" aria-hidden="true" />
            Export PDF
          </Button>
          {res.rental_id ? (
            <Link
              href={`/companies/${scope.companyId}/rentals/${res.rental_id}?branch=${scope.branch}`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary-hover"
            >
              <CarFront className="size-4" aria-hidden="true" />
              Open rental #{res.rental_id}
            </Link>
          ) : res.status === "confirmed" ? (
            <>
              {canCreateRental ? (
                <Button type="button" onClick={() => setStartOpen(true)}>
                  Create rental contract
                </Button>
              ) : null}
              {canCancel ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={cancelling}
                  onClick={() => {
                    void handleCancel();
                  }}
                >
                  <XCircle className="mr-1.5 size-4" aria-hidden="true" />
                  {cancelling ? "Cancelling…" : "Cancel reservation"}
                </Button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      {notice ? (
        <p
          role="status"
          className="rounded-xl border border-success bg-success/10 px-4 py-3 text-sm text-success-foreground"
        >
          {notice}
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-danger bg-danger/10 px-4 py-3 text-sm text-danger-foreground"
        >
          {error instanceof ApiError && error.status === 409
            ? "Cannot cancel a reservation that already has a rental contract or is not confirmed."
            : errorText(error)}
        </p>
      ) : null}

      <section className="dc-shadow-card grid gap-5 rounded-2xl border bg-surface p-card sm:grid-cols-2 lg:grid-cols-4">
        <div className="min-w-0">
          <p className="text-label text-muted-foreground">Customer</p>
          <p className="mt-1 text-sm font-semibold">
            {lookup.customerHref(res) ? (
              <Link
                href={lookup.customerHref(res)!}
                title={resCustomerName}
                className="block truncate text-link hover:underline"
              >
                {resCustomerName}
              </Link>
            ) : (
              <span title={resCustomerName} className="block truncate">
                {resCustomerName}
              </span>
            )}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-label text-muted-foreground">Vehicle</p>
          <p className="mt-1 text-sm font-semibold">
            {lookup.vehicleHref(res.vehicle_id) ? (
              <Link
                href={lookup.vehicleHref(res.vehicle_id)!}
                title={resVehicle.full}
                className="block truncate text-link hover:underline"
              >
                {resVehicle.full}
              </Link>
            ) : (
              <span title={resVehicle.full} className="block truncate">
                {resVehicle.full}
              </span>
            )}
          </p>
        </div>
        <div>
          <p className="text-label text-muted-foreground">Departure</p>
          <p className="mt-1 font-mono text-xs font-medium tabular-nums">
            {fmtDate(res.starts_at)}
          </p>
        </div>
        <div>
          <p className="text-label text-muted-foreground">Expected return</p>
          <p className="mt-1 font-mono text-xs font-medium tabular-nums">
            {fmtDate(res.ends_at)}
          </p>
        </div>
      </section>

      {can(user!, "documents.view") ? (
        <EntityDocumentsPanel
          entityType="reservation"
          entityId={res.id}
          branchId={res.branch_id}
          canUpload={can(user!, "documents.manage")}
        />
      ) : null}

      <StartRentalDialog
        reservation={startOpen ? res : null}
        onClose={() => setStartOpen(false)}
        onCreated={(created) => {
          void client.invalidateQueries({
            queryKey: [...scope.key, "reservations"],
          });
          scope.navigate(
            `/companies/${scope.companyId}/rentals/${created.id}?branch=${scope.branch}`,
          );
        }}
      />

      <LiveDocumentPdfModal
        doc={pdfOpen ? resPdfDoc : null}
        onClose={() => setPdfOpen(false)}
      />
    </ViewFadeIn>
  );
}

export function RentalDetailPage() {
  const { rentalId } = useParams<{ rentalId: string }>();
  const { user } = useSession();
  const scope = useLiveContext();
  const client = useQueryClient();

  const valid =
    /^[1-9]\d*$/.test(rentalId ?? "") && Number.isSafeInteger(Number(rentalId));
  const driverOnly = !!user && isDriverRole(user);
  const canView = !!user && (can(user, "rentals.view") || driverOnly);
  const canManage = !!user && can(user, "rentals.manage");

  const [transitionMode, setTransitionMode] = useState<
    "handover" | "return" | null
  >(null);
  const [extendOpen, setExtendOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [notice, setNotice] = useState("");

  const query = useQuery({
    queryKey: [...scope.key, "rentals", rentalId],
    queryFn: ({ signal }) =>
      getRental(rentalId, scope.companyId, scope.branch, signal),
    enabled: valid && canView,
    staleTime: 0,
  });

  const lookup = useLiveEntityLookup({
    customerIds: query.data ? [query.data.customer_id] : [],
    vehicleIds: query.data ? [query.data.vehicle_id] : [],
    reservationIds:
      query.data &&
      ((!query.data.customer_name && !query.data.customer_id) ||
        !query.data.starts_at ||
        !query.data.ends_at)
        ? [query.data.reservation_id]
        : [],
    driverIds: query.data ? [query.data.driver_user_id] : [],
  });

  const backHref = `/companies/${scope.companyId}/rentals?tab=contracts&branch=${scope.branch}`;

  if (!valid) {
    return (
      <StatePanel title="Page unavailable" href={backHref} linkLabel="Back to rentals">
        The rental contract URL is invalid.
      </StatePanel>
    );
  }
  if (!canView) {
    return (
      <StatePanel title="Access denied">
        Your account does not have permission to view rental contracts.
      </StatePanel>
    );
  }
  if (query.isPending) {
    return (
      <div role="status" className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-52 w-full rounded-2xl" />
      </div>
    );
  }
  if (query.error || !query.data) {
    return (
      <StatePanel
        title="Rental unavailable"
        onRetry={() => {
          void query.refetch();
        }}
      >
        {errorText(query.error)}
      </StatePanel>
    );
  }

  const rental = query.data;
  const rentalCustomerName = lookup.customerName(rental);
  const rentalCustomerHref = lookup.customerHref(rental);
  const rentalVehicle = lookup.vehicleDisplay(rental);
  const rentalVehicleHref = lookup.vehicleHref(rental.vehicle_id);
  const rentalDriver = lookup.driverDisplay(rental);
  const rentalWindow = lookup.reservationWindow(rental);
  const rentalBranchName = scope.directory?.branches.find(
    (b) => b.id === rental.branch_id,
  )?.name;
  const rentalPdfDoc: LivePdfDocument = {
    kind: "rental",
    id: rental.id,
    status: rental.status,
    companyName: scope.company?.name ?? `Company #${rental.company_id}`,
    branchName: rentalBranchName,
    currency: scope.company?.currency || "ZMW",
    customerName: rentalCustomerName,
    createdAt: rental.created_at,
    startsAt: rentalWindow.starts_at,
    endsAt: rentalWindow.ends_at,
    lines: [
      {
        label: rentalVehicle.full,
        detail: `Driver: ${rentalDriver.name} · Reservation #${rental.reservation_id}`,
      },
      ...(rental.handover_odometer !== null
        ? [
            {
              label: "Handover odometer",
              detail: `${rental.handover_odometer.toLocaleString()} ${rental.odometer_unit}`,
            },
          ]
        : []),
      ...(rental.return_odometer !== null
        ? [
            {
              label: "Return odometer",
              detail: `${rental.return_odometer.toLocaleString()} ${rental.odometer_unit}`,
            },
          ]
        : []),
    ],
    notes: rental.return_notes || rental.handover_notes,
    serverPdfPath: `api/v1/rentals/${rental.id}/pdf`,
  };
  const isAssignedDriver = driverOnly && rental.driver_user_id === user!.id;
  const canHandoverOrReturn = canManage || isAssignedDriver;
  const canViewDocs = can(user!, "documents.view") || isAssignedDriver;
  const canUploadDocs = can(user!, "documents.manage") || isAssignedDriver;
  const canViewReservation = can(user!, "reservations.view");
  const canViewInvoices = can(user!, "invoices.view");

  async function refreshAll() {
    await Promise.all([
      client.invalidateQueries({ queryKey: [...scope.key, "rentals"] }),
      client.invalidateQueries({ queryKey: [...scope.key, "vehicles"] }),
      client.invalidateQueries({ queryKey: [...scope.key, "reservations"] }),
      client.invalidateQueries({ queryKey: [...scope.key, "invoices"] }),
    ]);
  }

  return (
    <ViewFadeIn className="space-y-6">
      <Link className="inline-block text-sm text-link hover:underline" href={backHref}>
        Back to rental contracts
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-page-title font-extrabold tracking-tight">
              Rental #{rental.id}
            </h1>
            <StatusDotBadge tone={RENTAL_STATUS_TONES[rental.status]}>
              {rental.status.charAt(0).toUpperCase() + rental.status.slice(1)}
            </StatusDotBadge>
            {rentalVehicleHref ? (
              <Link
                href={rentalVehicleHref}
                title={rentalVehicle.full}
                className="group inline-flex min-w-0 items-center gap-2"
              >
                <PlateTag className="group-hover:border-link/50 group-hover:text-link">
                  {rentalVehicle.registration}
                </PlateTag>
                {rentalVehicle.makeModel ? (
                  <span className="max-w-[16rem] truncate text-sm font-medium text-muted-foreground group-hover:text-link group-hover:underline">
                    {rentalVehicle.makeModel}
                  </span>
                ) : null}
              </Link>
            ) : (
              <>
                <PlateTag>{rentalVehicle.registration}</PlateTag>
                {rentalVehicle.makeModel ? (
                  <span
                    title={rentalVehicle.makeModel}
                    className="max-w-[16rem] truncate text-sm font-medium text-muted-foreground"
                  >
                    {rentalVehicle.makeModel}
                  </span>
                ) : null}
              </>
            )}
          </div>
          <p className="flex max-w-xl flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            {rentalCustomerHref ? (
              <Link
                href={rentalCustomerHref}
                title={rentalCustomerName}
                className="max-w-[20rem] truncate font-medium text-link hover:underline"
              >
                {rentalCustomerName}
              </Link>
            ) : (
              <span
                title={rentalCustomerName}
                className="max-w-[20rem] truncate"
              >
                {rentalCustomerName}
              </span>
            )}
            <span aria-hidden="true">·</span>
            {canViewReservation ? (
              <Link
                href={`/companies/${scope.companyId}/reservations/${rental.reservation_id}?branch=${encodeURIComponent(scope.branch)}`}
                className="shrink-0 text-link hover:underline"
              >
                Reservation #{rental.reservation_id}
              </Link>
            ) : (
              <span className="shrink-0">
                Reservation #{rental.reservation_id}
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {canViewInvoices && rental.invoice_id ? (
            <Link
              href={`/companies/${scope.companyId}/finance/invoices/${rental.invoice_id}?branch=${encodeURIComponent(scope.branch)}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-surface px-3.5 text-xs font-semibold text-link hover:border-link/50 hover:bg-muted/50"
            >
              <FileText className="size-4" aria-hidden="true" />
              Open invoice #{rental.invoice_id}
            </Link>
          ) : null}
          <Button
            type="button"
            variant="outline"
            onClick={() => setPdfOpen(true)}
            className="gap-1.5"
          >
            <FileText className="size-4" aria-hidden="true" />
            Export PDF
          </Button>
          {canManage && rental.status !== "returned" ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setAssignOpen(true)}
              className="gap-1.5"
            >
              <UserCheck className="size-4" aria-hidden="true" />
              Assign driver
            </Button>
          ) : null}
          {canHandoverOrReturn && rental.status === "draft" ? (
            <Button
              type="button"
              onClick={() => setTransitionMode("handover")}
            >
              Complete handover
            </Button>
          ) : null}
          {canManage && rental.status === "active" ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setExtendOpen(true)}
              className="gap-1.5"
            >
              <Clock className="size-4" aria-hidden="true" />
              Extend rental
            </Button>
          ) : null}
          {canHandoverOrReturn && rental.status === "active" ? (
            <Button
              type="button"
              onClick={() => setTransitionMode("return")}
              className="gap-1.5"
            >
              <CheckCircle2 className="size-4" aria-hidden="true" />
              Record return
            </Button>
          ) : null}
        </div>
      </div>

      {notice ? (
        <div
          role="status"
          className="flex items-center justify-between gap-2 rounded-2xl border border-success bg-success/10 px-4 py-3 text-sm text-success-foreground"
        >
          <span>{notice}</span>
          <button
            type="button"
            aria-label="Dismiss notice"
            onClick={() => setNotice("")}
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="dc-shadow-card space-y-4 rounded-2xl border bg-surface p-card lg:col-span-2">
          <h2 className="text-section-heading">Handover &amp; return telemetry</h2>
          <dl className="grid gap-5 sm:grid-cols-2">
            <div>
              <dt className="text-label text-muted-foreground">Handed over at</dt>
              <dd className="mt-1 font-mono text-xs font-medium">
                {fmtDate(rental.handed_over_at)}
              </dd>
            </div>
            <div>
              <dt className="text-label text-muted-foreground">
                Handover odometer
              </dt>
              <dd className="mt-1 font-mono text-sm font-semibold tabular-nums">
                {rental.handover_odometer !== null
                  ? `${rental.handover_odometer.toLocaleString()} ${rental.odometer_unit}`
                  : "Pending handover"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-label text-muted-foreground">Handover notes</dt>
              <dd className="mt-1 text-sm">
                {rental.handover_notes || "No handover notes recorded yet."}
              </dd>
            </div>
            <div>
              <dt className="text-label text-muted-foreground">Returned at</dt>
              <dd className="mt-1 font-mono text-xs font-medium">
                {fmtDate(rental.returned_at)}
              </dd>
            </div>
            <div>
              <dt className="text-label text-muted-foreground">Return odometer</dt>
              <dd className="mt-1 font-mono text-sm font-semibold tabular-nums">
                {rental.return_odometer !== null
                  ? `${rental.return_odometer.toLocaleString()} ${rental.odometer_unit}`
                  : "Pending return"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-label text-muted-foreground">Return notes</dt>
              <dd className="mt-1 text-sm">
                {rental.return_notes || "No return notes recorded yet."}
              </dd>
            </div>
          </dl>
        </section>

        <section className="dc-shadow-card space-y-4 rounded-2xl border bg-surface p-card">
          <h2 className="text-section-heading">Dispatch context</h2>
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="text-label text-muted-foreground">Assigned driver</dt>
              <dd className="mt-1 font-semibold">
                {rentalDriver.href ? (
                  <Link
                    href={rentalDriver.href}
                    title={rentalDriver.name}
                    className="block truncate text-link hover:underline"
                  >
                    {rentalDriver.name}
                  </Link>
                ) : (
                  <span title={rentalDriver.name} className="block truncate">
                    {rentalDriver.name}
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-label text-muted-foreground">
                Scheduled start
              </dt>
              <dd className="mt-1 font-mono text-xs tabular-nums">
                {fmtDate(rentalWindow.starts_at)}
              </dd>
            </div>
            <div>
              <dt className="text-label text-muted-foreground">
                Expected return
              </dt>
              <dd className="mt-1 font-mono text-xs tabular-nums">
                {fmtDate(rentalWindow.ends_at)}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      {canViewDocs ? (
        <EntityDocumentsPanel
          entityType="rental"
          entityId={rental.id}
          branchId={rental.branch_id}
          canUpload={canUploadDocs}
        />
      ) : null}

      <HandoverReturnDialog
        rental={transitionMode ? rental : null}
        mode={transitionMode ?? "handover"}
        scheduledAt={
          transitionMode === "handover"
            ? rentalWindow.starts_at
            : rentalWindow.ends_at
        }
        onClose={() => setTransitionMode(null)}
        onCompleted={(updated) => {
          setNotice(
            updated.status === "active"
              ? `Rental #${updated.id} handed over.`
              : `Rental #${updated.id} returned.`,
          );
          void refreshAll();
        }}
      />

      <ExtendRentalDialog
        rental={extendOpen ? rental : null}
        onClose={() => setExtendOpen(false)}
        onExtended={(updated) => {
          setNotice(`Rental #${updated.id} extended.`);
          void refreshAll();
        }}
      />

      <AssignDriverDialog
        rental={assignOpen ? rental : null}
        onClose={() => setAssignOpen(false)}
        onAssigned={(updated) => {
          setNotice(
            updated.driver_user_id
              ? `Driver assigned to Rental #${updated.id}.`
              : `Driver unassigned from Rental #${updated.id}.`,
          );
          void refreshAll();
        }}
      />

      <LiveDocumentPdfModal
        doc={pdfOpen ? rentalPdfDoc : null}
        onClose={() => setPdfOpen(false)}
      />
    </ViewFadeIn>
  );
}
