"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CarFront,
  Fuel,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { useSession } from "@/features/auth/session-provider";
import { useLiveContext } from "@/features/live/context";
import { getVehicleHistory } from "./service";
import { errorText } from "@/lib/api/client";
import { can, formatMoneyMinor, type Vehicle } from "@/lib/api/contracts";
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

type FileTab = "rentals" | "fuel" | "maintenance" | "incidents" | "compliance";

export function VehicleDigitalFileTabs({ vehicle }: { vehicle: Vehicle }) {
  const { user } = useSession();
  const scope = useLiveContext();
  const currency = scope.company?.currency || "ZMW";
  const canFinance = !!user && can(user, "invoices.view");
  const [tab, setTab] = useState<FileTab>("rentals");

  const query = useQuery({
    queryKey: [...scope.key, "vehicles", "history", vehicle.id],
    queryFn: ({ signal }) =>
      getVehicleHistory(vehicle.id, scope.companyId, signal),
    retry: false,
  });

  if (query.isError) {
    return (
      <StatePanel title="Digital vehicle file history unavailable">
        {errorText(query.error)}
      </StatePanel>
    );
  }

  const data = query.data;

  return (
    <section className="dc-shadow-card space-y-4 rounded-2xl border bg-surface p-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-section-heading">
            Digital Vehicle File · Lifecycle History
          </h2>
          <p className="text-xs text-muted-foreground">
            Consolidated rental, fuel, workshop, accident/incident, and
            compliance records for {vehicle.registration}.
          </p>
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Digital vehicle file history"
        className="flex flex-wrap gap-1.5 rounded-2xl border bg-background p-1.5"
      >
        {(
          [
            ["rentals", `Rentals (${data?.rentals.length ?? 0})`, CarFront],
            ["fuel", `Fuel (${data?.fuel.length ?? 0})`, Fuel],
            ["maintenance", `Maintenance (${data?.work_orders.length ?? 0})`, Wrench],
            ["incidents", `Incidents (${data?.incidents.length ?? 0})`, AlertTriangle],
            ["compliance", "Compliance & Licensing", ShieldCheck],
          ] as const
        ).map(([k, label, Icon]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors ${
              tab === k
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            }`}
          >
            <Icon className="size-3.5" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      {query.isLoading || !data ? (
        <DataTableSkeleton columns={5} rows={3} />
      ) : tab === "rentals" ? (
        data.rentals.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No rental history recorded for this vehicle yet.
          </p>
        ) : (
          <DataTableFrame ariaLabel="Vehicle rental history">
            <DataTable>
              <DataTableHead>
                <tr>
                  <DataTableHeaderCell>Rental</DataTableHeaderCell>
                  <DataTableHeaderCell>Customer</DataTableHeaderCell>
                  <DataTableHeaderCell>Period</DataTableHeaderCell>
                  <DataTableHeaderCell>Status</DataTableHeaderCell>
                  {canFinance ? (
                    <DataTableHeaderCell align="right">
                      Revenue
                    </DataTableHeaderCell>
                  ) : null}
                </tr>
              </DataTableHead>
              <DataTableBody>
                {data.rentals.map((r) => (
                  <DataTableRow key={r.id}>
                    <DataTableCell className="font-mono text-xs font-semibold">
                      #{r.id}
                    </DataTableCell>
                    <DataTableCell className="text-xs">
                      {r.customer_name ?? "—"}
                    </DataTableCell>
                    <DataTableCell className="font-mono text-xs text-muted-foreground">
                      {r.started_at?.slice(0, 10) ?? "—"} →{" "}
                      {r.returned_at?.slice(0, 10) ?? "Active"}
                    </DataTableCell>
                    <DataTableCell>
                      <StatusDotBadge tone={r.status === "active" ? "info" : "neutral"}>
                        {r.status}
                      </StatusDotBadge>
                    </DataTableCell>
                    {canFinance ? (
                      <DataTableCell align="right" numeric>
                        {r.revenue_minor !== null
                          ? formatMoneyMinor(r.revenue_minor, currency)
                          : "—"}
                      </DataTableCell>
                    ) : null}
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </DataTableFrame>
        )
      ) : tab === "fuel" ? (
        data.fuel.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No fuel fills logged for this vehicle yet.
          </p>
        ) : (
          <DataTableFrame ariaLabel="Vehicle fuel history">
            <DataTable>
              <DataTableHead>
                <tr>
                  <DataTableHeaderCell>Date</DataTableHeaderCell>
                  <DataTableHeaderCell align="right">Litres</DataTableHeaderCell>
                  <DataTableHeaderCell align="right">Odometer</DataTableHeaderCell>
                  <DataTableHeaderCell align="right">L/100km</DataTableHeaderCell>
                  {canFinance ? (
                    <DataTableHeaderCell align="right">Cost</DataTableHeaderCell>
                  ) : null}
                </tr>
              </DataTableHead>
              <DataTableBody>
                {data.fuel.map((f) => (
                  <DataTableRow key={f.id}>
                    <DataTableCell className="font-mono text-xs">
                      {f.filled_at}
                    </DataTableCell>
                    <DataTableCell align="right" numeric>
                      {f.litres.toFixed(1)} L
                    </DataTableCell>
                    <DataTableCell align="right" numeric>
                      {f.odometer_km.toLocaleString()} km
                    </DataTableCell>
                    <DataTableCell align="right" numeric>
                      {f.litres_per_100km !== null
                        ? `${f.litres_per_100km.toFixed(1)}`
                        : "—"}
                      {f.is_abnormal ? " ⚠" : ""}
                    </DataTableCell>
                    {canFinance ? (
                      <DataTableCell align="right" numeric>
                        {f.amount_minor !== null
                          ? formatMoneyMinor(f.amount_minor, currency)
                          : "—"}
                      </DataTableCell>
                    ) : null}
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </DataTableFrame>
        )
      ) : tab === "maintenance" ? (
        data.work_orders.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No workshop work orders recorded for this vehicle yet.
          </p>
        ) : (
          <DataTableFrame ariaLabel="Vehicle maintenance history">
            <DataTable>
              <DataTableHead>
                <tr>
                  <DataTableHeaderCell>WO #</DataTableHeaderCell>
                  <DataTableHeaderCell>Work order</DataTableHeaderCell>
                  <DataTableHeaderCell>Status</DataTableHeaderCell>
                  {canFinance ? (
                    <DataTableHeaderCell align="right">Cost</DataTableHeaderCell>
                  ) : null}
                </tr>
              </DataTableHead>
              <DataTableBody>
                {data.work_orders.map((w) => (
                  <DataTableRow key={w.id}>
                    <DataTableCell className="font-mono text-xs font-semibold">
                      WO #{w.id}
                    </DataTableCell>
                    <DataTableCell className="text-xs">{w.title}</DataTableCell>
                    <DataTableCell>
                      <StatusDotBadge tone={w.status === "completed" ? "success" : "warning"}>
                        {w.status.replace("_", " ")}
                      </StatusDotBadge>
                    </DataTableCell>
                    {canFinance ? (
                      <DataTableCell align="right" numeric>
                        {w.total_cost_minor !== null
                          ? formatMoneyMinor(w.total_cost_minor, currency)
                          : "—"}
                      </DataTableCell>
                    ) : null}
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </DataTableFrame>
        )
      ) : tab === "incidents" ? (
        data.incidents.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No accidents, breakdowns, or damage incidents logged for this vehicle.
          </p>
        ) : (
          <DataTableFrame ariaLabel="Vehicle incidents history">
            <DataTable>
              <DataTableHead>
                <tr>
                  <DataTableHeaderCell>Date</DataTableHeaderCell>
                  <DataTableHeaderCell>Type / Severity</DataTableHeaderCell>
                  <DataTableHeaderCell>Description</DataTableHeaderCell>
                  <DataTableHeaderCell>Claim #</DataTableHeaderCell>
                  <DataTableHeaderCell>Status</DataTableHeaderCell>
                </tr>
              </DataTableHead>
              <DataTableBody>
                {data.incidents.map((inc) => (
                  <DataTableRow key={inc.id}>
                    <DataTableCell className="font-mono text-xs">
                      {inc.occurred_at}
                    </DataTableCell>
                    <DataTableCell className="text-xs capitalize">
                      {inc.incident_type.replace("_", " ")} · {inc.severity}
                    </DataTableCell>
                    <DataTableCell className="text-xs">
                      {inc.description}
                    </DataTableCell>
                    <DataTableCell className="font-mono text-xs text-muted-foreground">
                      {inc.insurance_claim_number ?? "—"}
                    </DataTableCell>
                    <DataTableCell>
                      <StatusDotBadge tone={inc.status === "closed" ? "success" : "danger"}>
                        {inc.status}
                      </StatusDotBadge>
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </DataTableFrame>
        )
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border bg-background p-3.5">
            <p className="text-[11px] font-semibold uppercase text-muted-foreground">
              Insurance
            </p>
            <p className="mt-1 text-sm font-bold">
              {data.compliance.insurance_provider ||
                vehicle.insurance_provider ||
                "Not set"}
            </p>
            <p className="font-mono text-xs text-muted-foreground">
              Policy:{" "}
              {data.compliance.insurance_policy_number ||
                vehicle.insurance_policy_number ||
                "—"}
            </p>
            <p className="mt-1 font-mono text-xs">
              Expires:{" "}
              <strong>
                {data.compliance.insurance_expires_at ||
                  vehicle.insurance_expires_at ||
                  "Not set"}
              </strong>
            </p>
          </div>
          <div className="rounded-xl border bg-background p-3.5">
            <p className="text-[11px] font-semibold uppercase text-muted-foreground">
              Roadworthy Certificate
            </p>
            <p className="mt-1 font-mono text-sm font-bold">
              {data.compliance.roadworthy_expires_at ||
                vehicle.roadworthy_expires_at ||
                "Not set"}
            </p>
          </div>
          <div className="rounded-xl border bg-background p-3.5">
            <p className="text-[11px] font-semibold uppercase text-muted-foreground">
              Vehicle Licence / Registration
            </p>
            <p className="mt-1 font-mono text-sm font-bold">
              {data.compliance.licence_expires_at ||
                vehicle.licence_expires_at ||
                "Not set"}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
