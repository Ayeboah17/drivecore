import { z } from "zod";
import {
  MAX_VEHICLE_FUNCTIONS,
  MAX_VEHICLE_FUNCTION_LENGTH,
  canonicalVehicleFunctionKey,
  parseMajorToMinor,
  vehicleCategories,
  vehicleFinancingTypes,
  vehicleFuelTypes,
  vehicleTransmissions,
} from "@/lib/api/contracts";

const optionalMoneyString = z
  .string()
  .optional()
  .refine(
    (value) => !value || value.trim() === "" || parseMajorToMinor(value) !== null,
    "Enter a valid nonnegative amount with up to 2 decimal places.",
  );

const whole = (value: string) =>
  /^\d+$/.test(value) && Number.isSafeInteger(Number(value));

export const customerFormSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(255),
  type: z.enum(["individual", "corporate"]),
  email: z
    .union([z.literal(""), z.email()])
    .refine((value) => value.length <= 255, "Maximum 255 characters."),
  phone: z.string().max(50),
  id_number: z.string().max(80).optional(),
  driver_licence_number: z.string().max(80).optional(),
  driver_licence_expires_at: z.string().max(32).optional(),
  company_registration: z.string().max(80).optional(),
  tin: z.string().max(80).optional(),
  contact_person_name: z.string().max(120).optional(),
  contact_person_phone: z.string().max(50).optional(),
  billing_address: z.string().max(500).optional(),
  credit_limit: optionalMoneyString,
  payment_terms_days: z
    .string()
    .optional()
    .refine(
      (value) =>
        !value ||
        value.trim() === "" ||
        (whole(value.trim()) && Number(value.trim()) <= 365),
      "Enter whole days between 0 and 365.",
    ),
});

export const vehicleFormSchema = z.object({
  registration: z.string().trim().min(1, "Enter a registration.").max(40),
  make: z.string().trim().min(1, "Enter a make.").max(100),
  model: z.string().trim().min(1, "Enter a model.").max(100),
  year: z
    .string()
    .refine(
      (value) =>
        value === "" ||
        (whole(value) && Number(value) >= 1900 && Number(value) <= 2100),
      "Enter a whole year from 1900 to 2100.",
    ),
  odometer: z
    .string()
    .refine(
      (value) => whole(value),
      "Enter a nonnegative whole number in kilometres.",
    ),
  status: z.enum(["available", "maintenance", "damaged"]),
});

export const manualVehicleStatuses = [
  "available",
  "maintenance",
  "damaged",
  "accident",
  "awaiting_inspection",
  "awaiting_repair",
] as const;

export const liveVehicleFormSchema = vehicleFormSchema.extend({
  status: z.enum(manualVehicleStatuses),
  vin: z.string().max(64).optional(),
  category: z.union([z.literal(""), z.enum(vehicleCategories)]).optional(),
  fuel_type: z.union([z.literal(""), z.enum(vehicleFuelTypes)]).optional(),
  transmission: z.union([z.literal(""), z.enum(vehicleTransmissions)]).optional(),
  current_location: z.string().max(160).optional(),
  daily_rate: z
    .string()
    .refine(
      (value) => parseMajorToMinor(value) !== null,
      "Enter a valid nonnegative amount with up to 2 decimal places.",
    ),
  functions: z
    .array(
      z
        .string()
        .trim()
        .min(1, "Function cannot be empty.")
        .max(
          MAX_VEHICLE_FUNCTION_LENGTH,
          `Maximum ${MAX_VEHICLE_FUNCTION_LENGTH} characters per function.`,
        ),
    )
    .max(
      MAX_VEHICLE_FUNCTIONS,
      `Select up to ${MAX_VEHICLE_FUNCTIONS} functions.`,
    )
    .refine(
      (items) =>
        new Set(items.map((item) => canonicalVehicleFunctionKey(item))).size ===
        items.length,
      "Duplicate functions are not allowed.",
    ),
  acquisition_date: z.string().max(32).optional(),
  acquisition_cost: optionalMoneyString,
  financing_type: z
    .union([z.literal(""), z.enum(vehicleFinancingTypes)])
    .optional(),
  financing_provider: z.string().max(120).optional(),
  financing_monthly: optionalMoneyString,
  financing_end_date: z.string().max(32).optional(),
  current_book_value: optionalMoneyString,
  residual_value: optionalMoneyString,
  insurance_provider: z.string().max(120).optional(),
  insurance_policy_number: z.string().max(80).optional(),
  insurance_expires_at: z.string().max(32).optional(),
  roadworthy_expires_at: z.string().max(32).optional(),
  licence_expires_at: z.string().max(32).optional(),
});
