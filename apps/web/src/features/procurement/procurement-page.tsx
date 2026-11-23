"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  Building2,
  CheckCircle2,
  ClipboardList,
  FileSpreadsheet,
  PackageCheck,
  Plus,
  Send,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import { useSession } from "@/features/auth/session-provider";
import { useLiveContext } from "@/features/live/context";
import { EntityDocumentsPanel } from "@/features/documents/documents-panel";
import { CreateSupplierInvoiceDialog } from "@/features/accounting/payables-panel";
import { RequisitionsPanel } from "@/features/srs-parity/requisitions-panel";
import { SupplierStatementDialog } from "@/features/srs-parity/supplier-statement-dialog";
import { listParts } from "@/features/inventory/service";
import {
  createPurchaseOrder,
  createSupplier,
  getPurchaseOrder,
  listPurchaseOrders,
  listSuppliers,
  transitionPurchaseOrder,
  type PurchaseOrderLinePayload,
} from "@/features/procurement/service";
import { ApiError, errorText } from "@/lib/api/client";
import {
  can,
  canAccessProcurement,
  canManageAp,
  formatMoneyMinor,
  parseMajorToMinor,
  type PurchaseOrder,
} from "@/lib/api/contracts";
import { nextSortState, parseSortParams, sortRows } from "@/lib/table-sort";
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
  StatusDotBadge,
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
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

type ProcurementTab = "requisitions" | "purchase-orders" | "suppliers";

const PO_STATUS_TONES: Record<PurchaseOrder["status"], StatusDotTone> = {
  draft: "neutral",
  submitted: "warning",
  approved: "info",
  received: "success",
  cancelled: "danger",
};

const PO_STATUS_LABELS: Record<PurchaseOrder["status"], string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  received: "Received",
  cancelled: "Cancelled",
};

const PO_SORT_KEYS = ["id", "supplier_name", "total_minor", "status"] as const;
const SUPPLIER_SORT_KEYS = ["name", "email", "is_active"] as const;

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString();
}

export function LiveProcurementPage() {
  const { user } = useSession();
  const scope = useLiveContext();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const client = useQueryClient();

  const canAccess = !!user && canAccessProcurement(user);
  const canManagePos = !!user && can(user, "purchase_orders.manage");
  const canManageSuppliers = !!user && can(user, "suppliers.manage");
  const currency = scope.company?.currency || "ZMW";

  const rawTab = searchParams.get("tab");
  const activeTab: ProcurementTab =
    rawTab === "requisitions"
      ? "requisitions"
      : rawTab === "suppliers"
        ? "suppliers"
        : "purchase-orders";
  const rawQ = searchParams.get("q") ?? "";
  const status = searchParams.get("status") ?? "";
  const rawPage = Number(searchParams.get("page") ?? "1");
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const { sort, dir } = parseSortParams(
    searchParams.get("sort"),
    searchParams.get("dir"),
    activeTab === "purchase-orders" ? PO_SORT_KEYS : SUPPLIER_SORT_KEYS,
  );

  const [createPoOpen, setCreatePoOpen] = useState(false);
  const [createSupplierOpen, setCreateSupplierOpen] = useState(false);
  const [statementSupplier, setStatementSupplier] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [notice, setNotice] = useState("");
  const branchId = scope.branch !== "all" ? scope.branch : undefined;
  const branchSuffix = `?branch=${encodeURIComponent(scope.branch)}`;

  function updateQuery(updates: Record<string, string | number | undefined>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === undefined || v === "" || (k === "page" && v === 1)) {
        next.delete(k);
      } else {
        next.set(k, String(v));
      }
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function handleSort(clickedKey: string) {
    const next = nextSortState(sort, dir, clickedKey);
    updateQuery({ sort: next.sort, dir: next.dir, page: 1 });
  }

  const posQuery = useQuery({
    queryKey: [
      ...scope.key,
      "purchase-orders",
      "list",
      branchId ?? "all",
      status,
      rawQ,
      page,
      sort,
      dir,
    ],
    queryFn: ({ signal }) =>
      listPurchaseOrders(
        {
          companyId: scope.companyId,
          branchId,
          status: status || undefined,
          q: rawQ,
          page,
          sort: sort || undefined,
          dir,
        },
        signal,
      ),
    enabled: canAccess && activeTab === "purchase-orders",
  });

  const suppliersQuery = useQuery({
    queryKey: [...scope.key, "suppliers", "list", rawQ, page, sort, dir],
    queryFn: ({ signal }) =>
      listSuppliers(
        {
          companyId: scope.companyId,
          q: rawQ,
          page,
          sort: sort || undefined,
          dir,
        },
        signal,
      ),
    enabled: canAccess && activeTab === "suppliers",
  });

  if (!canAccess) {
    return (
      <StatePanel title="Access denied">
        Your account does not have permission to view Procurement.
      </StatePanel>
    );
  }

  return (
    <ViewFadeIn className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-page-title font-extrabold tracking-tight">
            Procurement
          </h1>
          <p className="text-sm text-muted-foreground">
            Multi-line purchase orders, approval gates, goods receipt, and
            supplier directory.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManagePos && activeTab === "purchase-orders" ? (
            <Button
              type="button"
              onClick={() => setCreatePoOpen(true)}
              className="gap-1.5"
            >
              <Plus className="size-4" aria-hidden="true" />
              New purchase order
            </Button>
          ) : null}
          {canManageSuppliers && activeTab === "suppliers" ? (
            <Button
              type="button"
              onClick={() => setCreateSupplierOpen(true)}
              className="gap-1.5"
            >
              <Plus className="size-4" aria-hidden="true" />
              New supplier
            </Button>
          ) : null}
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Procurement sections"
        className="flex flex-wrap gap-1.5 rounded-2xl border bg-surface p-1.5"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "requisitions"}
          onClick={() =>
            updateQuery({
              tab: "requisitions",
              status: "",
              q: "",
              sort: "",
              dir: "",
              page: 1,
            })
          }
          className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors ${
            activeTab === "requisitions"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
          }`}
        >
          <ClipboardList className="size-3.5" aria-hidden="true" />
          Requisitions
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "purchase-orders"}
          onClick={() =>
            updateQuery({
              tab: "purchase-orders",
              q: "",
              sort: "",
              dir: "",
              page: 1,
            })
          }
          className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors ${
            activeTab === "purchase-orders"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
          }`}
        >
          <ShoppingCart className="size-3.5" aria-hidden="true" />
          Purchase orders
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "suppliers"}
          onClick={() =>
            updateQuery({
              tab: "suppliers",
              status: "",
              q: "",
              sort: "",
              dir: "",
              page: 1,
            })
          }
          className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors ${
            activeTab === "suppliers"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
          }`}
        >
          <Building2 className="size-3.5" aria-hidden="true" />
          Suppliers
        </button>
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

      {activeTab === "requisitions" ? (
        <RequisitionsPanel />
      ) : activeTab === "purchase-orders" ? (
        <DataTableFrame
          ariaLabel="Purchase orders table"
          toolbar={
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <DataSearchForm
                label="Search purchase orders"
                placeholder="Search PO # or supplier…"
                defaultValue={rawQ}
                formKey={`po:${rawQ}`}
                onSubmitQuery={(nextQ) => updateQuery({ q: nextQ, page: 1 })}
              />
              <div className="w-full space-y-1.5 sm:w-52">
                <span className="block text-label font-semibold">Status</span>
                <DriveCoreSelect
                  ariaLabel="Filter purchase orders by status"
                  value={status}
                  onValueChange={(nextStatus) =>
                    updateQuery({ status: nextStatus, page: 1 })
                  }
                  options={[
                    { value: "", label: "All statuses" },
                    { value: "draft", label: "Draft" },
                    { value: "submitted", label: "Submitted" },
                    { value: "approved", label: "Approved" },
                    { value: "received", label: "Received" },
                    { value: "cancelled", label: "Cancelled" },
                  ]}
                />
              </div>
            </div>
          }
        >
          {posQuery.isPending ? (
            <DataTableSkeleton columns={6} label="Loading purchase orders" />
          ) : posQuery.error ? (
            <div className="p-card">
              <StatePanel title="Purchase orders unavailable">
                {errorText(posQuery.error)}
              </StatePanel>
            </div>
          ) : posQuery.data.items.length === 0 ? (
            <div className="p-card">
              <StatePanel title="No purchase orders yet">
                Create a purchase order to replenish spare parts from a supplier.
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
                    PO #
                  </DataTableHeaderCell>
                  <DataTableHeaderCell
                    sortKey="supplier_name"
                    activeSort={sort}
                    activeDir={dir}
                    onSort={handleSort}
                  >
                    Supplier
                  </DataTableHeaderCell>
                  <DataTableHeaderCell>Lines</DataTableHeaderCell>
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
                {sortRows(posQuery.data.items, sort, dir, {
                  id: (po) => po.id,
                  supplier_name: (po) => po.supplier_name ?? "",
                  total_minor: (po) => po.total_minor,
                  status: (po) => po.status,
                }).map((po) => (
                  <DataTableRow key={po.id}>
                    <DataTableCell numeric>
                      <Link
                        href={`/companies/${scope.companyId}/procurement/purchase-orders/${po.id}${branchSuffix}`}
                        className="font-semibold text-foreground hover:text-link hover:underline"
                      >
                        {po.po_number}
                      </Link>
                    </DataTableCell>
                    <DataTableCell className="font-medium">
                      {po.supplier_name ?? `Supplier #${po.supplier_id}`}
                    </DataTableCell>
                    <DataTableCell numeric>
                      {po.lines.length}{" "}
                      {po.lines.length === 1 ? "line" : "lines"}
                    </DataTableCell>
                    <DataTableCell align="right" numeric className="font-semibold">
                      {formatMoneyMinor(po.total_minor, currency)}
                    </DataTableCell>
                    <DataTableCell>
                      <StatusDotBadge tone={PO_STATUS_TONES[po.status]}>
                        {PO_STATUS_LABELS[po.status]}
                      </StatusDotBadge>
                    </DataTableCell>
                    <DataTableCell align="right">
                      <Link
                        href={`/companies/${scope.companyId}/procurement/purchase-orders/${po.id}${branchSuffix}`}
                        className="text-xs font-semibold text-link hover:underline"
                      >
                        Open
                      </Link>
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          )}
        </DataTableFrame>
      ) : (
        <DataTableFrame
          ariaLabel="Suppliers table"
          toolbar={
            <DataSearchForm
              label="Search suppliers"
              placeholder="Search supplier name or email…"
              defaultValue={rawQ}
              formKey={`sup:${rawQ}`}
              onSubmitQuery={(nextQ) => updateQuery({ q: nextQ, page: 1 })}
            />
          }
        >
          {suppliersQuery.isPending ? (
            <DataTableSkeleton columns={4} label="Loading suppliers" />
          ) : suppliersQuery.error ? (
            <div className="p-card">
              <StatePanel title="Suppliers unavailable">
                {errorText(suppliersQuery.error)}
              </StatePanel>
            </div>
          ) : suppliersQuery.data.items.length === 0 ? (
            <div className="p-card">
              <StatePanel title="No suppliers yet">
                Add suppliers to start creating purchase orders.
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
                    Supplier name
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
                  <DataTableHeaderCell align="right">POs</DataTableHeaderCell>
                  <DataTableHeaderCell align="right">
                    Total spend
                  </DataTableHeaderCell>
                  <DataTableHeaderCell align="right">
                    Open AP
                  </DataTableHeaderCell>
                  <DataTableHeaderCell
                    sortKey="is_active"
                    activeSort={sort}
                    activeDir={dir}
                    onSort={handleSort}
                  >
                    Status
                  </DataTableHeaderCell>
                  <DataTableHeaderCell align="right">
                    Statement
                  </DataTableHeaderCell>
                </tr>
              </DataTableHead>
              <DataTableBody>
                {sortRows(suppliersQuery.data.items, sort, dir, {
                  name: (s) => s.name,
                  email: (s) => s.email ?? "",
                  is_active: (s) => s.is_active,
                }).map((s) => (
                  <DataTableRow key={s.id}>
                    <DataTableCell className="font-medium">
                      {s.name}
                    </DataTableCell>
                    <DataTableCell>{s.email ?? "—"}</DataTableCell>
                    <DataTableCell>{s.phone ?? "—"}</DataTableCell>
                    <DataTableCell align="right" numeric>
                      {s.po_count ?? "—"}
                    </DataTableCell>
                    <DataTableCell align="right" numeric>
                      {s.total_spend_minor != null
                        ? formatMoneyMinor(s.total_spend_minor, currency)
                        : "—"}
                    </DataTableCell>
                    <DataTableCell align="right" numeric>
                      {s.open_ap_minor != null
                        ? formatMoneyMinor(s.open_ap_minor, currency)
                        : "—"}
                    </DataTableCell>
                    <DataTableCell>
                      <StatusDotBadge tone={s.is_active ? "success" : "neutral"}>
                        {s.is_active ? "Active" : "Inactive"}
                      </StatusDotBadge>
                    </DataTableCell>
                    <DataTableCell align="right">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() =>
                          setStatementSupplier({ id: s.id, name: s.name })
                        }
                      >
                        <FileSpreadsheet className="size-3.5" aria-hidden="true" />
                        Statement
                      </Button>
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          )}
        </DataTableFrame>
      )}

      <SupplierStatementDialog
        supplierId={statementSupplier?.id ?? null}
        supplierName={statementSupplier?.name ?? ""}
        open={!!statementSupplier}
        onOpenChange={(open) => {
          if (!open) setStatementSupplier(null);
        }}
      />

      <CreatePurchaseOrderDialog
        open={createPoOpen}
        onOpenChange={setCreatePoOpen}
        onCreated={(po) => {
          setNotice(`Draft purchase order ${po.po_number} created.`);
          void client.invalidateQueries({
            queryKey: [...scope.key, "purchase-orders"],
          });
          router.push(
            `/companies/${scope.companyId}/procurement/purchase-orders/${po.id}${branchSuffix}`,
          );
        }}
      />

      <CreateSupplierDialog
        open={createSupplierOpen}
        onOpenChange={setCreateSupplierOpen}
        onCreated={(s) => {
          setNotice(`Supplier "${s.name}" created.`);
          void client.invalidateQueries({
            queryKey: [...scope.key, "suppliers"],
          });
        }}
      />
    </ViewFadeIn>
  );
}

export function LivePurchaseOrderDetailPage({
  purchaseOrderId,
}: {
  purchaseOrderId: string;
}) {
  const { user } = useSession();
  const scope = useLiveContext();
  const client = useQueryClient();

  const valid =
    /^[1-9]\d*$/.test(purchaseOrderId ?? "") &&
    Number.isSafeInteger(Number(purchaseOrderId));
  const canView = !!user && can(user, "purchase_orders.view");
  const canManage = !!user && can(user, "purchase_orders.manage");
  const canApprove = !!user && can(user, "purchase_orders.approve");
  const canViewDocs = !!user && can(user, "documents.view");
  const canUploadDocs = !!user && can(user, "documents.manage");
  const canCreateApInvoice = !!user && canManageAp(user);
  const currency = scope.company?.currency || "ZMW";

  const [notice, setNotice] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [busyAction, setBusyAction] = useState("");
  const [apInvoiceOpen, setApInvoiceOpen] = useState(false);

  const query = useQuery({
    queryKey: [...scope.key, "purchase-orders", "detail", purchaseOrderId],
    queryFn: ({ signal }) => getPurchaseOrder(purchaseOrderId, signal),
    enabled: valid && canView,
    staleTime: 0,
  });

  const backHref = `/companies/${scope.companyId}/procurement?tab=purchase-orders&branch=${encodeURIComponent(scope.branch)}`;

  async function refreshAll() {
    await Promise.all([
      client.invalidateQueries({ queryKey: [...scope.key, "purchase-orders"] }),
      client.invalidateQueries({ queryKey: [...scope.key, "parts"] }),
      client.invalidateQueries({ queryKey: [...scope.key, "stock-movements"] }),
      client.invalidateQueries({ queryKey: [...scope.key, "gl"] }),
    ]);
  }

  if (!valid) {
    return (
      <StatePanel
        title="Page unavailable"
        href={backHref}
        linkLabel="Back to procurement"
      >
        The purchase order URL is invalid.
      </StatePanel>
    );
  }
  if (!canView) {
    return (
      <StatePanel title="Access denied">
        Your account does not have permission to view purchase orders.
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
        title="Purchase order unavailable"
        onRetry={() => {
          void query.refetch();
        }}
      >
        {errorText(query.error)}
      </StatePanel>
    );
  }

  const po = query.data;

  async function runAction(action: "submit" | "approve" | "receive" | "cancel") {
    if (busyAction) return;
    setBusyAction(action);
    setError(null);
    const ac = new AbortController();
    try {
      await transitionPurchaseOrder(po.id, action, ac.signal);
      setNotice(
        action === "submit"
          ? `${po.po_number} submitted for approval.`
          : action === "approve"
            ? `${po.po_number} approved.`
            : action === "receive"
              ? `${po.po_number} received — stock incremented and posted to GL.`
              : `${po.po_number} cancelled.`,
      );
      await refreshAll();
    } catch (failure) {
      setError(failure);
    } finally {
      setBusyAction("");
    }
  }

  return (
    <ViewFadeIn className="space-y-6">
      <Link
        className="inline-block text-sm text-link hover:underline"
        href={backHref}
      >
        Back to purchase orders
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-page-title font-extrabold tracking-tight">
              {po.po_number}
            </h1>
            <StatusDotBadge tone={PO_STATUS_TONES[po.status]}>
              {PO_STATUS_LABELS[po.status]}
            </StatusDotBadge>
          </div>
          <p className="text-sm text-muted-foreground">
            {po.supplier_name ?? `Supplier #${po.supplier_id}`} · Created{" "}
            {fmtDate(po.created_at)}
            {po.approved_by_name ? ` · Approved by ${po.approved_by_name}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {canManage && po.status === "draft" ? (
            <Button
              type="button"
              disabled={busyAction !== ""}
              onClick={() => {
                void runAction("submit");
              }}
              className="gap-1.5"
            >
              <Send className="size-4" aria-hidden="true" />
              {busyAction === "submit" ? "Submitting…" : "Submit for approval"}
            </Button>
          ) : null}
          {canApprove && po.status === "submitted" ? (
            <Button
              type="button"
              disabled={busyAction !== ""}
              onClick={() => {
                void runAction("approve");
              }}
              className="gap-1.5"
            >
              <CheckCircle2 className="size-4" aria-hidden="true" />
              {busyAction === "approve" ? "Approving…" : "Approve purchase order"}
            </Button>
          ) : null}
          {canManage && po.status === "approved" ? (
            <Button
              type="button"
              disabled={busyAction !== ""}
              onClick={() => {
                void runAction("receive");
              }}
              className="gap-1.5"
            >
              <PackageCheck className="size-4" aria-hidden="true" />
              {busyAction === "receive" ? "Receiving…" : "Receive goods"}
            </Button>
          ) : null}
          {canCreateApInvoice && po.status === "received" ? (
            <Button
              type="button"
              onClick={() => setApInvoiceOpen(true)}
              className="gap-1.5"
            >
              <Plus className="size-4" aria-hidden="true" />
              Create supplier invoice
            </Button>
          ) : null}
          {canManage &&
          ["draft", "submitted", "approved"].includes(po.status) ? (
            <Button
              type="button"
              variant="outline"
              disabled={busyAction !== ""}
              onClick={() => {
                void runAction("cancel");
              }}
              className="gap-1.5"
            >
              <Ban className="size-4" aria-hidden="true" />
              Cancel
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

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-danger bg-danger/10 px-4 py-3 text-sm text-danger-foreground"
        >
          {error instanceof ApiError && error.status === 409
            ? "This purchase order has already been received or is not eligible for that transition."
            : errorText(error)}
        </p>
      ) : null}

      <section className="dc-shadow-card space-y-4 rounded-2xl border bg-surface p-card">
        <div className="flex items-center justify-between">
          <h2 className="text-section-heading">Order lines</h2>
          <span className="font-mono text-base font-extrabold tabular-nums">
            Total: {formatMoneyMinor(po.total_minor, currency)}
          </span>
        </div>
        <DataTable>
          <DataTableHead>
            <tr>
              <DataTableHeaderCell>Part</DataTableHeaderCell>
              <DataTableHeaderCell align="right">Qty</DataTableHeaderCell>
              <DataTableHeaderCell align="right">Unit cost</DataTableHeaderCell>
              <DataTableHeaderCell align="right">Line total</DataTableHeaderCell>
            </tr>
          </DataTableHead>
          <DataTableBody>
            {po.lines.map((line, idx) => (
              <DataTableRow key={line.id ?? idx}>
                <DataTableCell className="font-medium">
                  {line.part_sku ? `${line.part_sku} · ` : ""}
                  {line.part_name ?? `Part #${line.part_id}`}
                </DataTableCell>
                <DataTableCell align="right" numeric>
                  {line.quantity}
                </DataTableCell>
                <DataTableCell align="right" numeric>
                  {formatMoneyMinor(line.unit_cost_minor, currency)}
                </DataTableCell>
                <DataTableCell align="right" numeric className="font-semibold">
                  {formatMoneyMinor(line.line_total_minor, currency)}
                </DataTableCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      </section>

      {canViewDocs ? (
        <EntityDocumentsPanel
          entityType="purchase_order"
          entityId={po.id}
          branchId={po.branch_id}
          canUpload={canUploadDocs}
        />
      ) : null}

      <CreateSupplierInvoiceDialog
        open={apInvoiceOpen}
        onOpenChange={setApInvoiceOpen}
        presetPo={{
          id: po.id,
          supplier_id: po.supplier_id,
          branch_id: po.branch_id,
          total_minor: po.total_minor,
        }}
        onCreated={(inv) => {
          setNotice(
            inv.match_status === "variance"
              ? `Supplier invoice ${inv.invoice_number} flagged with 3-way match variance (${formatMoneyMinor(inv.variance_minor, currency)}).`
              : `Supplier invoice ${inv.invoice_number} matched to ${po.po_number} and posted to AP.`,
          );
          void refreshAll();
        }}
      />
    </ViewFadeIn>
  );
}

interface PoLineRow {
  key: string;
  partId: string;
  quantity: string;
  unitCost: string;
}

function CreatePurchaseOrderDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (po: PurchaseOrder) => void;
}) {
  const session = useSession();
  const scope = useLiveContext();
  const formId = useId();
  const currency = scope.company?.currency || "ZMW";

  const companyBranches = useMemo(() => {
    const fromDir = (scope.directory?.branches ?? []).filter(
      (b) => String(b.company_id) === scope.companyId,
    );
    if (fromDir.length > 0) return fromDir;
    const membership = session.user?.companies.find(
      (c) => String(c.id) === scope.companyId,
    );
    if (membership?.branch_id) {
      return [
        {
          id: membership.branch_id,
          company_id: Number(scope.companyId),
          name: `Branch #${membership.branch_id}`,
        },
      ];
    }
    return [];
  }, [scope.directory?.branches, scope.companyId, session.user?.companies]);

  const [branchId, setBranchId] = useState(
    scope.branch !== "all"
      ? scope.branch
      : companyBranches[0]
        ? String(companyBranches[0].id)
        : "",
  );
  const [supplierId, setSupplierId] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<PoLineRow[]>([
    { key: "po-1", partId: "", quantity: "5", unitCost: "" },
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const suppliersQuery = useQuery({
    queryKey: [...scope.key, "suppliers", "picker"],
    queryFn: ({ signal }) =>
      listSuppliers({ companyId: scope.companyId, isActive: "1" }, signal),
    enabled: open,
  });

  const partsQuery = useQuery({
    queryKey: [...scope.key, "parts", "po-picker", branchId],
    queryFn: ({ signal }) =>
      listParts({ companyId: scope.companyId, branchId }, signal),
    enabled: open && !!branchId,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!branchId) {
      setError(new Error("Select a branch."));
      return;
    }
    if (!supplierId) {
      setError(new Error("Select a supplier."));
      return;
    }
    const payloadLines: PurchaseOrderLinePayload[] = [];
    for (const row of lines) {
      if (!row.partId) {
        setError(new Error("Select a part on every order line."));
        return;
      }
      if (!/^[1-9]\d*$/.test(row.quantity.trim())) {
        setError(new Error("Line quantity must be at least 1."));
        return;
      }
      const costMinor = parseMajorToMinor(row.unitCost || "0");
      if (costMinor === null || costMinor < 0) {
        setError(new Error("Enter a valid unit cost."));
        return;
      }
      payloadLines.push({
        part_id: Number(row.partId),
        quantity: Number(row.quantity.trim()),
        unit_cost_minor: costMinor,
      });
    }
    setBusy(true);
    setError(null);
    const ac = new AbortController();
    try {
      const created = await createPurchaseOrder(
        {
          company_id: Number(scope.companyId),
          branch_id: Number(branchId),
          supplier_id: Number(supplierId),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
          lines: payloadLines,
        },
        ac.signal,
      );
      onOpenChange(false);
      onCreated(created);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) {
          setError(null);
          onOpenChange(false);
        }
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl p-card sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New purchase order</DialogTitle>
          <DialogDescription>
            Creates a draft multi-line purchase order. Submit for Finance/Admin
            approval before receiving goods.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
          className="space-y-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor={`${formId}-branch`} className="text-sm font-medium">
                Branch
              </label>
              <DriveCoreSelect
                id={`${formId}-branch`}
                value={branchId}
                onValueChange={setBranchId}
                options={[
                  { value: "", label: "Select branch" },
                  ...companyBranches.map((b) => ({
                    value: String(b.id),
                    label: b.name,
                  })),
                ]}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor={`${formId}-supplier`} className="text-sm font-medium">
                Supplier
              </label>
              <DriveCoreSelect
                id={`${formId}-supplier`}
                value={supplierId}
                onValueChange={setSupplierId}
                options={[
                  { value: "", label: "Select supplier" },
                  ...(suppliersQuery.data?.items ?? []).map((s) => ({
                    value: String(s.id),
                    label: s.name,
                  })),
                ]}
              />
            </div>
          </div>

          <div className="space-y-2.5 rounded-xl border border-border/80 bg-muted/20 p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Order lines
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setLines((prev) => [
                    ...prev,
                    {
                      key: `po-${Date.now()}-${prev.length}`,
                      partId: "",
                      quantity: "1",
                      unitCost: "",
                    },
                  ])
                }
              >
                <Plus className="mr-1 size-3.5" aria-hidden="true" />
                Add line
              </Button>
            </div>
            {lines.map((row, idx) => (
              <div
                key={row.key}
                className="grid gap-2 sm:grid-cols-[1fr_5rem_8rem_auto] sm:items-end"
              >
                <div className="space-y-1">
                  <label
                    htmlFor={`${formId}-part-${idx}`}
                    className="text-xs font-medium"
                  >
                    Part
                  </label>
                  <DriveCoreSelect
                    id={`${formId}-part-${idx}`}
                    value={row.partId}
                    onValueChange={(nextPartId) => {
                      const picked = (partsQuery.data?.items ?? []).find(
                        (p) => String(p.id) === nextPartId,
                      );
                      setLines((prev) =>
                        prev.map((item) =>
                          item.key === row.key
                            ? {
                                ...item,
                                partId: nextPartId,
                                unitCost: picked
                                  ? (picked.unit_cost_minor / 100).toFixed(2)
                                  : item.unitCost,
                              }
                            : item,
                        ),
                      );
                    }}
                    options={[
                      { value: "", label: "Select part" },
                      ...(partsQuery.data?.items ?? []).map((p) => ({
                        value: String(p.id),
                        label: `${p.sku} · ${p.name}`,
                      })),
                    ]}
                  />
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor={`${formId}-qty-${idx}`}
                    className="text-xs font-medium"
                  >
                    Qty
                  </label>
                  <Input
                    id={`${formId}-qty-${idx}`}
                    inputMode="numeric"
                    value={row.quantity}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((item) =>
                          item.key === row.key
                            ? { ...item, quantity: e.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor={`${formId}-cost-${idx}`}
                    className="text-xs font-medium"
                  >
                    Unit ({currency})
                  </label>
                  <Input
                    id={`${formId}-cost-${idx}`}
                    inputMode="decimal"
                    value={row.unitCost}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((item) =>
                          item.key === row.key
                            ? { ...item, unitCost: e.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={lines.length <= 1}
                  aria-label={`Remove line ${idx + 1}`}
                  onClick={() =>
                    setLines((prev) => prev.filter((item) => item.key !== row.key))
                  }
                >
                  <Trash2 className="size-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <label htmlFor={`${formId}-notes`} className="text-sm font-medium">
              Notes (optional)
            </label>
            <Textarea
              id={`${formId}-notes`}
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-xl border border-danger bg-danger/10 px-3.5 py-2.5 text-sm text-danger-foreground"
            >
              {errorText(error)}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Creating…" : "Create draft PO"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CreateSupplierDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (supplier: { id: number; name: string }) => void;
}) {
  const scope = useLiveContext();
  const formId = useId();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!name.trim()) {
      setError(new Error("Enter a supplier name."));
      return;
    }
    setBusy(true);
    setError(null);
    const ac = new AbortController();
    try {
      const created = await createSupplier(
        {
          company_id: Number(scope.companyId),
          name: name.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          is_active: true,
        },
        ac.signal,
      );
      setName("");
      setEmail("");
      setPhone("");
      onOpenChange(false);
      onCreated(created);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) {
          setError(null);
          onOpenChange(false);
        }
      }}
    >
      <DialogContent className="rounded-2xl p-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New supplier</DialogTitle>
          <DialogDescription>
            Add a spare parts or service vendor for this company.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <label htmlFor={`${formId}-name`} className="text-sm font-medium">
              Supplier name
            </label>
            <Input
              id={`${formId}-name`}
              placeholder="Lusaka Auto Spares Ltd"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor={`${formId}-email`} className="text-sm font-medium">
              Email (optional)
            </label>
            <Input
              id={`${formId}-email`}
              type="email"
              placeholder="orders@vendor.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor={`${formId}-phone`} className="text-sm font-medium">
              Phone (optional)
            </label>
            <Input
              id={`${formId}-phone`}
              placeholder="+260 211 000 000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          {error ? (
            <p
              role="alert"
              className="rounded-xl border border-danger bg-danger/10 px-3.5 py-2.5 text-sm text-danger-foreground"
            >
              {errorText(error)}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Creating…" : "Create supplier"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
