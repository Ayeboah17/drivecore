import { z } from "zod";
import {
  MAX_VEHICLE_FUNCTIONS,
  MAX_VEHICLE_FUNCTION_LENGTH,
  canonicalVehicleFunctionKey,
  parseMajorToMinor,
} from "@/lib/api/contracts";

export const customerFormSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(255),
  type: z.enum(["individual", "corporate"]),
  email: z
    .union([z.literal(""), z.email()])
    .refine((value) => value.length <= 255, "Maximum 255 characters."),
  phone: z.string().max(50),
});
const whole = (value: string) =>
  /^\d+$/.test(value) && Number.isSafeInteger(Number(value));
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

export const liveVehicleFormSchema = vehicleFormSchema.extend({
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
});
