"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardCheck, Fuel, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { allowed } from "@/lib/demo/permissions";
import { day, invoiceBalance } from "@/lib/demo/rules";
import { money, rows } from "@/lib/demo/selectors";
import type { Database, DemoContext } from "@/lib/demo/types";
import { projectFuelTelemetry } from "./projections";
import { useDemo } from "./provider";
import { selectClass } from "./form";
import { Status } from "./table";

const DAMAGE_ZONES = [
  { id: "front_bumper", label: "Front Bumper", fee: 45000 },
  { id: "rear_bumper", label: "Rear Bumper", fee: 35000 },
  { id: "left_doors", label: "Left Doors", fee: 60000 },
  { id: "right_doors", label: "Right Doors", fee: 60000 },
  { id: "windscreen", label: "Windscreen", fee: 75000 },
  { id: "alloys", label: "Alloys / Tyres", fee: 25000 },
] as const;

export function InspectionStudio({
  db,
  ctx,
}: {
  db: Database;
  ctx: DemoContext;
}) {
  const { execute, now } = useDemo();
  const rentals = rows(db, ctx, "rental").filter((r) =>
    ["draft", "active"].includes(r.status),
  );
  const [selectedRentalId, setSelectedRentalId] = useState(rentals[0]?.id ?? "");
  const rental =
    rentals.find((r) => r.id === selectedRentalId) ?? rentals[0] ?? null;

  const vehicle = rental
    ? db.entities.find((e) => e.kind === "vehicle" && e.id === rental.vehicleId)
    : undefined;
  const customer = rental
    ? db.entities.find((e) => e.kind === "customer" && e.id === rental.customerId)
    : undefined;
  const handoverInspection = rental
    ? db.entities.find(
        (e) =>
          e.kind === "inspection" &&
          e.rentalId === rental.id &&
          e.stage === "handover",
      )
    : undefined;
  const linkedInvoice = rental
    ? db.entities.find((e) => e.kind === "invoice" && e.rentalId === rental.id)
    : undefined;

  const baseOdo =
    rental?.handoverOdometer || (vehicle && "odometer" in vehicle ? vehicle.odometer : 15000);
  const [returnOdometer, setReturnOdometer] = useState<string>("");
  const [fuelLevel, setFuelLevel] = useState<number>(85);
  const [selectedZones, setSelectedZones] = useState<string[]>([]);
  const [returnedCondition, setReturnedCondition] = useState<"available" | "maintenance" | "damaged">("available");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const canWriteOperations = allowed(db, ctx, "operations", true);
  const effectiveOdometer = returnOdometer || String(baseOdo + 120);

  const damageTotalMinor = selectedZones.reduce((sum, id) => {
    const zone = DAMAGE_ZONES.find((z) => z.id === id);
    return sum + (zone?.fee ?? 0);
  }, 0);
  const fuelShortfallMinor = fuelLevel < 80 ? (80 - fuelLevel) * 150 : 0;
  const lateDays =
    rental && rental.status === "active" && now > Date.parse(rental.endsAt)
      ? Math.ceil((now - Date.parse(rental.endsAt)) / day)
      : 0;
  const lateChargeMinor = rental ? lateDays * rental.dailyRate : 0;
  const additionalChargeMinor = damageTotalMinor + fuelShortfallMinor;
  const invoiceOutstandingMinor = linkedInvoice
    ? invoiceBalance(db, linkedInvoice.id).outstanding
    : rental?.total ?? 0;
  const reconciledTotalMinor =
    (rental?.total ?? 0) + lateChargeMinor + additionalChargeMinor;

  const fuelRows = projectFuelTelemetry(db, ctx);

  function toggleZone(id: string) {
    setSelectedZones((prev) => {
      const next = prev.includes(id)
        ? prev.filter((item) => item !== id)
        : [...prev, id];
      if (next.length > 0 && returnedCondition === "available") {
        setReturnedCondition("damaged");
      } else if (next.length === 0 && returnedCondition === "damaged") {
        setReturnedCondition("available");
      }
      return next;
    });
  }

  async function commitAction() {
    if (!rental) return;
    setBusy(true);
    setError("");
    try {
      const damageSummary = selectedZones
        .map((id) => DAMAGE_ZONES.find((z) => z.id === id)?.label)
        .filter(Boolean)
        .join(", ");
      const fullNotes = [
        notes.trim() || "Inspected via Handover / Return Studio.",
        `Fuel: ${fuelLevel}%`,
        damageSummary ? `Zones flagged: ${damageSummary}` : "No exterior damage flagged",
      ].join(" · ");

      if (rental.status === "draft") {
        await execute(ctx, {
          type: "action",
          id: rental.id,
          action: "handover",
          values: {
            odometer: effectiveOdometer,
            condition: "Checked",
            notes: fullNotes,
          },
        });
      } else {
        await execute(ctx, {
          type: "action",
          id: rental.id,
          action: "return",
          values: {
            odometer: effectiveOdometer,
            condition: returnedCondition,
            notes: fullNotes,
            additionalCharge: (additionalChargeMinor / 100).toFixed(2),
          },
        });
      }
      setNotes("");
      setSelectedZones([]);
      setReturnOdometer("");
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Could not record inspection.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="dc-shadow-card rounded-3xl border bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-primary">
              Handover & Return Reconciliation Studio
            </p>
            <h2 className="text-section-heading font-extrabold">
              Outbound Baseline vs. Inbound Inspection
            </h2>
          </div>

          <label className="w-full max-w-sm space-y-1 text-xs font-semibold text-muted-foreground">
            Active / Ready Rental Contract
            <select
              className={`${selectClass} rounded-xl`}
              value={rental?.id ?? ""}
              onChange={(e) => {
                setSelectedRentalId(e.target.value);
                setReturnOdometer("");
                setError("");
              }}
            >
              {!rentals.length ? (
                <option value="">No draft or active rentals in scope</option>
              ) : (
                rentals.map((r) => {
                  const v = db.entities.find((e) => e.id === r.vehicleId);
                  return (
                    <option key={r.id} value={r.id}>
                      {v && "registration" in v ? v.registration : r.vehicleId} ·{" "}
                      {r.status.toUpperCase()}
                    </option>
                  );
                })
              )}
            </select>
          </label>
        </div>

        {!rental ? (
          <p className="mt-4 rounded-2xl border bg-muted/40 p-5 text-sm text-muted-foreground">
            All contracts in this branch scope are completed or awaiting confirmation.
            Confirm a reservation in Rentals to perform a digital handover or return.
          </p>
        ) : (
          <div className="mt-5 grid gap-5 lg:grid-cols-12">
            {/* Left 7 Cols: Baseline & Interactive Inspection Form */}
            <div className="space-y-4 lg:col-span-7">
              <div className="rounded-2xl border bg-muted/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ClipboardCheck className="size-4 text-primary" aria-hidden="true" />
                    <h3 className="text-sm font-bold">Outbound Handover Baseline</h3>
                  </div>
                  <Status value={rental.status} />
                </div>
                <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-3">
                  <div>
                    <dt className="text-muted-foreground">Vehicle</dt>
                    <dd className="font-mono font-bold">
                      {vehicle && "registration" in vehicle
                        ? `${vehicle.registration} (${vehicle.make})`
                        : rental.vehicleId}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Customer</dt>
                    <dd className="font-semibold">
                      {customer && "name" in customer ? customer.name : rental.customerId}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Baseline Odometer</dt>
                    <dd className="font-mono font-bold tabular-nums">
                      {baseOdo.toLocaleString()} km
                    </dd>
                  </div>
                </dl>
                {handoverInspection && "notes" in handoverInspection ? (
                  <p className="mt-2.5 border-t pt-2 text-xs text-muted-foreground">
                    Signed baseline: {handoverInspection.notes}
                  </p>
                ) : null}
              </div>

              <div className="space-y-4 rounded-2xl border-2 border-primary/20 bg-background/40 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-extrabold">
                    {rental.status === "draft"
                      ? "Outbound Handover Check"
                      : "Inbound Return Check & Damage Assessment"}
                  </h3>
                  <span className="font-mono text-xs font-semibold text-link">
                    Min {baseOdo.toLocaleString()} km
                  </span>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-1.5 text-xs font-semibold">
                    Inspection Odometer (km)
                    <input
                      type="number"
                      min={baseOdo}
                      value={effectiveOdometer}
                      onChange={(e) => setReturnOdometer(e.target.value)}
                      className="h-10 w-full rounded-xl border border-input bg-surface px-3 font-mono text-sm font-bold"
                    />
                  </label>

                  {rental.status === "active" ? (
                    <label className="space-y-1.5 text-xs font-semibold">
                      Returned Vehicle Condition
                      <select
                        value={returnedCondition}
                        onChange={(e) =>
                          setReturnedCondition(
                            e.target.value as "available" | "maintenance" | "damaged",
                          )
                        }
                        className={`${selectClass} rounded-xl`}
                      >
                        <option value="available">Available (Ready for Rent)</option>
                        <option value="maintenance">Maintenance Required</option>
                        <option value="damaged">Damaged (Hold Unit)</option>
                      </select>
                    </label>
                  ) : null}
                </div>

                <label className="block space-y-1.5 text-xs font-semibold">
                  <div className="flex items-center justify-between">
                    <span>Fuel / Charge Gauge Reading</span>
                    <span className="font-mono text-sm font-bold text-primary tabular-nums">
                      {fuelLevel}% {fuelLevel < 80 ? "(Shortfall fee applies)" : "(Full)"}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={fuelLevel}
                    onChange={(e) => setFuelLevel(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </label>

                {rental.status === "active" ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold">
                      Exterior Damage Zones (tap to include assessment charge)
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {DAMAGE_ZONES.map((zone) => {
                        const checked = selectedZones.includes(zone.id);
                        return (
                          <button
                            key={zone.id}
                            type="button"
                            onClick={() => toggleZone(zone.id)}
                            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
                              checked
                                ? "border-primary bg-primary text-primary-foreground"
                                : "bg-surface text-foreground hover:bg-muted"
                            }`}
                          >
                            {checked ? (
                              <AlertTriangle className="size-3.5" aria-hidden="true" />
                            ) : null}
                            <span>{zone.label}</span>
                            <span className="font-mono text-[10px] opacity-80">
                              +{money(db, ctx.companyId, zone.fee)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <label className="block space-y-1.5 text-xs font-semibold">
                  Inspector Notes
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Exterior condition, keys, spare tyre, documents..."
                    className="h-10 w-full rounded-xl border border-input bg-surface px-3 text-sm font-normal"
                  />
                </label>

                {error ? (
                  <p role="alert" className="text-sm font-medium text-danger-foreground">
                    {error}
                  </p>
                ) : null}
              </div>
            </div>

            {/* Right 5 Cols: Dark Charcoal Auto-Reconciliation Summary */}
            <aside className="flex flex-col justify-between rounded-2xl bg-structural p-5 text-structural-foreground lg:col-span-5">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/15 pb-3">
                  <div>
                    <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-primary">
                      Auto-Reconciliation
                    </p>
                    <h3 className="text-base font-extrabold">
                      Contract Settlement Summary
                    </h3>
                  </div>
                  <CheckCircle2 className="size-5 text-success" aria-hidden="true" />
                </div>

                <dl className="space-y-2.5 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-white/75">Base Contract Total</dt>
                    <dd className="font-mono font-bold tabular-nums">
                      {money(db, ctx.companyId, rental.total)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-white/75">
                      Late Return Extension ({lateDays}d)
                    </dt>
                    <dd className="font-mono font-bold tabular-nums">
                      {money(db, ctx.companyId, lateChargeMinor)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-white/75">Fuel Shortfall Charge</dt>
                    <dd className="font-mono font-bold tabular-nums">
                      {money(db, ctx.companyId, fuelShortfallMinor)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-white/75">Damage Zones Assessed</dt>
                    <dd className="font-mono font-bold tabular-nums">
                      {money(db, ctx.companyId, damageTotalMinor)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between border-t border-white/15 pt-3 text-base">
                    <dt className="font-bold">Reconciled Contract Value</dt>
                    <dd className="font-mono text-lg font-extrabold text-primary tabular-nums">
                      {money(db, ctx.companyId, reconciledTotalMinor)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between text-xs text-white/70">
                    <dt>Linked Invoice Outstanding</dt>
                    <dd className="font-mono font-semibold tabular-nums">
                      {money(db, ctx.companyId, invoiceOutstandingMinor)}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="mt-6 space-y-2.5">
                {canWriteOperations ? (
                  <Button
                    disabled={busy}
                    onClick={() => {
                      void commitAction();
                    }}
                    className="h-11 w-full rounded-xl font-bold"
                  >
                    {busy
                      ? "Recording in IndexedDB…"
                      : rental.status === "draft"
                        ? "Commit Outbound Handover"
                        : "Commit Return & Reconcile Invoice"}
                  </Button>
                ) : (
                  <p className="rounded-xl bg-white/10 p-3 text-xs text-white/80">
                    Read-only role: switch to Operations or Admin to commit inspections.
                  </p>
                )}
                <p className="text-[11px] text-white/65">
                  Updates rental status, vehicle odometer/condition, inspection
                  evidence, invoice draft, and immutable audit trail atomically.
                </p>
              </div>
            </aside>
          </div>
        )}
      </section>

      {/* Fuel & GPS Efficiency Panel */}
      <section className="dc-shadow-card rounded-3xl border bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Fuel className="size-4" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-section-heading font-extrabold">
                Fuel & GPS Telemetry Efficiency
              </h2>
              <p className="text-xs text-muted-foreground">
                Fleet consumption benchmarks and anomaly flags derived from odometer
                and workshop history
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {fuelRows.slice(0, 8).map((row) => (
            <article
              key={row.vehicle.id}
              className="flex flex-col justify-between gap-2 rounded-2xl border bg-background/60 p-3.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-md bg-structural px-2 py-0.5 font-mono text-xs font-bold text-structural-foreground">
                  {row.registration}
                </span>
                <span className="font-mono text-xs font-bold text-foreground tabular-nums">
                  {row.efficiencyKmPerL} km/L
                </span>
              </div>
              <p className="text-xs font-medium text-muted-foreground">
                {row.vehicle.make} {row.vehicle.model} · {row.fuelType}
              </p>
              <div className="flex items-center justify-between border-t pt-2 text-xs">
                <span className="font-mono text-muted-foreground tabular-nums">
                  {row.odometer.toLocaleString()} km
                </span>
                {row.anomaly ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-warning-foreground">
                    <ShieldAlert className="size-3.5" aria-hidden="true" />
                    Alert
                  </span>
                ) : (
                  <span className="font-semibold text-success-foreground">
                    Nominal
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
