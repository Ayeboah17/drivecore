"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Plus, Wrench } from "lucide-react";
import { useLiveContext } from "@/features/live/context";
import { listRecords } from "@/features/records/service";
import { createWorkOrder } from "@/features/maintenance/service";
import {
  createMaintenanceSchedule,
  listMaintenanceSchedules,
  useUnitPreferences,
} from "@/features/operations-srs/service";
import { errorText } from "@/lib/api/client";
import type { MaintenanceSchedule, Vehicle } from "@/lib/api/contracts";
import { formatDistance } from "@/lib/units";
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
import { DriveCoreSelect } from "@/components/ui/drivecore-select";
import { Input } from "@/components/ui/input";

const STATUS_TONE: Record<MaintenanceSchedule["status"], StatusDotTone> = {
  ok: "success",
  due_soon: "warning",
  overdue: "danger",
};

export function PreventiveSchedulesPanel({
  canManage,
  onWorkOrderOpened,
}: {
  canManage: boolean;
  onWorkOrderOpened?: (msg: string) => void;
}) {
  const scope = useLiveContext();
  const client = useQueryClient();
  const units = useUnitPreferences(scope.companyId);
  const branchId = scope.branch !== "all" ? scope.branch : undefined;

  const [statusFilter, setStatusFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [vehicleId, setVehicleId] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [intervalKm, setIntervalKm] = useState("10000");
  const [intervalDays, setIntervalDays] = useState("180");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: [...scope.key, "maintenance-schedules", branchId ?? "all", statusFilter],
    queryFn: ({ signal }) =>
      listMaintenanceSchedules(
        {
          companyId: scope.companyId,
          branchId,
          status: statusFilter || undefined,
        },
        signal,
      ),
    enabled: !!scope.companyId,
    retry: false,
  });

  const vehiclesQuery = useQuery({
    queryKey: [...scope.key, "vehicles", "schedule-picker"],
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
    enabled: open && !!scope.companyId,
  });

  const vehicles = (vehiclesQuery.data?.items ?? []) as Vehicle[];

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!vehicleId || !serviceName.trim()) {
      setError("Select a vehicle and enter a service name.");
      return;
    }
    const kmVal = intervalKm.trim() ? Number(intervalKm.trim()) : null;
    const daysVal = intervalDays.trim() ? Number(intervalDays.trim()) : null;
    if (!kmVal && !daysVal) {
      setError("Specify an interval in kilometres, days, or both.");
      return;
    }
    const chosen = vehicles.find((v) => String(v.id) === vehicleId);
    setBusy(true);
    try {
      await createMaintenanceSchedule({
        company_id: Number(scope.companyId),
        branch_id: chosen?.branch_id ?? (branchId ? Number(branchId) : 2),
        vehicle_id: Number(vehicleId),
        service_name: serviceName.trim(),
        interval_km: kmVal,
        interval_days: daysVal,
        last_service_odometer: chosen?.odometer ?? 0,
      });
      setServiceName("");
      setVehicleId("");
      setOpen(false);
      await client.invalidateQueries({
        queryKey: [...scope.key, "maintenance-schedules"],
      });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleOpenWorkOrder(s: MaintenanceSchedule) {
    setBusy(true);
    setError(null);
    try {
      await createWorkOrder(
        {
          company_id: s.company_id,
          branch_id: s.branch_id,
          vehicle_id: s.vehicle_id,
          title: `Preventive: ${s.service_name}`,
          due_at: s.next_due_at ?? new Date().toISOString().slice(0, 10),
          notes: `Opened from preventive schedule #${s.id}.`,
          labour_cost_minor: 0,
        },
        new AbortController().signal,
      );
      await client.invalidateQueries({
        queryKey: [...scope.key, "work-orders"],
      });
      onWorkOrderOpened?.(
        `Opened preventive work order for ${s.vehicle_registration ?? `Vehicle #${s.vehicle_id}`}: ${s.service_name}.`,
      );
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  if (query.data && !query.data.supported) {
    return (
      <StatePanel title="Preventive schedules endpoint not yet deployed">
        Preventive maintenance schedules require backend PR #16
        (/api/v1/maintenance-schedules).
      </StatePanel>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="w-48">
          <DriveCoreSelect
            ariaLabel="Filter schedules by status"
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={[
              { value: "", label: "All statuses" },
              { value: "overdue", label: "Overdue" },
              { value: "due_soon", label: "Due soon" },
              { value: "ok", label: "OK" },
            ]}
          />
        </div>
        {canManage ? (
          <Button type="button" size="sm" onClick={() => setOpen(true)} className="gap-1.5">
            <Plus className="size-3.5" aria-hidden="true" />
            New schedule
          </Button>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-xs text-danger-foreground">
          {error}
        </p>
      ) : null}

      <DataTableFrame ariaLabel="Preventive maintenance schedules">
        {query.isPending ? (
          <DataTableSkeleton columns={6} label="Loading preventive schedules" />
        ) : query.error || !query.data ? (
          <div className="p-card">
            <StatePanel title="Preventive schedules unavailable">
              {errorText(query.error)}
            </StatePanel>
          </div>
        ) : query.data.items.length === 0 ? (
          <div className="p-card">
            <StatePanel title="No preventive schedules yet">
              Add mileage or calendar-day service intervals to track upcoming
              maintenance automatically.
            </StatePanel>
          </div>
        ) : (
          <DataTable>
            <DataTableHead>
              <tr>
                <DataTableHeaderCell>Vehicle</DataTableHeaderCell>
                <DataTableHeaderCell>Service</DataTableHeaderCell>
                <DataTableHeaderCell align="right">Interval</DataTableHeaderCell>
                <DataTableHeaderCell align="right">Next due</DataTableHeaderCell>
                <DataTableHeaderCell>Status</DataTableHeaderCell>
                <DataTableHeaderCell align="right">Action</DataTableHeaderCell>
              </tr>
            </DataTableHead>
            <DataTableBody>
              {query.data.items.map((s) => (
                <DataTableRow key={s.id}>
                  <DataTableCell>
                    <PlateTag>{s.vehicle_registration ?? `#${s.vehicle_id}`}</PlateTag>
                  </DataTableCell>
                  <DataTableCell className="font-medium">
                    {s.service_name}
                  </DataTableCell>
                  <DataTableCell align="right" numeric className="text-muted-foreground">
                    {[
                      s.interval_km
                        ? formatDistance(s.interval_km, units.distance)
                        : null,
                      s.interval_days ? `${s.interval_days}d` : null,
                    ]
                      .filter(Boolean)
                      .join(" / ")}
                  </DataTableCell>
                  <DataTableCell align="right" numeric>
                    {[
                      s.next_due_odometer !== null
                        ? formatDistance(s.next_due_odometer, units.distance)
                        : null,
                      s.next_due_at,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </DataTableCell>
                  <DataTableCell>
                    <StatusDotBadge tone={STATUS_TONE[s.status]}>
                      {s.status.replace("_", " ")}
                    </StatusDotBadge>
                  </DataTableCell>
                  <DataTableCell align="right">
                    {canManage ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void handleOpenWorkOrder(s)}
                        className="h-7 gap-1 px-2 text-xs"
                      >
                        <Wrench className="size-3" aria-hidden="true" />
                        Open Work Order
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md rounded-2xl p-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="size-4 text-link" aria-hidden="true" />
              New preventive schedule
            </DialogTitle>
            <DialogDescription>
              Track recurring vehicle service by odometer distance and/or days.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => void handleCreate(e)} className="space-y-4">
            <div className="space-y-1">
              <span className="block text-xs font-medium">Vehicle</span>
              <DriveCoreSelect
                ariaLabel="Schedule vehicle"
                value={vehicleId}
                onValueChange={setVehicleId}
                options={[
                  { value: "", label: "Select vehicle…" },
                  ...vehicles.map((v) => ({
                    value: String(v.id),
                    label: `${v.registration} — ${v.make} ${v.model}`,
                  })),
                ]}
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="pm-name" className="text-xs font-medium">
                Service name
              </label>
              <Input
                id="pm-name"
                placeholder="e.g. 10,000 km Oil & Filter Service"
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                disabled={busy}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="pm-km" className="text-xs font-medium">
                  Interval (km)
                </label>
                <Input
                  id="pm-km"
                  inputMode="numeric"
                  value={intervalKm}
                  onChange={(e) => setIntervalKm(e.target.value)}
                  disabled={busy}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="pm-days" className="text-xs font-medium">
                  Interval (days)
                </label>
                <Input
                  id="pm-days"
                  inputMode="numeric"
                  value={intervalDays}
                  onChange={(e) => setIntervalDays(e.target.value)}
                  disabled={busy}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save schedule"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
