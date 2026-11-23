import { z } from "zod";
import { managedRoleNames } from "@/lib/api/contracts";

export const createUserSchema = z
  .object({
    name: z.string().trim().min(1, "Enter a name.").max(255),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Enter a valid email address.")
      .max(255, "Maximum 255 characters."),
    password: z
      .string()
      .min(12, "Password must be at least 12 characters.")
      .regex(/[a-zA-Z]/, "Password must include at least one letter.")
      .regex(/[0-9]/, "Password must include at least one number."),
    password_confirmation: z.string().min(1, "Confirm the password."),
    role: z.enum(managedRoleNames),
    branch_id: z
      .string()
      .refine(
        (v) => v === "" || (/^[1-9]\d*$/.test(v) && Number.isSafeInteger(Number(v))),
        "Select a valid branch or whole-company access.",
      ),
  })
  .refine((data) => data.password === data.password_confirmation, {
    message: "Passwords do not match.",
    path: ["password_confirmation"],
  });

export const updateUserSchema = z.object({
  role: z.enum(managedRoleNames),
  branch_id: z
    .string()
    .refine(
      (v) => v === "" || (/^[1-9]\d*$/.test(v) && Number.isSafeInteger(Number(v))),
      "Select a valid branch or whole-company access.",
    ),
  is_active: z.boolean(),
});

export type CreateUserValues = z.infer<typeof createUserSchema>;
export type UpdateUserValues = z.infer<typeof updateUserSchema>;
