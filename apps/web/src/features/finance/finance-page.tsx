"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  CarFront,
  CheckCircle2,
  CreditCard,
  FileCheck2,
  FileText,
  Landmark,
  Plus,
  Receipt,
  ShieldAlert,
  Wallet,
  X,
} from "lucide-react";
import { useSession } from "@/features/auth/session-provider";
import { useLiveContext } from "@/features/live/context";
import { CreditControlPanel } from "@/features/governance/credit-control-panel";
import { PayablesPanel } from "@/features/accounting/payables-panel";
import { CreditNotesPanel } from "@/features/accounting/credit-notes-panel";
import { BankingReconciliationPanel } from "@/features/accounting/banking-panel";
import { FixedAssetsPanel } from "@/features/accounting/fixed-assets-panel";
import {
  getArAgeing,
  getGlAccounts,
  listExpenses,
  listInvoices,
  listJournalEntries,
  listPayments,
  listRefunds,
} from "@/features/finance/service";
import { invoiceDisplayStatus } from "@/features/finance/pricing";
import {
  CreateExpenseDialog,
  CreateInvoiceDialog,
  EXPENSE_CATEGORY_LABELS,
  PAYMENT_METHOD_LABELS,
} from "@/features/finance/dialogs";
import {
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_TONES,
} from "@/features/finance/invoice-detail-page";
import {
  LiveDocumentPdfModal,
  type LivePdfDocument,
} from "@/features/pdf/live-pdf-modal";
import { errorText } from "@/lib/api/client";
import {
  can,
  canAccessAp,
  canAccessAssets,
  canAccessBanking,
  canAccessFinance,
  canViewGl,
  expenseCategories,
  formatMoneyMinor,
  paymentMethods,
  type ArAgeingBucketKey,
  type Invoice,
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
  PlateTag,
  StatusDotBadge,
  type ActiveFilterChip,
} from "@/components/data/data-table";
import { StatePanel } from "@/components/layout/state-panel";
import { ViewFadeIn } from "@/components/motion/primitives";
import { Button } from "@/components/ui/button";
import { DriveCoreSelect } from "@/components/ui/drivecore-select";
import { Skeleton } from "@/components/ui/skeleton";

type FinanceTab =
  | "invoices"
  | "credit"
  | "payables"
  | "payments"
  | "expenses"
  | "banking"
  | "assets"
  | "ledger";

const INVOICE_SORT_KEYS = [
  "id",
  "customer_name",
  "due_at",
  "total_minor",
  "outstanding_minor",
  "status",
] as const;
const PAYMENT_SORT_KEYS = ["id", "paid_at", "amount_minor", "method"] as const;
const REFUND_SORT_KEYS = ["id", "refunded_at", "amount_minor"] as const;
const EXPENSE_SORT_KEYS = [
  "incurred_at",
  "description",
  "category",
  "amount_minor",
] as const;

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString();
}

export function LiveFinancePage() {
  const { user } = useSession();
  const scope = useLiveContext();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const client = useQueryClient();

  const canAccess = !!user && canAccessFinance(user);
  const canViewInvoices = !!user && can(user, "invoices.view");
  const canManageInvoices = !!user && can(user, "invoices.manage");
  const canViewExpenses = !!user && can(user, "expenses.view");
  const canManageExpenses = !!user && can(user, "expenses.manage");
  const hasGlAccess = !!user && canViewGl(user);
  const hasApAccess = !!user && canAccessAp(user);
  const hasBankingAccess = !!user && canAccessBanking(user);
  const hasAssetsAccess = !!user && canAccessAssets(user);
  const currency = scope.company?.currency || "ZMW";

  const rawTab = searchParams.get("tab");
  const activeTab: FinanceTab =
    rawTab === "credit" ||
    rawTab === "payables" ||
    rawTab === "payments" ||
    rawTab === "expenses" ||
    rawTab === "banking" ||
    rawTab === "assets" ||
    rawTab === "ledger" ||
    rawTab === "invoices"
      ? rawTab
      : canViewInvoices
        ? "invoices"
        : canViewExpenses
          ? "expenses"
          : "ledger";

  const flow = searchParams.get("flow") === "refunds" ? "refunds" : "payments";
  const arView = searchParams.get("ar_view") === "credit_notes" ? "credit_notes" : "invoices";
  const rawQ = searchParams.get("q") ?? "";
  const status = searchParams.get("status") ?? "";
  const bucket = (searchParams.get("bucket") ?? "") as ArAgeingBucketKey | "";
  const method = searchParams.get("method") ?? "";
  const category = searchParams.get("category") ?? "";
  const glSource = searchParams.get("source") ?? "";
  const glAccount = searchParams.get("account") ?? "";
  const rawPage = Number(searchParams.get("page") ?? "1");
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;

  const allowedSorts =
    activeTab === "invoices"
      ? INVOICE_SORT_KEYS
      : activeTab === "payments"
        ? flow === "refunds"
          ? REFUND_SORT_KEYS
          : PAYMENT_SORT_KEYS
        : activeTab === "expenses"
          ? EXPENSE_SORT_KEYS
          : ([] as const);

  const { sort, dir } = parseSortParams(
    searchParams.get("sort"),
    searchParams.get("dir"),
    allowedSorts,
  );

  const [createInvoiceOpen, setCreateInvoiceOpen] = useState(false);
  const [createExpenseOpen, setCreateExpenseOpen] = useState(false);
  const [pdfInvoice, setPdfInvoice] = useState<Invoice | null>(null);
  const [notice, setNotice] = useState("");

  const branchId = scope.branch !== "all" ? scope.branch : undefined;
  const branchSuffix = `?branch=${encodeURIComponent(scope.branch)}`;

  function updateQuery(updates: Record<string, string | number | undefined>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined || value === "" || (key === "page" && value === 1)) {
        next.delete(key);
      } else {
        next.set(key, String(value));
      }
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function handleTabChange(nextTab: FinanceTab) {
    updateQuery({
      tab: nextTab,
      q: "",
      status: "",
      bucket: "",
      method: "",
      category: "",
      source: "",
      account: "",
      sort: "",
      dir: "",
      page: 1,
    });
  }

  function handleSort(clickedKey: string) {
    const next = nextSortState(sort, dir, clickedKey);
    updateQuery({ sort: next.sort, dir: next.dir, page: 1 });
  }

  const ageingQuery = useQuery({
    queryKey: [...scope.key, "invoices", "ageing", branchId ?? "all"],
    queryFn: ({ signal }) =>
      getArAgeing({ companyId: scope.companyId, branchId }, signal),
    enabled: canViewInvoices && activeTab === "invoices",
  });

  const invoicesQuery = useQuery({
    queryKey: [
      ...scope.key,
      "invoices",
      "list",
      branchId ?? "all",
      status,
      bucket,
      rawQ,
      page,
      sort,
      dir,
    ],
    queryFn: ({ signal }) =>
      listInvoices(
        {
          companyId: scope.companyId,
          branchId,
          status: status || undefined,
          ageingBucket: bucket || undefined,
          q: rawQ,
          page,
          sort: sort || undefined,
          dir,
        },
        signal,
      ),
    enabled: canViewInvoices && activeTab === "invoices",
  });

  const paymentsQuery = useQuery({
    queryKey: [
      ...scope.key,
      "payments",
      "list",
      branchId ?? "all",
      method,
      rawQ,
      page,
      sort,
      dir,
    ],
    queryFn: ({ signal }) =>
      listPayments(
        {
          companyId: scope.companyId,
          branchId,
          method: method || undefined,
          q: rawQ,
          page,
          sort: sort || undefined,
          dir,
        },
        signal,
      ),
    enabled: canViewInvoices && activeTab === "payments" && flow === "payments",
  });

  const refundsQuery = useQuery({
    queryKey: [
      ...scope.key,
      "refunds",
      "list",
      branchId ?? "all",
      rawQ,
      page,
      sort,
      dir,
    ],
    queryFn: ({ signal }) =>
      listRefunds(
        {
          companyId: scope.companyId,
          branchId,
          q: rawQ,
          page,
          sort: sort || undefined,
          dir,
        },
        signal,
      ),
    enabled: canViewInvoices && activeTab === "payments" && flow === "refunds",
  });

  const expensesQuery = useQuery({
    queryKey: [
      ...scope.key,
      "expenses",
      "list",
      branchId ?? "all",
      category,
      rawQ,
      page,
      sort,
      dir,
    ],
    queryFn: ({ signal }) =>
      listExpenses(
        {
          companyId: scope.companyId,
          branchId,
          category: category || undefined,
          q: rawQ,
          page,
          sort: sort || undefined,
          dir,
        },
        signal,
      ),
    enabled: canViewExpenses && activeTab === "expenses",
  });

  const glAccountsQuery = useQuery({
    queryKey: [...scope.key, "gl", "accounts", branchId ?? "all"],
    queryFn: ({ signal }) =>
      getGlAccounts({ companyId: scope.companyId, branchId }, signal),
    enabled: hasGlAccess && activeTab === "ledger",
  });

  const glJournalQuery = useQuery({
    queryKey: [
      ...scope.key,
      "gl",
      "journal-entries",
      branchId ?? "all",
      glAccount,
      glSource,
      rawQ,
      page,
    ],
    queryFn: ({ signal }) =>
      listJournalEntries(
        {
          companyId: scope.companyId,
          branchId,
          accountCode: glAccount || undefined,
          sourceType: glSource || undefined,
          q: rawQ,
          page,
        },
        signal,
      ),
    enabled: hasGlAccess && activeTab === "ledger",
  });

  if (!canAccess) {
    return (
      <StatePanel title="Access denied">
        Your account does not have permission to access Finance records.
      </StatePanel>
    );
  }

  const tabs: { key: FinanceTab; label: string; visible: boolean }[] = [
    { key: "invoices", label: "Invoices", visible: canViewInvoices },
    { key: "credit", label: "Credit control", visible: canViewInvoices },
    { key: "payables", label: "Payables (AP)", visible: hasApAccess },
    { key: "payments", label: "Payments & Refunds", visible: canViewInvoices },
    { key: "expenses", label: "Expenses", visible: canViewExpenses },
    { key: "banking", label: "Banking & Recon", visible: hasBankingAccess },
    { key: "assets", label: "Fixed assets", visible: hasAssetsAccess },
    { key: "ledger", label: "General Ledger", visible: hasGlAccess },
  ];

  const invoicePdfDoc: LivePdfDocument | null = pdfInvoice
    ? {
        kind: "invoice",
        id: pdfInvoice.id,
        status: invoiceDisplayStatus(pdfInvoice),
        companyName: scope.company?.name ?? `Company #${pdfInvoice.company_id}`,
        branchName: scope.directory?.branches.find(
          (b) => b.id === pdfInvoice.branch_id,
        )?.name,
        currency,
        customerName:
          pdfInvoice.customer_name ??
          pdfInvoice.custom_customer_name ??
          (pdfInvoice.customer_id
            ? `Customer #${pdfInvoice.customer_id}`
            : "Custom customer"),
        createdAt: pdfInvoice.issued_at ?? pdfInvoice.created_at,
        lines: pdfInvoice.lines.map((line) => ({
          label: line.description,
          detail: `${line.quantity} × ${formatMoneyMinor(line.unit_price_minor, currency)}`,
          amountMinor: line.line_total_minor,
        })),
        pricing: {
          subtotalMinor: pdfInvoice.subtotal_minor,
          discountPct: pdfInvoice.discount_pct,
          discountMinor: pdfInvoice.discount_minor,
          vatRatePct: pdfInvoice.vat_rate_pct,
          vatMinor: pdfInvoice.vat_minor,
          totalMinor: pdfInvoice.total_minor,
        },
        notes: pdfInvoice.notes,
        serverPdfPath: `api/v1/invoices/${pdfInvoice.id}/pdf`,
      }
    : null;

  const invoiceChips: ActiveFilterChip[] = [];
  if (rawQ) {
    invoiceChips.push({
      key: "q",
      label: `Search: ${rawQ}`,
      onRemove: () => updateQuery({ q: "", page: 1 }),
    });
  }
  if (status) {
    invoiceChips.push({
      key: "status",
      label: `Status: ${status}`,
      onRemove: () => updateQuery({ status: "", page: 1 }),
    });
  }
  if (bucket) {
    const bucketLabel =
      ageingQuery.data?.buckets.find((b) => b.key === bucket)?.label ?? bucket;
    invoiceChips.push({
      key: "bucket",
      label: `Ageing: ${bucketLabel}`,
      onRemove: () => updateQuery({ bucket: "", page: 1 }),
    });
  }

  return (
    <ViewFadeIn className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-page-title font-extrabold tracking-tight">
            Finance
          </h1>
          <p className="text-sm text-muted-foreground">
            {scope.company?.name} ·{" "}
            {scope.branch === "all"
              ? "All accessible branches"
              : (scope.directory?.branches.find(
                  (b) => String(b.id) === scope.branch,
                )?.name ?? `Branch #${scope.branch}`)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManageInvoices && activeTab === "invoices" ? (
            <Button
              type="button"
              onClick={() => setCreateInvoiceOpen(true)}
              className="gap-1.5"
            >
              <Plus className="size-4" aria-hidden="true" />
              New invoice
            </Button>
          ) : null}
          {canManageExpenses && activeTab === "expenses" ? (
            <Button
              type="button"
              onClick={() => setCreateExpenseOpen(true)}
              className="gap-1.5"
            >
              <Plus className="size-4" aria-hidden="true" />
              Record expense
            </Button>
          ) : null}
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Finance sections"
        className="flex flex-wrap gap-1.5 rounded-2xl border bg-surface p-1.5"
      >
        {tabs
          .filter((t) => t.visible)
          .map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => handleTabChange(tab.key)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                }`}
              >
                {tab.key === "invoices" ? (
                  <Receipt className="size-3.5" aria-hidden="true" />
                ) : tab.key === "credit" ? (
                  <ShieldAlert className="size-3.5" aria-hidden="true" />
                ) : tab.key === "payables" ? (
                  <FileCheck2 className="size-3.5" aria-hidden="true" />
                ) : tab.key === "payments" ? (
                  <CreditCard className="size-3.5" aria-hidden="true" />
                ) : tab.key === "expenses" ? (
                  <Wallet className="size-3.5" aria-hidden="true" />
                ) : tab.key === "banking" ? (
                  <Landmark className="size-3.5" aria-hidden="true" />
                ) : tab.key === "assets" ? (
                  <CarFront className="size-3.5" aria-hidden="true" />
                ) : (
                  <BookOpen className="size-3.5" aria-hidden="true" />
                )}
                {tab.label}
              </button>
            );
          })}
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

      {activeTab === "credit" && canViewInvoices ? (
        <CreditControlPanel canManage={canManageInvoices} />
      ) : null}

      {activeTab === "payables" && hasApAccess ? <PayablesPanel /> : null}

      {activeTab === "banking" && hasBankingAccess ? (
        <BankingReconciliationPanel />
      ) : null}

      {activeTab === "assets" && hasAssetsAccess ? <FixedAssetsPanel /> : null}

      {activeTab === "invoices" ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={arView === "invoices" ? "default" : "outline"}
              onClick={() => updateQuery({ ar_view: "", page: 1 })}
            >
              Customer invoices
            </Button>
            <Button
              type="button"
              size="sm"
              variant={arView === "credit_notes" ? "default" : "outline"}
              onClick={() => updateQuery({ ar_view: "credit_notes", page: 1 })}
            >
              Credit notes
            </Button>
          </div>
          {arView === "credit_notes" ? (
            <CreditNotesPanel />
          ) : (
            <>
          <section
            aria-label="Accounts receivable ageing"
            className="dc-shadow-card rounded-2xl border bg-surface p-card"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Landmark className="size-4 text-link" aria-hidden="true" />
                <h2 className="text-sm font-bold">
                  AR Ageing (5-bucket open balances)
                </h2>
              </div>
              {ageingQuery.data ? (
                <span className="font-mono text-xs font-semibold text-muted-foreground tabular-nums">
                  Total open:{" "}
                  {formatMoneyMinor(
                    ageingQuery.data.total_outstanding_minor,
                    currency,
                  )}
                </span>
              ) : null}
            </div>
            {ageingQuery.isPending ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-xl" />
                ))}
              </div>
            ) : ageingQuery.data ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {ageingQuery.data.buckets.map((b, idx) => {
                  const selected = bucket === b.key;
                  return (
                    <button
                      key={b.key}
                      type="button"
                      onClick={() =>
                        updateQuery({
                          bucket: selected ? "" : b.key,
                          page: 1,
                        })
                      }
                      className={`rounded-xl border p-3 text-left transition-colors ${
                        selected
                          ? "border-primary bg-primary/10"
                          : idx >= 2 && b.amount_minor > 0
                            ? "border-warning/50 bg-warning/5 hover:border-warning"
                            : "bg-background/60 hover:border-border"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-muted-foreground">
                          {b.label}
                        </span>
                        <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums">
                          {b.count} inv
                        </span>
                      </div>
                      <p className="mt-1.5 font-mono text-sm font-extrabold tabular-nums">
                        {formatMoneyMinor(b.amount_minor, currency)}
                      </p>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </section>

          <DataTableFrame
            ariaLabel="Invoices table"
            chips={invoiceChips}
            toolbar={
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <DataSearchForm
                  label="Search invoices"
                  placeholder="Search invoice #, customer, or notes…"
                  defaultValue={rawQ}
                  formKey={`inv:${scope.companyId}:${scope.branch}:${rawQ}`}
                  onSubmitQuery={(nextQ) => updateQuery({ q: nextQ, page: 1 })}
                />
                <div className="w-full space-y-1.5 sm:w-52">
                  <span className="block text-label font-semibold">Status</span>
                  <DriveCoreSelect
                    ariaLabel="Filter invoices by status"
                    value={status}
                    onValueChange={(nextStatus) =>
                      updateQuery({ status: nextStatus, page: 1 })
                    }
                    options={[
                      { value: "", label: "All statuses" },
                      { value: "draft", label: "Draft" },
                      { value: "issued", label: "Issued" },
                      { value: "overdue", label: "Overdue" },
                      { value: "paid", label: "Paid" },
                      { value: "void", label: "Void" },
                    ]}
                  />
                </div>
              </div>
            }
            footer={
              invoicesQuery.data ? (
                <>
                  <span className="font-mono text-xs tabular-nums">
                    {invoicesQuery.data.total}{" "}
                    {invoicesQuery.data.total === 1 ? "invoice" : "invoices"} ·
                    Page {invoicesQuery.data.page} of{" "}
                    {invoicesQuery.data.lastPage}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={page <= 1 || invoicesQuery.isFetching}
                      onClick={() => updateQuery({ page: Math.max(1, page - 1) })}
                    >
                      Previous
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={
                        page >= invoicesQuery.data.lastPage ||
                        invoicesQuery.isFetching
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
            {invoicesQuery.isPending ? (
              <DataTableSkeleton columns={7} label="Loading invoices" />
            ) : invoicesQuery.error ? (
              <div className="p-card">
                <StatePanel
                  title="Invoices unavailable"
                  onRetry={() => {
                    void invoicesQuery.refetch();
                  }}
                >
                  {errorText(invoicesQuery.error)}
                </StatePanel>
              </div>
            ) : invoicesQuery.data.items.length === 0 ? (
              <div className="p-card">
                <StatePanel
                  title={
                    invoiceChips.length > 0
                      ? "No matching invoices"
                      : "No invoices yet"
                  }
                >
                  {invoiceChips.length > 0
                    ? "Try clearing your search, status, or ageing filter."
                    : "Invoices auto-generated on rental return or created manually will appear here."}
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
                      Invoice
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
                      sortKey="due_at"
                      activeSort={sort}
                      activeDir={dir}
                      onSort={handleSort}
                    >
                      Due date
                    </DataTableHeaderCell>
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
                      align="right"
                      sortKey="outstanding_minor"
                      activeSort={sort}
                      activeDir={dir}
                      onSort={handleSort}
                    >
                      Balance due
                    </DataTableHeaderCell>
                    <DataTableHeaderCell
                      sortKey="status"
                      activeSort={sort}
                      activeDir={dir}
                      onSort={handleSort}
                    >
                      Status
                    </DataTableHeaderCell>
                    <DataTableHeaderCell align="right">
                      Actions
                    </DataTableHeaderCell>
                  </tr>
                </DataTableHead>
                <DataTableBody>
                  {sortRows(invoicesQuery.data.items, sort, dir, {
                    id: (inv) => inv.id,
                    customer_name: (inv) => inv.customer_name ?? "",
                    due_at: (inv) => Date.parse(inv.due_at),
                    total_minor: (inv) => inv.total_minor,
                    outstanding_minor: (inv) => inv.outstanding_minor,
                    status: (inv) => invoiceDisplayStatus(inv),
                  }).map((inv) => {
                    const disp = invoiceDisplayStatus(inv);
                    return (
                      <DataTableRow key={inv.id}>
                        <DataTableCell numeric>
                          <Link
                            href={`/companies/${scope.companyId}/finance/invoices/${inv.id}${branchSuffix}`}
                            className="font-semibold text-foreground hover:text-link hover:underline"
                          >
                            {inv.invoice_number}
                          </Link>
                        </DataTableCell>
                        <DataTableCell className="max-w-[14rem]">
                          <span className="inline-flex max-w-full items-center gap-1.5">
                            <span className="truncate">
                              {inv.customer_name ??
                                inv.custom_customer_name ??
                                (inv.customer_id
                                  ? `Customer #${inv.customer_id}`
                                  : "Custom customer")}
                            </span>
                            {inv.customer_id === null ? (
                              <span className="shrink-0 rounded-md border bg-muted/60 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Custom
                              </span>
                            ) : null}
                          </span>
                        </DataTableCell>
                        <DataTableCell numeric>
                          {fmtDate(inv.due_at)}
                        </DataTableCell>
                        <DataTableCell align="right" numeric className="font-medium">
                          {formatMoneyMinor(inv.total_minor, currency)}
                        </DataTableCell>
                        <DataTableCell align="right" numeric className="font-semibold">
                          {formatMoneyMinor(inv.outstanding_minor, currency)}
                        </DataTableCell>
                        <DataTableCell>
                          <StatusDotBadge tone={INVOICE_STATUS_TONES[disp]}>
                            {INVOICE_STATUS_LABELS[disp]}
                          </StatusDotBadge>
                        </DataTableCell>
                        <DataTableCell align="right">
                          <div className="inline-flex items-center gap-2">
                            <Link
                              href={`/companies/${scope.companyId}/finance/invoices/${inv.id}${branchSuffix}`}
                              className="text-xs font-semibold text-link hover:underline"
                            >
                              Open
                            </Link>
                            <button
                              type="button"
                              onClick={() => setPdfInvoice(inv)}
                              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                            >
                              <FileText className="size-3.5" aria-hidden="true" />
                              PDF
                            </button>
                          </div>
                        </DataTableCell>
                      </DataTableRow>
                    );
                  })}
                </DataTableBody>
              </DataTable>
            )}
          </DataTableFrame>
            </>
          )}
        </div>
      ) : null}

      {activeTab === "payments" ? (
        <DataTableFrame
          ariaLabel="Payments and refunds table"
          toolbar={
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="inline-flex rounded-xl border bg-muted/40 p-1">
                <button
                  type="button"
                  onClick={() =>
                    updateQuery({ flow: "payments", sort: "", dir: "", page: 1 })
                  }
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    flow === "payments"
                      ? "bg-surface text-foreground shadow-xs"
                      : "text-muted-foreground"
                  }`}
                >
                  Payments
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updateQuery({
                      flow: "refunds",
                      method: "",
                      sort: "",
                      dir: "",
                      page: 1,
                    })
                  }
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    flow === "refunds"
                      ? "bg-surface text-foreground shadow-xs"
                      : "text-muted-foreground"
                  }`}
                >
                  Refunds
                </button>
              </div>
              <DataSearchForm
                label={flow === "payments" ? "Search payments" : "Search refunds"}
                placeholder={
                  flow === "payments"
                    ? "Search reference, invoice #, or customer…"
                    : "Search reason, invoice #, or customer…"
                }
                defaultValue={rawQ}
                formKey={`pay:${flow}:${rawQ}`}
                onSubmitQuery={(nextQ) => updateQuery({ q: nextQ, page: 1 })}
              />
              {flow === "payments" ? (
                <div className="w-full space-y-1.5 sm:w-48">
                  <span className="block text-label font-semibold">Method</span>
                  <DriveCoreSelect
                    ariaLabel="Filter by payment method"
                    value={method}
                    onValueChange={(nextMethod) =>
                      updateQuery({ method: nextMethod, page: 1 })
                    }
                    options={[
                      { value: "", label: "All methods" },
                      ...paymentMethods.map((m) => ({
                        value: m,
                        label: PAYMENT_METHOD_LABELS[m],
                      })),
                    ]}
                  />
                </div>
              ) : null}
            </div>
          }
        >
          {flow === "payments" ? (
            paymentsQuery.isPending ? (
              <DataTableSkeleton columns={6} label="Loading payments" />
            ) : paymentsQuery.error ? (
              <div className="p-card">
                <StatePanel title="Payments unavailable">
                  {errorText(paymentsQuery.error)}
                </StatePanel>
              </div>
            ) : paymentsQuery.data.items.length === 0 ? (
              <div className="p-card">
                <StatePanel title="No payments recorded">
                  Payments recorded against issued invoices will appear here.
                </StatePanel>
              </div>
            ) : (
              <DataTable>
                <DataTableHead>
                  <tr>
                    <DataTableHeaderCell
                      sortKey="paid_at"
                      activeSort={sort}
                      activeDir={dir}
                      onSort={handleSort}
                    >
                      Date
                    </DataTableHeaderCell>
                    <DataTableHeaderCell>Invoice</DataTableHeaderCell>
                    <DataTableHeaderCell>Customer</DataTableHeaderCell>
                    <DataTableHeaderCell
                      sortKey="method"
                      activeSort={sort}
                      activeDir={dir}
                      onSort={handleSort}
                    >
                      Method
                    </DataTableHeaderCell>
                    <DataTableHeaderCell>Reference</DataTableHeaderCell>
                    <DataTableHeaderCell
                      align="right"
                      sortKey="amount_minor"
                      activeSort={sort}
                      activeDir={dir}
                      onSort={handleSort}
                    >
                      Amount
                    </DataTableHeaderCell>
                  </tr>
                </DataTableHead>
                <DataTableBody>
                  {sortRows(paymentsQuery.data.items, sort, dir, {
                    id: (p) => p.id,
                    paid_at: (p) => Date.parse(p.paid_at),
                    method: (p) => p.method,
                    amount_minor: (p) => p.amount_minor,
                  }).map((p) => (
                    <DataTableRow key={p.id}>
                      <DataTableCell numeric>{fmtDate(p.paid_at)}</DataTableCell>
                      <DataTableCell numeric>
                        <Link
                          href={`/companies/${scope.companyId}/finance/invoices/${p.invoice_id}${branchSuffix}`}
                          className="font-semibold text-link hover:underline"
                        >
                          {p.invoice_number ?? `Invoice #${p.invoice_id}`}
                        </Link>
                      </DataTableCell>
                      <DataTableCell>
                        {p.customer_name ?? "—"}
                      </DataTableCell>
                      <DataTableCell>
                        {PAYMENT_METHOD_LABELS[p.method]}
                      </DataTableCell>
                      <DataTableCell className="font-mono text-xs">
                        {p.reference}
                      </DataTableCell>
                      <DataTableCell align="right" numeric className="font-semibold">
                        {formatMoneyMinor(p.amount_minor, currency)}
                      </DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            )
          ) : refundsQuery.isPending ? (
            <DataTableSkeleton columns={5} label="Loading refunds" />
          ) : refundsQuery.error ? (
            <div className="p-card">
              <StatePanel title="Refunds unavailable">
                {errorText(refundsQuery.error)}
              </StatePanel>
            </div>
          ) : refundsQuery.data.items.length === 0 ? (
            <div className="p-card">
              <StatePanel title="No refunds recorded">
                Refunds recorded against paid invoices will appear here.
              </StatePanel>
            </div>
          ) : (
            <DataTable>
              <DataTableHead>
                <tr>
                  <DataTableHeaderCell
                    sortKey="refunded_at"
                    activeSort={sort}
                    activeDir={dir}
                    onSort={handleSort}
                  >
                    Date
                  </DataTableHeaderCell>
                  <DataTableHeaderCell>Invoice</DataTableHeaderCell>
                  <DataTableHeaderCell>Customer</DataTableHeaderCell>
                  <DataTableHeaderCell>Reason</DataTableHeaderCell>
                  <DataTableHeaderCell
                    align="right"
                    sortKey="amount_minor"
                    activeSort={sort}
                    activeDir={dir}
                    onSort={handleSort}
                  >
                    Amount
                  </DataTableHeaderCell>
                </tr>
              </DataTableHead>
              <DataTableBody>
                {sortRows(refundsQuery.data.items, sort, dir, {
                  id: (r) => r.id,
                  refunded_at: (r) => Date.parse(r.refunded_at),
                  amount_minor: (r) => r.amount_minor,
                }).map((r) => (
                  <DataTableRow key={r.id}>
                    <DataTableCell numeric>
                      {fmtDate(r.refunded_at)}
                    </DataTableCell>
                    <DataTableCell numeric>
                      <Link
                        href={`/companies/${scope.companyId}/finance/invoices/${r.invoice_id}${branchSuffix}`}
                        className="font-semibold text-link hover:underline"
                      >
                        {r.invoice_number ?? `Invoice #${r.invoice_id}`}
                      </Link>
                    </DataTableCell>
                    <DataTableCell>{r.customer_name ?? "—"}</DataTableCell>
                    <DataTableCell>{r.reason}</DataTableCell>
                    <DataTableCell align="right" numeric className="font-semibold">
                      {formatMoneyMinor(r.amount_minor, currency)}
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          )}
        </DataTableFrame>
      ) : null}

      {activeTab === "expenses" ? (
        <DataTableFrame
          ariaLabel="Expenses table"
          toolbar={
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <DataSearchForm
                label="Search expenses"
                placeholder="Search description or vehicle registration…"
                defaultValue={rawQ}
                formKey={`exp:${rawQ}`}
                onSubmitQuery={(nextQ) => updateQuery({ q: nextQ, page: 1 })}
              />
              <div className="w-full space-y-1.5 sm:w-52">
                <span className="block text-label font-semibold">Category</span>
                <DriveCoreSelect
                  ariaLabel="Filter expenses by category"
                  value={category}
                  onValueChange={(nextCategory) =>
                    updateQuery({ category: nextCategory, page: 1 })
                  }
                  options={[
                    { value: "", label: "All categories" },
                    ...expenseCategories.map((c) => ({
                      value: c,
                      label: EXPENSE_CATEGORY_LABELS[c],
                    })),
                  ]}
                />
              </div>
            </div>
          }
        >
          {expensesQuery.isPending ? (
            <DataTableSkeleton columns={5} label="Loading expenses" />
          ) : expensesQuery.error ? (
            <div className="p-card">
              <StatePanel title="Expenses unavailable">
                {errorText(expensesQuery.error)}
              </StatePanel>
            </div>
          ) : expensesQuery.data.items.length === 0 ? (
            <div className="p-card">
              <StatePanel title="No expenses recorded">
                Immutable operating and fleet expenses posted in this scope will
                appear here.
              </StatePanel>
            </div>
          ) : (
            <DataTable>
              <DataTableHead>
                <tr>
                  <DataTableHeaderCell
                    sortKey="incurred_at"
                    activeSort={sort}
                    activeDir={dir}
                    onSort={handleSort}
                  >
                    Date
                  </DataTableHeaderCell>
                  <DataTableHeaderCell
                    sortKey="description"
                    activeSort={sort}
                    activeDir={dir}
                    onSort={handleSort}
                  >
                    Description
                  </DataTableHeaderCell>
                  <DataTableHeaderCell
                    sortKey="category"
                    activeSort={sort}
                    activeDir={dir}
                    onSort={handleSort}
                  >
                    Category
                  </DataTableHeaderCell>
                  <DataTableHeaderCell>Vehicle</DataTableHeaderCell>
                  <DataTableHeaderCell
                    align="right"
                    sortKey="amount_minor"
                    activeSort={sort}
                    activeDir={dir}
                    onSort={handleSort}
                  >
                    Amount
                  </DataTableHeaderCell>
                </tr>
              </DataTableHead>
              <DataTableBody>
                {sortRows(expensesQuery.data.items, sort, dir, {
                  incurred_at: (e) => Date.parse(e.incurred_at),
                  description: (e) => e.description,
                  category: (e) => e.category,
                  amount_minor: (e) => e.amount_minor,
                }).map((exp) => (
                  <DataTableRow key={exp.id}>
                    <DataTableCell numeric>
                      {fmtDate(exp.incurred_at)}
                    </DataTableCell>
                    <DataTableCell className="font-medium">
                      {exp.description}
                    </DataTableCell>
                    <DataTableCell>
                      {EXPENSE_CATEGORY_LABELS[exp.category]}
                    </DataTableCell>
                    <DataTableCell>
                      {exp.vehicle_registration ? (
                        <PlateTag>{exp.vehicle_registration}</PlateTag>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          General
                        </span>
                      )}
                    </DataTableCell>
                    <DataTableCell align="right" numeric className="font-semibold">
                      {formatMoneyMinor(exp.amount_minor, currency)}
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          )}
        </DataTableFrame>
      ) : null}

      {activeTab === "ledger" ? (
        !hasGlAccess ? (
          <StatePanel title="General Ledger restricted">
            Your role does not have permission (`gl.view`) to inspect General
            Ledger accounts or journal postings.
          </StatePanel>
        ) : (
          <div className="space-y-6">
            <section
              aria-label="Chart of Accounts trial balance"
              className="dc-shadow-card space-y-4 rounded-2xl border bg-surface p-card"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-section-heading">
                    Trial balance (system Chart of Accounts)
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Double-entry totals across all posted invoices, payments,
                    refunds, and expenses.
                  </p>
                </div>
                {glAccountsQuery.data ? (
                  <StatusDotBadge
                    tone={
                      glAccountsQuery.data.is_balanced ? "success" : "danger"
                    }
                  >
                    <CheckCircle2 className="size-3.5" aria-hidden="true" />
                    {glAccountsQuery.data.is_balanced
                      ? `Balanced (${formatMoneyMinor(glAccountsQuery.data.total_debits_minor, currency)})`
                      : "Out of balance"}
                  </StatusDotBadge>
                ) : null}
              </div>

              {glAccountsQuery.isPending ? (
                <DataTableSkeleton columns={5} label="Loading chart of accounts" />
              ) : glAccountsQuery.error ? (
                <StatePanel title="Trial balance unavailable">
                  {errorText(glAccountsQuery.error)}
                </StatePanel>
              ) : (
                <DataTable>
                  <DataTableHead>
                    <tr>
                      <DataTableHeaderCell>Code</DataTableHeaderCell>
                      <DataTableHeaderCell>Account</DataTableHeaderCell>
                      <DataTableHeaderCell>Type</DataTableHeaderCell>
                      <DataTableHeaderCell align="right">
                        Debits
                      </DataTableHeaderCell>
                      <DataTableHeaderCell align="right">
                        Credits
                      </DataTableHeaderCell>
                      <DataTableHeaderCell align="right">
                        Net balance
                      </DataTableHeaderCell>
                    </tr>
                  </DataTableHead>
                  <DataTableBody>
                    {glAccountsQuery.data.accounts.map((acc) => (
                      <DataTableRow key={acc.code}>
                        <DataTableCell numeric className="font-semibold">
                          {acc.code}
                        </DataTableCell>
                        <DataTableCell className="font-medium">
                          {acc.name}
                        </DataTableCell>
                        <DataTableCell className="capitalize text-muted-foreground">
                          {acc.type}
                        </DataTableCell>
                        <DataTableCell align="right" numeric>
                          {formatMoneyMinor(acc.debit_minor, currency)}
                        </DataTableCell>
                        <DataTableCell align="right" numeric>
                          {formatMoneyMinor(acc.credit_minor, currency)}
                        </DataTableCell>
                        <DataTableCell align="right" numeric className="font-semibold">
                          {formatMoneyMinor(acc.balance_minor, currency)}
                        </DataTableCell>
                      </DataTableRow>
                    ))}
                  </DataTableBody>
                </DataTable>
              )}
            </section>

            <section
              aria-label="Double-entry journal entries"
              className="dc-shadow-card space-y-4 rounded-2xl border bg-surface p-card"
            >
              <div className="flex flex-wrap items-end justify-between gap-3">
                <h2 className="text-section-heading">Journal entries</h2>
                <div className="flex flex-wrap gap-3">
                  <div className="w-44 space-y-1">
                    <span className="block text-label font-semibold">Source</span>
                    <DriveCoreSelect
                      ariaLabel="Filter journal by source"
                      value={glSource}
                      onValueChange={(next) =>
                        updateQuery({ source: next, page: 1 })
                      }
                      options={[
                        { value: "", label: "All sources" },
                        { value: "invoice", label: "Invoice" },
                        { value: "payment", label: "Payment" },
                        { value: "refund", label: "Refund" },
                        { value: "expense", label: "Expense" },
                        { value: "work_order", label: "Work order" },
                        { value: "purchase_order", label: "Purchase order" },
                        { value: "stock_adjustment", label: "Stock adjustment" },
                      ]}
                    />
                  </div>
                  <div className="w-52 space-y-1">
                    <span className="block text-label font-semibold">
                      Account
                    </span>
                    <DriveCoreSelect
                      ariaLabel="Filter journal by account"
                      value={glAccount}
                      onValueChange={(next) =>
                        updateQuery({ account: next, page: 1 })
                      }
                      options={[
                        { value: "", label: "All accounts" },
                        ...(glAccountsQuery.data?.accounts ?? []).map((a) => ({
                          value: a.code,
                          label: `${a.code} · ${a.name}`,
                        })),
                      ]}
                    />
                  </div>
                </div>
              </div>

              {glJournalQuery.isPending ? (
                <DataTableSkeleton columns={4} label="Loading journal entries" />
              ) : glJournalQuery.error ? (
                <StatePanel title="Journal unavailable">
                  {errorText(glJournalQuery.error)}
                </StatePanel>
              ) : glJournalQuery.data.items.length === 0 ? (
                <StatePanel title="No journal entries yet">
                  Issuing an invoice, recording a payment or refund, or posting
                  an expense will generate balanced debit/credit entries here.
                </StatePanel>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {glJournalQuery.data.items.map((entry) => (
                    <article
                      key={entry.id}
                      className="rounded-xl border bg-background/60 p-3.5"
                    >
                      <div className="flex items-center justify-between gap-2 border-b pb-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold">
                            {entry.reference}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {entry.memo}
                          </p>
                        </div>
                        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                          {fmtDate(entry.posted_at)}
                        </span>
                      </div>
                      <ul className="mt-2.5 space-y-1.5 text-xs">
                        {entry.lines.map((line, idx) => (
                          <li
                            key={line.id ?? idx}
                            className="flex items-center justify-between gap-2"
                          >
                            <span className="flex min-w-0 items-center gap-1.5">
                              <span
                                className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                                  line.debit_minor > 0
                                    ? "bg-structural text-structural-foreground"
                                    : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {line.debit_minor > 0 ? "DR" : "CR"}
                              </span>
                              <span className="truncate">
                                {line.account_code} {line.account_name}
                              </span>
                            </span>
                            <span className="shrink-0 font-mono font-semibold tabular-nums">
                              {formatMoneyMinor(
                                line.debit_minor > 0
                                  ? line.debit_minor
                                  : line.credit_minor,
                                currency,
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        )
      ) : null}

      <CreateInvoiceDialog
        open={createInvoiceOpen}
        onOpenChange={setCreateInvoiceOpen}
        onCreated={(created) => {
          setNotice(`Draft invoice ${created.invoice_number} created.`);
          void client.invalidateQueries({
            queryKey: [...scope.key, "invoices"],
          });
          router.push(
            `/companies/${scope.companyId}/finance/invoices/${created.id}${branchSuffix}`,
          );
        }}
      />

      <CreateExpenseDialog
        open={createExpenseOpen}
        onOpenChange={setCreateExpenseOpen}
        onCreated={(created) => {
          setNotice(
            `Expense "${created.description}" (${formatMoneyMinor(created.amount_minor, currency)}) posted to GL.`,
          );
          void Promise.all([
            client.invalidateQueries({ queryKey: [...scope.key, "expenses"] }),
            client.invalidateQueries({ queryKey: [...scope.key, "gl"] }),
          ]);
        }}
      />

      <LiveDocumentPdfModal
        doc={invoicePdfDoc}
        onClose={() => setPdfInvoice(null)}
      />
    </ViewFadeIn>
  );
}
