"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  MessageSquarePlus,
  ShieldAlert,
} from "lucide-react";
import { useLiveContext } from "@/features/live/context";
import {
  createCollectionNote,
  getCustomerStatement,
  listCollectionNotes,
  listCreditAccounts,
  updateCollectionNote,
  updateCreditAccount,
} from "@/features/governance/service";
import { errorText } from "@/lib/api/client";
import {
  formatMoneyMinor,
  parseMajorToMinor,
  type CollectionNoteType,
  type CreditAccount,
} from "@/lib/api/contracts";
import { downloadCsv } from "@/lib/csv";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableFrame,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  DataTableSkeleton,
  StatusDotBadge,
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
import {
  DriveCoreDateField,
  DriveCoreDateRangePicker,
} from "@/components/ui/drivecore-calendar";
import { DriveCoreSelect } from "@/components/ui/drivecore-select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function CustomerStatementDialog({
  customerId,
  customerName,
  open,
  onOpenChange,
}: {
  customerId: number;
  customerName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const scope = useLiveContext();
  const currency = scope.company?.currency || "ZMW";
  const [range, setRange] = useState<{ from: string; to: string }>({
    from: "",
    to: "",
  });

  const query = useQuery({
    queryKey: [...scope.key, "statement", customerId, range.from, range.to],
    queryFn: ({ signal }) =>
      getCustomerStatement(
        customerId,
        { from: range.from || undefined, to: range.to || undefined },
        signal,
      ),
    enabled: open && customerId > 0,
    retry: false,
  });

  function handleExport() {
    if (!query.data) return;
    downloadCsv(
      `drivecore-statement-cust${customerId}.csv`,
      ["Date", "Type", "Reference", "Description", "Debit", "Credit", "Balance"],
      query.data.rows.map((r) => [
        r.date,
        r.type,
        r.reference,
        r.description,
        (r.debit_minor / 100).toFixed(2),
        (r.credit_minor / 100).toFixed(2),
        (r.balance_minor / 100).toFixed(2),
      ]),
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl rounded-2xl p-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-4 text-link" aria-hidden="true" />
            Customer Account Statement — {customerName}
          </DialogTitle>
          <DialogDescription>
            Chronological running balance across issued invoices, payments, and
            refunds.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <DriveCoreDateRangePicker
            from={range.from}
            to={range.to}
            onChange={setRange}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!query.data}
            onClick={handleExport}
            className="gap-1.5"
          >
            <Download className="size-3.5" aria-hidden="true" />
            Export CSV
          </Button>
        </div>

        {query.isPending ? (
          <DataTableSkeleton columns={6} label="Loading statement" />
        ) : query.error || !query.data ? (
          <StatePanel title="Statement unavailable">
            {errorText(query.error)}
          </StatePanel>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 rounded-xl border bg-muted/20 p-3 text-xs">
              <div>
                <span className="text-muted-foreground">Opening balance</span>
                <p className="font-mono text-sm font-bold">
                  {formatMoneyMinor(query.data.opening_balance_minor, currency)}
                </p>
              </div>
              <div className="text-right">
                <span className="text-muted-foreground">Closing balance</span>
                <p className="font-mono text-sm font-bold">
                  {formatMoneyMinor(query.data.closing_balance_minor, currency)}
                </p>
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto rounded-xl border">
              <DataTable>
                <DataTableHead>
                  <tr>
                    <DataTableHeaderCell>Date</DataTableHeaderCell>
                    <DataTableHeaderCell>Reference</DataTableHeaderCell>
                    <DataTableHeaderCell>Description</DataTableHeaderCell>
                    <DataTableHeaderCell align="right">Debit</DataTableHeaderCell>
                    <DataTableHeaderCell align="right">Credit</DataTableHeaderCell>
                    <DataTableHeaderCell align="right">Balance</DataTableHeaderCell>
                  </tr>
                </DataTableHead>
                <DataTableBody>
                  {query.data.rows.length === 0 ? (
                    <DataTableRow>
                      <td
                        colSpan={6}
                        className="px-3 py-4 text-center text-xs text-muted-foreground"
                      >
                        No transactions in this period.
                      </td>
                    </DataTableRow>
                  ) : (
                    query.data.rows.map((r, i) => (
                      <DataTableRow key={`${r.reference}-${i}`}>
                        <DataTableCell className="font-mono text-xs">
                          {r.date}
                        </DataTableCell>
                        <DataTableCell className="font-mono text-xs font-semibold">
                          {r.reference}
                        </DataTableCell>
                        <DataTableCell className="text-xs">
                          {r.description}
                        </DataTableCell>
                        <DataTableCell align="right" numeric>
                          {r.debit_minor > 0
                            ? formatMoneyMinor(r.debit_minor, currency)
                            : "—"}
                        </DataTableCell>
                        <DataTableCell align="right" numeric>
                          {r.credit_minor > 0
                            ? formatMoneyMinor(r.credit_minor, currency)
                            : "—"}
                        </DataTableCell>
                        <DataTableCell align="right" numeric className="font-semibold">
                          {formatMoneyMinor(r.balance_minor, currency)}
                        </DataTableCell>
                      </DataTableRow>
                    ))
                  )}
                </DataTableBody>
              </DataTable>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function CreditControlPanel({ canManage }: { canManage: boolean }) {
  const scope = useLiveContext();
  const client = useQueryClient();
  const currency = scope.company?.currency || "ZMW";
  const branchId = scope.branch !== "all" ? scope.branch : undefined;

  const [holdOnly, setHoldOnly] = useState(false);
  const [statementTarget, setStatementTarget] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [holdTarget, setHoldTarget] = useState<CreditAccount | null>(null);
  const [holdReason, setHoldReason] = useState("");
  const [limitText, setLimitText] = useState("");
  const [followTarget, setFollowTarget] = useState<CreditAccount | null>(null);
  const [noteType, setNoteType] = useState<CollectionNoteType>("promise_to_pay");
  const [promisedAmount, setPromisedAmount] = useState("");
  const [promisedDate, setPromisedDate] = useState("");
  const [noteText, setNoteText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const accountsQuery = useQuery({
    queryKey: [...scope.key, "credit", "accounts", branchId ?? "all", holdOnly],
    queryFn: ({ signal }) =>
      listCreditAccounts(
        { companyId: scope.companyId, branchId, holdOnly: holdOnly || undefined },
        signal,
      ),
    enabled: !!scope.companyId,
    retry: false,
  });

  const notesQuery = useQuery({
    queryKey: [...scope.key, "credit", "collections", branchId ?? "all"],
    queryFn: ({ signal }) =>
      listCollectionNotes({ companyId: scope.companyId, branchId }, signal),
    enabled: !!scope.companyId,
    retry: false,
  });

  if (accountsQuery.data && !accountsQuery.data.supported) {
    return (
      <StatePanel title="Credit control endpoint not yet deployed">
        Credit limits, holds, and collections require backend PR #17
        (/api/v1/credit/accounts).
      </StatePanel>
    );
  }

  const accounts = accountsQuery.data?.items ?? [];
  const notes = notesQuery.data?.items ?? [];
  const onHoldCount = accounts.filter((a) => a.is_on_credit_hold).length;
  const totalExposure = accounts.reduce((s, a) => s + a.open_ar_minor, 0);
  const totalOverdue = accounts.reduce((s, a) => s + a.overdue_minor, 0);

  async function handleSaveCredit(e: React.FormEvent) {
    e.preventDefault();
    if (!holdTarget) return;
    setError(null);
    const parsedLimit = limitText.trim()
      ? parseMajorToMinor(limitText.trim())
      : null;
    if (limitText.trim() && parsedLimit === null) {
      setError("Enter a valid credit limit amount.");
      return;
    }
    const nextHold = !holdTarget.is_on_credit_hold;
    setBusy(true);
    try {
      await updateCreditAccount(holdTarget.customer_id, {
        credit_limit_minor: parsedLimit,
        is_on_credit_hold: nextHold,
        credit_hold_reason: nextHold ? holdReason.trim() || "Manual credit hold" : null,
      });
      setNotice(
        nextHold
          ? `${holdTarget.customer_name} placed on credit hold.`
          : `Credit hold released for ${holdTarget.customer_name}.`,
      );
      setHoldTarget(null);
      setHoldReason("");
      await client.invalidateQueries({ queryKey: [...scope.key, "credit"] });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveFollowUp(e: React.FormEvent) {
    e.preventDefault();
    if (!followTarget) return;
    setError(null);
    if (!noteText.trim()) {
      setError("Enter follow-up or dispute notes.");
      return;
    }
    const amt = promisedAmount.trim()
      ? parseMajorToMinor(promisedAmount.trim())
      : null;
    setBusy(true);
    try {
      await createCollectionNote({
        company_id: Number(scope.companyId),
        branch_id: followTarget.branch_id,
        customer_id: followTarget.customer_id,
        note_type: noteType,
        promised_amount_minor: amt,
        promised_date: promisedDate || null,
        notes: noteText.trim(),
      });
      setNotice(`Collection note logged for ${followTarget.customer_name}.`);
      setFollowTarget(null);
      setNoteText("");
      setPromisedAmount("");
      setPromisedDate("");
      await client.invalidateQueries({ queryKey: [...scope.key, "credit"] });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleResolveNote(id: number, status: "kept" | "resolved") {
    setBusy(true);
    try {
      await updateCollectionNote(id, { status });
      await client.invalidateQueries({ queryKey: [...scope.key, "credit"] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="dc-shadow-card rounded-2xl border bg-surface p-3.5">
          <p className="text-xs text-muted-foreground">Customers on hold</p>
          <p className="mt-1 font-mono text-xl font-extrabold tabular-nums text-danger-foreground">
            {onHoldCount}
          </p>
        </div>
        <div className="dc-shadow-card rounded-2xl border bg-surface p-3.5">
          <p className="text-xs text-muted-foreground">Total exposure (AR)</p>
          <p className="mt-1 font-mono text-xl font-extrabold tabular-nums">
            {formatMoneyMinor(totalExposure, currency)}
          </p>
        </div>
        <div className="dc-shadow-card rounded-2xl border bg-surface p-3.5">
          <p className="text-xs text-muted-foreground">Total overdue</p>
          <p className="mt-1 font-mono text-xl font-extrabold tabular-nums text-amber-700 dark:text-amber-400">
            {formatMoneyMinor(totalOverdue, currency)}
          </p>
        </div>
        <div className="dc-shadow-card rounded-2xl border bg-surface p-3.5">
          <p className="text-xs text-muted-foreground">Open follow-ups</p>
          <p className="mt-1 font-mono text-xl font-extrabold tabular-nums">
            {notes.filter((n) => n.status === "open").length}
          </p>
        </div>
      </div>

      {notice ? (
        <p
          role="status"
          className="rounded-xl border border-success bg-success/10 px-4 py-2.5 text-sm text-success-foreground"
        >
          {notice}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          size="sm"
          variant={holdOnly ? "default" : "outline"}
          onClick={() => setHoldOnly((v) => !v)}
          className="gap-1.5 rounded-xl text-xs"
        >
          <ShieldAlert className="size-3.5" aria-hidden="true" />
          On credit hold only
        </Button>
      </div>

      <DataTableFrame ariaLabel="Credit control accounts">
        {accountsQuery.isPending ? (
          <DataTableSkeleton columns={7} label="Loading credit accounts" />
        ) : accountsQuery.error ? (
          <div className="p-card">
            <StatePanel title="Credit accounts unavailable">
              {errorText(accountsQuery.error)}
            </StatePanel>
          </div>
        ) : (
          <DataTable>
            <DataTableHead>
              <tr>
                <DataTableHeaderCell>Customer</DataTableHeaderCell>
                <DataTableHeaderCell align="right">Credit limit</DataTableHeaderCell>
                <DataTableHeaderCell align="right">Open AR</DataTableHeaderCell>
                <DataTableHeaderCell align="right">Terms</DataTableHeaderCell>
                <DataTableHeaderCell>Hold status</DataTableHeaderCell>
                <DataTableHeaderCell align="right">Actions</DataTableHeaderCell>
              </tr>
            </DataTableHead>
            <DataTableBody>
              {accounts.map((a) => (
                <DataTableRow key={a.customer_id}>
                  <DataTableCell className="font-semibold">
                    {a.customer_name}
                  </DataTableCell>
                  <DataTableCell align="right" numeric>
                    {a.credit_limit_minor !== null
                      ? formatMoneyMinor(a.credit_limit_minor, currency)
                      : "Not set"}
                  </DataTableCell>
                  <DataTableCell align="right" numeric className="font-semibold">
                    {formatMoneyMinor(a.open_ar_minor, currency)}
                  </DataTableCell>
                  <DataTableCell align="right" numeric className="text-muted-foreground">
                    Net {a.payment_terms_days}d
                  </DataTableCell>
                  <DataTableCell>
                    <StatusDotBadge
                      tone={a.is_on_credit_hold ? "danger" : "success"}
                    >
                      {a.is_on_credit_hold ? "On hold" : "Active"}
                    </StatusDotBadge>
                  </DataTableCell>
                  <DataTableCell align="right">
                    <div className="inline-flex flex-wrap justify-end gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        onClick={() =>
                          setStatementTarget({
                            id: a.customer_id,
                            name: a.customer_name,
                          })
                        }
                      >
                        Statement
                      </Button>
                      {canManage ? (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1 px-2 text-xs"
                            onClick={() => setFollowTarget(a)}
                          >
                            <MessageSquarePlus className="size-3" aria-hidden="true" />
                            Follow-up
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={a.is_on_credit_hold ? "outline" : "ghost"}
                            className={`h-7 gap-1 px-2 text-xs ${
                              a.is_on_credit_hold
                                ? ""
                                : "text-destructive hover:text-destructive"
                            }`}
                            onClick={() => {
                              setHoldTarget(a);
                              setHoldReason(a.credit_hold_reason ?? "");
                              setLimitText(
                                a.credit_limit_minor !== null
                                  ? (a.credit_limit_minor / 100).toFixed(2)
                                  : "",
                              );
                            }}
                          >
                            {a.is_on_credit_hold ? (
                              <>
                                <CheckCircle2 className="size-3" aria-hidden="true" />
                                Release hold
                              </>
                            ) : (
                              <>
                                <Ban className="size-3" aria-hidden="true" />
                                Place hold
                              </>
                            )}
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        )}
      </DataTableFrame>

      {/* Collection Follow-ups & Disputes */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold tracking-tight">
          Collection follow-ups, promises to pay &amp; disputes
        </h3>
        <DataTableFrame ariaLabel="Collection follow-ups">
          {notes.length === 0 ? (
            <div className="p-card text-xs text-muted-foreground">
              No collection follow-ups logged yet.
            </div>
          ) : (
            <DataTable>
              <DataTableHead>
                <tr>
                  <DataTableHeaderCell>Customer</DataTableHeaderCell>
                  <DataTableHeaderCell>Type</DataTableHeaderCell>
                  <DataTableHeaderCell>Notes</DataTableHeaderCell>
                  <DataTableHeaderCell align="right">Promised</DataTableHeaderCell>
                  <DataTableHeaderCell>Status</DataTableHeaderCell>
                  <DataTableHeaderCell align="right">Action</DataTableHeaderCell>
                </tr>
              </DataTableHead>
              <DataTableBody>
                {notes.map((n) => (
                  <DataTableRow key={n.id}>
                    <DataTableCell className="font-medium">
                      {n.customer_name ?? `Customer #${n.customer_id}`}
                    </DataTableCell>
                    <DataTableCell className="capitalize">
                      {n.note_type.replace(/_/g, " ")}
                    </DataTableCell>
                    <DataTableCell className="text-xs text-muted-foreground">
                      {n.notes}
                    </DataTableCell>
                    <DataTableCell align="right" numeric className="text-xs">
                      {n.promised_amount_minor !== null
                        ? `${formatMoneyMinor(n.promised_amount_minor, currency)}${n.promised_date ? ` by ${n.promised_date}` : ""}`
                        : "—"}
                    </DataTableCell>
                    <DataTableCell>
                      <StatusDotBadge
                        tone={
                          n.status === "kept" || n.status === "resolved"
                            ? "success"
                            : "warning"
                        }
                      >
                        {n.status}
                      </StatusDotBadge>
                    </DataTableCell>
                    <DataTableCell align="right">
                      {canManage && n.status === "open" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          className="h-7 px-2 text-xs"
                          onClick={() =>
                            void handleResolveNote(
                              n.id,
                              n.note_type === "promise_to_pay"
                                ? "kept"
                                : "resolved",
                            )
                          }
                        >
                          Mark resolved
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          )}
        </DataTableFrame>
      </div>

      {/* Hold / Credit Limit Dialog */}
      <Dialog
        open={!!holdTarget}
        onOpenChange={(o) => {
          if (!o) setHoldTarget(null);
        }}
      >
        <DialogContent className="max-w-md rounded-2xl p-card">
          <DialogHeader>
            <DialogTitle>
              {holdTarget?.is_on_credit_hold
                ? `Release credit hold — ${holdTarget.customer_name}`
                : `Place credit hold — ${holdTarget?.customer_name}`}
            </DialogTitle>
            <DialogDescription>
              {holdTarget?.is_on_credit_hold
                ? "Releasing this hold re-enables reservations and handovers."
                : "Placing a customer on hold blocks new reservations, quote conversions, and handovers (payments remain allowed)."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handleSaveCredit(e)} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="cc-limit" className="text-xs font-medium">
                Credit limit ({currency}, optional)
              </label>
              <Input
                id="cc-limit"
                inputMode="decimal"
                value={limitText}
                onChange={(e) => setLimitText(e.target.value)}
                disabled={busy}
              />
            </div>
            {!holdTarget?.is_on_credit_hold ? (
              <div className="space-y-1">
                <label htmlFor="cc-reason" className="text-xs font-medium">
                  Hold reason
                </label>
                <Input
                  id="cc-reason"
                  placeholder="e.g. Overdue balance > 60 days"
                  value={holdReason}
                  onChange={(e) => setHoldReason(e.target.value)}
                  disabled={busy}
                />
              </div>
            ) : null}
            {error ? (
              <p role="alert" className="text-xs text-danger-foreground">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setHoldTarget(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {holdTarget?.is_on_credit_hold
                  ? "Confirm release"
                  : "Confirm hold"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Collection Follow-up Dialog */}
      <Dialog
        open={!!followTarget}
        onOpenChange={(o) => {
          if (!o) setFollowTarget(null);
        }}
      >
        <DialogContent className="max-w-md rounded-2xl p-card">
          <DialogHeader>
            <DialogTitle>
              Log collection follow-up — {followTarget?.customer_name}
            </DialogTitle>
            <DialogDescription>
              Record reminders, promises to pay, disputes, or escalations.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handleSaveFollowUp(e)} className="space-y-4">
            <div className="space-y-1">
              <span className="block text-xs font-medium">Follow-up type</span>
              <DriveCoreSelect
                ariaLabel="Follow-up type"
                value={noteType}
                onValueChange={(v) => setNoteType(v as CollectionNoteType)}
                options={[
                  { value: "promise_to_pay", label: "Promise to pay" },
                  { value: "reminder", label: "Payment reminder" },
                  { value: "dispute", label: "Invoice dispute" },
                  { value: "escalation", label: "Escalation" },
                  { value: "general", label: "General note" },
                ]}
              />
            </div>
            {noteType === "promise_to_pay" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label htmlFor="ptp-amt" className="text-xs font-medium">
                    Promised amount ({currency})
                  </label>
                  <Input
                    id="ptp-amt"
                    inputMode="decimal"
                    value={promisedAmount}
                    onChange={(e) => setPromisedAmount(e.target.value)}
                    disabled={busy}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="ptp-date" className="text-xs font-medium">
                    Promised date
                  </label>
                  <DriveCoreDateField
                    id="ptp-date"
                    label="Promised date"
                    value={promisedDate}
                    onChange={setPromisedDate}
                    optional
                    disabled={busy}
                  />
                </div>
              </div>
            ) : null}
            <div className="space-y-1">
              <label htmlFor="ptp-notes" className="text-xs font-medium">
                Notes
              </label>
              <Textarea
                id="ptp-notes"
                rows={3}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                disabled={busy}
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
                disabled={busy}
                onClick={() => setFollowTarget(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                Save follow-up
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {statementTarget ? (
        <CustomerStatementDialog
          customerId={statementTarget.id}
          customerName={statementTarget.name}
          open={!!statementTarget}
          onOpenChange={(o) => {
            if (!o) setStatementTarget(null);
          }}
        />
      ) : null}
    </div>
  );
}
