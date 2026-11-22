"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BatteryCharging, Plus, RefreshCw } from "lucide-react";
import { useLiveContext } from "@/features/live/context";
import { listRecords } from "@/features/records/service";
import {
  createVehicleComponent,
  listVehicleComponents,
  updateVehicleComponent,
  useUnitPreferences,
} from "@/features/operations-srs/service";
import { errorText } from "@/lib/api/client";
import {
  componentPositions,
  type ComponentPosition,
  type Vehicle,
  type VehicleComponent,
} from "@/lib/api/contracts";
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

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function TyresBatteriesPanel({ canManage }: { canManage: boolean }) {
  const scope = useLiveContext();
  const client = useQueryClient();
  const units = useUnitPreferences(scope.companyId);
  const branchId = scope.branch !== "all" ? scope.branch : undefined;

  const [typeFilter, setTypeFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [vehicleId, setVehicleId] = useState("");
  const [compType, setCompType] = useState<"tyre" | "battery">("tyre");
  const [position, setPosition] = useState<ComponentPosition>("FL");
  const [serialNumber, setSerialNumber] = useState("");
  const [brandModel, setBrandModel] = useState("");
  const [installedAt, setInstalledAt] = useState(todayIso);
  const [warrantyDate, setWarrantyDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: [...scope.key, "vehicle-components", branchId ?? "all", typeFilter],
    queryFn: ({ signal }) =>
      listVehicleComponents(
        {
          companyId: scope.companyId,
          branchId,
          componentType: typeFilter || undefined,
        },
        signal,
      ),
    enabled: !!scope.companyId,
    retry: false,
  });

  const vehiclesQuery = useQuery({
    queryKey: [...scope.key, "vehicles", "component-picker"],
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
    if (!vehicleId || !serialNumber.trim() || !brandModel.trim()) {
      setError("Select a vehicle and enter serial number and brand/model.");
      return;
    }
    const chosen = vehicles.find((v) => String(v.id) === vehicleId);
    setBusy(true);
    try {
      await createVehicleComponent({
        company_id: Number(scope.companyId),
        branch_id: chosen?.branch_id ?? (branchId ? Number(branchId) : 2),
        vehicle_id: Number(vehicleId),
        component_type: compType,
        position: compType === "battery" ? "BATTERY" : position,
        serial_number: serialNumber.trim(),
        brand_model: brandModel.trim(),
        installed_at: installedAt,
        installed_odometer: chosen?.odometer ?? 0,
        warranty_expires_at: warrantyDate || null,
      });
      setSerialNumber("");
      setBrandModel("");
      setWarrantyDate("");
      setOpen(false);
      await client.invalidateQueries({
        queryKey: [...scope.key, "vehicle-components"],
      });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleMarkReplaced(item: VehicleComponent) {
    setBusy(true);
    try {
      await updateVehicleComponent(item.id, {
        status: "replaced",
        replaced_at: todayIso(),
      });
      await client.invalidateQueries({
        queryKey: [...scope.key, "vehicle-components"],
      });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  if (query.data && !query.data.supported) {
    return (
      <StatePanel title="Tyres & batteries endpoint not yet deployed">
        Tyre &amp; battery serial tracking requires backend PR #16
        (/api/v1/vehicle-components).
      </StatePanel>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="w-48">
          <DriveCoreSelect
            ariaLabel="Filter components by type"
            value={typeFilter}
            onValueChange={setTypeFilter}
            options={[
              { value: "", label: "All components" },
              { value: "tyre", label: "Tyres" },
              { value: "battery", label: "Batteries" },
            ]}
          />
        </div>
        {canManage ? (
          <Button type="button" size="sm" onClick={() => setOpen(true)} className="gap-1.5">
            <Plus className="size-3.5" aria-hidden="true" />
            Log tyre / battery
          </Button>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-xs text-danger-foreground">
          {error}
        </p>
      ) : null}

      <DataTableFrame ariaLabel="Tyres and batteries">
        {query.isPending ? (
          <DataTableSkeleton columns={7} label="Loading tyres and batteries" />
        ) : query.error || !query.data ? (
          <div className="p-card">
            <StatePanel title="Tyres & batteries unavailable">
              {errorText(query.error)}
            </StatePanel>
          </div>
        ) : query.data.items.length === 0 ? (
          <div className="p-card">
            <StatePanel title="No tyre or battery records yet">
              Log tyre serials by wheel position (FL/FR/RL/RR/SPARE) and battery
              warranties to track replacement history.
            </StatePanel>
          </div>
        ) : (
          <DataTable>
            <DataTableHead>
              <tr>
                <DataTableHeaderCell>Vehicle</DataTableHeaderCell>
                <DataTableHeaderCell>Type &amp; Pos</DataTableHeaderCell>
                <DataTableHeaderCell>Serial #</DataTableHeaderCell>
                <DataTableHeaderCell>Brand / Model</DataTableHeaderCell>
                <DataTableHeaderCell>Installed</DataTableHeaderCell>
                <DataTableHeaderCell>Status</DataTableHeaderCell>
                <DataTableHeaderCell align="right">Action</DataTableHeaderCell>
              </tr>
            </DataTableHead>
            <DataTableBody>
              {query.data.items.map((c) => (
                <DataTableRow key={c.id}>
                  <DataTableCell>
                    <PlateTag>{c.vehicle_registration ?? `#${c.vehicle_id}`}</PlateTag>
                  </DataTableCell>
                  <DataTableCell className="capitalize">
                    {c.component_type} ·{" "}
                    <span className="font-mono text-xs font-semibold">
                      {c.position}
                    </span>
                  </DataTableCell>
                  <DataTableCell className="font-mono text-xs font-semibold">
                    {c.serial_number}
                  </DataTableCell>
                  <DataTableCell>{c.brand_model}</DataTableCell>
                  <DataTableCell className="text-xs text-muted-foreground">
                    {c.installed_at} ·{" "}
                    {formatDistance(c.installed_odometer, units.distance)}
                  </DataTableCell>
                  <DataTableCell>
                    <StatusDotBadge
                      tone={c.status === "active" ? "success" : "neutral"}
                    >
                      {c.status}
                    </StatusDotBadge>
                  </DataTableCell>
                  <DataTableCell align="right">
                    {canManage && c.status === "active" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void handleMarkReplaced(c)}
                        className="h-7 gap-1 px-2 text-xs"
                      >
                        <RefreshCw className="size-3" aria-hidden="true" />
                        Mark replaced
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
              <BatteryCharging className="size-4 text-link" aria-hidden="true" />
              Log tyre or battery
            </DialogTitle>
            <DialogDescription>
              Record serial number, wheel/battery position, and warranty expiry.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => void handleCreate(e)} className="space-y-4">
            <div className="space-y-1">
              <span className="block text-xs font-medium">Vehicle</span>
              <DriveCoreSelect
                ariaLabel="Component vehicle"
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

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <span className="block text-xs font-medium">Type</span>
                <DriveCoreSelect
                  ariaLabel="Component type"
                  value={compType}
                  onValueChange={(v) => {
                    const next = v as "tyre" | "battery";
                    setCompType(next);
                    setPosition(next === "battery" ? "BATTERY" : "FL");
                  }}
                  options={[
                    { value: "tyre", label: "Tyre" },
                    { value: "battery", label: "Battery" },
                  ]}
                />
              </div>
              <div className="space-y-1">
                <span className="block text-xs font-medium">Position</span>
                <DriveCoreSelect
                  ariaLabel="Component position"
                  value={position}
                  onValueChange={(v) => setPosition(v as ComponentPosition)}
                  options={componentPositions.map((p) => ({
                    value: p,
                    label: p,
                  }))}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="comp-serial" className="text-xs font-medium">
                  Serial number
                </label>
                <Input
                  id="comp-serial"
                  placeholder="e.g. TYR-FL-2026-01"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  disabled={busy}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="comp-brand" className="text-xs font-medium">
                  Brand &amp; model
                </label>
                <Input
                  id="comp-brand"
                  placeholder="e.g. Bridgestone Dueler 265/65R17"
                  value={brandModel}
                  onChange={(e) => setBrandModel(e.target.value)}
                  disabled={busy}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="comp-installed" className="text-xs font-medium">
                  Installed date
                </label>
                <DriveCoreDateField
                  id="comp-installed"
                  label="Installed date"
                  value={installedAt}
                  onChange={setInstalledAt}
                  disabled={busy}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="comp-warranty" className="text-xs font-medium">
                  Warranty expires (optional)
                </label>
                <DriveCoreDateField
                  id="comp-warranty"
                  label="Warranty expires"
                  value={warrantyDate}
                  onChange={setWarrantyDate}
                  optional
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
                {busy ? "Saving…" : "Save component"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
