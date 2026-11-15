import type { z } from "zod";
import {
  companyInput,
  branchInput,
  currencyOptions,
  defaultCurrency,
} from "@/features/setup/contracts";
import {
  customerFormSchema,
  vehicleFormSchema,
} from "@/features/records/schemas";
interface DemoField {
  name: string;
  label: string;
  options?: readonly string[];
  type?: "email" | "tel";
  numeric?: boolean;
}
export interface DemoStep {
  title: string;
  entity: string;
  schema: z.ZodType;
  values: Record<string, string>;
  fields: DemoField[];
}
export const steps: DemoStep[] = [
  {
    title: "Create demo company",
    entity: "Company",
    schema: companyInput,
    values: { name: "Example Mobility", currency: defaultCurrency },
    fields: [
      { name: "name", label: "Company name" },
      { name: "currency", label: "Currency", options: currencyOptions },
    ],
  },
  {
    title: "Create demo branch",
    entity: "Branch",
    schema: branchInput,
    values: { name: "Example Main Branch" },
    fields: [{ name: "name", label: "Branch name" }],
  },
  {
    title: "Create demo customer",
    entity: "Customer",
    schema: customerFormSchema,
    values: {
      name: "Example Customer",
      type: "individual",
      email: "customer@example.test",
      phone: "",
    },
    fields: [
      { name: "name", label: "Customer name" },
      {
        name: "type",
        label: "Customer type",
        options: ["individual", "corporate"],
      },
      { name: "email", label: "Email (optional)", type: "email" },
      { name: "phone", label: "Phone (optional)", type: "tel" },
    ],
  },
  {
    title: "Create demo vehicle",
    entity: "Vehicle",
    schema: vehicleFormSchema,
    values: {
      registration: "DEMO-001",
      make: "Example Make",
      model: "Example Model",
      year: "2024",
      odometer: "0",
      status: "available",
    },
    fields: [
      { name: "registration", label: "Registration" },
      { name: "make", label: "Make" },
      { name: "model", label: "Model" },
      { name: "year", label: "Year (optional)", numeric: true },
      { name: "odometer", label: "Odometer", numeric: true },
      {
        name: "status",
        label: "Status",
        options: ["available", "maintenance", "damaged"],
      },
    ],
  },
];
