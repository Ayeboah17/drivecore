"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileSpreadsheet } from "lucide-react";
import { useLiveContext } from "@/features/live/context";
import { getSupplierStatement } from "./service";
import { errorText } from "@/lib/api/client";
import { formatMoneyMinor } from "@/lib/api/contracts";
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
} from "@/components/data/data-table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DriveCoreDateRangePicker } from "@/components/ui/drivecore-calendar";

export function SupplierStatementDialog({
  supplierId,
  supplierName,
  open,
  onOpenChange,
}: {
  supplierId: number | null;
  supplierName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const scope = useLiveContext();
  const currency = scope.company?.currency || "ZMW";
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(`${today.slice(0, 4)}-01-01`);
  const [to, setTo] = useState(today);

  const query = useQuery({
    queryKey: [...scope.key, "supplier-statement", supplierId, from, to],
    queryFn: ({ signal }) =>
      getSupplierStatement(supplierId!, { from, to }, signal),
    enabled: open && supplierId !== null,
  });

  function exportCsv() {
    if (!query.data) return;
    downloadCsv(
      `drivecore-supplier-statement-${query.data.supplier_id}.csv`,
      ["Date", "Reference", "Description", "Billed", "Paid", "Balance"],
      query.data.rows.map((r) => [
        r.date,
        r.reference,
        r.description,
        (r.credit_minor / 100).toFixed(2),
        (r.debit_minor / 100).toFixed(2),
        (r.balance_minor / 100).toFixed(2),
      ]),
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-4 text-primary" aria-hidden="true" />
            Supplier account statement · {supplierName}
          </DialogTitle>
          <DialogDescription>
            Chronological AP bills and supplier payments with running balance.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <DriveCoreDateRangePicker
            from={from}
            to={to}
            onChange={(next) => {
              setFrom(next.from);
              setTo(next.to);
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!query.data}
            onClick={exportCsv}
          >
            <Download className="size-4" aria-hidden="true" />
            Export CSV
          </Button>
        </div>

        {query.isLoading ? (
          <DataTableSkeleton columns={6} rows={4} />
        ) : query.isError ? (
          <p role="alert" className="text-sm text-danger-foreground">
            {errorText(query.error)}
          </p>
        ) : query.data ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border bg-background p-3">
                <p className="text-xs text-muted-foreground">Opening balance</p>
                <p className="mt-0.5 font-mono text-base font-bold">
                  {formatMoneyMinor(query.data.opening_balance_minor, currency)}
                </p>
              </div>
              <div className="rounded-xl border bg-background p-3">
                <p className="text-xs text-muted-foreground">
                  Closing AP balance
                </p>
                <p className="mt-0.5 font-mono text-base font-bold text-primary">
                  {formatMoneyMinor(query.data.closing_balance_minor, currency)}
                </p>
              </div>
            </div>

            <DataTableFrame ariaLabel="Supplier statement ledger">
              <DataTable>
                <DataTableHead>
                  <tr>
                    <DataTableHeaderCell>Date</DataTableHeaderCell>
                    <DataTableHeaderCell>Reference</DataTableHeaderCell>
                    <DataTableHeaderCell>Description</DataTableHeaderCell>
                    <DataTableHeaderCell align="right">Paid</DataTableHeaderCell>
                    <DataTableHeaderCell align="right">Billed</DataTableHeaderCell>
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
                        No supplier transactions in this period.
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
                        <DataTableCell align="right" numeric>
                          {formatMoneyMinor(r.balance_minor, currency)}
                        </DataTableCell>
                      </DataTableRow>
                    ))
                  )}
                </DataTableBody>
              </DataTable>
            </DataTableFrame>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
