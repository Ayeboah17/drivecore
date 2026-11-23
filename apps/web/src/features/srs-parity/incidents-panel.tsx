"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Plus,
  Wrench,
} from "lucide-react";
import { useLiveContext } from "@/features/live/context";
import { listRecords } from "@/features/records/service";
import {
  createIncident,
  createWorkOrderFromIncident,
  listIncidents,
} from "./service";
import { errorText } from "@/lib/api/client";
import {
  formatMoneyMinor,
  incidentSeverities,
  incidentTypes,
  parseMajorToMinor,
  type IncidentSeverity,
  type IncidentType,
  type Vehicle,
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
  PlateTag,
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
import { DriveCoreSelect } from "@/components/ui/drivecore-select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function IncidentsPanel({
  canManage,
  onWorkOrderCreated,
}: {
  canManage: boolean;
  onWorkOrderCreated?: (msg: string) => void;
}) {
  const scope = useLiveContext();
  const client = useQueryClient();
  const currency = scope.company?.currency || "ZMW";
  const branchId = scope.branch !== "all" ? scope.branch : undefined;

  const [createOpen, setCreateOpen] = useState(false);
  const [vehicleId, setVehicleId] = useState("");
  const [incType, setIncType] = useState<IncidentType>("accident");
  const [severity, setSeverity] = useState<IncidentSeverity>("moderate");
  const [occurredAt, setOccurredAt] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [location, setLocation] = useState("");
  const [driverName, setDriverName] = useState("");
  const [claimNo, setClaimNo] = useState("");
  const [estCost, setEstCost] = useState("");
  const [description, setDescription] = useState("");
  const [markUnsafe, setMarkUnsafe] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const incidentsQuery = useQuery({
    queryKey: [...scope.key, "incidents", branchId ?? "all"],
    queryFn: ({ signal }) =>
      listIncidents({ companyId: scope.companyId, branchId }, signal),
  });

  const vehiclesQuery = useQuery({
    queryKey: [...scope.key, "vehicles", "for-incidents"],
    queryFn: ({ signal }) =>
      listRecords(
        "vehicles",
        {
          companyId: scope.companyId,
          branch: scope.branch,
          q: "",
          filter: "",
          page: 1,
        },
        signal,
      ),
    enabled: createOpen,
  });

  async function refresh() {
    await Promise.all([
      client.invalidateQueries({ queryKey: [...scope.key, "incidents"] }),
      client.invalidateQueries({ queryKey: [...scope.key, "work-orders"] }),
      client.invalidateQueries({ queryKey: [...scope.key, "vehicles"] }),
    ]);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setErrMsg(null);
    if (!vehicleId) {
      setErrMsg("Select a vehicle.");
      return;
    }
    if (!description.trim()) {
      setErrMsg("Describe the accident, breakdown, or damage.");
      return;
    }
    const costMinor = estCost.trim() ? parseMajorToMinor(estCost) : null;
    const defaultBranchId =
      scope.branch !== "all"
        ? Number(scope.branch)
        : scope.directory?.branches[0]?.id ?? 1;
    setBusy(true);
    try {
      await createIncident({
        company_id: Number(scope.companyId),
        branch_id: defaultBranchId,
        vehicle_id: Number(vehicleId),
        incident_type: incType,
        severity,
        occurred_at: occurredAt,
        location: location.trim() || null,
        driver_name: driverName.trim() || null,
        insurance_claim_number: claimNo.trim() || null,
        estimated_cost_minor: costMinor,
        description: description.trim(),
        mark_vehicle_unsafe: markUnsafe,
      });
      setCreateOpen(false);
      setDescription("");
      setLocation("");
      setClaimNo("");
      setEstCost("");
      setNotice("Incident logged and linked to the Digital Vehicle File.");
      await refresh();
    } catch (err) {
      setErrMsg(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleToWorkOrder(incidentId: number) {
    setErrMsg(null);
    setBusy(true);
    try {
      const res = await createWorkOrderFromIncident(incidentId);
      const msg = `Work order #${res.work_order.id} created from incident #${incidentId}.`;
      setNotice(msg);
      onWorkOrderCreated?.(msg);
      await refresh();
    } catch (err) {
      setErrMsg(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  const items = incidentsQuery.data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold tracking-tight">
            Accidents, Breakdowns &amp; Damage Incidents
          </h2>
          <p className="text-xs text-muted-foreground">
            Log field incidents, track insurance claims, block unsafe vehicles,
            and dispatch corrective work orders.
          </p>
        </div>
        {canManage ? (
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" aria-hidden="true" />
            Log incident
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

      {incidentsQuery.isLoading ? (
        <DataTableSkeleton columns={7} rows={3} />
      ) : items.length === 0 ? (
        <StatePanel title="No incidents logged">
          Report vehicle accidents, breakdowns, or return damage here to track
          claims and trigger workshop repairs.
        </StatePanel>
      ) : (
        <DataTableFrame ariaLabel="Vehicle incidents table">
          <DataTable>
            <DataTableHead>
              <tr>
                <DataTableHeaderCell>Date</DataTableHeaderCell>
                <DataTableHeaderCell>Vehicle</DataTableHeaderCell>
                <DataTableHeaderCell>Type &amp; Severity</DataTableHeaderCell>
                <DataTableHeaderCell>Description</DataTableHeaderCell>
                <DataTableHeaderCell>Claim #</DataTableHeaderCell>
                <DataTableHeaderCell align="right">Est. cost</DataTableHeaderCell>
                <DataTableHeaderCell>Status</DataTableHeaderCell>
                <DataTableHeaderCell align="right">Action</DataTableHeaderCell>
              </tr>
            </DataTableHead>
            <DataTableBody>
              {items.map((inc) => (
                <DataTableRow key={inc.id}>
                  <DataTableCell className="font-mono text-xs">
                    {inc.occurred_at}
                  </DataTableCell>
                  <DataTableCell>
                    <PlateTag>
                      {inc.vehicle_registration ?? `VEH #${inc.vehicle_id}`}
                    </PlateTag>
                  </DataTableCell>
                  <DataTableCell className="text-xs capitalize">
                    {inc.incident_type.replace("_", " ")} · {inc.severity}
                  </DataTableCell>
                  <DataTableCell className="max-w-xs truncate text-xs">
                    {inc.description}
                  </DataTableCell>
                  <DataTableCell className="font-mono text-xs text-muted-foreground">
                    {inc.insurance_claim_number ?? "—"}
                  </DataTableCell>
                  <DataTableCell align="right" numeric>
                    {inc.estimated_cost_minor !== null
                      ? formatMoneyMinor(inc.estimated_cost_minor, currency)
                      : "—"}
                  </DataTableCell>
                  <DataTableCell>
                    <StatusDotBadge
                      tone={inc.status === "closed" ? "success" : "danger"}
                    >
                      {inc.status}
                    </StatusDotBadge>
                  </DataTableCell>
                  <DataTableCell align="right">
                    {inc.work_order_id ? (
                      <span className="font-mono text-xs text-muted-foreground">
                        WO #{inc.work_order_id}
                      </span>
                    ) : canManage ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void handleToWorkOrder(inc.id)}
                      >
                        <Wrench className="size-3.5" aria-hidden="true" />
                        Create work order
                      </Button>
                    ) : null}
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        </DataTableFrame>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Log accident or breakdown incident</DialogTitle>
            <DialogDescription>
              Records the incident on the Digital Vehicle File and optionally
              marks the vehicle unsafe for allocation.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handleCreate(e)} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold">Vehicle</label>
                <DriveCoreSelect
                  ariaLabel="Incident vehicle"
                  value={vehicleId}
                  onValueChange={setVehicleId}
                  options={[
                    { value: "", label: "Select vehicle…" },
                    ...(vehiclesQuery.data?.items ?? [])
                      .filter((v): v is Vehicle => "registration" in v)
                      .map((v) => ({
                        value: String(v.id),
                        label: `${v.registration} · ${v.make} ${v.model}`,
                      })),
                  ]}
                />
              </div>
              <DriveCoreDateField
                label="Incident date"
                value={occurredAt}
                onChange={setOccurredAt}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold">Incident type</label>
                <DriveCoreSelect
                  ariaLabel="Incident type"
                  value={incType}
                  onValueChange={(v) => setIncType(v as IncidentType)}
                  options={incidentTypes.map((t) => ({
                    value: t,
                    label: t.replace("_", " "),
                  }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold">Severity</label>
                <DriveCoreSelect
                  ariaLabel="Incident severity"
                  value={severity}
                  onValueChange={(v) => setSeverity(v as IncidentSeverity)}
                  options={incidentSeverities.map((s) => ({
                    value: s,
                    label: s.replace("_", " "),
                  }))}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <label htmlFor="inc-loc" className="text-xs font-semibold">
                  Location
                </label>
                <Input
                  id="inc-loc"
                  placeholder="Highway / yard"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="inc-claim" className="text-xs font-semibold">
                  Insurance claim #
                </label>
                <Input
                  id="inc-claim"
                  placeholder="CLM-2026-..."
                  value={claimNo}
                  onChange={(e) => setClaimNo(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="inc-cost" className="text-xs font-semibold">
                  Est. repair ({currency})
                </label>
                <Input
                  id="inc-cost"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={estCost}
                  onChange={(e) => setEstCost(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="inc-driver" className="text-xs font-semibold">
                Driver name (optional)
              </label>
              <Input
                id="inc-driver"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="inc-desc" className="text-xs font-semibold">
                Incident details
              </label>
              <Textarea
                id="inc-desc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe damage, breakdown fault, or police report details"
                required
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={markUnsafe}
                onChange={(e) => setMarkUnsafe(e.target.checked)}
                className="size-3.5 rounded border"
              />
              Mark vehicle status as{" "}
              <strong>{incType === "accident" ? "Accident" : "Awaiting repair"}</strong>{" "}
              (blocks rental allocation per SRS §8)
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Logging…" : "Save incident"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
