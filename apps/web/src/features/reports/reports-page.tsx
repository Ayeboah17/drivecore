"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  CarFront,
  Download,
  FileSpreadsheet,
  Landmark,
  ShieldCheck,
} from "lucide-react";
import { useSession } from "@/features/auth/session-provider";
import { useLiveContext } from "@/features/live/context";
import { DetailedStatsPanel } from "@/features/stats/detailed-stats-panel";
import { FinancialStatementsPanel } from "@/features/accounting/financial-statements-panel";
import {
  getFinancialReport,
  getFleetReport,
  listAuditEvents,
} from "@/features/reports/service";
import { errorText } from "@/lib/api/client";
import {
  can,
  canAccessReports,
  canViewAudit,
  canViewStatements,
  formatMoneyMinor,
} from "@/lib/api/contracts";
import { downloadCsv } from "@/lib/csv";
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
} from "@/components/data/data-table";
import { StatePanel } from "@/components/layout/state-panel";
import { ViewFadeIn } from "@/components/motion/primitives";
import { Button } from "@/components/ui/button";
import { DriveCoreDateRangePicker } from "@/components/ui/drivecore-calendar";

type ReportsTab = "financial" | "statements" | "fleet" | "stats" | "audit";

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

export function LiveReportsPage() {
  const { user } = useSession();
  const scope = useLiveContext();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const canAccess = !!user && canAccessReports(user);
  const canFinancial = !!user && can(user, "invoices.view");
  const canStatements = !!user && canViewStatements(user);
  const canFleet = !!user && can(user, "vehicles.view");
  const hasAuditAccess = !!user && canViewAudit(user);
  const currency = scope.company?.currency || "ZMW";

  const rawTab = searchParams.get("tab");
  const activeTab: ReportsTab =
    rawTab === "financial" ||
    (rawTab === "statements" && canStatements) ||
    rawTab === "fleet" ||
    rawTab === "stats" ||
    rawTab === "audit"
      ? (rawTab as ReportsTab)
      : canFinancial
        ? "financial"
        : canFleet
          ? "fleet"
          : "stats";

  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const rawQ = searchParams.get("q") ?? "";
  const rawPage = Number(searchParams.get("page") ?? "1");
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const branchId = scope.branch !== "all" ? scope.branch : undefined;

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

  const financialQuery = useQuery({
    queryKey: [...scope.key, "reports", "financial", branchId ?? "all", from, to],
    queryFn: ({ signal }) =>
      getFinancialReport(
        {
          companyId: scope.companyId,
          branchId,
          from: from || undefined,
          to: to || undefined,
        },
        signal,
      ),
    enabled: canFinancial && activeTab === "financial",
  });

  const fleetQuery = useQuery({
    queryKey: [...scope.key, "reports", "fleet", branchId ?? "all", from, to],
    queryFn: ({ signal }) =>
      getFleetReport(
        {
          companyId: scope.companyId,
          branchId,
          from: from || undefined,
          to: to || undefined,
        },
        signal,
      ),
    enabled: canFleet && activeTab === "fleet",
  });

  const auditQuery = useQuery({
    queryKey: [...scope.key, "audit-events", rawQ, page],
    queryFn: ({ signal }) =>
      listAuditEvents(
        { companyId: scope.companyId, q: rawQ, page },
        signal,
      ),
    enabled: hasAuditAccess && activeTab === "audit",
  });

  if (!canAccess) {
    return (
      <StatePanel title="Access denied">
        Your account does not have permission to view Reports.
      </StatePanel>
    );
  }

  const tabs: { key: ReportsTab; label: string; visible: boolean }[] = [
    { key: "financial", label: "Financial report", visible: canFinancial },
    {
      key: "statements",
      label: "Financial statements",
      visible: canStatements,
    },
    { key: "fleet", label: "Fleet & maintenance", visible: canFleet },
    { key: "stats", label: "Detailed stats", visible: canAccess },
    { key: "audit", label: "Audit trail", visible: hasAuditAccess },
  ];

  function handleExportCsv() {
    if (activeTab === "financial" && financialQuery.data) {
      downloadCsv(
        `drivecore-financial-report-co${scope.companyId}.csv`,
        ["Date", "Type", "Reference", "Counterparty", "Amount", "VAT", "Status"],
        financialQuery.data.rows.map((r) => [
          r.date,
          r.type,
          r.reference,
          r.counterparty,
          (r.amount_minor / 100).toFixed(2),
          (r.vat_minor / 100).toFixed(2),
          r.status,
        ]),
      );
    } else if (activeTab === "fleet" && fleetQuery.data) {
      downloadCsv(
        `drivecore-fleet-report-co${scope.companyId}.csv`,
        [
          "Registration",
          "Vehicle",
          "Status",
          "Rentals",
          "Work orders",
          "Downtime (hrs)",
          ...(canFinancial ? ["Revenue", "Maintenance cost", "Net ROI"] : []),
        ],
        fleetQuery.data.map((r) => [
          r.registration,
          r.make_model,
          r.status,
          r.rental_count,
          r.work_order_count,
          r.downtime_hours,
          ...(canFinancial
            ? [
                ((r.revenue_minor ?? 0) / 100).toFixed(2),
                ((r.maintenance_cost_minor ?? 0) / 100).toFixed(2),
                ((r.net_roi_minor ?? 0) / 100).toFixed(2),
              ]
            : []),
        ]),
      );
    } else if (activeTab === "audit" && auditQuery.data) {
      downloadCsv(
        `drivecore-audit-trail-co${scope.companyId}.csv`,
        ["Timestamp", "Actor", "Action", "Entity", "Summary"],
        auditQuery.data.items.map((a) => [
          a.created_at,
          a.actor_name ?? "System",
          a.action,
          a.entity_type ? `${a.entity_type}#${a.entity_id ?? ""}` : "",
          a.summary,
        ]),
      );
    }
  }

  return (
    <ViewFadeIn className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-page-title font-extrabold tracking-tight">
            Reports
          </h1>
          <p className="text-sm text-muted-foreground">
            Scoped financial summaries, fleet utilization &amp; ROI, and
            immutable audit history.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={handleExportCsv}
          className={`gap-1.5 ${activeTab === "stats" || activeTab === "statements" ? "hidden" : ""}`}
        >
          <Download className="size-4" aria-hidden="true" />
          Export CSV
        </Button>
      </div>

      <div
        role="tablist"
        aria-label="Report sections"
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
                onClick={() => updateQuery({ tab: tab.key, q: "", page: 1 })}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                }`}
              >
                {tab.key === "financial" ? (
                  <Landmark className="size-3.5" aria-hidden="true" />
                ) : tab.key === "statements" ? (
                  <FileSpreadsheet className="size-3.5" aria-hidden="true" />
                ) : tab.key === "fleet" ? (
                  <CarFront className="size-3.5" aria-hidden="true" />
                ) : tab.key === "stats" ? (
                  <BarChart3 className="size-3.5" aria-hidden="true" />
                ) : (
                  <ShieldCheck className="size-3.5" aria-hidden="true" />
                )}
                {tab.label}
              </button>
            );
          })}
      </div>

      {activeTab === "financial" || activeTab === "fleet" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-surface p-4">
          <div className="space-y-0.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Reporting period
            </p>
            <p className="text-xs text-muted-foreground">
              Filter figures and CSV exports by calendar range.
            </p>
          </div>
          <DriveCoreDateRangePicker
            from={from}
            to={to}
            onChange={(next) => updateQuery({ from: next.from, to: next.to })}
          />
        </div>
      ) : null}

      {activeTab === "financial" ? (
        !canFinancial ? (
          <StatePanel title="Financial report restricted">
            Your role does not have permission to view financial reports.
          </StatePanel>
        ) : financialQuery.isPending ? (
          <DataTableSkeleton columns={6} label="Loading financial report" />
        ) : financialQuery.error || !financialQuery.data ? (
          <StatePanel title="Financial report unavailable">
            {errorText(financialQuery.error)}
          </StatePanel>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="dc-shadow-card rounded-2xl border bg-surface p-4">
                <p className="text-label text-muted-foreground">Total invoiced</p>
                <p className="mt-1 font-mono text-lg font-extrabold tabular-nums">
                  {formatMoneyMinor(
                    financialQuery.data.summary.invoiced_minor,
                    currency,
                  )}
                </p>
              </div>
              <div className="dc-shadow-card rounded-2xl border bg-surface p-4">
                <p className="text-label text-muted-foreground">VAT collected</p>
                <p className="mt-1 font-mono text-lg font-extrabold tabular-nums">
                  {formatMoneyMinor(
                    financialQuery.data.summary.vat_minor,
                    currency,
                  )}
                </p>
              </div>
              <div className="dc-shadow-card rounded-2xl border bg-surface p-4">
                <p className="text-label text-muted-foreground">Total expenses</p>
                <p className="mt-1 font-mono text-lg font-extrabold tabular-nums">
                  {formatMoneyMinor(
                    financialQuery.data.summary.expenses_minor,
                    currency,
                  )}
                </p>
              </div>
              <div className="dc-shadow-card rounded-2xl border bg-surface p-4">
                <p className="text-label text-muted-foreground">Net position</p>
                <p className="mt-1 font-mono text-lg font-extrabold tabular-nums">
                  {formatMoneyMinor(
                    financialQuery.data.summary.net_position_minor,
                    currency,
                  )}
                </p>
              </div>
            </div>

            <DataTableFrame ariaLabel="Financial report breakdown">
              {financialQuery.data.rows.length === 0 ? (
                <div className="p-card">
                  <StatePanel title="No financial entries in range">
                    Issued invoices and posted expenses in this period will
                    appear here.
                  </StatePanel>
                </div>
              ) : (
                <DataTable>
                  <DataTableHead>
                    <tr>
                      <DataTableHeaderCell>Date</DataTableHeaderCell>
                      <DataTableHeaderCell>Type</DataTableHeaderCell>
                      <DataTableHeaderCell>Reference</DataTableHeaderCell>
                      <DataTableHeaderCell>Counterparty</DataTableHeaderCell>
                      <DataTableHeaderCell align="right">
                        Amount
                      </DataTableHeaderCell>
                      <DataTableHeaderCell>Status</DataTableHeaderCell>
                    </tr>
                  </DataTableHead>
                  <DataTableBody>
                    {financialQuery.data.rows.map((r) => (
                      <DataTableRow key={r.id}>
                        <DataTableCell numeric>{fmtDate(r.date)}</DataTableCell>
                        <DataTableCell className="capitalize">
                          {r.type}
                        </DataTableCell>
                        <DataTableCell numeric className="font-semibold">
                          {r.reference}
                        </DataTableCell>
                        <DataTableCell>{r.counterparty}</DataTableCell>
                        <DataTableCell align="right" numeric className="font-semibold">
                          {formatMoneyMinor(r.amount_minor, currency)}
                        </DataTableCell>
                        <DataTableCell className="capitalize">
                          {r.status}
                        </DataTableCell>
                      </DataTableRow>
                    ))}
                  </DataTableBody>
                </DataTable>
              )}
            </DataTableFrame>
          </div>
        )
      ) : null}

      {activeTab === "fleet" ? (
        !canFleet ? (
          <StatePanel title="Fleet report restricted">
            Your role does not have permission to view fleet reports.
          </StatePanel>
        ) : fleetQuery.isPending ? (
          <DataTableSkeleton columns={6} label="Loading fleet report" />
        ) : fleetQuery.error || !fleetQuery.data ? (
          <StatePanel title="Fleet report unavailable">
            {errorText(fleetQuery.error)}
          </StatePanel>
        ) : (
          <DataTableFrame ariaLabel="Fleet and maintenance report">
            <DataTable>
              <DataTableHead>
                <tr>
                  <DataTableHeaderCell>Vehicle</DataTableHeaderCell>
                  <DataTableHeaderCell>Status</DataTableHeaderCell>
                  <DataTableHeaderCell align="right">Rentals</DataTableHeaderCell>
                  <DataTableHeaderCell align="right">
                    Work orders
                  </DataTableHeaderCell>
                  <DataTableHeaderCell align="right">
                    Downtime (hrs)
                  </DataTableHeaderCell>
                  {canFinancial ? (
                    <>
                      <DataTableHeaderCell align="right">
                        Revenue
                      </DataTableHeaderCell>
                      <DataTableHeaderCell align="right">
                        Net ROI
                      </DataTableHeaderCell>
                    </>
                  ) : null}
                </tr>
              </DataTableHead>
              <DataTableBody>
                {fleetQuery.data.map((row) => (
                  <DataTableRow key={row.vehicle_id}>
                    <DataTableCell>
                      <div className="flex items-center gap-2">
                        <PlateTag>{row.registration}</PlateTag>
                        <span className="text-xs text-muted-foreground">
                          {row.make_model}
                        </span>
                      </div>
                    </DataTableCell>
                    <DataTableCell className="capitalize">
                      {row.status}
                    </DataTableCell>
                    <DataTableCell align="right" numeric>
                      {row.rental_count}
                    </DataTableCell>
                    <DataTableCell align="right" numeric>
                      {row.work_order_count}
                    </DataTableCell>
                    <DataTableCell align="right" numeric>
                      {row.downtime_hours.toFixed(1)}
                    </DataTableCell>
                    {canFinancial ? (
                      <>
                        <DataTableCell align="right" numeric>
                          {formatMoneyMinor(row.revenue_minor ?? 0, currency)}
                        </DataTableCell>
                        <DataTableCell align="right" numeric className="font-semibold">
                          {formatMoneyMinor(row.net_roi_minor ?? 0, currency)}
                        </DataTableCell>
                      </>
                    ) : null}
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </DataTableFrame>
        )
      ) : null}

      {activeTab === "stats" ? <DetailedStatsPanel /> : null}

      {activeTab === "audit" ? (
        !hasAuditAccess ? (
          <StatePanel title="Audit trail restricted">
            Your role does not have permission (`audit.view`) to inspect the
            immutable audit trail.
          </StatePanel>
        ) : (
          <DataTableFrame
            ariaLabel="Immutable audit trail"
            toolbar={
              <DataSearchForm
                label="Search audit trail"
                placeholder="Search actor, action, or summary…"
                defaultValue={rawQ}
                formKey={`audit:${rawQ}`}
                onSubmitQuery={(nextQ) => updateQuery({ q: nextQ, page: 1 })}
              />
            }
          >
            {auditQuery.isPending ? (
              <DataTableSkeleton columns={4} label="Loading audit events" />
            ) : auditQuery.error ? (
              <div className="p-card">
                <StatePanel title="Audit trail unavailable">
                  {errorText(auditQuery.error)}
                </StatePanel>
              </div>
            ) : auditQuery.data.items.length === 0 ? (
              <div className="p-card">
                <StatePanel title="No audit events yet">
                  Recorded administrative and transactional events will appear
                  here.
                </StatePanel>
              </div>
            ) : (
              <DataTable>
                <DataTableHead>
                  <tr>
                    <DataTableHeaderCell>Timestamp</DataTableHeaderCell>
                    <DataTableHeaderCell>Actor</DataTableHeaderCell>
                    <DataTableHeaderCell>Action</DataTableHeaderCell>
                    <DataTableHeaderCell>Summary</DataTableHeaderCell>
                  </tr>
                </DataTableHead>
                <DataTableBody>
                  {auditQuery.data.items.map((ev) => (
                    <DataTableRow key={ev.id}>
                      <DataTableCell numeric>
                        {fmtDateTime(ev.created_at)}
                      </DataTableCell>
                      <DataTableCell className="font-medium">
                        {ev.actor_name ?? "System"}
                      </DataTableCell>
                      <DataTableCell className="font-mono text-xs">
                        {ev.action}
                      </DataTableCell>
                      <DataTableCell>{ev.summary}</DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            )}
          </DataTableFrame>
        )
      ) : null}
      {activeTab === "statements" && canStatements ? (
        <FinancialStatementsPanel />
      ) : null}
    </ViewFadeIn>
  );
}
