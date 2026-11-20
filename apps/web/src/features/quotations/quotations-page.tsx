"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRightLeft,
  CheckCircle2,
  CopyPlus,
  FileText,
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
import { useLiveEntityLookup } from "@/features/rentals/entity-lookup";
import { ApiError, errorText } from "@/lib/api/client";
import { can, formatMoneyMinor, type Quotation } from "@/lib/api/contracts";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DriveCoreSelect } from "@/components/ui/drivecore-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  CreateQuotationDialog,
  type QuotationDraftSeed,
} from "./create-quotation-dialog";
import {
  nextSortState,
  sortRows,
  type SortDirection,
} from "@/lib/table-sort";
import {
  cancelQuotation,
  convertQuotation,
  decideQuotationDiscount,
  getQuotation,
  listQuotations,
} from "./service";

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export function quotationStatusMeta(status: Quotation["status"]): {
  label: string;
  tone: StatusDotTone;
} {
  switch (status) {
    case "pending_approval":
      return { label: "Pending approval", tone: "warning" };
    case "approved":
      return { label: "Approved", tone: "success" };
    case "converted":
      return { label: "Converted", tone: "info" };
    case "rejected":
      return { label: "Rejected", tone: "danger" };
    case "cancelled":
      return { label: "Cancelled", tone: "neutral" };
    default:
      return { label: "Draft", tone: "neutral" };
  }
}

export function QuotationsDirectorySection({
  q,
  status,
  page,
  sort,
  dir,
  onUpdateQuery,
}: {
  q: string;
  status: string;
  page: number;
  sort: string;
  dir: SortDirection | "";
  onUpdateQuery: (next: {
    q?: string;
    status?: string;
    page?: number;
    sort?: string;
    dir?: SortDirection | "";
  }) => void;
}) {
  const scope = useLiveContext();
  const branchSuffix = `?branch=${scope.branch}`;
  const currency = scope.company?.currency || "ZMW";

  function handleSort(columnKey: string) {
    const next = nextSortState(sort, dir, columnKey);
    onUpdateQuery({ sort: next.sort, dir: next.dir, page: 1 });
  }

  const query = useQuery({
    queryKey: [
      ...scope.key,
      "quotations",
      "list",
      { q: q.trim(), status, page, sort, dir },
    ],
    queryFn: ({ signal }) =>
      listQuotations(
        {
          companyId: scope.companyId,
          branch: scope.branch,
          q,
          status: status || undefined,
          page,
          sort: sort || undefined,
          dir: dir || undefined,
        },
        signal,
      ),
    staleTime: 0,
  });

  const items = query.data?.items ?? [];
  const lookup = useLiveEntityLookup({
    customerIds: items.map((item) => item.customer_id),
    vehicleIds: items.flatMap((item) =>
      item.vehicles.map((v) => v.vehicle_id),
    ),
  });

  const chips: ActiveFilterChip[] = [];
  if (q.trim()) {
    chips.push({
      key: "q",
      label: `Search: ${q.trim()}`,
      onRemove: () => onUpdateQuery({ q: "", page: 1 }),
    });
  }
  if (status) {
    chips.push({
      key: "status",
      label: `Status: ${quotationStatusMeta(status as Quotation["status"]).label}`,
      onRemove: () => onUpdateQuery({ status: "", page: 1 }),
    });
  }

  return (
    <DataTableFrame
      ariaLabel="Quotations directory"
      chips={chips}
      onClearAll={
        chips.length > 0
          ? () => onUpdateQuery({ q: "", status: "", page: 1 })
          : undefined
      }
      toolbar={
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <DataSearchForm
            label="Search quotations"
            placeholder="Search by customer, vehicle plate, or quote ID"
            defaultValue={q}
            formKey={`quotations:${q}`}
            onSubmitQuery={(nextQ) => onUpdateQuery({ q: nextQ, page: 1 })}
          />
          <div className="space-y-1.5 lg:w-56">
            <span className="block text-xs font-medium text-muted-foreground">
              Status
            </span>
            <DriveCoreSelect
              ariaLabel="Filter by quotation status"
              value={status}
              onValueChange={(nextStatus) =>
                onUpdateQuery({ status: nextStatus, page: 1 })
              }
              options={[
                { value: "", label: "All statuses" },
                { value: "pending_approval", label: "Pending approval" },
                { value: "approved", label: "Approved" },
                { value: "converted", label: "Converted" },
                { value: "rejected", label: "Rejected" },
                { value: "cancelled", label: "Cancelled" },
              ]}
            />
          </div>
        </div>
      }
      footer={
        query.data ? (
          <>
            <span className="font-mono text-xs tabular-nums">
              {query.data.total}{" "}
              {query.data.total === 1 ? "record" : "records"} · Page{" "}
              {query.data.page} of {query.data.lastPage}
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={page <= 1 || query.isFetching}
                onClick={() => onUpdateQuery({ page: Math.max(1, page - 1) })}
              >
                Previous
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={page >= query.data.lastPage || query.isFetching}
                onClick={() => onUpdateQuery({ page: page + 1 })}
              >
                Next
              </Button>
            </div>
          </>
        ) : undefined
      }
    >
      {query.isPending ? (
        <DataTableSkeleton columns={6} label="Loading quotations…" />
      ) : query.error ? (
        <div className="p-card">
          <StatePanel
            title="Quotations unavailable"
            onRetry={() => {
              void query.refetch();
            }}
          >
            {errorText(query.error)}
          </StatePanel>
        </div>
      ) : items.length === 0 ? (
        <div className="p-card">
          <StatePanel
            title={
              chips.length > 0 ? "No matching quotations" : "No quotations yet"
            }
          >
            {chips.length > 0 ? (
              <div className="space-y-3">
                <p>No quotations matched your search or status filter.</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onUpdateQuery({ q: "", status: "", page: 1 })}
                >
                  Clear search and filters
                </Button>
              </div>
            ) : (
              <p>
                Multi-vehicle quotations created in this company and branch
                scope will appear here.
              </p>
            )}
          </StatePanel>
        </div>
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
                Quotation
              </DataTableHeaderCell>
              <DataTableHeaderCell
                sortKey="customer_name"
                activeSort={sort}
                activeDir={dir}
                onSort={handleSort}
              >
                Customer
              </DataTableHeaderCell>
              <DataTableHeaderCell>Vehicles</DataTableHeaderCell>
              <DataTableHeaderCell
                align="right"
                sortKey="total_minor"
                activeSort={sort}
                activeDir={dir}
                onSort={handleSort}
              >
                Total
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
            {sortRows(items, sort, dir, {
              id: (item) => item.id,
              customer_name: (item) => lookup.customerName(item),
              total_minor: (item) => item.total_minor,
              status: (item) => item.status,
            }).map((quote) => {
              const custName = lookup.customerName(quote);
              const custHref = lookup.customerHref(quote);
              const meta = quotationStatusMeta(quote.status);
              const firstVeh = quote.vehicles[0];
              const extraCount = Math.max(0, quote.vehicles.length - 1);
              return (
                <DataTableRow key={quote.id}>
                  <DataTableCell numeric>
                    <Link
                      href={`/companies/${scope.companyId}/quotations/${quote.id}${branchSuffix}`}
                      className="font-semibold text-foreground hover:text-link hover:underline"
                    >
                      #{quote.id}
                    </Link>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {quote.rental_days}d
                      {quote.discount_pct > 0
                        ? ` · ${quote.discount_pct}% off`
                        : ""}
                    </div>
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
                    {firstVeh ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <PlateTag>{firstVeh.registration}</PlateTag>
                        {extraCount > 0 ? (
                          <span className="text-xs text-muted-foreground">
                            +{extraCount} more
                          </span>
                        ) : (
                          <span className="truncate text-xs text-muted-foreground">
                            {firstVeh.make} {firstVeh.model}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </DataTableCell>
                  <DataTableCell align="right" numeric>
                    <span className="font-semibold text-foreground">
                      {formatMoneyMinor(quote.total_minor, currency)}
                    </span>
                    <div className="text-[11px] text-muted-foreground">
                      incl. {quote.vat_rate_pct}% VAT
                    </div>
                  </DataTableCell>
                  <DataTableCell>
                    <StatusDotBadge tone={meta.tone}>
                      {meta.label}
                    </StatusDotBadge>
                  </DataTableCell>
                  <DataTableCell align="right">
                    <Link
                      href={`/companies/${scope.companyId}/quotations/${quote.id}${branchSuffix}`}
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
  );
}

export function QuotationDetailPage() {
  const { quotationId } = useParams<{ quotationId: string }>();
  const { user } = useSession();
  const scope = useLiveContext();
  const client = useQueryClient();

  const valid =
    /^[1-9]\d*$/.test(quotationId ?? "") &&
    Number.isSafeInteger(Number(quotationId));
  const canView = !!user && can(user, "quotations.view");
  const canManage = !!user && can(user, "quotations.manage");
  const canApproveDiscount = !!user && can(user, "quotations.approve_discount");
  const canConvert =
    canManage && !!user && can(user, "reservations.manage");

  const [decisionMode, setDecisionMode] = useState<
    "approve-discount" | "reject-discount" | null
  >(null);
  const [decisionNotes, setDecisionNotes] = useState("");
  const [busyAction, setBusyAction] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState("");
  const [pdfOpen, setPdfOpen] = useState(false);
  const [reviseOpen, setReviseOpen] = useState(false);

  const query = useQuery({
    queryKey: [...scope.key, "quotations", quotationId],
    queryFn: ({ signal }) =>
      getQuotation(quotationId, scope.companyId, scope.branch, signal),
    enabled: valid && canView,
    staleTime: 0,
  });

  const lookup = useLiveEntityLookup({
    customerIds: query.data ? [query.data.customer_id] : [],
    vehicleIds: query.data
      ? query.data.vehicles.map((v) => v.vehicle_id)
      : [],
  });

  const backHref = `/companies/${scope.companyId}/rentals?tab=quotations&branch=${scope.branch}`;

  if (!valid) {
    return (
      <StatePanel
        title="Page unavailable"
        href={backHref}
        linkLabel="Back to quotations"
      >
        The quotation URL is invalid.
      </StatePanel>
    );
  }
  if (!canView) {
    return (
      <StatePanel title="Access denied">
        Your account does not have permission to view quotations.
      </StatePanel>
    );
  }
  if (query.isPending) {
    return (
      <div role="status" className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-56 w-full rounded-2xl" />
      </div>
    );
  }
  if (query.error || !query.data) {
    return (
      <StatePanel
        title="Quotation unavailable"
        onRetry={() => {
          void query.refetch();
        }}
      >
        {errorText(query.error)}
      </StatePanel>
    );
  }

  const quote = query.data;
  const currency = scope.company?.currency || "ZMW";
  const branchName = scope.directory?.branches.find(
    (b) => b.id === quote.branch_id,
  )?.name;
  const custName = lookup.customerName(quote);
  const custHref = lookup.customerHref(quote);
  const statusMeta = quotationStatusMeta(quote.status);

  async function refreshAll() {
    await Promise.all([
      client.invalidateQueries({ queryKey: [...scope.key, "quotations"] }),
      client.invalidateQueries({ queryKey: [...scope.key, "reservations"] }),
    ]);
  }

  async function handleDiscountDecision() {
    if (!decisionMode || busyAction) return;
    setBusyAction(true);
    setError(null);
    const ac = new AbortController();
    try {
      const updated = await decideQuotationDiscount(
        quote.id,
        decisionMode,
        decisionNotes,
        ac.signal,
      );
      setDecisionMode(null);
      setDecisionNotes("");
      setNotice(
        updated.status === "approved"
          ? `Discount approved for Quotation #${updated.id}.`
          : `Discount rejected for Quotation #${updated.id}.`,
      );
      await refreshAll();
    } catch (failure) {
      setError(failure);
    } finally {
      setBusyAction(false);
    }
  }

  async function handleConvert() {
    if (busyAction) return;
    setBusyAction(true);
    setError(null);
    const ac = new AbortController();
    try {
      const updated = await convertQuotation(quote.id, ac.signal);
      setNotice(
        `Converted Quotation #${updated.id} into ${updated.reservation_ids.length} reservation${updated.reservation_ids.length === 1 ? "" : "s"}.`,
      );
      await refreshAll();
    } catch (failure) {
      setError(failure);
    } finally {
      setBusyAction(false);
    }
  }

  async function handleCancel() {
    if (busyAction) return;
    setBusyAction(true);
    setError(null);
    const ac = new AbortController();
    try {
      await cancelQuotation(quote.id, ac.signal);
      setNotice(`Quotation #${quote.id} cancelled.`);
      await refreshAll();
    } catch (failure) {
      setError(failure);
    } finally {
      setBusyAction(false);
    }
  }

  const pdfDoc: LivePdfDocument = {
    kind: "quotation",
    id: quote.id,
    status: quote.status,
    companyName: scope.company?.name ?? `Company #${quote.company_id}`,
    branchName,
    currency,
    customerName: custName,
    createdAt: quote.created_at,
    startsAt: quote.starts_at,
    endsAt: quote.ends_at,
    rentalDays: quote.rental_days,
    lines: quote.vehicles.map((v) => ({
      label: `${v.registration} · ${v.make} ${v.model}`,
      detail: `${formatMoneyMinor(v.daily_rate_minor, currency)}/day × ${quote.rental_days}d`,
      amountMinor: v.line_subtotal_minor,
    })),
    pricing: {
      subtotalMinor: quote.subtotal_minor,
      discountPct: quote.discount_pct,
      discountMinor: quote.discount_minor,
      vatRatePct: quote.vat_rate_pct,
      vatMinor: quote.vat_minor,
      totalMinor: quote.total_minor,
    },
    notes: quote.notes,
    serverPdfPath: `api/v1/quotations/${quote.id}/pdf`,
  };

  const reviseSeed: QuotationDraftSeed = {
    branchId: String(quote.branch_id),
    customerId: String(quote.customer_id),
    vehicleIds: quote.vehicles.map((v) => v.vehicle_id),
    startsAt: quote.starts_at,
    endsAt: quote.ends_at,
    discountPct: 0,
    notes: quote.notes ?? "",
  };

  return (
    <ViewFadeIn className="space-y-6">
      <Link
        className="inline-block text-sm text-link hover:underline"
        href={backHref}
      >
        Back to quotations
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-page-title font-extrabold tracking-tight">
              Quotation #{quote.id}
            </h1>
            <StatusDotBadge tone={statusMeta.tone}>
              {statusMeta.label}
            </StatusDotBadge>
          </div>
          <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            {custHref ? (
              <Link
                href={custHref}
                title={custName}
                className="max-w-[20rem] truncate font-medium text-link hover:underline"
              >
                {custName}
              </Link>
            ) : (
              <span title={custName} className="max-w-[20rem] truncate">
                {custName}
              </span>
            )}
            <span aria-hidden="true">·</span>
            <span>
              {quote.vehicles.length} vehicle
              {quote.vehicles.length === 1 ? "" : "s"}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {quote.rental_days} billing day{quote.rental_days === 1 ? "" : "s"}
            </span>
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
          {quote.status === "pending_approval" && canApproveDiscount ? (
            <>
              <Button
                type="button"
                disabled={busyAction}
                onClick={() => {
                  setDecisionNotes("");
                  setDecisionMode("approve-discount");
                }}
                className="gap-1.5"
              >
                <CheckCircle2 className="size-4" aria-hidden="true" />
                Approve discount
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busyAction}
                onClick={() => {
                  setDecisionNotes("");
                  setDecisionMode("reject-discount");
                }}
                className="gap-1.5"
              >
                <XCircle className="size-4" aria-hidden="true" />
                Reject discount
              </Button>
            </>
          ) : null}
          {quote.status === "approved" && canConvert ? (
            <Button
              type="button"
              disabled={busyAction}
              onClick={() => {
                void handleConvert();
              }}
              className="gap-1.5"
            >
              <ArrowRightLeft className="size-4" aria-hidden="true" />
              {busyAction ? "Converting…" : "Convert to reservations"}
            </Button>
          ) : null}
          {quote.status === "rejected" && canManage ? (
            <Button
              type="button"
              onClick={() => setReviseOpen(true)}
              className="gap-1.5"
            >
              <CopyPlus className="size-4" aria-hidden="true" />
              Revise as new quote
            </Button>
          ) : null}
          {(quote.status === "pending_approval" ||
            quote.status === "approved") &&
          canManage ? (
            <Button
              type="button"
              variant="outline"
              disabled={busyAction}
              onClick={() => {
                void handleCancel();
              }}
            >
              Cancel quotation
            </Button>
          ) : null}
        </div>
      </div>

      {notice ? (
        <div
          role="status"
          className="flex items-center justify-between gap-2 rounded-2xl border border-success/40 bg-success/10 px-4 py-3 text-sm text-success-foreground"
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

      {error ? (
        <div
          role="alert"
          className="rounded-2xl border border-danger bg-danger/10 px-4 py-3 text-sm text-danger-foreground"
        >
          {error instanceof ApiError && error.status === 409
            ? "Quotation cannot complete this action: one or more vehicles overlap an existing reservation or the quotation status changed."
            : errorText(error)}
        </div>
      ) : null}

      {quote.status === "pending_approval" ? (
        <div
          role="status"
          className="rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning-foreground"
        >
          Discount of <strong>{quote.discount_pct}%</strong> requires Finance or
          Admin approval before this quotation can be converted into
          reservations.
        </div>
      ) : null}

      {quote.discount_status === "approved" ||
      quote.discount_status === "rejected" ? (
        <section className="rounded-2xl border border-border/80 bg-surface p-4 text-sm">
          <p className="font-medium">
            Discount {quote.discount_status}{" "}
            {quote.discount_decided_by_name
              ? `by ${quote.discount_decided_by_name}`
              : ""}
            {quote.discount_decided_at
              ? ` · ${fmtDate(quote.discount_decided_at)}`
              : ""}
          </p>
          {quote.discount_decision_notes ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {quote.discount_decision_notes}
            </p>
          ) : null}
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="dc-shadow-card overflow-hidden rounded-2xl border border-border/80 bg-surface lg:col-span-2">
          <div className="border-b border-border/70 bg-muted/20 px-5 py-3.5">
            <h2 className="text-section-heading">Quoted vehicles</h2>
          </div>
          <DataTable>
            <DataTableHead>
              <tr>
                <DataTableHeaderCell>Vehicle</DataTableHeaderCell>
                <DataTableHeaderCell align="right">
                  Daily rate
                </DataTableHeaderCell>
                <DataTableHeaderCell align="right">
                  Line subtotal
                </DataTableHeaderCell>
                <DataTableHeaderCell align="right">
                  Reservation
                </DataTableHeaderCell>
              </tr>
            </DataTableHead>
            <DataTableBody>
              {quote.vehicles.map((v) => {
                const vehHref = lookup.vehicleHref(v.vehicle_id);
                return (
                  <DataTableRow key={v.vehicle_id}>
                    <DataTableCell>
                      {vehHref ? (
                        <Link
                          href={vehHref}
                          className="group inline-flex flex-col gap-0.5"
                        >
                          <PlateTag className="group-hover:border-link/50 group-hover:text-link">
                            {v.registration}
                          </PlateTag>
                          <span className="text-xs text-muted-foreground group-hover:text-link group-hover:underline">
                            {v.make} {v.model}
                          </span>
                        </Link>
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          <PlateTag>{v.registration}</PlateTag>
                          <span className="text-xs text-muted-foreground">
                            {v.make} {v.model}
                          </span>
                        </div>
                      )}
                    </DataTableCell>
                    <DataTableCell align="right" numeric>
                      {formatMoneyMinor(v.daily_rate_minor, currency)}
                    </DataTableCell>
                    <DataTableCell align="right" numeric>
                      <span className="font-semibold text-foreground">
                        {formatMoneyMinor(v.line_subtotal_minor, currency)}
                      </span>
                    </DataTableCell>
                    <DataTableCell align="right" numeric>
                      {v.reservation_id ? (
                        <Link
                          href={`/companies/${scope.companyId}/reservations/${v.reservation_id}?branch=${scope.branch}`}
                          className="font-semibold text-link hover:underline"
                        >
                          Reservation #{v.reservation_id}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </DataTableCell>
                  </DataTableRow>
                );
              })}
            </DataTableBody>
          </DataTable>
        </section>

        <section className="dc-shadow-card space-y-4 rounded-2xl border border-border/80 bg-surface p-card">
          <h2 className="text-section-heading">Pricing summary</h2>
          <dl className="space-y-2.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Departure</dt>
              <dd className="font-mono text-xs tabular-nums">
                {fmtDate(quote.starts_at)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Expected return</dt>
              <dd className="font-mono text-xs tabular-nums">
                {fmtDate(quote.ends_at)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-border/60 pt-2.5">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="font-mono text-xs tabular-nums">
                {formatMoneyMinor(quote.subtotal_minor, currency)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">
                Discount ({quote.discount_pct}%)
              </dt>
              <dd className="font-mono text-xs tabular-nums">
                -{formatMoneyMinor(quote.discount_minor, currency)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">
                VAT ({quote.vat_rate_pct}%)
              </dt>
              <dd className="font-mono text-xs tabular-nums">
                {formatMoneyMinor(quote.vat_minor, currency)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-border/70 pt-2.5 text-base font-semibold">
              <dt>Total</dt>
              <dd className="font-mono tabular-nums">
                {formatMoneyMinor(quote.total_minor, currency)}
              </dd>
            </div>
          </dl>
          {quote.notes ? (
            <div className="border-t border-border/60 pt-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Notes</p>
              <p className="mt-1">{quote.notes}</p>
            </div>
          ) : null}
        </section>
      </div>

      {can(user!, "documents.view") ? (
        <EntityDocumentsPanel
          entityType="quotation"
          entityId={quote.id}
          branchId={quote.branch_id}
          canUpload={can(user!, "documents.manage")}
        />
      ) : null}

      <Dialog
        open={!!decisionMode}
        onOpenChange={(open) => {
          if (!open && !busyAction) setDecisionMode(null);
        }}
      >
        <DialogContent className="rounded-2xl p-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {decisionMode === "approve-discount"
                ? `Approve ${quote.discount_pct}% discount`
                : `Reject ${quote.discount_pct}% discount`}
            </DialogTitle>
            <DialogDescription>
              {decisionMode === "approve-discount"
                ? "Approving unlocks conversion into confirmed vehicle reservations."
                : "Rejecting locks this quotation as Rejected; operators can revise as a new quote."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="decision-notes" className="text-sm font-medium">
                Decision notes (optional)
              </label>
              <Textarea
                id="decision-notes"
                rows={3}
                maxLength={500}
                placeholder={
                  decisionMode === "approve-discount"
                    ? "Corporate contract tier approved…"
                    : "Reason for rejecting discount…"
                }
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={busyAction}
                onClick={() => setDecisionMode(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={busyAction}
                onClick={() => {
                  void handleDiscountDecision();
                }}
              >
                {busyAction
                  ? "Saving…"
                  : decisionMode === "approve-discount"
                    ? "Confirm approval"
                    : "Confirm rejection"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <LiveDocumentPdfModal
        doc={pdfOpen ? pdfDoc : null}
        onClose={() => setPdfOpen(false)}
      />

      <CreateQuotationDialog
        open={reviseOpen}
        initialValues={reviseSeed}
        onOpenChange={setReviseOpen}
        onCreated={(created) => {
          void refreshAll();
          scope.navigate(
            `/companies/${scope.companyId}/quotations/${created.id}?branch=${scope.branch}`,
          );
        }}
      />
    </ViewFadeIn>
  );
}
