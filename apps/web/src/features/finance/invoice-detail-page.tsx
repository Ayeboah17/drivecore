"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  CheckCircle2,
  CreditCard,
  FileText,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useSession } from "@/features/auth/session-provider";
import { useLiveContext } from "@/features/live/context";
import { EntityDocumentsPanel } from "@/features/documents/documents-panel";
import {
  getInvoice,
  issueInvoice,
  updateInvoice,
  voidInvoice,
  type InvoiceLinePayload,
} from "@/features/finance/service";
import {
  calculateInvoicePreview,
  invoiceDisplayStatus,
  type InvoiceDisplayStatus,
} from "@/features/finance/pricing";
import {
  PAYMENT_METHOD_LABELS,
  RecordPaymentDialog,
  RecordRefundDialog,
} from "@/features/finance/dialogs";
import {
  LiveDocumentPdfModal,
  type LivePdfDocument,
} from "@/features/pdf/live-pdf-modal";
import { ApiError, errorText } from "@/lib/api/client";
import {
  can,
  formatMoneyMinor,
  parseMajorToMinor,
  type Invoice,
} from "@/lib/api/contracts";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  StatusDotBadge,
  type StatusDotTone,
} from "@/components/data/data-table";
import { StatePanel } from "@/components/layout/state-panel";
import { ViewFadeIn } from "@/components/motion/primitives";
import { Button } from "@/components/ui/button";
import { DriveCoreDateField } from "@/components/ui/drivecore-calendar";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

export const INVOICE_STATUS_TONES: Record<InvoiceDisplayStatus, StatusDotTone> = {
  draft: "neutral",
  issued: "info",
  overdue: "warning",
  paid: "success",
  void: "danger",
};

export const INVOICE_STATUS_LABELS: Record<InvoiceDisplayStatus, string> = {
  draft: "Draft",
  issued: "Issued",
  overdue: "Overdue",
  paid: "Paid",
  void: "Void",
};

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString();
}

function fmtDateTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

interface EditableLine {
  key: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

export function LiveInvoiceDetailPage({ invoiceId }: { invoiceId: string }) {
  const { user } = useSession();
  const scope = useLiveContext();
  const client = useQueryClient();

  const valid =
    /^[1-9]\d*$/.test(invoiceId ?? "") && Number.isSafeInteger(Number(invoiceId));
  const canView = !!user && can(user, "invoices.view");
  const canManageInvoices = !!user && can(user, "invoices.manage");
  const canManagePayments = !!user && can(user, "payments.manage");
  const canViewDocs = !!user && can(user, "documents.view");
  const canUploadDocs = !!user && can(user, "documents.manage");
  const currency = scope.company?.currency || "ZMW";

  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState<unknown>(null);
  const [busyAction, setBusyAction] = useState<"" | "issue" | "void" | "save">(
    "",
  );
  const [payOpen, setPayOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);

  const query = useQuery({
    queryKey: [...scope.key, "invoices", "detail", invoiceId],
    queryFn: ({ signal }) => getInvoice(invoiceId, signal),
    enabled: valid && canView,
    staleTime: 0,
  });

  const backHref = `/companies/${scope.companyId}/finance?tab=invoices&branch=${encodeURIComponent(scope.branch)}`;

  async function refreshFinance() {
    await Promise.all([
      client.invalidateQueries({ queryKey: [...scope.key, "invoices"] }),
      client.invalidateQueries({ queryKey: [...scope.key, "payments"] }),
      client.invalidateQueries({ queryKey: [...scope.key, "refunds"] }),
      client.invalidateQueries({ queryKey: [...scope.key, "gl"] }),
    ]);
  }

  if (!valid) {
    return (
      <StatePanel
        title="Page unavailable"
        href={backHref}
        linkLabel="Back to finance"
      >
        The invoice URL is invalid.
      </StatePanel>
    );
  }
  if (!canView) {
    return (
      <StatePanel title="Access denied">
        Your account does not have permission to view invoices.
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
        title="Invoice unavailable"
        onRetry={() => {
          void query.refetch();
        }}
      >
        {errorText(query.error)}
      </StatePanel>
    );
  }

  const invoice = query.data;
  const displayStatus = invoiceDisplayStatus(invoice);
  const isCustomCustomer = invoice.customer_id === null;
  const resolvedCustomerName =
    invoice.customer_name ??
    invoice.custom_customer_name ??
    (invoice.customer_id ? `Customer #${invoice.customer_id}` : "Custom customer");
  const branchName = scope.directory?.branches.find(
    (b) => b.id === invoice.branch_id,
  )?.name;

  const pdfDoc: LivePdfDocument = {
    kind: "invoice",
    id: invoice.id,
    status: displayStatus,
    companyName: scope.company?.name ?? `Company #${invoice.company_id}`,
    branchName,
    currency,
    customerName: isCustomCustomer
      ? `${resolvedCustomerName} (Custom)`
      : resolvedCustomerName,
    createdAt: invoice.issued_at ?? invoice.created_at,
    lines: invoice.lines.map((line) => ({
      label: line.description,
      detail: `${line.quantity} × ${formatMoneyMinor(line.unit_price_minor, currency)}`,
      amountMinor: line.line_total_minor,
    })),
    pricing: {
      subtotalMinor: invoice.subtotal_minor,
      discountPct: invoice.discount_pct,
      discountMinor: invoice.discount_minor,
      vatRatePct: invoice.vat_rate_pct,
      vatMinor: invoice.vat_minor,
      totalMinor: invoice.total_minor,
    },
    notes: invoice.notes,
    serverPdfPath: `api/v1/invoices/${invoice.id}/pdf`,
  };

  async function handleIssue() {
    if (busyAction) return;
    setBusyAction("issue");
    setActionError(null);
    const ac = new AbortController();
    try {
      await issueInvoice(invoice.id, ac.signal);
      setNotice(
        `${invoice.invoice_number} issued and posted to the General Ledger.`,
      );
      await refreshFinance();
    } catch (failure) {
      setActionError(failure);
    } finally {
      setBusyAction("");
    }
  }

  async function handleVoid() {
    if (busyAction) return;
    setBusyAction("void");
    setActionError(null);
    const ac = new AbortController();
    try {
      await voidInvoice(invoice.id, ac.signal);
      setNotice(
        invoice.status === "issued"
          ? `${invoice.invoice_number} voided and reversing GL entry posted.`
          : `${invoice.invoice_number} draft voided.`,
      );
      await refreshFinance();
    } catch (failure) {
      setActionError(failure);
    } finally {
      setBusyAction("");
    }
  }

  const canVoid =
    canManageInvoices &&
    (invoice.status === "draft" ||
      (invoice.status === "issued" && invoice.paid_minor === 0));

  return (
    <ViewFadeIn className="space-y-6">
      <Link
        className="inline-block text-sm text-link hover:underline"
        href={backHref}
      >
        Back to invoices
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-page-title font-extrabold tracking-tight">
              {invoice.invoice_number}
            </h1>
            <StatusDotBadge tone={INVOICE_STATUS_TONES[displayStatus]}>
              {INVOICE_STATUS_LABELS[displayStatus]}
            </StatusDotBadge>
          </div>
          <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            <span>{resolvedCustomerName}</span>
            {isCustomCustomer ? (
              <span className="rounded-md border bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Custom
              </span>
            ) : null}
            {isCustomCustomer && invoice.custom_customer_email ? (
              <>
                <span aria-hidden="true">·</span>
                <span>{invoice.custom_customer_email}</span>
              </>
            ) : null}
            {isCustomCustomer && invoice.custom_customer_phone ? (
              <>
                <span aria-hidden="true">·</span>
                <span>{invoice.custom_customer_phone}</span>
              </>
            ) : null}
            <span aria-hidden="true">·</span>
            <span>Due {fmtDate(invoice.due_at)}</span>
            {invoice.rental_id ? (
              <>
                <span aria-hidden="true">·</span>
                <Link
                  href={`/companies/${scope.companyId}/rentals/${invoice.rental_id}?branch=${encodeURIComponent(scope.branch)}`}
                  className="text-link hover:underline"
                >
                  Rental #{invoice.rental_id}
                </Link>
              </>
            ) : null}
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
          {canManageInvoices && invoice.status === "draft" ? (
            <Button
              type="button"
              disabled={busyAction !== "" || invoice.total_minor <= 0}
              onClick={() => {
                void handleIssue();
              }}
              className="gap-1.5"
            >
              <CheckCircle2 className="size-4" aria-hidden="true" />
              {busyAction === "issue" ? "Issuing…" : "Issue invoice"}
            </Button>
          ) : null}
          {canManagePayments &&
          invoice.status === "issued" &&
          invoice.outstanding_minor > 0 ? (
            <Button
              type="button"
              onClick={() => setPayOpen(true)}
              className="gap-1.5"
            >
              <CreditCard className="size-4" aria-hidden="true" />
              Record payment
            </Button>
          ) : null}
          {canManagePayments &&
          invoice.status === "issued" &&
          invoice.net_paid_minor > 0 ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setRefundOpen(true)}
              className="gap-1.5"
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              Record refund
            </Button>
          ) : null}
          {canVoid ? (
            <Button
              type="button"
              variant="outline"
              disabled={busyAction !== ""}
              onClick={() => {
                void handleVoid();
              }}
              className="gap-1.5"
            >
              <Ban className="size-4" aria-hidden="true" />
              {busyAction === "void" ? "Voiding…" : "Void invoice"}
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

      {actionError ? (
        <p
          role="alert"
          className="rounded-xl border border-danger bg-danger/10 px-4 py-3 text-sm text-danger-foreground"
        >
          {actionError instanceof ApiError && actionError.status === 409
            ? "This invoice cannot be changed in its current state. Issued invoices with recorded payments cannot be voided — record a refund instead."
            : errorText(actionError)}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="dc-shadow-card rounded-2xl border bg-surface p-4">
          <p className="text-label text-muted-foreground">Invoice total</p>
          <p className="mt-1 font-mono text-lg font-extrabold tabular-nums">
            {formatMoneyMinor(invoice.total_minor, currency)}
          </p>
        </div>
        <div className="dc-shadow-card rounded-2xl border bg-surface p-4">
          <p className="text-label text-muted-foreground">Total paid</p>
          <p className="mt-1 font-mono text-lg font-extrabold text-success-foreground tabular-nums">
            {formatMoneyMinor(invoice.paid_minor, currency)}
          </p>
        </div>
        <div className="dc-shadow-card rounded-2xl border bg-surface p-4">
          <p className="text-label text-muted-foreground">Refunded</p>
          <p className="mt-1 font-mono text-lg font-extrabold tabular-nums">
            {formatMoneyMinor(invoice.refunded_minor, currency)}
          </p>
        </div>
        <div className="dc-shadow-card rounded-2xl border bg-surface p-4">
          <p className="text-label text-muted-foreground">Balance due</p>
          <p className="mt-1 font-mono text-lg font-extrabold tabular-nums">
            {formatMoneyMinor(invoice.outstanding_minor, currency)}
          </p>
        </div>
      </div>

      {invoice.status === "draft" && canManageInvoices ? (
        <DraftInvoiceEditor
          key={`${invoice.id}:${invoice.updated_at}`}
          invoice={invoice}
          currency={currency}
          busy={busyAction !== ""}
          onSavingChange={(saving) => setBusyAction(saving ? "save" : "")}
          onSaved={async () => {
            setNotice(`${invoice.invoice_number} draft updated.`);
            setActionError(null);
            await refreshFinance();
          }}
          onError={setActionError}
        />
      ) : (
        <section className="dc-shadow-card space-y-4 rounded-2xl border bg-surface p-card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-section-heading">Itemized charges</h2>
            <span className="text-xs text-muted-foreground">
              {invoice.status === "issued"
                ? `Immutable · Issued ${fmtDateTime(invoice.issued_at)}`
                : invoice.status === "void"
                  ? `Voided ${fmtDateTime(invoice.voided_at)}`
                  : "Draft"}
            </span>
          </div>

          <DataTable>
            <DataTableHead>
              <tr>
                <DataTableHeaderCell>Description</DataTableHeaderCell>
                <DataTableHeaderCell align="right">Qty</DataTableHeaderCell>
                <DataTableHeaderCell align="right">Unit price</DataTableHeaderCell>
                <DataTableHeaderCell align="right">Line total</DataTableHeaderCell>
              </tr>
            </DataTableHead>
            <DataTableBody>
              {invoice.lines.map((line, index) => (
                <DataTableRow key={line.id ?? index}>
                  <DataTableCell className="font-medium">
                    {line.description}
                  </DataTableCell>
                  <DataTableCell align="right" numeric>
                    {line.quantity}
                  </DataTableCell>
                  <DataTableCell align="right" numeric>
                    {formatMoneyMinor(line.unit_price_minor, currency)}
                  </DataTableCell>
                  <DataTableCell align="right" numeric className="font-semibold">
                    {formatMoneyMinor(line.line_total_minor, currency)}
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>

          <dl className="ml-auto max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="font-mono tabular-nums">
                {formatMoneyMinor(invoice.subtotal_minor, currency)}
              </dd>
            </div>
            {invoice.discount_minor > 0 ? (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">
                  Discount ({invoice.discount_pct}%)
                </dt>
                <dd className="font-mono tabular-nums">
                  -{formatMoneyMinor(invoice.discount_minor, currency)}
                </dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt className="text-muted-foreground">
                VAT ({invoice.vat_rate_pct}%)
              </dt>
              <dd className="font-mono tabular-nums">
                {formatMoneyMinor(invoice.vat_minor, currency)}
              </dd>
            </div>
            <div className="flex justify-between border-t pt-2 font-bold">
              <dt>Total</dt>
              <dd className="font-mono tabular-nums">
                {formatMoneyMinor(invoice.total_minor, currency)}
              </dd>
            </div>
          </dl>

          {invoice.notes ? (
            <p className="rounded-xl border bg-muted/20 px-3.5 py-2.5 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Notes: </span>
              {invoice.notes}
            </p>
          ) : null}
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="dc-shadow-card space-y-3 rounded-2xl border bg-surface p-card">
          <h2 className="text-section-heading">Payments</h2>
          {invoice.payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No payments recorded on this invoice yet.
            </p>
          ) : (
            <DataTable>
              <DataTableHead>
                <tr>
                  <DataTableHeaderCell>Date</DataTableHeaderCell>
                  <DataTableHeaderCell>Method</DataTableHeaderCell>
                  <DataTableHeaderCell>Reference</DataTableHeaderCell>
                  <DataTableHeaderCell align="right">Amount</DataTableHeaderCell>
                </tr>
              </DataTableHead>
              <DataTableBody>
                {invoice.payments.map((p) => (
                  <DataTableRow key={p.id}>
                    <DataTableCell numeric>{fmtDate(p.paid_at)}</DataTableCell>
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
          )}
        </section>

        <section className="dc-shadow-card space-y-3 rounded-2xl border bg-surface p-card">
          <h2 className="text-section-heading">Refunds &amp; credits</h2>
          {invoice.refunds.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No refunds recorded on this invoice.
            </p>
          ) : (
            <DataTable>
              <DataTableHead>
                <tr>
                  <DataTableHeaderCell>Date</DataTableHeaderCell>
                  <DataTableHeaderCell>Reason</DataTableHeaderCell>
                  <DataTableHeaderCell align="right">Amount</DataTableHeaderCell>
                </tr>
              </DataTableHead>
              <DataTableBody>
                {invoice.refunds.map((r) => (
                  <DataTableRow key={r.id}>
                    <DataTableCell numeric>
                      {fmtDate(r.refunded_at)}
                    </DataTableCell>
                    <DataTableCell>{r.reason}</DataTableCell>
                    <DataTableCell align="right" numeric className="font-semibold">
                      {formatMoneyMinor(r.amount_minor, currency)}
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          )}
        </section>
      </div>

      {canViewDocs ? (
        <EntityDocumentsPanel
          entityType="invoice"
          entityId={invoice.id}
          branchId={invoice.branch_id}
          canUpload={canUploadDocs}
        />
      ) : null}

      <RecordPaymentDialog
        invoice={payOpen ? invoice : null}
        currency={currency}
        onClose={() => setPayOpen(false)}
        onRecorded={(payment) => {
          setNotice(
            `Recorded ${PAYMENT_METHOD_LABELS[payment.method].toLowerCase()} payment of ${formatMoneyMinor(payment.amount_minor, currency)}.`,
          );
          setActionError(null);
          void refreshFinance();
        }}
      />

      <RecordRefundDialog
        invoice={refundOpen ? invoice : null}
        currency={currency}
        onClose={() => setRefundOpen(false)}
        onRecorded={(refund) => {
          setNotice(
            `Recorded refund of ${formatMoneyMinor(refund.amount_minor, currency)}.`,
          );
          setActionError(null);
          void refreshFinance();
        }}
      />

      <LiveDocumentPdfModal
        doc={pdfOpen ? pdfDoc : null}
        onClose={() => setPdfOpen(false)}
      />
    </ViewFadeIn>
  );
}

function DraftInvoiceEditor({
  invoice,
  currency,
  busy,
  onSavingChange,
  onSaved,
  onError,
}: {
  invoice: Invoice;
  currency: string;
  busy: boolean;
  onSavingChange: (saving: boolean) => void;
  onSaved: () => Promise<void>;
  onError: (err: unknown) => void;
}) {
  const isCustomCustomer = invoice.customer_id === null;
  const [customName, setCustomName] = useState(
    invoice.custom_customer_name ?? invoice.customer_name ?? "",
  );
  const [customEmail, setCustomEmail] = useState(
    invoice.custom_customer_email ?? "",
  );
  const [customPhone, setCustomPhone] = useState(
    invoice.custom_customer_phone ?? "",
  );
  const [dueDate, setDueDate] = useState(invoice.due_at.slice(0, 10));
  const [discountPct, setDiscountPct] = useState(String(invoice.discount_pct));
  const [notes, setNotes] = useState(invoice.notes ?? "");
  const [lines, setLines] = useState<EditableLine[]>(() =>
    invoice.lines.length > 0
      ? invoice.lines.map((l, idx) => ({
          key: `l-${l.id ?? idx}`,
          description: l.description,
          quantity: String(l.quantity),
          unitPrice: (l.unit_price_minor / 100).toFixed(2),
        }))
      : [{ key: "l-0", description: "", quantity: "1", unitPrice: "0.00" }],
  );

  const preview = useMemo(() => {
    const disc = Number(discountPct || "0");
    return calculateInvoicePreview({
      lines: lines.map((l) => ({
        description: l.description,
        quantity: /^\d+$/.test(l.quantity) ? Number(l.quantity) : 0,
        unit_price_minor: parseMajorToMinor(l.unitPrice) ?? 0,
      })),
      discountPct: Number.isFinite(disc) ? disc : 0,
      vatRatePct: invoice.vat_rate_pct,
    });
  }, [lines, discountPct, invoice.vat_rate_pct]);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    const disc = Number(discountPct || "0");
    if (Number.isNaN(disc) || disc < 0 || disc > 100) {
      onError(new Error("Discount percentage must be between 0 and 100."));
      return;
    }
    if (isCustomCustomer) {
      if (!customName.trim()) {
        onError(new Error("Enter a custom customer name."));
        return;
      }
      if (
        customEmail.trim() &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customEmail.trim())
      ) {
        onError(new Error("Enter a valid custom customer email address."));
        return;
      }
    }
    const payloadLines: InvoiceLinePayload[] = [];
    for (const row of lines) {
      if (!row.description.trim()) {
        onError(new Error("Every line item requires a description."));
        return;
      }
      if (!/^[1-9]\d*$/.test(row.quantity.trim())) {
        onError(new Error("Quantity must be a whole number of at least 1."));
        return;
      }
      const unitMinor = parseMajorToMinor(row.unitPrice);
      if (unitMinor === null || unitMinor < 0) {
        onError(new Error("Enter a valid unit price."));
        return;
      }
      payloadLines.push({
        description: row.description.trim(),
        quantity: Number(row.quantity.trim()),
        unit_price_minor: unitMinor,
      });
    }

    onSavingChange(true);
    onError(null);
    const ac = new AbortController();
    try {
      await updateInvoice(
        invoice.id,
        {
          due_at: new Date(`${dueDate}T23:59:59Z`).toISOString(),
          discount_pct: disc,
          notes: notes.trim(),
          ...(isCustomCustomer
            ? {
                custom_customer_name: customName.trim(),
                custom_customer_email: customEmail.trim() || null,
                custom_customer_phone: customPhone.trim() || null,
              }
            : {}),
          lines: payloadLines,
        },
        ac.signal,
      );
      await onSaved();
    } catch (failure) {
      onError(failure);
    } finally {
      onSavingChange(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        void handleSave(e);
      }}
      className="dc-shadow-card space-y-4 rounded-2xl border bg-surface p-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-section-heading">Draft invoice editor</h2>
          <p className="text-xs text-muted-foreground">
            Adjust line items, due date, or discount before issuing. Once issued,
            amounts lock permanently.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() =>
            setLines((prev) => [
              ...prev,
              {
                key: `l-${Date.now()}-${prev.length}`,
                description: "",
                quantity: "1",
                unitPrice: "0.00",
              },
            ])
          }
        >
          <Plus className="mr-1 size-3.5" aria-hidden="true" />
          Add line
        </Button>
      </div>

      <fieldset disabled={busy} className="space-y-4">
        {isCustomCustomer ? (
          <div className="grid gap-4 rounded-xl border border-border/80 bg-muted/20 p-3.5 sm:grid-cols-3">
            <div className="space-y-1">
              <label htmlFor="draft-custom-name" className="text-xs font-medium">
                Custom customer name
              </label>
              <Input
                id="draft-custom-name"
                maxLength={255}
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="draft-custom-email" className="text-xs font-medium">
                Custom email (optional)
              </label>
              <Input
                id="draft-custom-email"
                type="email"
                maxLength={255}
                value={customEmail}
                onChange={(e) => setCustomEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="draft-custom-phone" className="text-xs font-medium">
                Custom phone (optional)
              </label>
              <Input
                id="draft-custom-phone"
                maxLength={50}
                value={customPhone}
                onChange={(e) => setCustomPhone(e.target.value)}
              />
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="draft-due" className="text-xs font-medium">
              Due date
            </label>
            <DriveCoreDateField
              id="draft-due"
              label="Due date"
              value={dueDate}
              onChange={setDueDate}
              disabled={busy}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="draft-discount" className="text-xs font-medium">
              Discount (%)
            </label>
            <Input
              id="draft-discount"
              inputMode="decimal"
              value={discountPct}
              onChange={(e) => setDiscountPct(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2.5">
          {lines.map((row, idx) => (
            <div
              key={row.key}
              className="grid gap-2 sm:grid-cols-[1fr_5rem_8rem_auto] sm:items-end"
            >
              <div className="space-y-1">
                <label
                  htmlFor={`edit-desc-${idx}`}
                  className="text-xs font-medium"
                >
                  Line description
                </label>
                <Input
                  id={`edit-desc-${idx}`}
                  value={row.description}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((item) =>
                        item.key === row.key
                          ? { ...item, description: e.target.value }
                          : item,
                      ),
                    )
                  }
                />
              </div>
              <div className="space-y-1">
                <label
                  htmlFor={`edit-qty-${idx}`}
                  className="text-xs font-medium"
                >
                  Qty
                </label>
                <Input
                  id={`edit-qty-${idx}`}
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
                  htmlFor={`edit-price-${idx}`}
                  className="text-xs font-medium"
                >
                  Unit ({currency})
                </label>
                <Input
                  id={`edit-price-${idx}`}
                  inputMode="decimal"
                  value={row.unitPrice}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((item) =>
                        item.key === row.key
                          ? { ...item, unitPrice: e.target.value }
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

        <div className="space-y-1">
          <label htmlFor="draft-notes" className="text-xs font-medium">
            Notes
          </label>
          <Textarea
            id="draft-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </fieldset>

      <div className="flex flex-wrap items-end justify-between gap-4 border-t pt-4">
        <dl className="space-y-1 text-xs">
          <div className="flex gap-4">
            <dt className="text-muted-foreground">Subtotal:</dt>
            <dd className="font-mono font-medium tabular-nums">
              {formatMoneyMinor(preview.subtotalMinor, currency)}
            </dd>
          </div>
          <div className="flex gap-4">
            <dt className="text-muted-foreground">
              VAT ({invoice.vat_rate_pct}%):
            </dt>
            <dd className="font-mono font-medium tabular-nums">
              {formatMoneyMinor(preview.vatMinor, currency)}
            </dd>
          </div>
          <div className="flex gap-4 text-sm font-bold">
            <dt>Draft total:</dt>
            <dd className="font-mono tabular-nums">
              {formatMoneyMinor(preview.totalMinor, currency)}
            </dd>
          </div>
        </dl>

        <Button type="submit" disabled={busy} className="gap-1.5">
          <Save className="size-4" aria-hidden="true" />
          Save draft
        </Button>
      </div>
    </form>
  );
}
