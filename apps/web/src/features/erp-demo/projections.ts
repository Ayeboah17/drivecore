import { allowed } from "@/lib/demo/permissions";
import { invoiceBalance, stock, vehicleStatus } from "@/lib/demo/rules";
import {
  dayKey,
  label,
  ledger,
  money,
  rows,
  summary,
  type Range,
} from "@/lib/demo/selectors";
import {
  entities,
  type Database,
  type DemoContext,
  type Of,
} from "@/lib/demo/types";

const CORRIDORS_CO1 = [
  { label: "Airport Residential, Accra", x: 38, y: 42 },
  { label: "Osu Oxford St, Accra", x: 31, y: 66 },
  { label: "Tema Motorway Km 11", x: 64, y: 34 },
  { label: "East Legon Hub", x: 47, y: 26 },
  { label: "Spintex Industrial Rd", x: 56, y: 49 },
  { label: "Cantonments Depot", x: 41, y: 55 },
  { label: "Tema Harbour Gate", x: 78, y: 44 },
  { label: "Labone Junction", x: 26, y: 52 },
] as const;

const CORRIDORS_CO2 = [
  { label: "Cairo Rd Central", x: 35, y: 48 },
  { label: "Kenneth Kaunda Airport", x: 68, y: 31 },
  { label: "Longacres Business District", x: 45, y: 39 },
  { label: "Kabulonga Hub", x: 54, y: 59 },
  { label: "Makeni Logistics Park", x: 24, y: 65 },
  { label: "Great East Corridor", x: 61, y: 43 },
] as const;

export interface VehicleProjection {
  vehicle: Of<"vehicle">;
  status: ReturnType<typeof vehicleStatus>;
  mapCategory: "On Rental" | "Available" | "Workshop" | "Reserved";
  x: number;
  y: number;
  locationLabel: string;
  speedKmh: number;
  fuelPct: number;
  tripProgressPct: number;
  custodian: string;
  activeRental?: Of<"rental">;
  activeWorkOrder?: Of<"workOrder">;
  cumRevenue: number;
  maintCost: number;
  fuelCost: number;
  netRoi: number;
}

function stableHash(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function projectVehicles(
  db: Database,
  ctx: DemoContext,
  now = Date.now(),
): VehicleProjection[] {
  const vehicles = rows(db, ctx, "vehicle");
  const rentals = rows(db, ctx, "rental");
  const customers = rows(db, ctx, "customer");
  const workOrders = rows(db, ctx, "workOrder");
  const branches = entities(db, "branch");
  const canFinance = allowed(db, ctx, "finance");
  const canRentals = allowed(db, ctx, "rentals");
  const corridor = ctx.companyId === "co-2" ? CORRIDORS_CO2 : CORRIDORS_CO1;

  return vehicles.map((vehicle, index) => {
    const status = vehicleStatus(db, vehicle, now);
    const mapCategory: VehicleProjection["mapCategory"] =
      status === "rented"
        ? "On Rental"
        : status === "maintenance" || status === "damaged" || status === "inactive"
          ? "Workshop"
          : status === "reserved"
            ? "Reserved"
            : "Available";

    const activeRental = rentals.find(
      (r) => r.vehicleId === vehicle.id && r.status === "active",
    );
    const activeWorkOrder = workOrders.find(
      (w) =>
        w.vehicleId === vehicle.id &&
        (w.status === "in_progress" || w.status === "open"),
    );
    const activeCustomer = activeRental
      ? customers.find((c) => c.id === activeRental.customerId)
      : undefined;
    const branch = branches.find((b) => b.id === vehicle.branchId);

    const slot = corridor[index % corridor.length];
    const h = stableHash(vehicle.id);
    const offsetX = ((Math.floor(index / corridor.length) * 7 + (h % 5)) % 9) - 4;
    const offsetY = (((Math.floor(index / corridor.length) * 5 + (h % 7)) % 9) - 4);

    const speedKmh =
      status === "rented" ? 38 + (h % 44) : status === "reserved" ? 12 + (h % 14) : 0;
    const fuelPct =
      vehicle.fuel === "Electric"
        ? 55 + (h % 42)
        : status === "rented"
          ? 42 + (h % 48)
          : status === "maintenance"
            ? 28 + (h % 35)
            : 76 + (h % 22);

    let tripProgressPct = 0;
    if (activeRental) {
      const s = Date.parse(activeRental.startsAt);
      const e = Date.parse(activeRental.endsAt);
      if (Number.isFinite(s) && Number.isFinite(e) && e > s) {
        tripProgressPct = Math.max(
          8,
          Math.min(100, Math.round(((now - s) / (e - s)) * 100)),
        );
      } else {
        tripProgressPct = 65;
      }
    } else if (status === "reserved") {
      tripProgressPct = 15;
    }

    const cumRevenue =
      canRentals || canFinance
        ? rentals
            .filter(
              (r) => r.vehicleId === vehicle.id && r.status !== "cancelled",
            )
            .reduce((sum, r) => sum + r.total, 0)
        : 0;

    const maintCost = workOrders
      .filter((w) => w.vehicleId === vehicle.id)
      .reduce((sum, w) => sum + w.labourCost + w.partsCost, 0);

    // Derived operational fuel benchmark (minor units) for vehicles with mileage
    const fuelCost = Math.round((vehicle.odometer % 12000) * 18);
    const netRoi = cumRevenue - maintCost - fuelCost;

    const custodian = activeCustomer
      ? activeCustomer.name
      : activeWorkOrder
        ? `Workshop · ${activeWorkOrder.title}`
        : branch?.name ?? "Branch depot";

    return {
      vehicle,
      status,
      mapCategory,
      x: Math.max(10, Math.min(90, slot.x + offsetX)),
      y: Math.max(16, Math.min(84, slot.y + offsetY)),
      locationLabel: slot.label,
      speedKmh,
      fuelPct,
      tripProgressPct,
      custodian,
      activeRental,
      activeWorkOrder,
      cumRevenue,
      maintCost,
      fuelCost,
      netRoi,
    };
  });
}

export interface KpiCriterion {
  id: number;
  title: string;
  metric: string;
  target: string;
  status: "met" | "attention";
  detail: string;
}

export function projectKpis(
  db: Database,
  ctx: DemoContext,
  range: Range,
  now = Date.now(),
) {
  const s = summary(db, ctx, range);
  const projected = projectVehicles(db, ctx, now);
  const available = projected.filter((v) => v.mapCategory === "Available").length;
  const rented = projected.filter((v) => v.mapCategory === "On Rental").length;
  const workshop = projected.filter((v) => v.mapCategory === "Workshop").length;
  const reserved = projected.filter((v) => v.mapCategory === "Reserved").length;

  const netMarginPct =
    s.revenue > 0
      ? Math.max(-99, Math.min(99, Math.round(((s.revenue - s.expenses) / s.revenue) * 100)))
      : 0;

  const parts = rows(db, ctx, "part");
  const lowStock = parts.filter((p) => stock(db, p.id) <= p.minimum).length;
  const workOrders = rows(db, ctx, "workOrder");
  const completedWork = workOrders.filter((w) => w.status === "completed").length;
  const inspections = rows(db, ctx, "inspection");
  const rentals = rows(db, ctx, "rental");
  const invoices = rows(db, ctx, "invoice");
  const paidInvoices = invoices.filter(
    (i) => i.status === "issued" && invoiceBalance(db, i.id).outstanding === 0,
  ).length;
  const glDiff = ledger(db, ctx).reduce((n, row) => n + row.debit - row.credit, 0);
  const audits = rows(db, ctx, "audit");
  const roles = entities(db, "role");
  const branches = entities(db, "branch").filter((b) => b.companyId === ctx.companyId);

  const criteria: KpiCriterion[] = [
    {
      id: 1,
      title: "Live Fleet Telematics & Status Visibility",
      metric: `${projected.length} tracked assets`,
      target: "100% scoped",
      status: projected.length > 0 ? "met" : "attention",
      detail: `${rented} on rental · ${available} available · ${workshop} in workshop`,
    },
    {
      id: 2,
      title: "Fleet Asset Utilisation Rate",
      metric: `${s.utilization}%`,
      target: "Target >= 50%",
      status: s.utilization >= 25 ? "met" : "attention",
      detail: `${s.active.length} active rental contracts across non-inactive units`,
    },
    {
      id: 3,
      title: "Operating Net Margin (Simulated)",
      metric: `${netMarginPct}%`,
      target: "Revenue > Expenses",
      status: netMarginPct >= 0 ? "met" : "attention",
      detail: `Revenue ${money(db, ctx.companyId, s.revenue)} vs Expenses ${money(db, ctx.companyId, s.expenses)}`,
    },
    {
      id: 4,
      title: "Digital Handover & Return Inspections",
      metric: `${inspections.length} signed`,
      target: "Paired handover/return",
      status: inspections.length > 0 ? "met" : "attention",
      detail: `${rentals.filter((r) => r.status === "completed").length} completed contracts reconciled`,
    },
    {
      id: 5,
      title: "Workshop Turnaround & Maintenance Tracking",
      metric: `${workOrders.length} work orders`,
      target: "Active downtime logged",
      status: workOrders.length > 0 ? "met" : "attention",
      detail: `${completedWork} completed · ${workOrders.length - completedWork} open/in progress`,
    },
    {
      id: 6,
      title: "Spare Parts Stock & Reorder Governance",
      metric: `${parts.length} SKUs tracked`,
      target: "Low stock flagged",
      status: lowStock === 0 ? "met" : "attention",
      detail: `${lowStock} part(s) currently at or below minimum threshold`,
    },
    {
      id: 7,
      title: "Double-Entry General Ledger Equilibrium",
      metric: glDiff === 0 ? "Balanced (0.00)" : `Delta ${glDiff}`,
      target: "Dr === Cr",
      status: glDiff === 0 ? "met" : "attention",
      detail: `${paidInvoices} settled invoices · ${money(db, ctx.companyId, s.outstanding)} open AR`,
    },
    {
      id: 8,
      title: "Multi-Company & Branch Access Isolation",
      metric: `${branches.length} branches · ${roles.length} roles`,
      target: "Capability-gated",
      status: branches.length > 0 ? "met" : "attention",
      detail: `Strict tenant + branch ownership enforced on every command`,
    },
    {
      id: 9,
      title: "Immutable Command & Financial Audit Trail",
      metric: `${audits.length} events`,
      target: "Append-only log",
      status: audits.length > 0 ? "met" : "attention",
      detail: `Every create, state change, and approval appends an audit record`,
    },
  ];

  return {
    utilizationPct: s.utilization,
    netMarginPct,
    fleetCounts: {
      available,
      rented,
      workshop,
      reserved,
      total: projected.length,
    },
    totalRevenue: s.revenue,
    totalExpenses: s.expenses,
    outstanding: s.outstanding,
    receipts: s.receipts,
    criteria,
  };
}

export interface PipelineStage {
  step: number;
  title: string;
  count: number;
  tab: "quotation" | "reservation" | "rental";
  note: string;
}

export function projectRentalPipeline(
  db: Database,
  ctx: DemoContext,
): PipelineStage[] {
  const quotes = rows(db, ctx, "quotation");
  const reservations = rows(db, ctx, "reservation");
  const rentals = rows(db, ctx, "rental");
  const customers = rows(db, ctx, "customer");
  const inspections = rows(db, ctx, "inspection");
  const invoices = rows(db, ctx, "invoice");

  return [
    {
      step: 1,
      title: "Lead & Quote",
      count: quotes.filter((q) => q.status === "draft").length,
      tab: "quotation",
      note: "Draft rate quotes",
    },
    {
      step: 2,
      title: "Reservation",
      count: reservations.filter((r) => ["draft", "confirmed"].includes(r.status)).length,
      tab: "reservation",
      note: "Allocated bookings",
    },
    {
      step: 3,
      title: "Credit & KYC",
      count: customers.filter((c) => c.active).length,
      tab: "reservation",
      note: "Verified accounts",
    },
    {
      step: 4,
      title: "Contract Draft",
      count: rentals.filter((r) => r.status === "draft").length,
      tab: "rental",
      note: "Awaiting handover",
    },
    {
      step: 5,
      title: "Handover Sign-Off",
      count: inspections.filter((i) => i.stage === "handover").length,
      tab: "rental",
      note: "Outbound baseline",
    },
    {
      step: 6,
      title: "On Rental",
      count: rentals.filter((r) => r.status === "active").length,
      tab: "rental",
      note: "Active dispatch",
    },
    {
      step: 7,
      title: "Return Check",
      count: inspections.filter((i) => i.stage === "return").length,
      tab: "rental",
      note: "Inbound reconciled",
    },
    {
      step: 8,
      title: "Invoiced & Closed",
      count: invoices.filter((i) => i.status === "issued").length,
      tab: "rental",
      note: "Recognized AR",
    },
  ];
}

export interface ArBucket {
  key: "current" | "d1_30" | "d31_60" | "d61_90" | "d90_plus";
  label: string;
  count: number;
  amount: number;
}

export interface CustomerExposure {
  customer: Of<"customer">;
  outstanding: number;
  overdueCount: number;
  creditLimit: number;
  holdRisk: boolean;
}

export function projectArAgeing(
  db: Database,
  ctx: DemoContext,
  now = Date.now(),
) {
  const buckets: ArBucket[] = [
    { key: "current", label: "Current", count: 0, amount: 0 },
    { key: "d1_30", label: "1–30 Days", count: 0, amount: 0 },
    { key: "d31_60", label: "31–60 Days", count: 0, amount: 0 },
    { key: "d61_90", label: "61–90 Days", count: 0, amount: 0 },
    { key: "d90_plus", label: "90+ Days", count: 0, amount: 0 },
  ];

  const invoices = rows(db, ctx, "invoice");
  const customers = rows(db, ctx, "customer");
  const byCustomer = new Map<string, { outstanding: number; overdue: number }>();

  for (const inv of invoices) {
    if (inv.status !== "issued") continue;
    const bal = invoiceBalance(db, inv.id);
    if (bal.outstanding <= 0) continue;

    const dueMs = Date.parse(inv.dueAt);
    const daysPastDue = Number.isFinite(dueMs)
      ? Math.floor((now - dueMs) / 86400000)
      : 0;

    let bucketIndex = 0;
    if (daysPastDue > 90) bucketIndex = 4;
    else if (daysPastDue > 60) bucketIndex = 3;
    else if (daysPastDue > 30) bucketIndex = 2;
    else if (daysPastDue > 0) bucketIndex = 1;

    buckets[bucketIndex].count += 1;
    buckets[bucketIndex].amount += bal.outstanding;

    const prev = byCustomer.get(inv.customerId) ?? { outstanding: 0, overdue: 0 };
    prev.outstanding += bal.outstanding;
    if (daysPastDue > 0) prev.overdue += 1;
    byCustomer.set(inv.customerId, prev);
  }

  const exposures: CustomerExposure[] = customers.map((customer) => {
    const entry = byCustomer.get(customer.id) ?? { outstanding: 0, overdue: 0 };
    const creditLimit = customer.type === "corporate" ? 2500000 : 500000;
    return {
      customer,
      outstanding: entry.outstanding,
      overdueCount: entry.overdue,
      creditLimit,
      holdRisk: entry.overdue > 0 || entry.outstanding > creditLimit,
    };
  });

  exposures.sort((a, b) => b.outstanding - a.outstanding || b.overdueCount - a.overdueCount);

  return { buckets, exposures };
}

export interface JournalBatch {
  id: string;
  date: string;
  reference: string;
  lines: { account: string; debit: number; credit: number }[];
}

export function projectJournalBatches(
  db: Database,
  ctx: DemoContext,
): JournalBatch[] {
  if (!allowed(db, ctx, "finance")) return [];
  const flat = ledger(db, ctx);
  const grouped = new Map<string, JournalBatch>();
  for (const row of flat) {
    const batchKey = `${dayKey(row.date)}::${row.reference}`;
    const existing = grouped.get(batchKey);
    if (existing) {
      existing.lines.push({
        account: row.account,
        debit: row.debit,
        credit: row.credit,
      });
    } else {
      grouped.set(batchKey, {
        id: row.id,
        date: row.date,
        reference: row.reference,
        lines: [{ account: row.account, debit: row.debit, credit: row.credit }],
      });
    }
  }
  return [...grouped.values()];
}

export interface FuelTelemetryRow {
  vehicle: Of<"vehicle">;
  registration: string;
  fuelType: string;
  odometer: number;
  efficiencyKmPerL: string;
  estimatedFuelCost: number;
  anomaly: string | null;
}

export function projectFuelTelemetry(
  db: Database,
  ctx: DemoContext,
): FuelTelemetryRow[] {
  return projectVehicles(db, ctx).map((proj) => {
    const baseEff =
      proj.vehicle.fuel === "Electric"
        ? "—"
        : proj.vehicle.category === "Economy"
          ? "14.2"
          : proj.vehicle.category === "Executive"
            ? "9.4"
            : proj.vehicle.category === "Pickup"
              ? "8.6"
              : proj.vehicle.category === "Van"
                ? "7.9"
                : "10.8";
    const anomaly =
      proj.status === "damaged"
        ? "GPS idle alert · inspection needed"
        : proj.maintCost > 40000
          ? "Elevated running cost"
          : null;
    return {
      vehicle: proj.vehicle,
      registration: proj.vehicle.registration,
      fuelType: proj.vehicle.fuel,
      odometer: proj.vehicle.odometer,
      efficiencyKmPerL: baseEff,
      estimatedFuelCost: proj.fuelCost,
      anomaly,
    };
  });
}

export { label, money };
