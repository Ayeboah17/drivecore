"use client";

import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Fuel,
  Gauge,
  MapPin,
  Navigation,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { allowed } from "@/lib/demo/permissions";
import { money, type Range } from "@/lib/demo/selectors";
import type { Database, DemoContext, Entity } from "@/lib/demo/types";
import { projectKpis, projectVehicles, type VehicleProjection } from "./projections";

function SemiGauge({
  label: title,
  pct,
  strokeColor,
  subtitle,
}: {
  label: string;
  pct: number;
  strokeColor: string;
  subtitle: string;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  const arcLen = 125.66;
  const dashOffset = arcLen - (arcLen * clamped) / 100;

  return (
    <div className="flex flex-col items-center rounded-2xl border bg-background/50 p-3 text-center">
      <svg viewBox="0 0 100 60" className="w-28" aria-hidden="true">
        <path
          d="M 10 50 A 40 40 0 0 1 90 50"
          fill="none"
          stroke="var(--border)"
          strokeWidth="9"
          strokeLinecap="round"
        />
        <path
          d="M 10 50 A 40 40 0 0 1 90 50"
          fill="none"
          stroke={strokeColor}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={arcLen}
          strokeDashoffset={dashOffset}
          className="erp-gauge-arc"
        />
      </svg>
      <p className="-mt-4 font-mono text-xl font-extrabold text-foreground tabular-nums">
        {pct}%
      </p>
      <p className="mt-1 text-xs font-bold text-foreground">{title}</p>
      <p className="text-[11px] text-muted-foreground">{subtitle}</p>
    </div>
  );
}

export function ExecutiveMapSection({
  db,
  ctx,
  range,
  now,
  onOpenRecord,
  onOpen360,
  onNewQuote,
}: {
  db: Database;
  ctx: DemoContext;
  range: Range;
  now: number;
  onOpenRecord: (entity: Entity) => void;
  onOpen360: (projection: VehicleProjection) => void;
  onNewQuote: () => void;
}) {
  const [filter, setFilter] = useState<"All" | "On Rental" | "Available" | "Workshop">("All");
  const [selectedId, setSelectedId] = useState<string>("");

  const projected = projectVehicles(db, ctx, now);
  const kpis = projectKpis(db, ctx, range, now);

  const visiblePins = projected.filter((p) => {
    if (filter === "All") return true;
    if (filter === "Workshop") return p.mapCategory === "Workshop";
    if (filter === "On Rental") return p.mapCategory === "On Rental";
    return p.mapCategory === "Available" || p.mapCategory === "Reserved";
  });

  const active =
    visiblePins.find((p) => p.vehicle.id === selectedId) ??
    projected.find((p) => p.vehicle.id === selectedId) ??
    visiblePins[0] ??
    projected[0];

  function cycle(delta: number) {
    if (!projected.length || !active) return;
    const idx = projected.findIndex((p) => p.vehicle.id === active.vehicle.id);
    const next = (idx + delta + projected.length) % projected.length;
    setSelectedId(projected[next].vehicle.id);
  }

  const tripRingCircumference = 113.1;
  const tripDashOffset = active
    ? tripRingCircumference - (tripRingCircumference * active.tripProgressPct) / 100
    : tripRingCircumference;

  return (
    <div className="space-y-5">
      {/* HERO MAP CONTAINER */}
      <section
        aria-label="Executive live fleet telematics map"
        className="dc-shadow-card relative overflow-hidden rounded-3xl border bg-surface"
      >
        {/* Top Live Telematics Chips (stacked header on mobile, floating overlay on md+) */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 border-b bg-surface/95 p-3 md:absolute md:top-3.5 md:right-3.5 md:left-3.5 md:border-b-0 md:bg-transparent md:p-0">
          <div className="dc-glass-panel flex flex-wrap items-center gap-1.5 rounded-2xl border p-1.5 shadow-sm">
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-structural px-2.5 py-1 font-mono text-[10px] font-bold tracking-wider text-structural-foreground">
              <span
                className="dc-gps-pulse size-2 rounded-full bg-primary"
                aria-hidden="true"
              />
              LIVE TELEMATICS
            </span>
            {(["All", "On Rental", "Available", "Workshop"] as const).map(
              (chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setFilter(chip)}
                  className={`rounded-xl px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-ring ${
                    filter === chip
                      ? "bg-primary text-primary-foreground shadow-2xs"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  {chip}
                </button>
              ),
            )}
          </div>

          {allowed(db, ctx, "rentals", true) ? (
            <Button
              size="sm"
              onClick={onNewQuote}
              className="h-9 gap-1.5 rounded-xl shadow-sm"
            >
              <Plus className="size-4" aria-hidden="true" />
              <span>New Rental / Quote</span>
            </Button>
          ) : null}
        </div>

        <div className="relative min-h-[290px] bg-[#EBF0F5] sm:min-h-[380px] dark:bg-[#151A20]">
          {/* Vector Greater Accra / Branch Corridor SVG Canvas */}
          <svg
            viewBox="0 0 800 400"
            preserveAspectRatio="xMidYMid slice"
            className="h-[290px] w-full select-none sm:h-[420px]"
            aria-hidden="true"
          >
            {/* Subtle Map Grid */}
            <defs>
              <pattern
                id="dc-map-grid"
                width="40"
                height="40"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 40 0 L 0 0 0 40"
                  fill="none"
                  stroke="currentColor"
                  strokeOpacity="0.06"
                  strokeWidth="1"
                />
              </pattern>
            </defs>
            <rect width="800" height="400" fill="url(#dc-map-grid)" className="text-foreground" />

            {/* Coastal Water Strip */}
            <path
              d="M 0 335 Q 210 318 420 330 T 800 315 L 800 400 L 0 400 Z"
              className="fill-[#D7E3ED] dark:fill-[#1D2630]"
            />

            {/* Green Park & Airport Reserve Zones */}
            <rect
              x="255"
              y="130"
              width="120"
              height="74"
              rx="18"
              className="fill-[#DCEAD9] dark:fill-[#1B2B24]"
            />
            <circle
              cx="535"
              cy="195"
              r="38"
              className="fill-[#DCEAD9] dark:fill-[#1B2B24]"
            />

            {/* Major Highway Arteries */}
            <path
              d="M 20 265 Q 240 215 440 165 T 790 120"
              fill="none"
              stroke="var(--surface)"
              strokeWidth="12"
              strokeLinecap="round"
            />
            <path
              d="M 150 40 Q 250 185 320 335"
              fill="none"
              stroke="var(--surface)"
              strokeWidth="9"
              strokeLinecap="round"
            />
            <path
              d="M 435 45 L 485 320"
              fill="none"
              stroke="var(--surface)"
              strokeWidth="8"
              strokeLinecap="round"
            />

            {/* Red Dashed Operating Geofence */}
            <circle
              cx="420"
              cy="190"
              r="142"
              fill="none"
              stroke="var(--primary)"
              strokeOpacity="0.4"
              strokeWidth="2"
              strokeDasharray="6 6"
            />

            {/* Active Corridor Route Polyline */}
            {active ? (
              <path
                d={`M 250 250 Q 370 155 ${(active.x / 100) * 800} ${(active.y / 100) * 400}`}
                fill="none"
                stroke="var(--primary)"
                strokeWidth="3"
                strokeDasharray="5 4"
                strokeOpacity="0.7"
              />
            ) : null}

            {/* Map Zone Watermarks */}
            <text
              x="315"
              y="170"
              textAnchor="middle"
              className="fill-muted-foreground/60 font-mono text-[10px] font-semibold uppercase tracking-widest"
            >
              {ctx.companyId === "co-2" ? "LUSAKA CORRIDOR" : "ACCRA / TEMA ZONE"}
            </text>
          </svg>

          {/* Clickable Vehicle Map Pins */}
          <div className="pointer-events-none absolute inset-0">
            {visiblePins.slice(0, 12).map((pin) => {
              const isSelected = active?.vehicle.id === pin.vehicle.id;
              const dotClass =
                pin.mapCategory === "On Rental"
                  ? "bg-primary"
                  : pin.mapCategory === "Workshop"
                    ? "bg-warning"
                    : "bg-success";

              return (
                <button
                  key={pin.vehicle.id}
                  type="button"
                  onClick={() => setSelectedId(pin.vehicle.id)}
                  style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                  aria-label={`Inspect ${pin.vehicle.registration} at ${pin.locationLabel}`}
                  className={`pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 rounded-full px-2 py-1 font-mono text-[10px] font-bold shadow-md transition-transform focus-visible:outline-2 focus-visible:outline-ring ${
                    isSelected
                      ? "z-20 scale-110 bg-structural text-structural-foreground ring-2 ring-primary"
                      : "z-10 border bg-surface/95 text-foreground hover:scale-105"
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <span className="relative flex size-2.5">
                      {pin.mapCategory === "On Rental" || isSelected ? (
                        <span
                          className={`dc-gps-pulse absolute inline-flex h-full w-full rounded-full opacity-75 ${dotClass}`}
                        />
                      ) : null}
                      <span
                        className={`relative inline-flex size-2.5 rounded-full ${dotClass}`}
                      />
                    </span>
                    <span>{pin.vehicle.registration}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Floating Glassmorphic Telemetry Popover (Desktop Overlay) */}
          {active ? (
            <div className="dc-glass-panel dc-shadow-float right-4 bottom-4 z-20 hidden w-[330px] rounded-2xl border p-4 md:absolute md:block">
              <TelemetryCardBody
                db={db}
                ctx={ctx}
                active={active}
                tripRingCircumference={tripRingCircumference}
                tripDashOffset={tripDashOffset}
                onOpen360={() => onOpen360(active)}
                onOpenRecord={() => onOpenRecord(active.vehicle)}
              />
            </div>
          ) : null}
        </div>

        {/* Mobile Stacked Telemetry Card (prevents 390px map overlap defect) */}
        {active ? (
          <div className="border-t bg-surface p-4 md:hidden">
            <TelemetryCardBody
              db={db}
              ctx={ctx}
              active={active}
              tripRingCircumference={tripRingCircumference}
              tripDashOffset={tripDashOffset}
              onOpen360={() => onOpen360(active)}
              onOpenRecord={() => onOpenRecord(active.vehicle)}
            />
          </div>
        ) : null}
      </section>

      {/* 12-COLUMN BOTTOM BENTO STRIP */}
      <div className="grid gap-5 lg:grid-cols-12">
        {/* Col 1-4: Selected Vehicle Spotlight */}
        <section className="dc-shadow-card flex flex-col justify-between rounded-2xl border bg-surface p-5 lg:col-span-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-primary">
                Vehicle Spotlight
              </p>
              <h2 className="text-sm font-extrabold text-foreground">
                {active
                  ? `${active.vehicle.make} ${active.vehicle.model}`
                  : "No vehicles in scope"}
              </h2>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="outline"
                className="size-8 rounded-lg"
                aria-label="Previous vehicle"
                onClick={() => cycle(-1)}
                disabled={projected.length < 2}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                className="size-8 rounded-lg"
                aria-label="Next vehicle"
                onClick={() => cycle(1)}
                disabled={projected.length < 2}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>

          {active ? (
            <>
              <div className="my-3 flex items-center justify-between gap-3 rounded-2xl bg-background/70 px-4 py-3">
                <div className="space-y-1">
                  <span className="inline-block rounded-md bg-structural px-2 py-0.5 font-mono text-xs font-bold text-structural-foreground">
                    {active.vehicle.registration}
                  </span>
                  <p className="text-xs font-medium text-muted-foreground">
                    {active.vehicle.category} · {active.vehicle.seats} seats ·{" "}
                    {active.vehicle.fuel}
                  </p>
                  <p className="font-mono text-sm font-extrabold text-foreground tabular-nums">
                    {money(db, ctx.companyId, active.vehicle.dailyRate)}/day
                  </p>
                </div>
                {/* Vector SUV Silhouette */}
                <svg
                  viewBox="0 0 140 64"
                  className="h-14 w-28 shrink-0 text-structural dark:text-foreground"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M16 42H124C128 42 131 39 131 35V29C131 25 127 23 121 22L101 18L84 8H44L26 20L12 24C9 25 8 28 8 32V36C8 40 11 42 16 42Z"
                    fill="currentColor"
                    fillOpacity="0.12"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M46 13H81L95 21H34L46 13Z"
                    fill="var(--primary)"
                    fillOpacity="0.22"
                  />
                  <circle cx="36" cy="44" r="9" fill="currentColor" />
                  <circle cx="36" cy="44" r="4" fill="var(--surface)" />
                  <circle cx="104" cy="44" r="9" fill="currentColor" />
                  <circle cx="104" cy="44" r="4" fill="var(--surface)" />
                </svg>
              </div>
              <div className="flex items-center justify-between gap-2 border-t pt-3 text-xs">
                <span className="truncate font-medium text-muted-foreground">
                  Custodian: <strong className="text-foreground">{active.custodian}</strong>
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 shrink-0 px-2 font-semibold text-link"
                  onClick={() => onOpen360(active)}
                >
                  360° File
                </Button>
              </div>
            </>
          ) : null}
        </section>

        {/* Col 5-8: Dual Semi-Circular SVG Arc Gauges */}
        <section className="dc-shadow-card flex flex-col justify-between rounded-2xl border bg-surface p-5 lg:col-span-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-foreground">
              Executive Performance Gauges
            </h2>
            <span className="font-mono text-[11px] font-semibold text-muted-foreground">
              {kpis.fleetCounts.total} units
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SemiGauge
              label="Fleet Utilisation"
              pct={kpis.utilizationPct}
              strokeColor="var(--primary)"
              subtitle={`${kpis.fleetCounts.rented} active rentals`}
            />
            <SemiGauge
              label="Operating Margin"
              pct={Math.max(0, kpis.netMarginPct)}
              strokeColor="var(--success)"
              subtitle="Simulated net ratio"
            />
          </div>
        </section>

        {/* Col 9-12: Fleet Status Overview Bar */}
        <section className="dc-shadow-card flex flex-col justify-between rounded-2xl border bg-surface p-5 lg:col-span-4">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-foreground">
                Fleet Status Overview
              </h2>
              <span className="font-mono text-xs font-bold text-foreground tabular-nums">
                {kpis.fleetCounts.total} Total
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Real-time capacity split across scoped branch allocations
            </p>
          </div>

          <div className="my-4 space-y-3">
            <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-muted">
              {kpis.fleetCounts.total > 0 ? (
                <>
                  <div
                    style={{
                      width: `${(kpis.fleetCounts.available / kpis.fleetCounts.total) * 100}%`,
                    }}
                    className="bg-success transition-all"
                    title={`Available: ${kpis.fleetCounts.available}`}
                  />
                  <div
                    style={{
                      width: `${(kpis.fleetCounts.rented / kpis.fleetCounts.total) * 100}%`,
                    }}
                    className="bg-primary transition-all"
                    title={`On Rental: ${kpis.fleetCounts.rented}`}
                  />
                  <div
                    style={{
                      width: `${(kpis.fleetCounts.workshop / kpis.fleetCounts.total) * 100}%`,
                    }}
                    className="bg-warning transition-all"
                    title={`Workshop: ${kpis.fleetCounts.workshop}`}
                  />
                  <div
                    style={{
                      width: `${(kpis.fleetCounts.reserved / kpis.fleetCounts.total) * 100}%`,
                    }}
                    className="bg-structural transition-all"
                    title={`Reserved: ${kpis.fleetCounts.reserved}`}
                  />
                </>
              ) : null}
            </div>

            <dl className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center justify-between rounded-xl border px-2.5 py-2">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="size-2 rounded-full bg-success" />
                  Available
                </dt>
                <dd className="font-mono font-bold tabular-nums">
                  {kpis.fleetCounts.available}
                </dd>
              </div>
              <div className="flex items-center justify-between rounded-xl border px-2.5 py-2">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="size-2 rounded-full bg-primary" />
                  On Rental
                </dt>
                <dd className="font-mono font-bold tabular-nums">
                  {kpis.fleetCounts.rented}
                </dd>
              </div>
              <div className="flex items-center justify-between rounded-xl border px-2.5 py-2">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="size-2 rounded-full bg-warning" />
                  Workshop
                </dt>
                <dd className="font-mono font-bold tabular-nums">
                  {kpis.fleetCounts.workshop}
                </dd>
              </div>
              <div className="flex items-center justify-between rounded-xl border px-2.5 py-2">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="size-2 rounded-full bg-structural" />
                  Reserved
                </dt>
                <dd className="font-mono font-bold tabular-nums">
                  {kpis.fleetCounts.reserved}
                </dd>
              </div>
            </dl>
          </div>
        </section>
      </div>
    </div>
  );
}

function TelemetryCardBody({
  db,
  ctx,
  active,
  tripRingCircumference,
  tripDashOffset,
  onOpen360,
  onOpenRecord,
}: {
  db: Database;
  ctx: DemoContext;
  active: VehicleProjection;
  tripRingCircumference: number;
  tripDashOffset: number;
  onOpen360: () => void;
  onOpenRecord: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-structural px-2 py-0.5 font-mono text-xs font-bold text-structural-foreground">
              {active.vehicle.registration}
            </span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-link">
              {active.mapCategory}
            </span>
          </div>
          <p className="mt-1 truncate text-sm font-extrabold text-foreground">
            {active.vehicle.make} {active.vehicle.model}
          </p>
          <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
            <MapPin className="size-3 shrink-0 text-primary" aria-hidden="true" />
            <span>{active.locationLabel}</span>
          </p>
        </div>

        {/* Radial Trip Progress Ring */}
        <div className="relative flex size-12 shrink-0 items-center justify-center">
          <svg viewBox="0 0 44 44" className="size-12 -rotate-90" aria-hidden="true">
            <circle
              cx="22"
              cy="22"
              r="18"
              fill="none"
              stroke="var(--border)"
              strokeWidth="4"
            />
            <circle
              cx="22"
              cy="22"
              r="18"
              fill="none"
              stroke="var(--primary)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={tripRingCircumference}
              strokeDashoffset={tripDashOffset}
              className="erp-gauge-arc"
            />
          </svg>
          <span className="absolute font-mono text-[10px] font-extrabold text-foreground tabular-nums">
            {active.tripProgressPct}%
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-xl bg-muted/60 p-2 font-mono text-[11px]">
        <div className="flex items-center gap-1 text-foreground">
          <Navigation className="size-3 text-primary" aria-hidden="true" />
          <span>{active.speedKmh} km/h</span>
        </div>
        <div className="flex items-center gap-1 text-foreground">
          <Fuel className="size-3 text-primary" aria-hidden="true" />
          <span>{active.fuelPct}%</span>
        </div>
        <div className="flex items-center gap-1 text-foreground">
          <Gauge className="size-3 text-primary" aria-hidden="true" />
          <span>{money(db, ctx.companyId, active.vehicle.dailyRate)}</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-0.5">
        <Button size="sm" variant="outline" className="h-8 flex-1 rounded-lg text-xs" onClick={onOpenRecord}>
          <Eye className="mr-1.5 size-3.5" aria-hidden="true" />
          Record
        </Button>
        <Button size="sm" className="h-8 flex-1 rounded-lg text-xs" onClick={onOpen360}>
          360° File
        </Button>
      </div>
    </div>
  );
}
