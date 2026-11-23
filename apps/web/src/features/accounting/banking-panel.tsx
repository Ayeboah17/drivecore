"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Landmark,
  Link2,
  Lock,
  Plus,
  RotateCcw,
  Upload,
} from "lucide-react";
import { useSession } from "@/features/auth/session-provider";
import { useLiveContext } from "@/features/live/context";
import {
  closeBankReconciliation,
  createBankAccount,
  importBankTransactions,
  listBankAccounts,
  listBankTransactions,
  matchBankTransaction,
  unmatchBankTransaction,
} from "./service";
import { errorText } from "@/lib/api/client";
import {
  canManageBanking,
  formatMoneyMinor,
  parseMajorToMinor,
  type BankTransaction,
} from "@/lib/api/contracts";
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
import { DriveCoreDateField } from "@/components/ui/drivecore-calendar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

function parseSignedMajorToMinor(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const negative = trimmed.startsWith("-");
  const unsigned = negative ? trimmed.slice(1).trim() : trimmed;
  const minor = parseMajorToMinor(unsigned);
  if (minor === null) return null;
  return negative ? -minor : minor;
}

export function BankingReconciliationPanel() {
  const { user } = useSession();
  const scope = useLiveContext();
  const client = useQueryClient();
  const currency = scope.company?.currency || "ZMW";
  const branchId = scope.branch !== "all" ? scope.branch : undefined;
  const canManage = !!user && canManageBanking(user);

  const [selectedBankId, setSelectedBankId] = useState<number | null>(null);
  const [addBankOpen, setAddBankOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // Add bank account state
  const [bankName, setBankName] = useState("");
  const [institution, setInstitution] = useState("");
  const [acctMasked, setAcctMasked] = useState("");
  const [glCode, setGlCode] = useState("1010");
  const [openingBalance, setOpeningBalance] = useState("0.00");

  // Import / manual statement lines state
  const [csvText, setCsvText] = useState(
    `${new Date().toISOString().slice(0, 10)},Bank service charge,FEE-01,-25.00`,
  );

  // Close reconciliation state
  const [stmtDate, setStmtDate] = useState(new Date().toISOString().slice(0, 10));
  const [stmtClosing, setStmtClosing] = useState("");

  const accountsQuery = useQuery({
    queryKey: [...scope.key, "bank-accounts", branchId ?? "all"],
    queryFn: ({ signal }) =>
      listBankAccounts({ companyId: scope.companyId, branchId }, signal),
  });

  const accounts = accountsQuery.data ?? [];
  const activeAccount =
    accounts.find((a) => a.id === selectedBankId) ?? accounts[0] ?? null;

  const txQuery = useQuery({
    queryKey: [...scope.key, "bank-transactions", activeAccount?.id ?? "none"],
    queryFn: ({ signal }) =>
      listBankTransactions(activeAccount!.id, undefined, signal),
    enabled: !!activeAccount,
  });

  async function refreshBanking() {
    await Promise.all([
      client.invalidateQueries({ queryKey: [...scope.key, "bank-accounts"] }),
      client.invalidateQueries({ queryKey: [...scope.key, "bank-transactions"] }),
      client.invalidateQueries({ queryKey: [...scope.key, "gl"] }),
    ]);
  }

  async function handleAddBank(e: React.FormEvent) {
    e.preventDefault();
    setErrMsg(null);
    const openMinor = parseSignedMajorToMinor(openingBalance);
    if (!bankName.trim() || !institution.trim() || !acctMasked.trim()) {
      setErrMsg("Fill in account name, bank name, and masked account number.");
      return;
    }
    if (openMinor === null) {
      setErrMsg("Enter a valid opening balance.");
      return;
    }
    setBusy(true);
    try {
      const created = await createBankAccount({
        company_id: Number(scope.companyId),
        branch_id: branchId ? Number(branchId) : null,
        name: bankName.trim(),
        bank_name: institution.trim(),
        account_number_masked: acctMasked.trim(),
        currency,
        gl_account_code: glCode.trim() || "1010",
        opening_balance_minor: openMinor,
      });
      setSelectedBankId(created.id);
      setAddBankOpen(false);
      setBankName("");
      setInstitution("");
      setAcctMasked("");
      setNotice(`Bank account "${created.name}" added.`);
      await refreshBanking();
    } catch (err) {
      setErrMsg(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleImportLines(e: React.FormEvent) {
    e.preventDefault();
    if (!activeAccount) return;
    setErrMsg(null);
    const rawLines = csvText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !/^date\s*,/i.test(l));
    if (rawLines.length === 0) {
      setErrMsg("Provide at least one statement line (date,description,reference,amount).");
      return;
    }
    const parsed: Array<{
      transaction_date: string;
      description: string;
      reference?: string | null;
      amount_minor: number;
    }> = [];
    for (let i = 0; i < rawLines.length; i++) {
      const parts = rawLines[i].split(",").map((p) => p.trim());
      if (parts.length < 4) {
        setErrMsg(`Row ${i + 1}: expected 4 comma-separated columns (YYYY-MM-DD,description,reference,amount).`);
        return;
      }
      const [dt, desc, ref, amt] = parts;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dt)) {
        setErrMsg(`Row ${i + 1}: invalid date "${dt}" (use YYYY-MM-DD).`);
        return;
      }
      const minor = parseSignedMajorToMinor(amt);
      if (minor === null || minor === 0) {
        setErrMsg(`Row ${i + 1}: invalid non-zero amount "${amt}".`);
        return;
      }
      parsed.push({
        transaction_date: dt,
        description: desc,
        reference: ref || null,
        amount_minor: minor,
      });
    }
    setBusy(true);
    try {
      await importBankTransactions(activeAccount.id, parsed);
      setImportOpen(false);
      setNotice(`Imported ${parsed.length} bank statement line(s).`);
      await refreshBanking();
    } catch (err) {
      setErrMsg(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmMatch(tx: BankTransaction) {
    const candidate = tx.suggested_matches[0];
    if (!candidate) return;
    setErrMsg(null);
    setBusy(true);
    try {
      await matchBankTransaction(tx.id, {
        mode: "match",
        entity_type: candidate.entity_type,
        entity_id: candidate.entity_id,
      });
      setNotice(`Matched statement line "${tx.description}" to ${candidate.label}.`);
      await refreshBanking();
    } catch (err) {
      setErrMsg(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function handlePostBankFee(tx: BankTransaction) {
    setErrMsg(null);
    setBusy(true);
    try {
      await matchBankTransaction(tx.id, {
        mode: "adjustment",
        gl_account_code: "5600",
        notes: tx.description,
      });
      setNotice(`Posted GL 5600 Bank Charges adjustment for "${tx.description}".`);
      await refreshBanking();
    } catch (err) {
      setErrMsg(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleUnmatch(tx: BankTransaction) {
    setErrMsg(null);
    setBusy(true);
    try {
      await unmatchBankTransaction(tx.id);
      setNotice(`Unmatched "${tx.description}".`);
      await refreshBanking();
    } catch (err) {
      setErrMsg(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleCloseRecon(e: React.FormEvent) {
    e.preventDefault();
    if (!activeAccount) return;
    setErrMsg(null);
    const closingMinor = parseSignedMajorToMinor(stmtClosing);
    if (closingMinor === null) {
      setErrMsg("Enter the statement closing balance.");
      return;
    }
    setBusy(true);
    try {
      await closeBankReconciliation(activeAccount.id, {
        statement_date: stmtDate,
        statement_closing_balance_minor: closingMinor,
      });
      setCloseOpen(false);
      setNotice(`Reconciliation closed for ${activeAccount.name} as of ${stmtDate}.`);
      await refreshBanking();
    } catch (err) {
      setErrMsg(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  const transactions = txQuery.data?.items ?? [];
  const reconciledDelta = transactions
    .filter((t) => t.match_status !== "unmatched")
    .reduce((sum, t) => sum + t.amount_minor, 0);
  const reconciledBalance =
    (activeAccount?.opening_balance_minor ?? 0) + reconciledDelta;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold tracking-tight">
            Cash &amp; Bank Accounts · Reconciliation
          </h2>
          <p className="text-xs text-muted-foreground">
            Import bank statements, match against ERP ledger entries, post bank
            charges, and close reconciliation periods.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManage ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddBankOpen(true)}
              >
                <Plus className="size-4" aria-hidden="true" />
                Add bank account
              </Button>
              {activeAccount ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setImportOpen(true)}
                  >
                    <Upload className="size-4" aria-hidden="true" />
                    Import / add lines
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setStmtClosing((reconciledBalance / 100).toFixed(2));
                      setCloseOpen(true);
                    }}
                  >
                    <Lock className="size-4" aria-hidden="true" />
                    Close reconciliation
                  </Button>
                </>
              ) : null}
            </>
          ) : null}
        </div>
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

      {accountsQuery.isLoading ? (
        <DataTableSkeleton columns={4} rows={2} />
      ) : accounts.length === 0 ? (
        <StatePanel title="No bank accounts configured">
          Add a company bank or cash account mapped to GL 1000-series to begin
          reconciling statements.
        </StatePanel>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((acct) => {
            const active = activeAccount?.id === acct.id;
            return (
              <button
                key={acct.id}
                type="button"
                onClick={() => setSelectedBankId(acct.id)}
                className={`rounded-2xl border p-4 text-left transition-colors ${
                  active
                    ? "border-primary bg-primary/5"
                    : "bg-surface hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-sm font-bold">
                    <Landmark className="size-4 text-primary" aria-hidden="true" />
                    {acct.name}
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    GL {acct.gl_account_code}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {acct.bank_name} · {acct.account_number_masked}
                </p>
                <p className="mt-2 font-mono text-lg font-extrabold tabular-nums">
                  {formatMoneyMinor(acct.ledger_balance_minor, acct.currency)}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Last reconciled:{" "}
                  {acct.last_reconciled_at
                    ? new Date(acct.last_reconciled_at).toLocaleDateString()
                    : "Never"}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {activeAccount ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-surface px-4 py-3 text-xs">
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5 font-semibold">
                <Building2 className="size-3.5 text-muted-foreground" />
                {activeAccount.name}
              </span>
              <span>
                Opening:{" "}
                <strong className="font-mono">
                  {formatMoneyMinor(activeAccount.opening_balance_minor, currency)}
                </strong>
              </span>
              <span>
                Reconciled balance:{" "}
                <strong className="font-mono text-foreground">
                  {formatMoneyMinor(reconciledBalance, currency)}
                </strong>
              </span>
            </div>
            <span className="text-muted-foreground">
              {transactions.filter((t) => t.match_status === "unmatched").length}{" "}
              unmatched line(s)
            </span>
          </div>

          {txQuery.isLoading ? (
            <DataTableSkeleton columns={6} rows={4} />
          ) : transactions.length === 0 ? (
            <StatePanel title="No statement lines imported">
              Click “Import / add lines” to paste CSV statement rows or enter a
              manual bank transaction.
            </StatePanel>
          ) : (
            <DataTableFrame ariaLabel="Bank statement transactions">
              <DataTable>
                <DataTableHead>
                  <tr>
                    <DataTableHeaderCell>Date</DataTableHeaderCell>
                    <DataTableHeaderCell>Description</DataTableHeaderCell>
                    <DataTableHeaderCell>Reference</DataTableHeaderCell>
                    <DataTableHeaderCell align="right">Amount</DataTableHeaderCell>
                    <DataTableHeaderCell>Status</DataTableHeaderCell>
                    <DataTableHeaderCell align="right">Actions</DataTableHeaderCell>
                  </tr>
                </DataTableHead>
                <DataTableBody>
                  {transactions.map((tx) => {
                    const isLocked = tx.reconciliation_id !== null;
                    const firstSuggestion = tx.suggested_matches[0];
                    return (
                      <DataTableRow key={tx.id}>
                        <DataTableCell className="font-mono text-xs">
                          {tx.transaction_date}
                        </DataTableCell>
                        <DataTableCell className="text-xs font-medium">
                          <div>{tx.description}</div>
                          {tx.matched_label ? (
                            <div className="text-[11px] text-muted-foreground">
                              Matched: {tx.matched_label}
                            </div>
                          ) : firstSuggestion ? (
                            <div className="text-[11px] text-link">
                              Suggested: {firstSuggestion.label}
                            </div>
                          ) : null}
                        </DataTableCell>
                        <DataTableCell className="font-mono text-xs text-muted-foreground">
                          {tx.reference ?? "—"}
                        </DataTableCell>
                        <DataTableCell align="right" numeric>
                          <span
                            className={
                              tx.amount_minor >= 0
                                ? "text-success-foreground"
                                : "text-danger-foreground"
                            }
                          >
                            {tx.amount_minor >= 0 ? "+" : "-"}
                            {formatMoneyMinor(Math.abs(tx.amount_minor), currency)}
                          </span>
                        </DataTableCell>
                        <DataTableCell>
                          <StatusDotBadge
                            tone={
                              tx.match_status === "matched"
                                ? "success"
                                : tx.match_status === "adjusted"
                                  ? "info"
                                  : "warning"
                            }
                          >
                            {isLocked ? "reconciled" : tx.match_status}
                          </StatusDotBadge>
                        </DataTableCell>
                        <DataTableCell align="right">
                          {canManage && !isLocked ? (
                            <div className="inline-flex items-center gap-1.5">
                              {tx.match_status === "unmatched" ? (
                                <>
                                  {firstSuggestion ? (
                                    <Button
                                      type="button"
                                      size="sm"
                                      disabled={busy}
                                      onClick={() => void handleConfirmMatch(tx)}
                                    >
                                      <Link2 className="size-3.5" aria-hidden="true" />
                                      Confirm match
                                    </Button>
                                  ) : null}
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={busy}
                                    onClick={() => void handlePostBankFee(tx)}
                                  >
                                    Post bank fee
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={busy}
                                  onClick={() => void handleUnmatch(tx)}
                                >
                                  <RotateCcw className="size-3.5" aria-hidden="true" />
                                  Unmatch
                                </Button>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">
                              {isLocked ? "Closed" : "Read-only"}
                            </span>
                          )}
                        </DataTableCell>
                      </DataTableRow>
                    );
                  })}
                </DataTableBody>
              </DataTable>
            </DataTableFrame>
          )}
        </div>
      ) : null}

      <Dialog open={addBankOpen} onOpenChange={setAddBankOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add bank or cash account</DialogTitle>
            <DialogDescription>
              Map a bank account to a 1000-series General Ledger code.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handleAddBank(e)} className="space-y-3">
            <div className="space-y-1">
              <label htmlFor="ba-name" className="text-xs font-semibold">
                Account display name
              </label>
              <Input
                id="ba-name"
                placeholder="e.g. Operating Checking"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="ba-bank" className="text-xs font-semibold">
                  Bank name
                </label>
                <Input
                  id="ba-bank"
                  placeholder="e.g. Stanbic Bank"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="ba-num" className="text-xs font-semibold">
                  Masked account #
                </label>
                <Input
                  id="ba-num"
                  placeholder="****4821"
                  value={acctMasked}
                  onChange={(e) => setAcctMasked(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="ba-gl" className="text-xs font-semibold">
                  GL account code
                </label>
                <Input
                  id="ba-gl"
                  value={glCode}
                  onChange={(e) => setGlCode(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="ba-open" className="text-xs font-semibold">
                  Opening balance ({currency})
                </label>
                <Input
                  id="ba-open"
                  inputMode="decimal"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddBankOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Adding…" : "Save account"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import bank statement lines</DialogTitle>
            <DialogDescription>
              Paste CSV rows as <code>YYYY-MM-DD,Description,Reference,Amount</code>{" "}
              (use negative numbers for withdrawals/fees).
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handleImportLines(e)} className="space-y-3">
            <Textarea
              aria-label="CSV statement lines"
              rows={6}
              className="font-mono text-xs"
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setImportOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Importing…" : "Import lines"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Close bank reconciliation</DialogTitle>
            <DialogDescription>
              Statement closing balance must equal reconciled balance (
              {formatMoneyMinor(reconciledBalance, currency)}).
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handleCloseRecon(e)} className="space-y-3">
            <div className="space-y-1">
              <DriveCoreDateField
                value={stmtDate}
                onChange={setStmtDate}
                label="Statement date"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="recon-closing" className="text-xs font-semibold">
                Statement closing balance ({currency})
              </label>
              <Input
                id="recon-closing"
                inputMode="decimal"
                value={stmtClosing}
                onChange={(e) => setStmtClosing(e.target.value)}
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCloseOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Closing…" : "Confirm close"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
