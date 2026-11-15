import { z } from "zod";

export const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
export const userSchema = z.object({
  id,
  name: z.string(),
  email: z.string(),
  is_platform_admin: z.boolean(),
  roles: z.array(z.string()),
  permissions: z.array(z.string()),
  companies: z.array(
    z.object({ id, name: z.string(), branch_id: id.nullable() }),
  ),
});
export type User = z.infer<typeof userSchema>;
export const companySchema = z.object({
  id,
  name: z.string(),
  currency: z.string(),
});
export const branchSchema = z.object({ id, company_id: id, name: z.string() });
export type Company = z.infer<typeof companySchema>;
export type Branch = z.infer<typeof branchSchema>;
const ownership = {
  id,
  company_id: id,
  branch_id: id,
  created_at: z.string(),
  updated_at: z.string(),
};
export const customerSchema = z.object({
  ...ownership,
  name: z.string(),
  type: z.enum(["individual", "corporate"]),
  email: z.string().nullable(),
  phone: z.string().nullable(),
});
export const vehicleSchema = z.object({
  ...ownership,
  registration: z.string(),
  make: z.string(),
  model: z.string(),
  year: z.number().int().nullable(),
  odometer: z.number().int().nonnegative(),
  status: z.enum(["available", "maintenance", "damaged", "rented"]),
});
export type Customer = z.infer<typeof customerSchema>;
export type Vehicle = z.infer<typeof vehicleSchema>;
export type Domain = "customers" | "vehicles";
export const can = (user: User, permission: string) =>
  user.is_platform_admin || user.permissions.includes(permission);
export function pageSchema<T extends z.ZodType>(record: T) {
  return z.object({
    data: z.array(record),
    meta: z.object({
      current_page: id,
      last_page: id,
      per_page: id,
      total: z.number().int().nonnegative(),
    }),
  });
}
export function normalizePage<T>(page: {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}) {
  return {
    items: page.data,
    page: page.meta.current_page,
    lastPage: page.meta.last_page,
    pageSize: page.meta.per_page,
    total: page.meta.total,
  };
}
export function safeLoginReturn(raw: string | null) {
  if (!raw || raw.length > 2000 || /[\\\x00-\x20]/.test(raw))
    return "/companies";
  try {
    const url = new URL(raw, "https://drivecore.invalid");
    if (
      url.origin !== "https://drivecore.invalid" ||
      !/^\/companies(?:\/|$)/.test(url.pathname) ||
      /%2f|%5c/i.test(url.pathname)
    )
      return "/companies";
    return url.pathname + url.search;
  } catch {
    return "/companies";
  }
}
