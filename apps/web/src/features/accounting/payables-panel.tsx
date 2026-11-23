"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Plus,
  Receipt,
  ShieldAlert,
} from "lucide-react";
import { useSession } from "@/features/auth/session-provider";
import { useLiveContext } from "@/features/live/context";
import { listPurchaseOrders, listSuppliers } from "@/features/procurement/service";
import { createApprovalRequest } from "@/features/governance/service";
import {
  createSupplierInvoice,
  getApAgeing,
  listBankAccounts,
  listSupplierInvoices,
  recordSupplierPayment,
} from "./service";
import { errorText } from "@/lib/api/client";
import {
  canManageAp,
  formatMoneyMinor,
  parseMajorToMinor,
  type ArAgeingBucketKey,
  type SupplierInvoice,
} from "@/lib/api/contracts";
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

const AP_BUCKET_LABELS: { key: ArAgeingBucketKey; label: string }[] = [
  { key: "current", label: "Current" },
  { key: "d1_30", label: "1–30 days" },
  { key: "d31_60", label: "31–60 days" },
  { key: "d61_90", label: "61–90 days" },
  { key: "d90_plus", label: "90+ days" },
];

const EXPENSE_ACCOUNTS = [
  { value: "5000", label: "5000 · Fleet Operating Expenses" },
  { value: "5200", label: "5200 · Insurance & Compliance" },
  { value: "5300", label: "5300 · Branch Rent & Utilities" },
  { value: "5400", label: "5400 · General & Admin" },
  { value: "1200", label: "1200 · Spare Parts Inventory" },
];

function matchTone(status: SupplierInvoice["match_status"]): StatusDotTone {
  if (status === "matched") return "success";
  if (status === "variance") return "danger";
  return "info";
}

function matchLabel(status: SupplierInvoice["match_status"]): string {
  if (status === "matched") return "3-way matched";
  if (status === "variance") return "Variance blocked";
  return "Non-PO bill";
}

function invoiceStatusTone(status: SupplierInvoice["status"]): StatusDotTone {
  if (status === "paid") return "success";
  if (status === "approved") return "info";
  if (status === "partially_paid" || status === "pending_approval")
    return "warning";
  if (status === "void") return "danger";
  return "neutral";
}

export function CreateSupplierInvoiceDialog({
  open,
  onOpenChange,
  presetPo,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presetPo?: {
    id: number;
    supplier_id: number;
    branch_id: number;
    total_minor: number;
  } | null;
  onCreated: (inv: SupplierInvoice) => void;
}) {
  const scope = useLiveContext();
  const [supplierId, setSupplierId] = useState(
    presetPo ? String(presetPo.supplier_id) : "",
  );
  const [poId, setPoId] = useState(presetPo ? String(presetPo.id) : "");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [dueAt, setDueAt] = useState(() =>
    new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
  );
  const [subtotal, setSubtotal] = useState(
    presetPo ? (presetPo.total_minor / 100).toFixed(2) : "",
  );
  const [vat, setVat] = useState("0.00");
  const [expenseAccount, setExpenseAccount] = useState("5000");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suppliersQuery = useQuery({
    queryKey: [...scope.key, "suppliers", "for-ap"],
    queryFn: ({ signal }) =>
      listSuppliers({ companyId: scope.companyId, page: 1 }, signal),
    enabled: open,
  });

  const posQuery = useQuery({
    queryKey: [...scope.key, "purchase-orders", "received-for-ap"],
    queryFn: ({ signal }) =>
      listPurchaseOrders(
        { companyId: scope.companyId, status: "received", page: 1 },
        signal,
      ),
    enabled: open,
  });

  const effectiveSupplierId = supplierId || (presetPo ? String(presetPo.supplier_id) : "");
  const effectivePoId = poId || (presetPo ? String(presetPo.id) : "");
  const defaultBranchId =
    presetPo?.branch_id ??
    (scope.branch !== "all"
      ? Number(scope.branch)
      : scope.directory?.branches[0]?.id ?? 1);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const subMinor = parseMajorToMinor(subtotal);
    const vatMinor = parseMajorToMinor(vat || "0");
    if (!effectiveSupplierId) {
      setError("Select a supplier.");
      return;
    }
    if (!invoiceNumber.trim()) {
      setError("Vendor invoice number is required.");
      return;
    }
    if (subMinor === null || subMinor <= 0) {
      setError("Enter a valid positive subtotal.");
      return;
    }
    if (vatMinor === null || vatMinor < 0) {
      setError("Enter a valid VAT amount.");
      return;
    }
    setBusy(true);
    try {
      const created = await createSupplierInvoice({
        company_id: Number(scope.companyId),
        branch_id: defaultBranchId,
        supplier_id: Number(effectiveSupplierId),
        purchase_order_id: effectivePoId ? Number(effectivePoId) : null,
        invoice_number: invoiceNumber.trim(),
        invoice_date: invoiceDate,
        due_at: dueAt,
        subtotal_minor: subMinor,
        vat_minor: vatMinor,
        expense_account_code: effectivePoId ? null : expenseAccount,
        notes: notes.trim() || null,
      });
      onCreated(created);
      onOpenChange(false);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Record supplier invoice</DialogTitle>
          <DialogDescription>
            Link to a received Purchase Order for automatic 3-way matching, or
            record a direct non-PO vendor bill.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Supplier</label>
              <DriveCoreSelect
                ariaLabel="Supplier"
                value={effectiveSupplierId}
                onValueChange={(v) => setSupplierId(v)}
                options={[
                  { value: "", label: "Select supplier…" },
                  ...(suppliersQuery.data?.items ?? []).map((s) => ({
                    value: String(s.id),
                    label: s.name,
                  })),
                ]}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">
                Purchase Order (optional)
              </label>
              <DriveCoreSelect
                ariaLabel="Purchase Order"
                value={effectivePoId}
                onValueChange={(v) => {
                  setPoId(v);
                  const found = (posQuery.data?.items ?? []).find(
                    (p) => String(p.id) === v,
                  );
                  if (found) {
                    setSupplierId(String(found.supplier_id));
                    setSubtotal((found.total_minor / 100).toFixed(2));
                  }
                }}
                options={[
                  { value: "", label: "Direct non-PO bill" },
                  ...(posQuery.data?.items ?? []).map((po) => ({
                    value: String(po.id),
                    label: `PO #${po.id} · ${formatMoneyMinor(po.total_minor, scope.company?.currency)}`,
                  })),
                ]}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="ap-inv-no" className="text-xs font-semibold">
                Vendor invoice number
              </label>
              <Input
                id="ap-inv-no"
                placeholder="e.g. SUP-2026-041"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                required
              />
            </div>
            {!effectivePoId ? (
              <div className="space-y-1">
                <label className="text-xs font-semibold">
                  GL expense account
                </label>
                <DriveCoreSelect
                  ariaLabel="GL expense account"
                  value={expenseAccount}
                  onValueChange={setExpenseAccount}
                  options={EXPENSE_ACCOUNTS}
                />
              </div>
            ) : (
              <div className="rounded-xl border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                3-way match compares billed total against received PO #{effectivePoId}.
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <DriveCoreDateField
                value={invoiceDate}
                onChange={setInvoiceDate}
                label="Invoice date"
              />
            </div>
            <div className="space-y-1">
              <DriveCoreDateField
                value={dueAt}
                onChange={setDueAt}
                label="Due date"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="ap-subtotal" className="text-xs font-semibold">
                Subtotal ({scope.company?.currency || "ZMW"})
              </label>
              <Input
                id="ap-subtotal"
                inputMode="decimal"
                placeholder="0.00"
                value={subtotal}
                onChange={(e) => setSubtotal(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="ap-vat" className="text-xs font-semibold">
                VAT ({scope.company?.currency || "ZMW"})
              </label>
              <Input
                id="ap-vat"
                inputMode="decimal"
                placeholder="0.00"
                value={vat}
                onChange={(e) => setVat(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="ap-notes" className="text-xs font-semibold">
              Notes
            </label>
            <Textarea
              id="ap-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional description or matching note"
            />
          </div>

          {error ? (
            <p role="alert" className="text-xs text-danger-foreground">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save supplier invoice"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PayablesPanel() {
  const { user } = useSession();
  const scope = useLiveContext();
  const client = useQueryClient();
  const currency = scope.company?.currency || "ZMW";
  const branchId = scope.branch !== "all" ? scope.branch : undefined;
  const canManage = !!user && canManageAp(user);

  const [q, setQ] = useState("");
  const [matchStatus, setMatchStatus] = useState("");
  const [bucket, setBucket] = useState<ArAgeingBucketKey | "">("");
  const [createOpen, setCreateOpen] = useState(false);
  const [paying, setPaying] = useState<SupplierInvoice | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<
    "bank_transfer" | "cash" | "card" | "mobile_money"
  >("bank_transfer");
  const [payBankId, setPayBankId] = useState("");
  const [payRef, setPayRef] = useState("");
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const ageingQuery = useQuery({
    queryKey: [...scope.key, "ap", "ageing", branchId ?? "all"],
    queryFn: ({ signal }) =>
      getApAgeing({ companyId: scope.companyId, branchId }, signal),
  });

  const invoicesQuery = useQuery({
    queryKey: [
      ...scope.key,
      "ap",
      "invoices",
      branchId ?? "all",
      matchStatus,
      bucket,
      q,
    ],
    queryFn: ({ signal }) =>
      listSupplierInvoices(
        {
          companyId: scope.companyId,
          branchId,
          matchStatus: matchStatus || undefined,
          ageingBucket: bucket || undefined,
          q,
        },
        signal,
      ),
  });

  const banksQuery = useQuery({
    queryKey: [...scope.key, "bank-accounts"],
    queryFn: ({ signal }) =>
      listBankAccounts({ companyId: scope.companyId, branchId }, signal),
    enabled: !!paying,
  });

  async function refreshAp() {
    await Promise.all([
      client.invalidateQueries({ queryKey: [...scope.key, "ap"] }),
      client.invalidateQueries({ queryKey: [...scope.key, "gl"] }),
      client.invalidateQueries({ queryKey: [...scope.key, "bank-accounts"] }),
      client.invalidateQueries({ queryKey: [...scope.key, "approvals"] }),
    ]);
  }

  async function handleRequestVarianceApproval(inv: SupplierInvoice) {
    setErrMsg(null);
    setBusy(true);
    try {
      await createApprovalRequest({
        company_id: Number(scope.companyId),
        branch_id: inv.branch_id,
        type: "purchase",
        entity_type: "supplier_invoice",
        entity_id: inv.id,
        title: `AP variance override · ${inv.invoice_number}`,
        previous_value: formatMoneyMinor(
          inv.total_minor - inv.variance_minor,
          currency,
        ),
        requested_value: formatMoneyMinor(inv.total_minor, currency),
        reason: `3-way match variance of ${formatMoneyMinor(inv.variance_minor, currency)} on PO #${inv.purchase_order_id ?? "—"}`,
      });
      setNotice(
        `Variance approval requested for ${inv.invoice_number}. Approve in Operations → Approvals to unlock payment.`,
      );
      await refreshAp();
    } catch (err) {
      setErrMsg(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function handlePaySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!paying) return;
    setErrMsg(null);
    const minor = parseMajorToMinor(payAmount);
    if (minor === null || minor <= 0) {
      setErrMsg("Enter a valid payment amount.");
      return;
    }
    setBusy(true);
    try {
      await recordSupplierPayment(paying.id, {
        amount_minor: minor,
        method: payMethod,
        bank_account_id: payBankId ? Number(payBankId) : null,
        reference: payRef.trim() || null,
        paid_at: payDate,
      });
      setNotice(`Supplier payment posted for ${paying.invoice_number}.`);
      setPaying(null);
      await refreshAp();
    } catch (err) {
      setErrMsg(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  const items = invoicesQuery.data?.items ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold tracking-tight">
            Accounts Payable &amp; 3-Way Match
          </h2>
          <p className="text-xs text-muted-foreground">
            Match supplier bills against received Purchase Orders, track AP
            ageing, and post supplier payments.
          </p>
        </div>
        {canManage ? (
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" aria-hidden="true" />
            New supplier invoice
          </Button>
        ) : null}
      </div>

      {notice ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-2xl border border-success bg-success/10 px-4 py-3 text-sm text-success-foreground"
        >
          <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
          <span>{notice}</span>
        </div>
      ) : null}

      {errMsg ? (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-2xl border border-danger bg-danger/10 px-4 py-3 text-sm text-danger-foreground"
        >
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
          <span>{errMsg}</span>
        </div>
      ) : null}

      {ageingQuery.data ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {AP_BUCKET_LABELS.map((b) => {
            const active = bucket === b.key;
            return (
              <button
                key={b.key}
                type="button"
                onClick={() => setBucket(active ? "" : b.key)}
                className={`rounded-2xl border p-3.5 text-left transition-colors ${
                  active
                    ? "border-primary bg-primary/5"
                    : "bg-surface hover:bg-muted/40"
                }`}
              >
                <p className="text-xs font-medium text-muted-foreground">
                  {b.label}
                </p>
                <p className="mt-1 font-mono text-base font-bold tabular-nums">
                  {formatMoneyMinor(ageingQuery.data.buckets[b.key], currency)}
                </p>
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <DataSearchForm
          label="Search supplier invoices"
          defaultValue={q}
          formKey={q}
          onSubmitQuery={(next) => setQ(next)}
          placeholder="Search invoice # or supplier…"
        />
        <div className="w-48">
          <DriveCoreSelect
            ariaLabel="Filter by match status"
            value={matchStatus}
            onValueChange={setMatchStatus}
            options={[
              { value: "", label: "All match states" },
              { value: "matched", label: "3-way matched" },
              { value: "variance", label: "Variance blocked" },
              { value: "non_po", label: "Non-PO bills" },
            ]}
          />
        </div>
      </div>

      {invoicesQuery.isLoading ? (
        <DataTableSkeleton columns={7} rows={4} />
      ) : invoicesQuery.isError ? (
        <StatePanel title="Could not load supplier invoices">
          {errorText(invoicesQuery.error)}
        </StatePanel>
      ) : items.length === 0 ? (
        <StatePanel title="No supplier invoices">
          Record a PO-linked supplier invoice or direct vendor bill to start
          tracking Accounts Payable.
        </StatePanel>
      ) : (
        <DataTableFrame ariaLabel="Supplier invoices">
          <DataTable>
            <DataTableHead>
              <tr>
                <DataTableHeaderCell>Invoice #</DataTableHeaderCell>
                <DataTableHeaderCell>Supplier</DataTableHeaderCell>
                <DataTableHeaderCell>PO / Account</DataTableHeaderCell>
                <DataTableHeaderCell>Match</DataTableHeaderCell>
                <DataTableHeaderCell>Due date</DataTableHeaderCell>
                <DataTableHeaderCell align="right">Total</DataTableHeaderCell>
                <DataTableHeaderCell align="right">
                  Outstanding
                </DataTableHeaderCell>
                <DataTableHeaderCell>Status</DataTableHeaderCell>
                <DataTableHeaderCell align="right">Actions</DataTableHeaderCell>
              </tr>
            </DataTableHead>
            <DataTableBody>
              {items.map((inv) => {
                const blockedVariance =
                  inv.match_status === "variance" &&
                  inv.status === "pending_approval";
                const payable =
                  canManage &&
                  inv.outstanding_minor > 0 &&
                  !blockedVariance &&
                  inv.status !== "void" &&
                  inv.status !== "paid";
                return (
                  <DataTableRow key={inv.id}>
                    <DataTableCell className="font-mono text-xs font-semibold">
                      <span className="inline-flex items-center gap-1.5">
                        <Receipt className="size-3.5 text-muted-foreground" />
                        {inv.invoice_number}
                      </span>
                    </DataTableCell>
                    <DataTableCell className="text-xs font-medium">
                      {inv.supplier_name ?? `Supplier #${inv.supplier_id}`}
                    </DataTableCell>
                    <DataTableCell className="font-mono text-xs text-muted-foreground">
                      {inv.purchase_order_id
                        ? `PO #${inv.purchase_order_id}`
                        : inv.expense_account_code
                          ? `GL ${inv.expense_account_code}`
                          : "—"}
                    </DataTableCell>
                    <DataTableCell>
                      <StatusDotBadge tone={matchTone(inv.match_status)}>
                        {matchLabel(inv.match_status)}
                      </StatusDotBadge>
                    </DataTableCell>
                    <DataTableCell className="font-mono text-xs">
                      {inv.due_at}
                    </DataTableCell>
                    <DataTableCell align="right" numeric>
                      {formatMoneyMinor(inv.total_minor, currency)}
                    </DataTableCell>
                    <DataTableCell align="right" numeric>
                      {formatMoneyMinor(inv.outstanding_minor, currency)}
                    </DataTableCell>
                    <DataTableCell>
                      <StatusDotBadge tone={invoiceStatusTone(inv.status)}>
                        {inv.status.replace("_", " ")}
                      </StatusDotBadge>
                    </DataTableCell>
                    <DataTableCell align="right">
                      <div className="inline-flex items-center gap-1.5">
                        {blockedVariance && canManage ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => void handleRequestVarianceApproval(inv)}
                          >
                            <ShieldAlert className="size-3.5" aria-hidden="true" />
                            Request override
                          </Button>
                        ) : null}
                        {payable ? (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              setPaying(inv);
                              setPayAmount(
                                (inv.outstanding_minor / 100).toFixed(2),
                              );
                              setPayRef("");
                              setErrMsg(null);
                            }}
                          >
                            <CreditCard className="size-3.5" aria-hidden="true" />
                            Record payment
                          </Button>
                        ) : null}
                      </div>
                    </DataTableCell>
                  </DataTableRow>
                );
              })}
            </DataTableBody>
          </DataTable>
        </DataTableFrame>
      )}

      <CreateSupplierInvoiceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(inv) => {
          setNotice(
            inv.match_status === "variance"
              ? `Supplier invoice ${inv.invoice_number} saved with 3-way match variance (${formatMoneyMinor(inv.variance_minor, currency)}). Payment blocked pending approval.`
              : `Supplier invoice ${inv.invoice_number} recorded.`,
          );
          void refreshAp();
        }}
      />

      <Dialog open={!!paying} onOpenChange={(o) => !o && setPaying(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Record supplier payment · {paying?.invoice_number}
            </DialogTitle>
            <DialogDescription>
              Posts DR 2000 Accounts Payable / CR Bank and updates AP ageing.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handlePaySubmit(e)} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="ap-pay-amt" className="text-xs font-semibold">
                Amount ({currency})
              </label>
              <Input
                id="ap-pay-amt"
                inputMode="decimal"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold">Payment method</label>
                <DriveCoreSelect
                  ariaLabel="Payment method"
                  value={payMethod}
                  onValueChange={(v) =>
                    setPayMethod(
                      v as "bank_transfer" | "cash" | "card" | "mobile_money",
                    )
                  }
                  options={[
                    { value: "bank_transfer", label: "Bank transfer" },
                    { value: "cash", label: "Cash" },
                    { value: "card", label: "Card" },
                    { value: "mobile_money", label: "Mobile money" },
                  ]}
                />
              </div>
              <div className="space-y-1">
                <DriveCoreDateField
                  value={payDate}
                  onChange={setPayDate}
                  label="Paid date"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">
                Bank / Cash account (optional)
              </label>
              <DriveCoreSelect
                ariaLabel="Bank account"
                value={payBankId}
                onValueChange={setPayBankId}
                options={[
                  { value: "", label: "Default Cash/Bank (GL 1000)" },
                  ...(banksQuery.data ?? []).map((b) => ({
                    value: String(b.id),
                    label: `${b.name} (${b.account_number_masked})`,
                  })),
                ]}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="ap-pay-ref" className="text-xs font-semibold">
                Reference
              </label>
              <Input
                id="ap-pay-ref"
                placeholder="Wire / cheque / transfer ref"
                value={payRef}
                onChange={(e) => setPayRef(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPaying(null)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Posting…" : "Confirm payment"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
