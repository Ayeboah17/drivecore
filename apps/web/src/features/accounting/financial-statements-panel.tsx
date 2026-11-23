"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Scale,
  TrendingUp,
  Waves,
} from "lucide-react";
import { useLiveContext } from "@/features/live/context";
import {
  getBalanceSheet,
  getCashFlowStatement,
  getPnlStatement,
} from "./service";
import { errorText } from "@/lib/api/client";
import { formatMoneyMinor, type StatementLine } from "@/lib/api/contracts";
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
  DriveCoreDateField,
  DriveCoreDateRangePicker,
} from "@/components/ui/drivecore-calendar";

type StatementKind = "pnl" | "balance-sheet" | "cash-flow";

function StatementSection({
  title,
  lines,
  totalLabel,
  totalMinor,
  currency,
}: {
  title: string;
  lines: StatementLine[];
  totalLabel: string;
  totalMinor: number;
  currency: string;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <DataTableFrame ariaLabel={`${title} statement lines`}>
        <DataTable>
          <DataTableHead>
            <tr>
              <DataTableHeaderCell>Account</DataTableHeaderCell>
              <DataTableHeaderCell>Name</DataTableHeaderCell>
              <DataTableHeaderCell align="right">Amount</DataTableHeaderCell>
            </tr>
          </DataTableHead>
          <DataTableBody>
            {lines.length === 0 ? (
              <DataTableRow>
                <td
                  colSpan={3}
                  className="px-3 py-3 text-center text-xs text-muted-foreground"
                >
                  No posted entries in this section.
                </td>
              </DataTableRow>
            ) : (
              lines.map((l) => (
                <DataTableRow key={`${title}-${l.account_code}`}>
                  <DataTableCell className="font-mono text-xs text-muted-foreground">
                    {l.account_code}
                  </DataTableCell>
                  <DataTableCell className="text-xs font-medium">
                    {l.account_name}
                  </DataTableCell>
                  <DataTableCell align="right" numeric>
                    {l.amount_minor < 0 ? "-" : ""}
                    {formatMoneyMinor(Math.abs(l.amount_minor), currency)}
                  </DataTableCell>
                </DataTableRow>
              ))
            )}
            <DataTableRow>
              <td colSpan={2} className="px-3 py-2.5 text-xs font-bold">
                {totalLabel}
              </td>
              <DataTableCell align="right" numeric>
                <strong>
                  {totalMinor < 0 ? "-" : ""}
                  {formatMoneyMinor(Math.abs(totalMinor), currency)}
                </strong>
              </DataTableCell>
            </DataTableRow>
          </DataTableBody>
        </DataTable>
      </DataTableFrame>
    </div>
  );
}

export function FinancialStatementsPanel() {
  const scope = useLiveContext();
  const currency = scope.company?.currency || "ZMW";
  const branchId = scope.branch !== "all" ? scope.branch : undefined;
  const today = new Date().toISOString().slice(0, 10);

  const [kind, setKind] = useState<StatementKind>("pnl");
  const [from, setFrom] = useState(`${today.slice(0, 4)}-01-01`);
  const [to, setTo] = useState(today);
  const [asOf, setAsOf] = useState(today);

  const pnlQuery = useQuery({
    queryKey: [...scope.key, "statements", "pnl", branchId ?? "all", from, to],
    queryFn: ({ signal }) =>
      getPnlStatement({ companyId: scope.companyId, branchId, from, to }, signal),
    enabled: kind === "pnl",
  });

  const bsQuery = useQuery({
    queryKey: [...scope.key, "statements", "bs", branchId ?? "all", asOf],
    queryFn: ({ signal }) =>
      getBalanceSheet({ companyId: scope.companyId, branchId, asOf }, signal),
    enabled: kind === "balance-sheet",
  });

  const cfQuery = useQuery({
    queryKey: [...scope.key, "statements", "cf", branchId ?? "all", from, to],
    queryFn: ({ signal }) =>
      getCashFlowStatement(
        { companyId: scope.companyId, branchId, from, to },
        signal,
      ),
    enabled: kind === "cash-flow",
  });

  function exportCsv() {
    if (kind === "pnl" && pnlQuery.data) {
      downloadCsv(
        `drivecore-pnl-co${scope.companyId}.csv`,
        ["Section", "Account", "Name", "Amount"],
        [
          ...pnlQuery.data.revenue_lines.map((l) => [
            "Revenue",
            l.account_code,
            l.account_name,
            (l.amount_minor / 100).toFixed(2),
          ]),
          ...pnlQuery.data.expense_lines.map((l) => [
            "Expenses",
            l.account_code,
            l.account_name,
            (l.amount_minor / 100).toFixed(2),
          ]),
          [
            "Summary",
            "",
            "Net Profit / Loss",
            (pnlQuery.data.net_profit_minor / 100).toFixed(2),
          ],
        ],
      );
    } else if (kind === "balance-sheet" && bsQuery.data) {
      downloadCsv(
        `drivecore-balance-sheet-co${scope.companyId}.csv`,
        ["Section", "Account", "Name", "Amount"],
        [
          ...bsQuery.data.asset_lines.map((l) => [
            "Assets",
            l.account_code,
            l.account_name,
            (l.amount_minor / 100).toFixed(2),
          ]),
          ...bsQuery.data.liability_lines.map((l) => [
            "Liabilities",
            l.account_code,
            l.account_name,
            (l.amount_minor / 100).toFixed(2),
          ]),
          ...bsQuery.data.equity_lines.map((l) => [
            "Equity",
            l.account_code,
            l.account_name,
            (l.amount_minor / 100).toFixed(2),
          ]),
        ],
      );
    } else if (kind === "cash-flow" && cfQuery.data) {
      downloadCsv(
        `drivecore-cash-flow-co${scope.companyId}.csv`,
        ["Activity", "Account", "Description", "Amount"],
        [
          ...cfQuery.data.operating_lines.map((l) => [
            "Operating",
            l.account_code,
            l.account_name,
            (l.amount_minor / 100).toFixed(2),
          ]),
          ...cfQuery.data.investing_lines.map((l) => [
            "Investing",
            l.account_code,
            l.account_name,
            (l.amount_minor / 100).toFixed(2),
          ]),
          ...cfQuery.data.financing_lines.map((l) => [
            "Financing",
            l.account_code,
            l.account_name,
            (l.amount_minor / 100).toFixed(2),
          ]),
        ],
      );
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Statement type"
          className="flex flex-wrap gap-1.5 rounded-2xl border bg-surface p-1.5"
        >
          {(
            [
              ["pnl", "Profit & Loss", TrendingUp],
              ["balance-sheet", "Balance Sheet", Scale],
              ["cash-flow", "Cash Flow", Waves],
            ] as const
          ).map(([k, label, Icon]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={kind === k}
              onClick={() => setKind(k)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors ${
                kind === k
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              }`}
            >
              <Icon className="size-3.5" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {kind === "balance-sheet" ? (
            <div className="w-52">
              <DriveCoreDateField
                value={asOf}
                onChange={setAsOf}
                label="As of date"
              />
            </div>
          ) : (
            <DriveCoreDateRangePicker
              from={from}
              to={to}
              onChange={(next) => {
                setFrom(next.from);
                setTo(next.to);
              }}
            />
          )}
          <Button type="button" variant="outline" onClick={exportCsv}>
            <Download className="size-4" aria-hidden="true" />
            Export statement CSV
          </Button>
        </div>
      </div>

      {kind === "pnl" ? (
        pnlQuery.isLoading ? (
          <DataTableSkeleton columns={3} rows={5} />
        ) : pnlQuery.isError ? (
          <StatePanel title="Could not load Profit & Loss">
            {errorText(pnlQuery.error)}
          </StatePanel>
        ) : pnlQuery.data ? (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border bg-surface p-4">
                <p className="text-xs text-muted-foreground">Total revenue</p>
                <p className="mt-1 font-mono text-lg font-extrabold tabular-nums">
                  {formatMoneyMinor(pnlQuery.data.total_revenue_minor, currency)}
                </p>
              </div>
              <div className="rounded-2xl border bg-surface p-4">
                <p className="text-xs text-muted-foreground">Total expenses</p>
                <p className="mt-1 font-mono text-lg font-extrabold tabular-nums">
                  {formatMoneyMinor(pnlQuery.data.total_expenses_minor, currency)}
                </p>
              </div>
              <div className="rounded-2xl border bg-surface p-4">
                <p className="text-xs text-muted-foreground">
                  Net profit / (loss)
                </p>
                <p
                  className={`mt-1 font-mono text-lg font-extrabold tabular-nums ${
                    pnlQuery.data.net_profit_minor >= 0
                      ? "text-success-foreground"
                      : "text-danger-foreground"
                  }`}
                >
                  {pnlQuery.data.net_profit_minor < 0 ? "-" : ""}
                  {formatMoneyMinor(
                    Math.abs(pnlQuery.data.net_profit_minor),
                    currency,
                  )}
                </p>
              </div>
            </div>
            <StatementSection
              title="Revenue"
              lines={pnlQuery.data.revenue_lines}
              totalLabel="Total revenue"
              totalMinor={pnlQuery.data.total_revenue_minor}
              currency={currency}
            />
            <StatementSection
              title="Operating Expenses & Depreciation"
              lines={pnlQuery.data.expense_lines}
              totalLabel="Total expenses"
              totalMinor={pnlQuery.data.total_expenses_minor}
              currency={currency}
            />
          </div>
        ) : null
      ) : kind === "balance-sheet" ? (
        bsQuery.isLoading ? (
          <DataTableSkeleton columns={3} rows={6} />
        ) : bsQuery.isError ? (
          <StatePanel title="Could not load Balance Sheet">
            {errorText(bsQuery.error)}
          </StatePanel>
        ) : bsQuery.data ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-surface px-4 py-3">
              <div className="inline-flex items-center gap-2 text-xs font-semibold">
                <FileSpreadsheet className="size-4 text-primary" />
                Balance Sheet as of {bsQuery.data.as_of}
              </div>
              <StatusDotBadge
                tone={bsQuery.data.is_balanced ? "success" : "danger"}
              >
                <CheckCircle2 className="mr-1 inline size-3" aria-hidden="true" />
                {bsQuery.data.is_balanced
                  ? "Balanced (Assets = Liabilities + Equity)"
                  : "Out of balance"}
              </StatusDotBadge>
            </div>
            <StatementSection
              title="Assets"
              lines={bsQuery.data.asset_lines}
              totalLabel="Total assets"
              totalMinor={bsQuery.data.total_assets_minor}
              currency={currency}
            />
            <StatementSection
              title="Liabilities"
              lines={bsQuery.data.liability_lines}
              totalLabel="Total liabilities"
              totalMinor={bsQuery.data.total_liabilities_minor}
              currency={currency}
            />
            <StatementSection
              title="Equity"
              lines={bsQuery.data.equity_lines}
              totalLabel="Total equity"
              totalMinor={bsQuery.data.total_equity_minor}
              currency={currency}
            />
          </div>
        ) : null
      ) : cfQuery.isLoading ? (
        <DataTableSkeleton columns={3} rows={5} />
      ) : cfQuery.isError ? (
        <StatePanel title="Could not load Cash Flow statement">
          {errorText(cfQuery.error)}
        </StatePanel>
      ) : cfQuery.data ? (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border bg-surface p-4">
              <p className="text-xs text-muted-foreground">Opening cash</p>
              <p className="mt-1 font-mono text-lg font-extrabold tabular-nums">
                {formatMoneyMinor(cfQuery.data.opening_cash_minor, currency)}
              </p>
            </div>
            <div className="rounded-2xl border bg-surface p-4">
              <p className="text-xs text-muted-foreground">Net cash change</p>
              <p className="mt-1 font-mono text-lg font-extrabold tabular-nums">
                {cfQuery.data.net_cash_change_minor < 0 ? "-" : "+"}
                {formatMoneyMinor(
                  Math.abs(cfQuery.data.net_cash_change_minor),
                  currency,
                )}
              </p>
            </div>
            <div className="rounded-2xl border bg-surface p-4">
              <p className="text-xs text-muted-foreground">Closing cash</p>
              <p className="mt-1 font-mono text-lg font-extrabold tabular-nums text-primary">
                {formatMoneyMinor(cfQuery.data.closing_cash_minor, currency)}
              </p>
            </div>
          </div>
          <StatementSection
            title="Operating Activities"
            lines={cfQuery.data.operating_lines}
            totalLabel="Net operating cash flow"
            totalMinor={cfQuery.data.operating_total_minor}
            currency={currency}
          />
          <StatementSection
            title="Investing Activities"
            lines={cfQuery.data.investing_lines}
            totalLabel="Net investing cash flow"
            totalMinor={cfQuery.data.investing_total_minor}
            currency={currency}
          />
          <StatementSection
            title="Financing Activities"
            lines={cfQuery.data.financing_lines}
            totalLabel="Net financing cash flow"
            totalMinor={cfQuery.data.financing_total_minor}
            currency={currency}
          />
        </div>
      ) : null}
    </div>
  );
}
