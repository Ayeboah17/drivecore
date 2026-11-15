import { z } from "zod";

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
  registration: z.string().trim().min(1).max(40),
  make: z.string().trim().min(1).max(100),
  model: z.string().trim().min(1).max(100),
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
    .refine((value) => whole(value), "Enter a nonnegative whole number."),
  status: z.enum(["available", "maintenance", "damaged"]),
});

// Laravel permits omission. Never solicit/send a distance before its unit is
// agreed with the backend owner. The isolated demo retains its existing schema.
export const liveVehicleFormSchema = vehicleFormSchema.omit({ odometer: true });
