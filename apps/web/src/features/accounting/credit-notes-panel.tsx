"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileMinus2 } from "lucide-react";
import { useLiveContext } from "@/features/live/context";
import { issueCreditNote, listCreditNotes } from "./service";
import { errorText } from "@/lib/api/client";
import {
  formatMoneyMinor,
  parseMajorToMinor,
  type CreditNote,
  type Invoice,
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

function cnTone(status: CreditNote["status"]): StatusDotTone {
  if (status === "posted") return "success";
  if (status === "pending_approval") return "warning";
  return "danger";
}

export function IssueCreditNoteDialog({
  invoice,
  open,
  onOpenChange,
  onIssued,
}: {
  invoice: Invoice;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onIssued: (cn: CreditNote) => void;
}) {
  const scope = useLiveContext();
  const currency = scope.company?.currency || "ZMW";
  const [subtotal, setSubtotal] = useState(
    (invoice.outstanding_minor / 100).toFixed(2),
  );
  const [vat, setVat] = useState("0.00");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const subMinor = parseMajorToMinor(subtotal);
    const vatMinor = parseMajorToMinor(vat || "0");
    if (subMinor === null || subMinor <= 0) {
      setError("Enter a positive credit subtotal.");
      return;
    }
    if (vatMinor === null || vatMinor < 0) {
      setError("Enter a valid VAT amount.");
      return;
    }
    if (!reason.trim()) {
      setError("Reason is required for auditability.");
      return;
    }
    setBusy(true);
    try {
      const created = await issueCreditNote(invoice.id, {
        subtotal_minor: subMinor,
        vat_minor: vatMinor,
        reason: reason.trim(),
      });
      onIssued(created);
      onOpenChange(false);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Issue credit note · Invoice #{invoice.id}
          </DialogTitle>
          <DialogDescription>
            Reduces customer AR balance and posts balanced GL reversal (DR
            Rental Revenue + VAT / CR Accounts Receivable).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="cn-subtotal" className="text-xs font-semibold">
                Credit subtotal ({currency})
              </label>
              <Input
                id="cn-subtotal"
                inputMode="decimal"
                value={subtotal}
                onChange={(e) => setSubtotal(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="cn-vat" className="text-xs font-semibold">
                VAT reversal ({currency})
              </label>
              <Input
                id="cn-vat"
                inputMode="decimal"
                value={vat}
                onChange={(e) => setVat(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <label htmlFor="cn-reason" className="text-xs font-semibold">
              Reason
            </label>
            <Textarea
              id="cn-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Early return adjustment / billing dispute resolution"
              required
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
              {busy ? "Issuing…" : "Confirm credit note"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CreditNotesPanel() {
  const scope = useLiveContext();
  const client = useQueryClient();
  const currency = scope.company?.currency || "ZMW";
  const branchId = scope.branch !== "all" ? scope.branch : undefined;

  const query = useQuery({
    queryKey: [...scope.key, "credit-notes", branchId ?? "all"],
    queryFn: ({ signal }) =>
      listCreditNotes({ companyId: scope.companyId, branchId }, signal),
  });

  if (query.isLoading) {
    return <DataTableSkeleton columns={6} rows={4} />;
  }
  if (query.isError) {
    return (
      <StatePanel title="Could not load credit notes">
        {errorText(query.error)}
      </StatePanel>
    );
  }
  const items = query.data?.items ?? [];
  if (items.length === 0) {
    return (
      <StatePanel title="No credit notes issued yet">
        Open any issued customer invoice to issue a formal credit note with
        balanced GL reversal.
      </StatePanel>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Showing {items.length} customer credit note{items.length === 1 ? "" : "s"}.
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            void client.invalidateQueries({
              queryKey: [...scope.key, "credit-notes"],
            })
          }
        >
          Refresh
        </Button>
      </div>
      <DataTableFrame ariaLabel="Customer credit notes">
        <DataTable>
          <DataTableHead>
            <tr>
              <DataTableHeaderCell>Credit note #</DataTableHeaderCell>
              <DataTableHeaderCell>Invoice</DataTableHeaderCell>
              <DataTableHeaderCell>Customer</DataTableHeaderCell>
              <DataTableHeaderCell>Reason</DataTableHeaderCell>
              <DataTableHeaderCell align="right">Total</DataTableHeaderCell>
              <DataTableHeaderCell>Status</DataTableHeaderCell>
            </tr>
          </DataTableHead>
          <DataTableBody>
            {items.map((cn) => (
              <DataTableRow key={cn.id}>
                <DataTableCell className="font-mono text-xs font-semibold">
                  <span className="inline-flex items-center gap-1.5">
                    <FileMinus2 className="size-3.5 text-muted-foreground" />
                    {cn.credit_note_number}
                  </span>
                </DataTableCell>
                <DataTableCell className="font-mono text-xs">
                  {cn.invoice_number ?? `INV #${cn.invoice_id}`}
                </DataTableCell>
                <DataTableCell className="text-xs font-medium">
                  {cn.customer_name ?? `Customer #${cn.customer_id}`}
                </DataTableCell>
                <DataTableCell className="text-xs text-muted-foreground">
                  {cn.reason}
                </DataTableCell>
                <DataTableCell align="right" numeric>
                  {formatMoneyMinor(cn.total_minor, currency)}
                </DataTableCell>
                <DataTableCell>
                  <StatusDotBadge tone={cnTone(cn.status)}>
                    {cn.status.replace("_", " ")}
                  </StatusDotBadge>
                </DataTableCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      </DataTableFrame>
    </div>
  );
}
