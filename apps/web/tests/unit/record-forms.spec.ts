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

test("live vehicle input omits odometer until its unit is confirmed; demo schema remains independent", () => {
  const parsed = liveVehicleFormSchema.parse(vehicle);
  expect(parsed).not.toHaveProperty("odometer");
  expect(
    liveVehicleFormSchema.safeParse({
      registration: "SYN",
      make: "Synthetic",
      model: "Fixture",
      year: "",
      status: "maintenance",
    }).success,
  ).toBe(true);
  expect(
    vehicleFormSchema.safeParse({ ...vehicle, odometer: "-1" }).success,
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
