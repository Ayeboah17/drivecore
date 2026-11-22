"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Receipt, Trash2, Wallet } from "lucide-react";
import { useSession } from "@/features/auth/session-provider";
import { useLiveContext } from "@/features/live/context";
import { listRecords } from "@/features/records/service";
import { getCompanySettings } from "@/features/quotations/service";
import {
  createExpense,
  createInvoice,
  recordPayment,
  recordRefund,
  type InvoiceLinePayload,
} from "@/features/finance/service";
import { calculateInvoicePreview } from "@/features/finance/pricing";
import { ApiError, errorText } from "@/lib/api/client";
import {
  expenseCategories,
  formatMoneyMinor,
  parseMajorToMinor,
  paymentMethods,
  type Customer,
  type ExpenseCategory,
  type ExpenseRecord,
  type Invoice,
  type PaymentMethod,
  type PaymentRecord,
  type RefundRecord,
  type Vehicle,
} from "@/lib/api/contracts";
import {
  humanizeFieldLabel,
  humanizeFieldMessage,
} from "@/lib/api/error-format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DriveCoreDateField } from "@/components/ui/drivecore-calendar";
import { DriveCoreSelect } from "@/components/ui/drivecore-select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  card: "Card",
  bank_transfer: "Bank transfer",
  mobile_money: "Mobile money",
};

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  maintenance: "Maintenance",
  fuel: "Fuel",
  insurance: "Insurance",
  tolls_parking: "Tolls & parking",
  general: "General",
};

function FinanceErrorBanner({
  error,
  conflictMessage,
}: {
  error: unknown;
  conflictMessage?: string;
}) {
  if (!error) return null;
  if (error instanceof ApiError && error.status === 409 && conflictMessage) {
    return (
      <p
        role="alert"
        className="rounded-xl border border-danger bg-danger/10 px-3.5 py-2.5 text-sm text-danger-foreground"
      >
        {conflictMessage}
      </p>
    );
  }
  const fields =
    error instanceof ApiError && error.fields
      ? Object.entries(error.fields)
      : [];
  return (
    <div
      role="alert"
      className="space-y-1 rounded-xl border border-danger bg-danger/10 px-3.5 py-2.5 text-sm text-danger-foreground"
    >
      <p className="font-medium">{errorText(error)}</p>
      {fields.length > 0 ? (
        <ul className="list-disc space-y-0.5 pl-4 text-xs">
          {fields.map(([key, messages]) => (
            <li key={key}>
              <span className="font-semibold">{humanizeFieldLabel(key)}:</span>{" "}
              {messages.map(humanizeFieldMessage).join(" ")}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

interface LineRowState {
  key: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

function defaultDueDateInput(): string {
  const d = new Date(Date.now() + 14 * 86_400_000);
  return d.toISOString().slice(0, 10);
}

export function CreateInvoiceDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (invoice: Invoice) => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && busy) return;
        onOpenChange(next);
      }}
    >
      <DialogContent
        showCloseButton={!busy}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl p-card sm:max-w-2xl"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="size-4 text-link" aria-hidden="true" />
            Create manual invoice
          </DialogTitle>
          <DialogDescription>
            Creates a draft invoice with itemized lines and company VAT. Review
            and issue it to lock amounts and post to the General Ledger.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <CreateInvoiceForm
            onBusyChange={setBusy}
            onCancel={() => onOpenChange(false)}
            onCreated={(invoice) => {
              onOpenChange(false);
              onCreated(invoice);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function CreateInvoiceForm({
  onBusyChange,
  onCancel,
  onCreated,
}: {
  onBusyChange: (busy: boolean) => void;
  onCancel: () => void;
  onCreated: (invoice: Invoice) => void;
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

  const initialBranch =
    scope.branch !== "all"
      ? scope.branch
      : companyBranches[0]
        ? String(companyBranches[0].id)
        : "";

  const [branchId, setBranchId] = useState(initialBranch);
  const [customerMode, setCustomerMode] = useState<"existing" | "custom">(
    "existing",
  );
  const [customerId, setCustomerId] = useState("");
  const [customName, setCustomName] = useState("");
  const [customEmail, setCustomEmail] = useState("");
  const [customPhone, setCustomPhone] = useState("");
  const [dueDate, setDueDate] = useState(defaultDueDateInput);
  const [discountPct, setDiscountPct] = useState("0");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineRowState[]>([
    { key: "line-1", description: "", quantity: "1", unitPrice: "" },
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const lock = useRef(false);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      controller.current?.abort();
    };
  }, []);

  const settingsQuery = useQuery({
    queryKey: ["live", scope.companyId, "company-settings"],
    queryFn: ({ signal }) => getCompanySettings(scope.companyId, signal),
    staleTime: 60_000,
  });

  const customersQuery = useQuery({
    queryKey: [...scope.key, "invoice-customers", branchId],
    queryFn: ({ signal }) =>
      listRecords(
        "customers",
        {
          companyId: scope.companyId,
          branch: branchId || "all",
          q: "",
          filter: "",
          page: 1,
        },
        signal,
      ),
    enabled: !!branchId,
  });
  const customerItems = (customersQuery.data?.items ?? []) as Customer[];

  const vatRatePct = settingsQuery.data?.vat_rate_pct ?? 15;
  const parsedDiscount = Number(discountPct || "0");

  const preview = useMemo(() => {
    const draftLines = lines.map((l) => ({
      description: l.description,
      quantity: /^\d+$/.test(l.quantity) ? Number(l.quantity) : 0,
      unit_price_minor: parseMajorToMinor(l.unitPrice) ?? 0,
    }));
    return calculateInvoicePreview({
      lines: draftLines,
      discountPct: Number.isFinite(parsedDiscount) ? parsedDiscount : 0,
      vatRatePct,
    });
  }, [lines, parsedDiscount, vatRatePct]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    if (!branchId) {
      setError(new Error("Select a branch."));
      return;
    }
    if (customerMode === "existing" && !customerId) {
      setError(new Error("Select a customer."));
      return;
    }
    if (customerMode === "custom") {
      if (!customName.trim()) {
        setError(new Error("Enter a custom customer name."));
        return;
      }
      if (
        customEmail.trim() &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customEmail.trim())
      ) {
        setError(new Error("Enter a valid custom customer email address."));
        return;
      }
    }
    if (!dueDate) {
      setError(new Error("Select a due date."));
      return;
    }
    const disc = Number(discountPct || "0");
    if (Number.isNaN(disc) || disc < 0 || disc > 100) {
      setError(new Error("Discount percentage must be between 0 and 100."));
      return;
    }

    const payloadLines: InvoiceLinePayload[] = [];
    for (const row of lines) {
      const desc = row.description.trim();
      if (!desc) {
        setError(new Error("Every line item requires a description."));
        return;
      }
      if (!/^[1-9]\d*$/.test(row.quantity.trim())) {
        setError(new Error("Line quantity must be a whole number of at least 1."));
        return;
      }
      const unitMinor = parseMajorToMinor(row.unitPrice);
      if (unitMinor === null || unitMinor < 0) {
        setError(new Error("Enter a valid unit price (e.g. 250.00)."));
        return;
      }
      payloadLines.push({
        description: desc,
        quantity: Number(row.quantity.trim()),
        unit_price_minor: unitMinor,
      });
    }

    lock.current = true;
    setBusy(true);
    onBusyChange(true);
    setError(null);
    controller.current = new AbortController();
    try {
      const created = await createInvoice(
        {
          company_id: Number(scope.companyId),
          branch_id: Number(branchId),
          ...(customerMode === "existing"
            ? { customer_id: Number(customerId) }
            : {
                custom_customer_name: customName.trim(),
                ...(customEmail.trim()
                  ? { custom_customer_email: customEmail.trim() }
                  : {}),
                ...(customPhone.trim()
                  ? { custom_customer_phone: customPhone.trim() }
                  : {}),
              }),
          due_at: new Date(`${dueDate}T23:59:59Z`).toISOString(),
          discount_pct: disc,
          ...(notes.trim() ? { notes: notes.trim() } : {}),
          lines: payloadLines,
        },
        controller.current.signal,
      );
      onCreated(created);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) {
        session.expire();
      }
      setError(failure);
    } finally {
      lock.current = false;
      setBusy(false);
      onBusyChange(false);
    }
  }

  return (
    <form
      noValidate
      aria-busy={busy}
      className="space-y-4"
      onSubmit={(e) => {
        void handleSubmit(e);
      }}
    >
      <fieldset disabled={busy} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor={`${formId}-branch`} className="text-sm font-medium">
              Branch
            </label>
            <DriveCoreSelect
              id={`${formId}-branch`}
              value={branchId}
              onValueChange={(next) => {
                setBranchId(next);
                setCustomerId("");
              }}
              placeholder="Select branch"
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
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor={
                  customerMode === "existing"
                    ? `${formId}-customer`
                    : `${formId}-custom-name`
                }
                className="text-sm font-medium"
              >
                {customerMode === "existing"
                  ? "Customer"
                  : "Custom customer name"}
              </label>
              <div
                role="group"
                aria-label="Customer billing mode"
                className="inline-flex rounded-lg border bg-muted/40 p-0.5 text-[11px]"
              >
                <button
                  type="button"
                  aria-pressed={customerMode === "existing"}
                  onClick={() => setCustomerMode("existing")}
                  className={`rounded-md px-2 py-0.5 font-semibold transition-colors ${
                    customerMode === "existing"
                      ? "bg-surface text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Existing
                </button>
                <button
                  type="button"
                  aria-pressed={customerMode === "custom"}
                  onClick={() => setCustomerMode("custom")}
                  className={`rounded-md px-2 py-0.5 font-semibold transition-colors ${
                    customerMode === "custom"
                      ? "bg-surface text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Custom
                </button>
              </div>
            </div>
            {customerMode === "existing" ? (
              <DriveCoreSelect
                id={`${formId}-customer`}
                value={customerId}
                onValueChange={setCustomerId}
                placeholder={
                  customersQuery.isPending
                    ? "Loading customers…"
                    : "Select customer"
                }
                options={[
                  { value: "", label: "Select customer" },
                  ...customerItems.map((c) => ({
                    value: String(c.id),
                    label: c.name,
                  })),
                ]}
              />
            ) : (
              <Input
                id={`${formId}-custom-name`}
                maxLength={255}
                placeholder="e.g. Walk-in client or insurer name"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
              />
            )}
          </div>
        </div>

        {customerMode === "custom" ? (
          <div className="grid gap-4 rounded-xl border border-border/80 bg-muted/20 p-3.5 sm:grid-cols-2">
            <div className="space-y-1">
              <label
                htmlFor={`${formId}-custom-email`}
                className="text-xs font-medium"
              >
                Custom customer email (optional)
              </label>
              <Input
                id={`${formId}-custom-email`}
                type="email"
                maxLength={255}
                placeholder="billing@client.com"
                value={customEmail}
                onChange={(e) => setCustomEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor={`${formId}-custom-phone`}
                className="text-xs font-medium"
              >
                Custom customer phone (optional)
              </label>
              <Input
                id={`${formId}-custom-phone`}
                maxLength={50}
                placeholder="+260 97 000 0000"
                value={customPhone}
                onChange={(e) => setCustomPhone(e.target.value)}
              />
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor={`${formId}-due`} className="text-sm font-medium">
              Due date
            </label>
            <DriveCoreDateField
              id={`${formId}-due`}
              label="Due date"
              value={dueDate}
              onChange={setDueDate}
              disabled={busy}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor={`${formId}-discount`} className="text-sm font-medium">
              Discount (%)
            </label>
            <Input
              id={`${formId}-discount`}
              inputMode="decimal"
              value={discountPct}
              onChange={(e) => setDiscountPct(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2.5 rounded-xl border border-border/80 bg-muted/20 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Line items
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                setLines((prev) => [
                  ...prev,
                  {
                    key: `line-${Date.now()}-${prev.length}`,
                    description: "",
                    quantity: "1",
                    unitPrice: "",
                  },
                ])
              }
            >
              <Plus className="mr-1 size-3.5" aria-hidden="true" />
              Add line
            </Button>
          </div>
          <div className="space-y-2.5">
            {lines.map((row, index) => (
              <div
                key={row.key}
                className="grid gap-2 sm:grid-cols-[1fr_5rem_8rem_auto] sm:items-end"
              >
                <div className="space-y-1">
                  <label
                    htmlFor={`${formId}-desc-${index}`}
                    className="text-xs font-medium"
                  >
                    Description
                  </label>
                  <Input
                    id={`${formId}-desc-${index}`}
                    placeholder="e.g. Chauffeur service, fuel refill"
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
                    htmlFor={`${formId}-qty-${index}`}
                    className="text-xs font-medium"
                  >
                    Qty
                  </label>
                  <Input
                    id={`${formId}-qty-${index}`}
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
                    htmlFor={`${formId}-price-${index}`}
                    className="text-xs font-medium"
                  >
                    Unit ({currency})
                  </label>
                  <Input
                    id={`${formId}-price-${index}`}
                    inputMode="decimal"
                    placeholder="0.00"
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
                  aria-label={`Remove line ${index + 1}`}
                  onClick={() =>
                    setLines((prev) => prev.filter((item) => item.key !== row.key))
                  }
                >
                  <Trash2 className="size-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>

          <dl className="space-y-1 border-t border-border/70 pt-3 text-xs">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="font-mono font-medium tabular-nums">
                {formatMoneyMinor(preview.subtotalMinor, currency)}
              </dd>
            </div>
            {preview.discountMinor > 0 ? (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">
                  Discount ({parsedDiscount}%)
                </dt>
                <dd className="font-mono font-medium tabular-nums">
                  -{formatMoneyMinor(preview.discountMinor, currency)}
                </dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt className="text-muted-foreground">VAT ({vatRatePct}%)</dt>
              <dd className="font-mono font-medium tabular-nums">
                {formatMoneyMinor(preview.vatMinor, currency)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-border/70 pt-1.5 text-sm font-bold">
              <dt>Estimated total</dt>
              <dd className="font-mono tabular-nums">
                {formatMoneyMinor(preview.totalMinor, currency)}
              </dd>
            </div>
          </dl>
        </div>

        <div className="space-y-1.5">
          <label htmlFor={`${formId}-notes`} className="text-sm font-medium">
            Notes (optional)
          </label>
          <Textarea
            id={`${formId}-notes`}
            rows={2}
            maxLength={2000}
            placeholder="Payment instructions or invoice memo…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </fieldset>

      <FinanceErrorBanner error={error} />

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Creating…" : "Create draft invoice"}
        </Button>
      </div>
    </form>
  );
}

export function RecordPaymentDialog({
  invoice,
  currency,
  onClose,
  onRecorded,
}: {
  invoice: Invoice | null;
  currency: string;
  onClose: () => void;
  onRecorded: (payment: PaymentRecord) => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={!!invoice}
      onOpenChange={(next) => {
        if (!next && !busy) onClose();
      }}
    >
      <DialogContent
        showCloseButton={!busy}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl p-card sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            {invoice
              ? `Outstanding balance on ${invoice.invoice_number}: ${formatMoneyMinor(invoice.outstanding_minor, currency)}.`
              : ""}
          </DialogDescription>
        </DialogHeader>
        {invoice ? (
          <RecordPaymentForm
            key={invoice.id}
            invoice={invoice}
            currency={currency}
            onBusyChange={setBusy}
            onCancel={onClose}
            onRecorded={(payment) => {
              onClose();
              onRecorded(payment);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function RecordPaymentForm({
  invoice,
  currency,
  onBusyChange,
  onCancel,
  onRecorded,
}: {
  invoice: Invoice;
  currency: string;
  onBusyChange: (busy: boolean) => void;
  onCancel: () => void;
  onRecorded: (payment: PaymentRecord) => void;
}) {
  const session = useSession();
  const formId = useId();
  const [amountText, setAmountText] = useState(
    (invoice.outstanding_minor / 100).toFixed(2),
  );
  const [method, setMethod] = useState<PaymentMethod>("bank_transfer");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const lock = useRef(false);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    const minor = parseMajorToMinor(amountText);
    if (minor === null || minor <= 0) {
      setError(new Error("Enter a positive payment amount."));
      return;
    }
    if (!reference.trim()) {
      setError(new Error("Enter a payment reference or receipt number."));
      return;
    }
    lock.current = true;
    setBusy(true);
    onBusyChange(true);
    setError(null);
    controller.current = new AbortController();
    try {
      const created = await recordPayment(
        invoice.id,
        {
          amount_minor: minor,
          method,
          reference: reference.trim(),
        },
        controller.current.signal,
      );
      onRecorded(created);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) {
        session.expire();
      }
      setError(failure);
    } finally {
      lock.current = false;
      setBusy(false);
      onBusyChange(false);
    }
  }

  return (
    <form
      noValidate
      aria-busy={busy}
      className="space-y-4"
      onSubmit={(e) => {
        void handleSubmit(e);
      }}
    >
      <fieldset disabled={busy} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor={`${formId}-amount`} className="text-sm font-medium">
            Payment amount ({currency})
          </label>
          <Input
            id={`${formId}-amount`}
            inputMode="decimal"
            value={amountText}
            onChange={(e) => setAmountText(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${formId}-method`} className="text-sm font-medium">
            Payment method
          </label>
          <DriveCoreSelect
            id={`${formId}-method`}
            value={method}
            onValueChange={(v) => setMethod(v as PaymentMethod)}
            options={paymentMethods.map((m) => ({
              value: m,
              label: PAYMENT_METHOD_LABELS[m],
            }))}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${formId}-ref`} className="text-sm font-medium">
            Reference
          </label>
          <Input
            id={`${formId}-ref`}
            maxLength={120}
            placeholder="e.g. EFT-2026-0041 or MoMo TXN ID"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </div>
      </fieldset>
      <FinanceErrorBanner
        error={error}
        conflictMessage="Payments can only be recorded on issued invoices."
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Recording…" : "Save payment"}
        </Button>
      </div>
    </form>
  );
}

export function RecordRefundDialog({
  invoice,
  currency,
  onClose,
  onRecorded,
}: {
  invoice: Invoice | null;
  currency: string;
  onClose: () => void;
  onRecorded: (refund: RefundRecord) => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={!!invoice}
      onOpenChange={(next) => {
        if (!next && !busy) onClose();
      }}
    >
      <DialogContent
        showCloseButton={!busy}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl p-card sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle>Record refund</DialogTitle>
          <DialogDescription>
            {invoice
              ? `Maximum refundable on ${invoice.invoice_number}: ${formatMoneyMinor(invoice.net_paid_minor, currency)}.`
              : ""}
          </DialogDescription>
        </DialogHeader>
        {invoice ? (
          <RecordRefundForm
            key={invoice.id}
            invoice={invoice}
            currency={currency}
            onBusyChange={setBusy}
            onCancel={onClose}
            onRecorded={(refund) => {
              onClose();
              onRecorded(refund);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function RecordRefundForm({
  invoice,
  currency,
  onBusyChange,
  onCancel,
  onRecorded,
}: {
  invoice: Invoice;
  currency: string;
  onBusyChange: (busy: boolean) => void;
  onCancel: () => void;
  onRecorded: (refund: RefundRecord) => void;
}) {
  const session = useSession();
  const formId = useId();
  const [amountText, setAmountText] = useState(
    (Math.max(0, invoice.net_paid_minor) / 100).toFixed(2),
  );
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const lock = useRef(false);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    const minor = parseMajorToMinor(amountText);
    if (minor === null || minor <= 0) {
      setError(new Error("Enter a positive refund amount."));
      return;
    }
    if (!reason.trim()) {
      setError(new Error("Enter a refund reason."));
      return;
    }
    lock.current = true;
    setBusy(true);
    onBusyChange(true);
    setError(null);
    controller.current = new AbortController();
    try {
      const created = await recordRefund(
        invoice.id,
        { amount_minor: minor, reason: reason.trim() },
        controller.current.signal,
      );
      onRecorded(created);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) {
        session.expire();
      }
      setError(failure);
    } finally {
      lock.current = false;
      setBusy(false);
      onBusyChange(false);
    }
  }

  return (
    <form
      noValidate
      aria-busy={busy}
      className="space-y-4"
      onSubmit={(e) => {
        void handleSubmit(e);
      }}
    >
      <fieldset disabled={busy} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor={`${formId}-amount`} className="text-sm font-medium">
            Refund amount ({currency})
          </label>
          <Input
            id={`${formId}-amount`}
            inputMode="decimal"
            value={amountText}
            onChange={(e) => setAmountText(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${formId}-reason`} className="text-sm font-medium">
            Refund reason
          </label>
          <Textarea
            id={`${formId}-reason`}
            rows={3}
            maxLength={500}
            placeholder="e.g. Early return adjustment or billing credit…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
      </fieldset>
      <FinanceErrorBanner
        error={error}
        conflictMessage="Refunds can only be recorded on issued invoices."
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Recording…" : "Save refund"}
        </Button>
      </div>
    </form>
  );
}

export function CreateExpenseDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (expense: ExpenseRecord) => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && busy) return;
        onOpenChange(next);
      }}
    >
      <DialogContent
        showCloseButton={!busy}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl p-card sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="size-4 text-link" aria-hidden="true" />
            Record expense
          </DialogTitle>
          <DialogDescription>
            Expenses are immutable once posted and emit a balanced General Ledger
            entry. Optionally link a vehicle for fleet cost attribution.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <CreateExpenseForm
            onBusyChange={setBusy}
            onCancel={() => onOpenChange(false)}
            onCreated={(expense) => {
              onOpenChange(false);
              onCreated(expense);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function CreateExpenseForm({
  onBusyChange,
  onCancel,
  onCreated,
}: {
  onBusyChange: (busy: boolean) => void;
  onCancel: () => void;
  onCreated: (expense: ExpenseRecord) => void;
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

  const initialBranch =
    scope.branch !== "all"
      ? scope.branch
      : companyBranches[0]
        ? String(companyBranches[0].id)
        : "";

  const [branchId, setBranchId] = useState(initialBranch);
  const [category, setCategory] = useState<ExpenseCategory>("fuel");
  const [vehicleId, setVehicleId] = useState("");
  const [description, setDescription] = useState("");
  const [amountText, setAmountText] = useState("");
  const [incurredDate, setIncurredDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const lock = useRef(false);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  const vehiclesQuery = useQuery({
    queryKey: [...scope.key, "expense-vehicles", branchId],
    queryFn: ({ signal }) =>
      listRecords(
        "vehicles",
        {
          companyId: scope.companyId,
          branch: branchId || "all",
          q: "",
          filter: "",
          page: 1,
        },
        signal,
      ),
    enabled: !!branchId,
  });
  const vehicleItems = (vehiclesQuery.data?.items ?? []) as Vehicle[];

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    if (!branchId) {
      setError(new Error("Select a branch."));
      return;
    }
    if (!description.trim()) {
      setError(new Error("Enter an expense description."));
      return;
    }
    const minor = parseMajorToMinor(amountText);
    if (minor === null || minor <= 0) {
      setError(new Error("Enter a positive expense amount."));
      return;
    }
    lock.current = true;
    setBusy(true);
    onBusyChange(true);
    setError(null);
    controller.current = new AbortController();
    try {
      const created = await createExpense(
        {
          company_id: Number(scope.companyId),
          branch_id: Number(branchId),
          vehicle_id: vehicleId ? Number(vehicleId) : null,
          category,
          description: description.trim(),
          amount_minor: minor,
          incurred_at: new Date(`${incurredDate}T12:00:00Z`).toISOString(),
        },
        controller.current.signal,
      );
      onCreated(created);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) {
        session.expire();
      }
      setError(failure);
    } finally {
      lock.current = false;
      setBusy(false);
      onBusyChange(false);
    }
  }

  return (
    <form
      noValidate
      aria-busy={busy}
      className="space-y-4"
      onSubmit={(e) => {
        void handleSubmit(e);
      }}
    >
      <fieldset disabled={busy} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor={`${formId}-branch`} className="text-sm font-medium">
              Branch
            </label>
            <DriveCoreSelect
              id={`${formId}-branch`}
              value={branchId}
              onValueChange={(next) => {
                setBranchId(next);
                setVehicleId("");
              }}
              placeholder="Select branch"
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
            <label htmlFor={`${formId}-category`} className="text-sm font-medium">
              Category
            </label>
            <DriveCoreSelect
              id={`${formId}-category`}
              value={category}
              onValueChange={(v) => setCategory(v as ExpenseCategory)}
              options={expenseCategories.map((c) => ({
                value: c,
                label: EXPENSE_CATEGORY_LABELS[c],
              }))}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor={`${formId}-vehicle`} className="text-sm font-medium">
            Linked vehicle (optional)
          </label>
          <DriveCoreSelect
            id={`${formId}-vehicle`}
            value={vehicleId}
            onValueChange={setVehicleId}
            placeholder="None (general branch expense)"
            options={[
              { value: "", label: "None (general branch expense)" },
              ...vehicleItems.map((v) => ({
                value: String(v.id),
                label: `${v.registration} · ${v.make} ${v.model}`,
              })),
            ]}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor={`${formId}-desc`} className="text-sm font-medium">
            Description
          </label>
          <Input
            id={`${formId}-desc`}
            maxLength={255}
            placeholder="e.g. Brake pad replacement or diesel top-up"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor={`${formId}-amount`} className="text-sm font-medium">
              Amount ({currency})
            </label>
            <Input
              id={`${formId}-amount`}
              inputMode="decimal"
              placeholder="0.00"
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor={`${formId}-date`} className="text-sm font-medium">
              Date incurred
            </label>
            <DriveCoreDateField
              id={`${formId}-date`}
              label="Date incurred"
              value={incurredDate}
              onChange={setIncurredDate}
              disabled={busy}
            />
          </div>
        </div>
      </fieldset>

      <FinanceErrorBanner error={error} />

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Posting…" : "Post expense"}
        </Button>
      </div>
    </form>
  );
}
