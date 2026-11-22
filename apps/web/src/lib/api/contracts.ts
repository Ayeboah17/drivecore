import { z } from "zod";

export const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const numericId = z.union([
  id,
  z
    .string()
    .regex(/^[1-9]\d*$/)
    .transform((value) => Number(value))
    .pipe(id),
]);
const nonNegInt = z.union([
  z.number().int().nonnegative(),
  z
    .string()
    .regex(/^\d+$/)
    .transform((value) => Number(value))
    .pipe(z.number().int().nonnegative()),
]);
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
  "finance",
  "viewer",
  "driver",
] as const;
export type ManagedRoleName = (typeof managedRoleNames)[number];
export const managedRoleLabels: Record<ManagedRoleName, string> = {
  "company-admin": "Company Admin",
  operations: "Operations",
  finance: "Finance",
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
export const documentEntityTypes = [
  "vehicle",
  "customer",
  "reservation",
  "rental",
  "quotation",
  "invoice",
  "work_order",
  "purchase_order",
] as const;
export type DocumentEntityType = (typeof documentEntityTypes)[number];
export const documentEntityLabels: Record<DocumentEntityType, string> = {
  vehicle: "Vehicle",
  customer: "Customer",
  reservation: "Reservation",
  rental: "Rental",
  quotation: "Quotation",
  invoice: "Invoice",
  work_order: "Work order",
  purchase_order: "Purchase order",
};

const nonNegNumber = z.union([
  z.number().nonnegative(),
  z
    .string()
    .regex(/^\d+(?:\.\d+)?$/)
    .transform((v) => Number(v))
    .pipe(z.number().nonnegative()),
]);

export const companySettingsSchema = z.object({
  company_id: numericId,
  currency: z.string(),
  vat_rate_pct: nonNegNumber.pipe(z.number().max(100)),
  discount_approval_threshold_pct: nonNegNumber.pipe(z.number().max(100)),
});

export const quotationVehicleSchema = z.object({
  vehicle_id: numericId,
  registration: z.string(),
  make: z.string(),
  model: z.string(),
  daily_rate_minor: nonNegInt,
  line_subtotal_minor: nonNegInt,
  reservation_id: numericId.nullable().optional().default(null),
});

export const quotationSchema = z.object({
  id: numericId,
  company_id: numericId,
  branch_id: numericId,
  customer_id: numericId,
  created_by: numericId.nullable().optional().default(null),
  customer_name: z.string().nullable().optional().default(null),
  starts_at: z.string(),
  ends_at: z.string(),
  rental_days: numericId,
  status: z.enum([
    "draft",
    "pending_approval",
    "approved",
    "rejected",
    "cancelled",
    "converted",
  ]),
  discount_pct: nonNegNumber.pipe(z.number().max(100)),
  discount_status: z.enum(["not_required", "pending", "approved", "rejected"]),
  discount_decided_by: numericId.nullable().optional().default(null),
  discount_decided_by_name: z.string().nullable().optional().default(null),
  discount_decided_at: z.string().nullable().optional().default(null),
  discount_decision_notes: z.string().nullable().optional().default(null),
  subtotal_minor: nonNegInt,
  discount_minor: nonNegInt,
  vat_rate_pct: nonNegNumber.pipe(z.number().max(100)),
  vat_minor: nonNegInt,
  total_minor: nonNegInt,
  notes: z.string().nullable().optional().default(null),
  converted_at: z.string().nullable().optional().default(null),
  created_at: z.string(),
  updated_at: z.string(),
  vehicles: z.array(quotationVehicleSchema).optional().default([]),
  reservation_ids: z.array(numericId).optional().default([]),
});

export const reservationSchema = z.object({
  ...ownership,
  customer_id: id,
  vehicle_id: id,
  created_by: id,
  starts_at: z.string(),
  ends_at: z.string(),
  status: z.enum(["confirmed", "cancelled", "completed"]),
  customer_name: z.string().nullable().optional(),
  vehicle_registration: z.string().nullable().optional(),
  vehicle_label: z.string().nullable().optional(),
  has_rental: z.boolean().optional(),
  rental_id: id.nullable().optional(),
});

export const rentalSchema = z.object({
  ...ownership,
  reservation_id: id,
  vehicle_id: id,
  driver_user_id: id.nullable().optional().default(null),
  status: z.enum(["draft", "active", "returned"]),
  handed_over_at: z.string().nullable(),
  returned_at: z.string().nullable(),
  handover_odometer: z.number().int().nonnegative().nullable(),
  return_odometer: z.number().int().nonnegative().nullable(),
  handover_notes: z.string().nullable(),
  return_notes: z.string().nullable(),
  odometer_unit: z.literal("km").optional().default("km"),
  customer_id: id.nullable().optional(),
  customer_name: z.string().nullable().optional(),
  vehicle_registration: z.string().nullable().optional(),
  vehicle_label: z.string().nullable().optional(),
  driver_name: z.string().nullable().optional(),
  starts_at: z.string().nullable().optional(),
  ends_at: z.string().nullable().optional(),
  invoice_id: numericId.nullable().optional().default(null),
});

export const paymentMethods = [
  "cash",
  "card",
  "bank_transfer",
  "mobile_money",
] as const;
export type PaymentMethod = (typeof paymentMethods)[number];

export const expenseCategories = [
  "maintenance",
  "fuel",
  "insurance",
  "tolls_parking",
  "general",
] as const;
export type ExpenseCategory = (typeof expenseCategories)[number];

export const arAgeingBuckets = [
  "current",
  "d1_30",
  "d31_60",
  "d61_90",
  "d90_plus",
] as const;
export type ArAgeingBucketKey = (typeof arAgeingBuckets)[number];

export const invoiceLineSchema = z.object({
  id: numericId.optional(),
  description: z.string(),
  quantity: numericId,
  unit_price_minor: nonNegInt,
  line_total_minor: nonNegInt,
});

export const paymentRecordSchema = z.object({
  id: numericId,
  company_id: numericId,
  branch_id: numericId,
  invoice_id: numericId,
  invoice_number: z.string().nullable().optional().default(null),
  customer_name: z.string().nullable().optional().default(null),
  recorded_by: numericId,
  amount_minor: numericId,
  method: z.enum(paymentMethods),
  reference: z.string(),
  paid_at: z.string(),
  created_at: z.string(),
});

export const refundRecordSchema = z.object({
  id: numericId,
  company_id: numericId,
  branch_id: numericId,
  invoice_id: numericId,
  invoice_number: z.string().nullable().optional().default(null),
  customer_name: z.string().nullable().optional().default(null),
  recorded_by: numericId,
  amount_minor: numericId,
  reason: z.string(),
  refunded_at: z.string(),
  created_at: z.string(),
});

export const invoiceSchema = z.object({
  id: numericId,
  company_id: numericId,
  branch_id: numericId,
  customer_id: numericId.nullable().optional().default(null),
  customer_name: z.string().nullable().optional().default(null),
  custom_customer_name: z.string().nullable().optional().default(null),
  custom_customer_email: z.string().nullable().optional().default(null),
  custom_customer_phone: z.string().nullable().optional().default(null),
  rental_id: numericId.nullable().optional().default(null),
  created_by: numericId,
  invoice_number: z.string(),
  status: z.enum(["draft", "issued", "void"]),
  due_at: z.string(),
  issued_at: z.string().nullable().optional().default(null),
  voided_at: z.string().nullable().optional().default(null),
  discount_pct: nonNegNumber.pipe(z.number().max(100)),
  subtotal_minor: nonNegInt,
  discount_minor: nonNegInt,
  vat_rate_pct: nonNegNumber.pipe(z.number().max(100)),
  vat_minor: nonNegInt,
  total_minor: nonNegInt,
  paid_minor: nonNegInt.optional().default(0),
  refunded_minor: nonNegInt.optional().default(0),
  net_paid_minor: z.coerce.number().int().optional().default(0),
  outstanding_minor: nonNegInt.optional().default(0),
  is_overdue: z.boolean().optional().default(false),
  notes: z.string().nullable().optional().default(null),
  created_at: z.string(),
  updated_at: z.string(),
  lines: z.array(invoiceLineSchema).optional().default([]),
  payments: z.array(paymentRecordSchema).optional().default([]),
  refunds: z.array(refundRecordSchema).optional().default([]),
});

export const expenseRecordSchema = z.object({
  id: numericId,
  company_id: numericId,
  branch_id: numericId,
  vehicle_id: numericId.nullable().optional().default(null),
  vehicle_registration: z.string().nullable().optional().default(null),
  recorded_by: numericId,
  category: z.enum(expenseCategories),
  description: z.string(),
  amount_minor: numericId,
  incurred_at: z.string(),
  created_at: z.string(),
});

export const arAgeingBucketSchema = z.object({
  key: z.enum(arAgeingBuckets),
  label: z.string(),
  count: nonNegInt,
  amount_minor: nonNegInt,
});

export const arExposureSchema = z.object({
  customer_id: numericId.nullable().optional().default(null),
  customer_name: z.string(),
  customer_type: z
    .enum(["individual", "corporate", "custom"])
    .optional()
    .default("individual"),
  outstanding_minor: nonNegInt,
  overdue_count: nonNegInt,
});

export const arAgeingSummarySchema = z.object({
  buckets: z.array(arAgeingBucketSchema),
  total_outstanding_minor: nonNegInt,
  exposures: z.array(arExposureSchema).optional().default([]),
});

export const glAccountSchema = z.object({
  id: numericId,
  code: z.string(),
  name: z.string(),
  type: z.enum(["asset", "liability", "equity", "revenue", "expense"]),
  is_system: z.boolean().optional().default(true),
  debit_minor: nonNegInt.optional().default(0),
  credit_minor: nonNegInt.optional().default(0),
  balance_minor: z.coerce.number().int().optional().default(0),
});

export const glTrialBalanceSchema = z.object({
  accounts: z.array(glAccountSchema),
  total_debits_minor: nonNegInt,
  total_credits_minor: nonNegInt,
  is_balanced: z.boolean(),
});

export const journalLineSchema = z.object({
  id: numericId.optional(),
  account_code: z.string(),
  account_name: z.string(),
  debit_minor: nonNegInt,
  credit_minor: nonNegInt,
});

export const journalEntrySchema = z.object({
  id: numericId,
  company_id: numericId,
  branch_id: numericId,
  created_by: numericId,
  source_type: z.enum([
    "invoice",
    "payment",
    "refund",
    "expense",
    "work_order",
    "purchase_order",
    "stock_adjustment",
  ]),
  source_id: numericId,
  reference: z.string(),
  memo: z.string(),
  posted_at: z.string(),
  lines: z.array(journalLineSchema),
});

export const partSchema = z.object({
  id: numericId,
  company_id: numericId,
  branch_id: numericId,
  sku: z.string(),
  name: z.string(),
  unit_cost_minor: nonNegInt,
  min_stock: nonNegInt,
  on_hand: z.coerce.number().int().optional().default(0),
  is_low_stock: z.boolean().optional().default(false),
  created_at: z.string(),
  updated_at: z.string(),
});

export const stockMovementSchema = z.object({
  id: numericId,
  company_id: numericId,
  branch_id: numericId,
  part_id: numericId,
  part_sku: z.string().nullable().optional().default(null),
  part_name: z.string().nullable().optional().default(null),
  recorded_by: numericId,
  quantity: z.coerce.number().int(),
  unit_cost_minor: nonNegInt,
  reason: z.string(),
  work_order_id: numericId.nullable().optional().default(null),
  purchase_order_id: numericId.nullable().optional().default(null),
  created_at: z.string(),
});

export const workOrderSchema = z.object({
  id: numericId,
  company_id: numericId,
  branch_id: numericId,
  vehicle_id: numericId,
  vehicle_registration: z.string().nullable().optional().default(null),
  vehicle_label: z.string().nullable().optional().default(null),
  created_by: numericId,
  title: z.string(),
  status: z.enum(["open", "in_progress", "completed", "cancelled"]),
  due_at: z.string(),
  started_at: z.string().nullable().optional().default(null),
  completed_at: z.string().nullable().optional().default(null),
  labour_cost_minor: nonNegInt,
  parts_cost_minor: nonNegInt,
  total_cost_minor: nonNegInt.optional().default(0),
  notes: z.string().nullable().optional().default(null),
  completion_notes: z.string().nullable().optional().default(null),
  expense_id: numericId.nullable().optional().default(null),
  created_at: z.string(),
  updated_at: z.string(),
  movements: z.array(stockMovementSchema).optional().default([]),
});

export const supplierSchema = z.object({
  id: numericId,
  company_id: numericId,
  name: z.string(),
  email: z.string().nullable().optional().default(null),
  phone: z.string().nullable().optional().default(null),
  is_active: z.boolean().default(true),
  created_at: z.string(),
  updated_at: z.string(),
});

export const purchaseOrderLineSchema = z.object({
  id: numericId.optional(),
  part_id: numericId,
  part_sku: z.string().nullable().optional().default(null),
  part_name: z.string().nullable().optional().default(null),
  quantity: numericId,
  unit_cost_minor: nonNegInt,
  line_total_minor: nonNegInt,
});

export const purchaseOrderSchema = z.object({
  id: numericId,
  company_id: numericId,
  branch_id: numericId,
  supplier_id: numericId,
  supplier_name: z.string().nullable().optional().default(null),
  created_by: numericId,
  approved_by: numericId.nullable().optional().default(null),
  approved_by_name: z.string().nullable().optional().default(null),
  po_number: z.string(),
  status: z.enum(["draft", "submitted", "approved", "received", "cancelled"]),
  total_minor: nonNegInt,
  notes: z.string().nullable().optional().default(null),
  submitted_at: z.string().nullable().optional().default(null),
  approved_at: z.string().nullable().optional().default(null),
  received_at: z.string().nullable().optional().default(null),
  created_at: z.string(),
  updated_at: z.string(),
  lines: z.array(purchaseOrderLineSchema).optional().default([]),
});

export const vehicleSummarySchema = z.object({
  vehicle_id: numericId,
  work_order_count: nonNegInt,
  open_work_order_count: nonNegInt,
  total_downtime_hours: nonNegNumber,
  cumulative_revenue_minor: z.coerce.number().int().nullable().optional().default(null),
  maintenance_cost_minor: z.coerce.number().int().nullable().optional().default(null),
  other_expenses_minor: z.coerce.number().int().nullable().optional().default(null),
  net_roi_minor: z.coerce.number().int().nullable().optional().default(null),
  recent_work_orders: z.array(workOrderSchema).optional().default([]),
});

export const documentSchema = z.object({
  id: numericId,
  company_id: numericId,
  branch_id: numericId,
  created_at: z.string(),
  updated_at: z.string(),
  uploaded_by: numericId,
  original_name: z.string(),
  mime_type: z.string(),
  size: nonNegInt,
  entity_type: z.enum(documentEntityTypes).nullable().optional().default(null),
  entity_id: numericId.nullable().optional().default(null),
  expires_at: z.string().nullable().optional().default(null),
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
export type CompanySettings = z.infer<typeof companySettingsSchema>;
export type QuotationVehicle = z.infer<typeof quotationVehicleSchema>;
export type Quotation = z.infer<typeof quotationSchema>;
export type Reservation = z.infer<typeof reservationSchema>;
export type Rental = z.infer<typeof rentalSchema>;
export type InvoiceLine = z.infer<typeof invoiceLineSchema>;
export type PaymentRecord = z.infer<typeof paymentRecordSchema>;
export type RefundRecord = z.infer<typeof refundRecordSchema>;
export type Invoice = z.infer<typeof invoiceSchema>;
export type ExpenseRecord = z.infer<typeof expenseRecordSchema>;
export type ArAgeingBucket = z.infer<typeof arAgeingBucketSchema>;
export type ArExposure = z.infer<typeof arExposureSchema>;
export type ArAgeingSummary = z.infer<typeof arAgeingSummarySchema>;
export type GlAccount = z.infer<typeof glAccountSchema>;
export type GlTrialBalance = z.infer<typeof glTrialBalanceSchema>;
export type JournalLine = z.infer<typeof journalLineSchema>;
export type JournalEntry = z.infer<typeof journalEntrySchema>;
export type PartRecord = z.infer<typeof partSchema>;
export type StockMovementRecord = z.infer<typeof stockMovementSchema>;
export type WorkOrder = z.infer<typeof workOrderSchema>;
export type SupplierRecord = z.infer<typeof supplierSchema>;
export type PurchaseOrderLine = z.infer<typeof purchaseOrderLineSchema>;
export type PurchaseOrder = z.infer<typeof purchaseOrderSchema>;
export type VehicleSummary = z.infer<typeof vehicleSummarySchema>;
export type DocumentRecord = z.infer<typeof documentSchema>;
export type ManagedUser = z.infer<typeof managedUserSchema>;
export type RoleDefinition = z.infer<typeof roleDefinitionSchema>;
export type Domain = "customers" | "vehicles";
export const can = (user: User, permission: string) =>
  user.is_platform_admin || user.permissions.includes(permission);
export const isDriverRole = (user: User) =>
  !user.is_platform_admin &&
  user.roles.includes("driver") &&
  !user.permissions.includes("rentals.view");
export const canAccessRentals = (user: User) =>
  can(user, "quotations.view") ||
  can(user, "reservations.view") ||
  can(user, "rentals.view") ||
  isDriverRole(user);
export const canAccessOperations = (user: User) =>
  can(user, "rentals.view") ||
  can(user, "documents.view") ||
  isDriverRole(user);
export const canAccessFinance = (user: User) =>
  can(user, "invoices.view") ||
  can(user, "expenses.view") ||
  can(user, "gl.view");
export const canViewGl = (user: User) => can(user, "gl.view");
export const canAccessMaintenance = (user: User) =>
  can(user, "work_orders.view");
export const canAccessInventory = (user: User) => can(user, "parts.view");
export const canAccessProcurement = (user: User) =>
  can(user, "purchase_orders.view") || can(user, "suppliers.view");
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
export const canManageCompanySettings = (user: User, companyId: string) =>
  user.is_platform_admin ||
  ((can(user, "settings.manage") || can(user, "users.manage")) &&
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

/** Formats integer minor units as explicit money (including 0.00 and negative amounts). */
export function formatMoneyMinor(minor: number, currency?: string): string {
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(Math.round(minor));
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, "0");
  return `${sign}${currency ? `${currency} ` : ""}${whole.toLocaleString()}.${frac}`;
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
