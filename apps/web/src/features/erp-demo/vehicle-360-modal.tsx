"use client";

import { useState } from "react";
import { Calculator, ExternalLink, Fuel, Gauge, Wrench } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Database, DemoContext, Entity } from "@/lib/demo/types";
import { label, money } from "@/lib/demo/selectors";
import { Status } from "./table";
import type { VehicleProjection } from "./projections";

export function Vehicle360Modal({
  projection,
  db,
  ctx,
  onClose,
  onOpenRecord,
}: {
  projection: VehicleProjection | null;
  db: Database;
  ctx: DemoContext;
  onClose: () => void;
  onOpenRecord: (entity: Entity) => void;
}) {
  const [resaleMinor, setResaleMinor] = useState<number>(18500000);
  const [replacementMinor, setReplacementMinor] = useState<number>(36000000);
  const [monthlyRevMinor, setMonthlyRevMinor] = useState<number>(2800000);

  if (!projection) return null;
  const v = projection.vehicle;
  const netOutlay = Math.max(0, replacementMinor - resaleMinor);
  const paybackMonths =
    monthlyRevMinor > 0 ? Math.max(1, Math.round(netOutlay / monthlyRevMinor)) : 0;

  return (
    <Dialog
      open={!!projection}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl p-6 sm:max-w-3xl">
        <DialogHeader className="pr-8">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="rounded-lg bg-structural px-2.5 py-1 font-mono text-xs font-bold text-structural-foreground">
              {v.registration}
            </span>
            <Status value={projection.status} />
            <span className="rounded-full border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {v.category} · {v.year}
            </span>
          </div>
          <DialogTitle className="pt-1 text-xl font-extrabold tracking-tight">
            360° Digital Vehicle File — {v.make} {v.model}
          </DialogTitle>
          <DialogDescription>
            Lifecycle profitability, telematics snapshot, and replacement
            payback simulation derived from scoped IndexedDB records.
          </DialogDescription>
        </DialogHeader>

        {/* Financial ROI Strip */}
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border bg-background/60 p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Cum. Revenue
            </p>
            <p className="mt-1 font-mono text-base font-extrabold text-foreground tabular-nums">
              {money(db, ctx.companyId, projection.cumRevenue)}
            </p>
          </div>
          <div className="rounded-2xl border bg-background/60 p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Workshop Costs
            </p>
            <p className="mt-1 font-mono text-base font-extrabold text-foreground tabular-nums">
              {money(db, ctx.companyId, projection.maintCost)}
            </p>
          </div>
          <div className="rounded-2xl border bg-background/60 p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Est. Fuel Burn
            </p>
            <p className="mt-1 font-mono text-base font-extrabold text-foreground tabular-nums">
              {money(db, ctx.companyId, projection.fuelCost)}
            </p>
          </div>
          <div className="rounded-2xl border border-primary/25 bg-accent/40 p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Net Asset ROI
            </p>
            <p
              className={`mt-1 font-mono text-base font-extrabold tabular-nums ${
                projection.netRoi >= 0
                  ? "text-success-foreground"
                  : "text-danger-foreground"
              }`}
            >
              {money(db, ctx.companyId, projection.netRoi)}
            </p>
          </div>
        </div>

        {/* Telemetry & Spec Specs */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-2xl border p-3.5">
            <Gauge className="size-5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <p className="text-xs text-muted-foreground">Odometer</p>
              <p className="font-mono text-sm font-bold tabular-nums">
                {v.odometer.toLocaleString()} km
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border p-3.5">
            <Fuel className="size-5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <p className="text-xs text-muted-foreground">Fuel & Power</p>
              <p className="text-sm font-bold">
                {v.fuel} · {projection.fuelPct}% tank
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border p-3.5">
            <Wrench className="size-5 shrink-0 text-primary" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Custodian</p>
              <p className="truncate text-sm font-bold">
                {projection.custodian}
              </p>
            </div>
          </div>
        </div>

        {v.functions.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border bg-muted/20 p-3">
            <span className="mr-1 font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Vehicle Functions:
            </span>
            {v.functions.map((fn) => (
              <span
                key={fn}
                className="rounded-md bg-structural px-2 py-0.5 font-mono text-[11px] font-semibold text-structural-foreground"
              >
                {fn}
              </span>
            ))}
          </div>
        ) : null}

        {/* Disposal & Replacement Simulator */}
        <section className="space-y-4 rounded-2xl bg-structural p-5 text-structural-foreground">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Calculator className="size-4 text-primary" aria-hidden="true" />
              <h3 className="text-sm font-bold">
                Disposal & Fleet Replacement Simulator
              </h3>
            </div>
            <span className="rounded-md bg-white/10 px-2 py-0.5 font-mono text-[11px] font-semibold">
              What-if Model
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="space-y-1.5 text-xs">
              <span className="text-white/75">Est. Resale Proceeds</span>
              <input
                type="number"
                min={0}
                step={500}
                value={Math.round(resaleMinor / 100)}
                onChange={(e) =>
                  setResaleMinor(Math.max(0, Number(e.target.value) || 0) * 100)
                }
                className="h-9 w-full rounded-lg border border-white/20 bg-white/10 px-2.5 font-mono text-sm font-semibold text-white focus:outline-2 focus:outline-primary"
              />
            </label>
            <label className="space-y-1.5 text-xs">
              <span className="text-white/75">Replacement Unit Cost</span>
              <input
                type="number"
                min={0}
                step={500}
                value={Math.round(replacementMinor / 100)}
                onChange={(e) =>
                  setReplacementMinor(
                    Math.max(0, Number(e.target.value) || 0) * 100,
                  )
                }
                className="h-9 w-full rounded-lg border border-white/20 bg-white/10 px-2.5 font-mono text-sm font-semibold text-white focus:outline-2 focus:outline-primary"
              />
            </label>
            <label className="space-y-1.5 text-xs">
              <span className="text-white/75">Projected Monthly Net</span>
              <input
                type="number"
                min={100}
                step={100}
                value={Math.round(monthlyRevMinor / 100)}
                onChange={(e) =>
                  setMonthlyRevMinor(
                    Math.max(100, Number(e.target.value) || 100) * 100,
                  )
                }
                className="h-9 w-full rounded-lg border border-white/20 bg-white/10 px-2.5 font-mono text-sm font-semibold text-white focus:outline-2 focus:outline-primary"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/15 pt-3 text-xs">
            <div>
              <span className="text-white/70">Net CapEx Outlay: </span>
              <strong className="font-mono text-sm tabular-nums">
                {money(db, ctx.companyId, netOutlay)}
              </strong>
            </div>
            <div>
              <span className="text-white/70">Estimated Payback: </span>
              <strong className="font-mono text-sm text-primary tabular-nums">
                {paybackMonths} months
              </strong>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <p className="text-xs text-muted-foreground">
            {projection.activeRental
              ? `Active contract: ${label(projection.activeRental)}`
              : projection.activeWorkOrder
                ? `Active work order: ${projection.activeWorkOrder.title}`
                : "Ready for allocation or workflow action."}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button
              onClick={() => {
                onOpenRecord(v);
                onClose();
              }}
              className="gap-1.5"
            >
              <span>Open full record</span>
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
