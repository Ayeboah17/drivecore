import { test, expect } from "@playwright/test";
import { createSeed } from "../../src/lib/demo/seed";
import type { DemoContext } from "../../src/lib/demo/types";
import {
  projectArAgeing,
  projectFuelTelemetry,
  projectJournalBatches,
  projectKpis,
  projectRentalPipeline,
  projectVehicles,
} from "../../src/features/erp-demo/projections";

const fixedNow = Date.parse("2026-11-15T10:00:00.000Z");
const adminCtx: DemoContext = {
  userId: "user-platform",
  companyId: "co-1",
  branchId: "all",
};

test("erp-demo projections derive vehicle ROI, 9 KPIs, 8-step pipeline, AR ageing buckets and balanced GL batches", () => {
  const db = createSeed(new Date(fixedNow));

  const vehicles = projectVehicles(db, adminCtx, fixedNow);
  expect(vehicles.length).toBe(16);
  expect(vehicles.some((v) => v.mapCategory === "On Rental")).toBe(true);
  expect(vehicles.some((v) => v.mapCategory === "Workshop")).toBe(true);
  expect(vehicles.some((v) => v.mapCategory === "Available")).toBe(true);

  const kpis = projectKpis(db, adminCtx, { from: "", to: "" }, fixedNow);
  expect(kpis.criteria).toHaveLength(9);
  expect(kpis.criteria.find((c) => c.id === 7)?.metric).toBe("Balanced (0.00)");

  const pipeline = projectRentalPipeline(db, adminCtx);
  expect(pipeline).toHaveLength(8);
  expect(pipeline[0].step).toBe(1);
  expect(pipeline[7].step).toBe(8);

  const ar = projectArAgeing(db, adminCtx, fixedNow);
  expect(ar.buckets).toHaveLength(5);
  expect(ar.buckets.reduce((s, b) => s + b.amount, 0)).toBeGreaterThan(0);

  const batches = projectJournalBatches(db, adminCtx);
  expect(batches.length).toBeGreaterThan(0);
  for (const batch of batches) {
    const net = batch.lines.reduce((s, l) => s + l.debit - l.credit, 0);
    expect(net).toBe(0);
  }

  const fuel = projectFuelTelemetry(db, adminCtx);
  expect(fuel).toHaveLength(16);
});

test("restricted viewer role never leaks finance projections outside permitted modules", () => {
  const db = createSeed(new Date(fixedNow));
  const viewerCtx: DemoContext = {
    userId: "user-viewer",
    companyId: "co-1",
    branchId: "br-1",
  };
  const opsCtx: DemoContext = {
    userId: "user-operations",
    companyId: "co-1",
    branchId: "br-1",
  };

  // Operations role cannot read finance: AR buckets & GL batches stay empty
  const opsAr = projectArAgeing(db, opsCtx, fixedNow);
  expect(opsAr.buckets.every((b) => b.amount === 0)).toBe(true);
  expect(projectJournalBatches(db, opsCtx)).toEqual([]);

  // Viewer scoped to br-1 only sees 8 br-1 vehicles
  expect(projectVehicles(db, viewerCtx, fixedNow)).toHaveLength(8);
});
