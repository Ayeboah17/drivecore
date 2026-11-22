"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Download, Fuel, Plus } from "lucide-react";
import { useSession } from "@/features/auth/session-provider";
import { useLiveContext } from "@/features/live/context";
import { listRecords } from "@/features/records/service";
import {
  createFuelTransaction,
  listFuelTransactions,
  useUnitPreferences,
} from "@/features/operations-srs/service";
import { errorText } from "@/lib/api/client";
import {
  can,
  formatMoneyMinor,
  parseMajorToMinor,
  type Vehicle,
} from "@/lib/api/contracts";
import { downloadCsv } from "@/lib/csv";
import {
  formatCostPerDistance,
  formatDistance,
  formatFuelEfficiency,
  formatVolume,
} from "@/lib/units";
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
import {
  DriveCoreDateField,
  DriveCoreDateRangePicker,
} from "@/components/ui/drivecore-calendar";
import { DriveCoreSelect } from "@/components/ui/drivecore-select";
import { Input } from "@/components/ui/input";

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function FuelLogPanel({ canManage }: { canManage: boolean }) {
  const { user } = useSession();
  const scope = useLiveContext();
  const client = useQueryClient();
  const units = useUnitPreferences(scope.companyId);
  const canFinance = !!user && can(user, "expenses.view");
  const currency = scope.company?.currency || "ZMW";
  const branchId = scope.branch !== "all" ? scope.branch : undefined;

  const [range, setRange] = useState<{ from: string; to: string }>({
    from: "",
    to: "",
  });
  const [abnormalOnly, setAbnormalOnly] = useState(false);
  const [open, setOpen] = useState(false);
  const [vehicleId, setVehicleId] = useState("");
  const [fuelDate, setFuelDate] = useState(todayIso);
  const [station, setStation] = useState("");
  const [litresText, setLitresText] = useState("");
  const [amountText, setAmountText] = useState("");
  const [odometerText, setOdometerText] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: [
      ...scope.key,
      "fuel-transactions",
      branchId ?? "all",
      range.from,
      range.to,
      abnormalOnly,
    ],
    queryFn: ({ signal }) =>
      listFuelTransactions(
        {
          companyId: scope.companyId,
          branchId,
          abnormalOnly: abnormalOnly || undefined,
          from: range.from || undefined,
          to: range.to || undefined,
        },
        signal,
      ),
    enabled: !!scope.companyId,
    retry: false,
  });

  const vehiclesQuery = useQuery({
    queryKey: [...scope.key, "vehicles", "fuel-picker"],
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
    const litres = Number(litresText.trim());
    const amountMinor = parseMajorToMinor(amountText.trim());
    const odometer = Number(odometerText.trim());
    if (
      !vehicleId ||
      !Number.isFinite(litres) ||
      litres <= 0 ||
      amountMinor === null ||
      amountMinor <= 0 ||
      !Number.isInteger(odometer) ||
      odometer < 0
    ) {
      setError("Select a vehicle and enter valid positive litres, amount, and odometer.");
      return;
    }
    const chosen = vehicles.find((v) => String(v.id) === vehicleId);
    setBusy(true);
    try {
      await createFuelTransaction({
        company_id: Number(scope.companyId),
        branch_id: chosen?.branch_id ?? (branchId ? Number(branchId) : 2),
        vehicle_id: Number(vehicleId),
        fuel_date: fuelDate,
        station: station.trim() || null,
        litres,
        amount_minor: amountMinor,
        odometer,
        payment_method: paymentMethod,
      });
      setStation("");
      setLitresText("");
      setAmountText("");
      setOdometerText("");
      setOpen(false);
      await client.invalidateQueries({
        queryKey: [...scope.key, "fuel-transactions"],
      });
      await client.invalidateQueries({ queryKey: [...scope.key, "expenses"] });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  if (query.data && !query.data.supported) {
    return (
      <StatePanel title="Fuel log endpoint not yet deployed">
        Fuel management requires backend PR #16 (/api/v1/fuel-transactions).
      </StatePanel>
    );
  }

  const items = query.data?.items ?? [];
  const totalLitres = items.reduce((s, r) => s + r.litres, 0);
  const totalAmount = items.reduce((s, r) => s + r.amount_minor, 0);
  const abnormalCount = items.filter((r) => r.is_abnormal).length;
  const effSamples = items.filter(
    (r) => r.litres_per_100km !== null && r.litres_per_100km > 0,
  );
  const avgL100 =
    effSamples.length > 0
      ? effSamples.reduce((s, r) => s + (r.litres_per_100km ?? 0), 0) /
        effSamples.length
      : null;

  function handleExportCsv() {
    downloadCsv(
      `drivecore-fuel-log-co${scope.companyId}.csv`,
      [
        "Date",
        "Vehicle",
        "Station",
        "Volume",
        "Odometer",
        "Efficiency",
        "Cost/dist",
        "Abnormal",
        ...(canFinance ? ["Amount"] : []),
      ],
      items.map((r) => [
        r.fuel_date,
        r.vehicle_registration ?? `#${r.vehicle_id}`,
        r.station ?? "",
        formatVolume(r.litres, units.volume),
        formatDistance(r.odometer, units.distance),
        formatFuelEfficiency(r.litres_per_100km, units.fuelEfficiency),
        formatCostPerDistance(r.cost_per_km_minor, currency, units.distance),
        r.is_abnormal ? "Yes" : "No",
        ...(canFinance ? [(r.amount_minor / 100).toFixed(2)] : []),
      ]),
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="dc-shadow-card rounded-2xl border bg-surface p-3.5">
          <p className="text-xs text-muted-foreground">Total fuel volume</p>
          <p className="mt-1 font-mono text-xl font-extrabold tabular-nums">
            {formatVolume(totalLitres, units.volume)}
          </p>
        </div>
        <div className="dc-shadow-card rounded-2xl border bg-surface p-3.5">
          <p className="text-xs text-muted-foreground">Avg efficiency</p>
          <p className="mt-1 font-mono text-xl font-extrabold tabular-nums">
            {formatFuelEfficiency(avgL100, units.fuelEfficiency)}
          </p>
        </div>
        <div className="dc-shadow-card rounded-2xl border bg-surface p-3.5">
          <p className="text-xs text-muted-foreground">Abnormal alerts</p>
          <p className="mt-1 font-mono text-xl font-extrabold tabular-nums text-amber-700 dark:text-amber-400">
            {abnormalCount}
          </p>
        </div>
        {canFinance ? (
          <div className="dc-shadow-card rounded-2xl border bg-surface p-3.5">
            <p className="text-xs text-muted-foreground">Total fuel spend</p>
            <p className="mt-1 font-mono text-xl font-extrabold tabular-nums">
              {formatMoneyMinor(totalAmount, currency)}
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <DriveCoreDateRangePicker
            from={range.from}
            to={range.to}
            onChange={setRange}
          />
          <Button
            type="button"
            size="sm"
            variant={abnormalOnly ? "default" : "outline"}
            onClick={() => setAbnormalOnly((v) => !v)}
            className="gap-1.5 rounded-xl text-xs"
          >
            <AlertTriangle className="size-3.5" aria-hidden="true" />
            Abnormal only
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleExportCsv}
            className="gap-1.5"
          >
            <Download className="size-3.5" aria-hidden="true" />
            Export CSV
          </Button>
          {canManage ? (
            <Button
              type="button"
              size="sm"
              onClick={() => setOpen(true)}
              className="gap-1.5"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              Log fuel
            </Button>
          ) : null}
        </div>
      </div>

      <DataTableFrame ariaLabel="Fuel transactions">
        {query.isPending ? (
          <DataTableSkeleton columns={7} label="Loading fuel log" />
        ) : query.error || !query.data ? (
          <div className="p-card">
            <StatePanel title="Fuel log unavailable">
              {errorText(query.error)}
            </StatePanel>
          </div>
        ) : items.length === 0 ? (
          <div className="p-card">
            <StatePanel title="No fuel transactions yet">
              Log fuel fills to track consumption efficiency (
              {units.fuelEfficiency === "l_per_100km"
                ? "L/100km"
                : units.fuelEfficiency}
              ), abnormal usage alerts, and automatic fuel expenses.
            </StatePanel>
          </div>
        ) : (
          <DataTable>
            <DataTableHead>
              <tr>
                <DataTableHeaderCell>Date</DataTableHeaderCell>
                <DataTableHeaderCell>Vehicle</DataTableHeaderCell>
                <DataTableHeaderCell>Station</DataTableHeaderCell>
                <DataTableHeaderCell align="right">Volume</DataTableHeaderCell>
                <DataTableHeaderCell align="right">Odometer</DataTableHeaderCell>
                <DataTableHeaderCell align="right">Efficiency</DataTableHeaderCell>
                <DataTableHeaderCell align="right">Cost/dist</DataTableHeaderCell>
                {canFinance ? (
                  <DataTableHeaderCell align="right">Amount</DataTableHeaderCell>
                ) : null}
                <DataTableHeaderCell>Status</DataTableHeaderCell>
              </tr>
            </DataTableHead>
            <DataTableBody>
              {items.map((r) => (
                <DataTableRow key={r.id}>
                  <DataTableCell className="font-mono text-xs">
                    {r.fuel_date}
                  </DataTableCell>
                  <DataTableCell>
                    <PlateTag>{r.vehicle_registration ?? `#${r.vehicle_id}`}</PlateTag>
                  </DataTableCell>
                  <DataTableCell className="text-muted-foreground">
                    {r.station || "—"}
                  </DataTableCell>
                  <DataTableCell align="right" numeric>
                    {formatVolume(r.litres, units.volume)}
                  </DataTableCell>
                  <DataTableCell align="right" numeric className="text-muted-foreground">
                    {formatDistance(r.odometer, units.distance)}
                  </DataTableCell>
                  <DataTableCell align="right" numeric className="font-semibold">
                    {formatFuelEfficiency(
                      r.litres_per_100km,
                      units.fuelEfficiency,
                    )}
                  </DataTableCell>
                  <DataTableCell align="right" numeric className="text-muted-foreground">
                    {formatCostPerDistance(
                      r.cost_per_km_minor,
                      currency,
                      units.distance,
                    )}
                  </DataTableCell>
                  {canFinance ? (
                    <DataTableCell align="right" numeric className="font-semibold">
                      {formatMoneyMinor(r.amount_minor, currency)}
                    </DataTableCell>
                  ) : null}
                  <DataTableCell>
                    <StatusDotBadge tone={r.is_abnormal ? "danger" : "success"}>
                      {r.is_abnormal ? "Abnormal" : "Normal"}
                    </StatusDotBadge>
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
              <Fuel className="size-4 text-link" aria-hidden="true" />
              Log fuel transaction
            </DialogTitle>
            <DialogDescription>
              Automatically posts a linked fuel Expense and balanced GL entry.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => void handleCreate(e)} className="space-y-4">
            <div className="space-y-1">
              <span className="block text-xs font-medium">Vehicle</span>
              <DriveCoreSelect
                ariaLabel="Fuel vehicle"
                value={vehicleId}
                onValueChange={(val) => {
                  setVehicleId(val);
                  const found = vehicles.find((v) => String(v.id) === val);
                  if (found && !odometerText)
                    setOdometerText(String(found.odometer));
                }}
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
                <label htmlFor="fuel-date" className="text-xs font-medium">
                  Fuel date
                </label>
                <DriveCoreDateField
                  id="fuel-date"
                  label="Fuel date"
                  value={fuelDate}
                  onChange={setFuelDate}
                  disabled={busy}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="fuel-station" className="text-xs font-medium">
                  Station (optional)
                </label>
                <Input
                  id="fuel-station"
                  placeholder="e.g. TotalEnergies Central"
                  value={station}
                  onChange={(e) => setStation(e.target.value)}
                  disabled={busy}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <label htmlFor="fuel-litres" className="text-xs font-medium">
                  Litres (L)
                </label>
                <Input
                  id="fuel-litres"
                  inputMode="decimal"
                  placeholder="55.0"
                  value={litresText}
                  onChange={(e) => setLitresText(e.target.value)}
                  disabled={busy}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="fuel-amount" className="text-xs font-medium">
                  Amount ({currency})
                </label>
                <Input
                  id="fuel-amount"
                  inputMode="decimal"
                  placeholder="1400.00"
                  value={amountText}
                  onChange={(e) => setAmountText(e.target.value)}
                  disabled={busy}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="fuel-odo" className="text-xs font-medium">
                  Odometer (km)
                </label>
                <Input
                  id="fuel-odo"
                  inputMode="numeric"
                  value={odometerText}
                  onChange={(e) => setOdometerText(e.target.value)}
                  disabled={busy}
                />
              </div>
            </div>

            <div className="space-y-1">
              <span className="block text-xs font-medium">Payment method</span>
              <DriveCoreSelect
                ariaLabel="Fuel payment method"
                value={paymentMethod}
                onValueChange={setPaymentMethod}
                options={[
                  { value: "cash", label: "Cash" },
                  { value: "card", label: "Fuel card / Card" },
                  { value: "mobile_money", label: "Mobile money" },
                  { value: "bank_transfer", label: "Bank transfer" },
                ]}
              />
            </div>

            {error ? (
              <p role="alert" className="text-xs text-danger-foreground">
                {error}
              </p>
            ) : null}

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
                {busy ? "Logging…" : "Save fuel fill"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
