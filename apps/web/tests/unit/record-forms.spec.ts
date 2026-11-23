import { test, expect } from "@playwright/test";
import {
  customerFormSchema,
  vehicleFormSchema,
} from "../../src/features/records/forms";
const customer = {
  name: "Synthetic",
  type: "individual",
  email: "",
  phone: "",
};
const vehicle = {
  registration: "SYN",
  make: "Synthetic",
  model: "Fixture",
  year: "",
  odometer: "0",
  status: "available",
};
test("customer form requires name/type and validates optional backend fields", () => {
  expect(customerFormSchema.safeParse(customer).success).toBe(true);
  for (const invalid of [
    { ...customer, name: "" },
    { ...customer, type: "unknown" },
    { ...customer, phone: "x".repeat(51) },
    { ...customer, email: "invalid" },
  ])
    expect(customerFormSchema.safeParse(invalid).success).toBe(false);
});
test("vehicle form accepts known writable fields and rejects invalid years, odometer and rented status", () => {
  expect(vehicleFormSchema.safeParse(vehicle).success).toBe(true);
  for (const invalid of [
    { ...vehicle, year: "1899" },
    { ...vehicle, year: "2101" },
    { ...vehicle, year: "2020.5" },
    { ...vehicle, odometer: "-1" },
    { ...vehicle, odometer: "1.2" },
    { ...vehicle, registration: "" },
    { ...vehicle, make: "" },
    { ...vehicle, model: "" },
    { ...vehicle, status: "rented" },
  ])
    expect(vehicleFormSchema.safeParse(invalid).success).toBe(false);
});

import { liveVehicleFormSchema } from "../../src/features/records/schemas";
import { assertRecordScope } from "../../src/features/records/service";
import {
  formatMinorCurrency,
  formatVehicleFunction,
  mergeVehicleFunctions,
  parseMajorToMinor,
} from "../../src/lib/api/contracts";

test("live vehicle input validates odometer (km), daily_rate minor conversion and custom functions", () => {
  const parsed = liveVehicleFormSchema.parse({
    ...vehicle,
    odometer: "4200",
    daily_rate: "1250.99",
    functions: ["Roof Rack", "VIP Chauffeur", "gps_tracker"],
  });
  expect(parsed.odometer).toBe("4200");
  expect(parsed.functions).toEqual(["Roof Rack", "VIP Chauffeur", "gps_tracker"]);
  expect(formatVehicleFunction("gps_tracker")).toBe("GPS Tracker");
  expect(formatVehicleFunction("Roof Rack")).toBe("Roof Rack");
  expect(parseMajorToMinor(parsed.daily_rate)).toBe(125099);
  expect(formatMinorCurrency(125099, "GHC")).toBe("GHC 1,250.99");
  expect(formatMinorCurrency(0, "GHC")).toBe("Not set");

  const merged = mergeVehicleFunctions(["Roof Rack"], "  VIP   Chauffeur , roof rack ");
  expect(merged.next).toEqual(["Roof Rack", "VIP Chauffeur"]);
  expect(merged.error).toContain("already added");

  const legacyDup = mergeVehicleFunctions(["gps_tracker"], "GPS Tracker");
  expect(legacyDup.next).toEqual(["gps_tracker"]);
  expect(legacyDup.error).toContain("already added");

  expect(
    liveVehicleFormSchema.safeParse({
      ...vehicle,
      daily_rate: "10.999",
      functions: [],
    }).success,
  ).toBe(false);
  expect(
    liveVehicleFormSchema.safeParse({
      ...vehicle,
      daily_rate: "",
      functions: ["Roof Rack", "roof rack"],
    }).success,
  ).toBe(false);
  expect(
    liveVehicleFormSchema.safeParse({
      ...vehicle,
      daily_rate: "",
      functions: ["x".repeat(51)],
    }).success,
  ).toBe(false);
  expect(
    liveVehicleFormSchema.safeParse({
      ...vehicle,
      daily_rate: "",
      functions: Array.from({ length: 21 }, (_, i) => `Custom ${i + 1}`),
    }).success,
  ).toBe(false);
  expect(
    liveVehicleFormSchema.safeParse({
      ...vehicle,
      odometer: "-1",
      daily_rate: "",
      functions: [],
    }).success,
  ).toBe(false);
});

test("record identity, company and selected branch must all match before display", () => {
  const record = {
    id: 10,
    company_id: 1,
    branch_id: 2,
    name: "Synthetic",
    type: "individual" as const,
    email: null,
    phone: null,
    created_at: "2026-11-15T10:00:00Z",
    updated_at: "2026-11-15T10:00:00Z",
  };
  expect(assertRecordScope(record, "1", "all", "10")).toEqual(record);
  for (const [company, branch, id] of [
    ["3", "all", "10"],
    ["1", "4", "10"],
    ["1", "2", "12"],
  ])
    expect(() => assertRecordScope(record, company, branch, id)).toThrow();
});
