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
