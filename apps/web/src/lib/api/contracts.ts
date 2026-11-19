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
export const MAX_VEHICLE_FUNCTIONS = 20;
export const MAX_VEHICLE_FUNCTION_LENGTH = 50;

export const vehicleFunctionSlugs = [
  "gps_tracker",
  "automatic",
  "awd_4x4",
  "air_conditioning",
  "chauffeur_eligible",
  "bluetooth",
  "child_seat",
] as const;
export type VehicleFunctionSlug = (typeof vehicleFunctionSlugs)[number];
export const vehicleFunctionLabels: Record<VehicleFunctionSlug, string> = {
  gps_tracker: "GPS Tracker",
  automatic: "Automatic",
  awd_4x4: "4x4 / AWD",
  air_conditioning: "A/C",
  chauffeur_eligible: "Chauffeur Eligible",
  bluetooth: "Bluetooth",
  child_seat: "Child Seat",
};
export const defaultVehicleFunctionSuggestions = [
  "GPS Tracker",
  "Automatic",
  "4x4 / AWD",
  "A/C",
  "Chauffeur Eligible",
  "Bluetooth",
  "Child Seat",
] as const;

export function normalizeVehicleFunction(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export function formatVehicleFunction(value: string): string {
  const normalized = normalizeVehicleFunction(value);
  return (
    vehicleFunctionLabels[normalized as VehicleFunctionSlug] ?? normalized
  );
}

export function canonicalVehicleFunctionKey(value: string): string {
  return formatVehicleFunction(value).toLowerCase();
}

export function mergeVehicleFunctions(
  existing: readonly string[],
  rawAdditions: string,
): { next: string[]; error?: string } {
  const parts = rawAdditions
    .split(",")
    .map((part) => normalizeVehicleFunction(part))
    .filter(Boolean);
  if (parts.length === 0) return { next: [...existing] };

  const next = [...existing];
  const seen = new Set(next.map((item) => canonicalVehicleFunctionKey(item)));
  let error: string | undefined;

  for (const part of parts) {
    if (part.length > MAX_VEHICLE_FUNCTION_LENGTH) {
      error = `Each function must be at most ${MAX_VEHICLE_FUNCTION_LENGTH} characters.`;
      continue;
    }
    const key = canonicalVehicleFunctionKey(part);
    if (seen.has(key)) {
      error = `"${formatVehicleFunction(part)}" is already added.`;
      continue;
    }
    if (next.length >= MAX_VEHICLE_FUNCTIONS) {
      error = `Maximum ${MAX_VEHICLE_FUNCTIONS} functions per vehicle.`;
      break;
    }
    seen.add(key);
    next.push(part);
  }
  return { next, error };
}

export const managedRoleNames = [
  "company-admin",
  "operations",
  "viewer",
  "driver",
] as const;
export type ManagedRoleName = (typeof managedRoleNames)[number];
export const managedRoleLabels: Record<ManagedRoleName, string> = {
  "company-admin": "Company Admin",
  operations: "Operations",
  viewer: "Viewer",
  driver: "Driver",
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
  odometer_unit: z.literal("km").optional().default("km"),
  daily_rate_minor: z.number().int().nonnegative().optional().default(0),
  functions: z
    .array(z.string().trim().min(1).max(MAX_VEHICLE_FUNCTION_LENGTH))
    .max(MAX_VEHICLE_FUNCTIONS)
    .optional()
    .default([]),
  status: z.enum(["available", "maintenance", "damaged", "rented"]),
});
export const managedUserSchema = z.object({
  id,
  name: z.string(),
  email: z.string(),
  is_active: z.boolean(),
  roles: z.array(z.string()),
  company_id: id.nullable(),
  branch_id: id.nullable(),
});
export const roleDefinitionSchema = z.object({
  name: z.enum(managedRoleNames),
  permissions: z.array(z.string()),
});
export type Customer = z.infer<typeof customerSchema>;
export type Vehicle = z.infer<typeof vehicleSchema>;
export type ManagedUser = z.infer<typeof managedUserSchema>;
export type RoleDefinition = z.infer<typeof roleDefinitionSchema>;
export type Domain = "customers" | "vehicles";
export const can = (user: User, permission: string) =>
  user.is_platform_admin || user.permissions.includes(permission);
export const canAccessUserAdmin = (user: User, companyId: string) =>
  user.is_platform_admin ||
  (can(user, "users.view") &&
    user.companies.some(
      (c) => String(c.id) === companyId && c.branch_id === null,
    ));
export const canManageUsers = (user: User, companyId: string) =>
  user.is_platform_admin ||
  (can(user, "users.manage") &&
    user.companies.some(
      (c) => String(c.id) === companyId && c.branch_id === null,
    ));

/** Exact decimal-string major currency units -> integer minor units (no float drift). */
export function parseMajorToMinor(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return 0;
  if (!/^\d+(?:\.\d{1,2})?$/.test(trimmed)) return null;
  const [wholePart, fracPart = ""] = trimmed.split(".");
  const minor = Number(wholePart) * 100 + Number(fracPart.padEnd(2, "0"));
  if (!Number.isSafeInteger(minor) || minor < 0) return null;
  return minor;
}

export function formatMinorToInput(minor: number): string {
  if (!minor) return "";
  const whole = Math.floor(minor / 100);
  const frac = String(minor % 100).padStart(2, "0");
  return `${whole}.${frac}`;
}

export function formatMinorCurrency(
  minor: number,
  currency?: string,
): string {
  if (!minor) return "Not set";
  const whole = Math.floor(minor / 100);
  const frac = String(minor % 100).padStart(2, "0");
  return `${currency ? `${currency} ` : ""}${whole.toLocaleString()}.${frac}`;
}
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
