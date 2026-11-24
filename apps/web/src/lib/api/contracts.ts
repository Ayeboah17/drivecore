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
  must_change_password: z.boolean().optional(),
  two_factor_enabled: z.boolean().optional(),
  two_factor_enrollment_required: z.boolean().optional(),
  roles: z.array(z.string()),
  permissions: z.array(z.string()),
  companies: z.array(
    z.object({
      id,
      name: z.string(),
      branch_id: id.nullable(),
      currency: z.string().optional(),
    }),
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

export const assignableRoleNames = [
  "ceo",
  "general-manager",
  "business-accounts-manager",
  "operations-manager",
  "maintenance-manager",
  "finance-manager",
  "credit-control-manager",
  "hr-admin-manager",
  "mechanic-technician",
  "system-administrator",
  "driver",
] as const;
export type AssignableRoleName = (typeof assignableRoleNames)[number];

export const legacyRoleNames = [
  "company-admin",
  "operations",
  "finance",
  "viewer",
] as const;

export const managedRoleNames = [
  ...assignableRoleNames,
  ...legacyRoleNames,
] as const;
export type ManagedRoleName = (typeof managedRoleNames)[number];

export const privilegedRoleNames: readonly ManagedRoleName[] = [
  "ceo",
  "general-manager",
  "finance-manager",
  "credit-control-manager",
  "system-administrator",
  "company-admin",
  "finance",
];

export const managedRoleLabels: Record<ManagedRoleName, string> = {
  ceo: "CEO",
  "general-manager": "General Manager",
  "business-accounts-manager": "Business Accounts Manager",
  "operations-manager": "Operations Manager",
  "maintenance-manager": "Maintenance Manager",
  "finance-manager": "Finance Manager",
  "credit-control-manager": "Credit Control Manager",
  "hr-admin-manager": "HR/Admin Manager",
  "mechanic-technician": "Mechanic / Technician",
  "system-administrator": "System Administrator",
  driver: "Driver",
  "company-admin": "Company Admin (Legacy)",
  operations: "Operations (Legacy)",
  finance: "Finance (Legacy)",
  viewer: "Viewer (Legacy)",
};

export function isPrivilegedRole(role: string): boolean {
  return privilegedRoleNames.includes(role as ManagedRoleName);
}

export function isPrivilegedUser(user: User): boolean {
  return user.is_platform_admin || user.roles.some((r) => isPrivilegedRole(r));
}

export function isSystemAdmin(user: User): boolean {
  return (
    user.is_platform_admin ||
    user.roles.includes("system-administrator") ||
    user.roles.includes("company-admin") ||
    (user.permissions.includes("users.manage") &&
      user.permissions.includes("settings.manage"))
  );
}

export function canAssignRole(user: User, role: string): boolean {
  if (isSystemAdmin(user)) return true;
  // HR/Admin Manager can manage non-privileged roles only
  if (user.roles.includes("hr-admin-manager")) {
    return !isPrivilegedRole(role);
  }
  return false;
}

export function canResetUserTwoFactor(user: User): boolean {
  return isSystemAdmin(user);
}

export const customerStatsRollupSchema = z.object({
  rental_count: nonNegInt,
  last_rental_at: z.string().nullable().optional().default(null),
  total_spent_minor: nonNegInt.nullable().optional().default(null),
  total_invoiced_minor: nonNegInt.nullable().optional().default(null),
  open_ar_minor: nonNegInt.nullable().optional().default(null),
  avg_rental_value_minor: nonNegInt.nullable().optional().default(null),
});
export type CustomerStatsRollup = z.infer<typeof customerStatsRollupSchema>;

export const vehicleStatsRollupSchema = z.object({
  rental_count: nonNegInt,
  utilization_pct: z.number().min(0).max(100),
  total_km_driven: nonNegInt,
  idle_days: nonNegInt.nullable().optional().default(null),
  revenue_minor: z.number().int().nullable().optional().default(null),
  expense_minor: z.number().int().nullable().optional().default(null),
  net_roi_minor: z.number().int().nullable().optional().default(null),
});
export type VehicleStatsRollup = z.infer<typeof vehicleStatsRollupSchema>;

export const vehicleCategories = [
  "sedan",
  "suv",
  "pickup_4x4",
  "van_minibus",
  "hatchback",
  "luxury",
  "commercial",
  "other",
] as const;
export type VehicleCategory = (typeof vehicleCategories)[number];
export const vehicleCategoryLabels: Record<VehicleCategory, string> = {
  sedan: "Sedan",
  suv: "SUV",
  pickup_4x4: "Pickup / 4x4",
  van_minibus: "Van / Minibus",
  hatchback: "Hatchback",
  luxury: "Executive / Luxury",
  commercial: "Commercial",
  other: "Other",
};

export const vehicleFuelTypes = [
  "petrol",
  "diesel",
  "hybrid",
  "electric",
  "lpg",
] as const;
export type VehicleFuelType = (typeof vehicleFuelTypes)[number];
export const vehicleFuelTypeLabels: Record<VehicleFuelType, string> = {
  petrol: "Petrol",
  diesel: "Diesel",
  hybrid: "Hybrid",
  electric: "Electric",
  lpg: "LPG",
};

export const vehicleTransmissions = ["automatic", "manual", "cvt"] as const;
export type VehicleTransmission = (typeof vehicleTransmissions)[number];
export const vehicleTransmissionLabels: Record<VehicleTransmission, string> = {
  automatic: "Automatic",
  manual: "Manual",
  cvt: "CVT",
};

export const vehicleFinancingTypes = [
  "cash_purchase",
  "loan",
  "finance_lease",
  "operating_lease",
] as const;
export type VehicleFinancingType = (typeof vehicleFinancingTypes)[number];
export const vehicleFinancingLabels: Record<VehicleFinancingType, string> = {
  cash_purchase: "Cash purchase",
  loan: "Bank loan",
  finance_lease: "Finance lease",
  operating_lease: "Operating lease",
};

export const customerSchema = z.object({
  ...ownership,
  name: z.string(),
  type: z.enum(["individual", "corporate"]),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  id_number: z.string().nullable().optional(),
  driver_licence_number: z.string().nullable().optional(),
  driver_licence_expires_at: z.string().nullable().optional(),
  company_registration: z.string().nullable().optional(),
  tin: z.string().nullable().optional(),
  contact_person_name: z.string().nullable().optional(),
  contact_person_phone: z.string().nullable().optional(),
  billing_address: z.string().nullable().optional(),
  credit_limit_minor: nonNegInt.nullable().optional(),
  payment_terms_days: nonNegInt.nullable().optional(),
  stats: customerStatsRollupSchema.optional(),
});
export const vehicleSchema = z.object({
  ...ownership,
  registration: z.string(),
  vin: z.string().nullable().optional(),
  make: z.string(),
  model: z.string(),
  year: z.number().int().nullable(),
  category: z.enum(vehicleCategories).nullable().optional(),
  fuel_type: z.enum(vehicleFuelTypes).nullable().optional(),
  transmission: z.enum(vehicleTransmissions).nullable().optional(),
  current_location: z.string().nullable().optional(),
  odometer: z.number().int().nonnegative(),
  odometer_unit: z.literal("km").optional().default("km"),
  daily_rate_minor: z.number().int().nonnegative().optional().default(0),
  functions: z
    .array(z.string().trim().min(1).max(MAX_VEHICLE_FUNCTION_LENGTH))
    .max(MAX_VEHICLE_FUNCTIONS)
    .optional()
    .default([]),
  status: z.enum([
    "available",
    "reserved",
    "rented",
    "maintenance",
    "damaged",
    "accident",
    "awaiting_inspection",
    "awaiting_repair",
    "sold",
    "decommissioned",
  ]),
  acquisition_date: z.string().nullable().optional(),
  acquisition_cost_minor: nonNegInt.nullable().optional(),
  financing_type: z.enum(vehicleFinancingTypes).nullable().optional(),
  financing_provider: z.string().nullable().optional(),
  financing_monthly_minor: nonNegInt.nullable().optional(),
  financing_end_date: z.string().nullable().optional(),
  current_book_value_minor: nonNegInt.nullable().optional(),
  residual_value_minor: nonNegInt.nullable().optional(),
  insurance_policy_number: z.string().nullable().optional(),
  insurance_provider: z.string().nullable().optional(),
  insurance_expires_at: z.string().nullable().optional(),
  roadworthy_expires_at: z.string().nullable().optional(),
  licence_expires_at: z.string().nullable().optional(),
  stats: vehicleStatsRollupSchema.optional(),
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

export const distanceUnits = ["km", "mi"] as const;
export type DistanceUnit = (typeof distanceUnits)[number];
export const volumeUnits = ["l", "gal_us"] as const;
export type VolumeUnit = (typeof volumeUnits)[number];
export const fuelEfficiencyUnits = [
  "l_per_100km",
  "km_per_l",
  "mpg_us",
  "mpg_uk",
] as const;
export type FuelEfficiencyUnit = (typeof fuelEfficiencyUnits)[number];
export const weightUnits = ["kg", "lb"] as const;
export type WeightUnit = (typeof weightUnits)[number];

export const companySettingsSchema = z.object({
  company_id: numericId,
  currency: z.string(),
  vat_rate_pct: nonNegNumber.pipe(z.number().max(100)),
  discount_approval_threshold_pct: nonNegNumber.pipe(z.number().max(100)),
  require_inspection_photos: z.boolean().optional().default(false),
  distance_unit: z.enum(distanceUnits).optional().default("km"),
  volume_unit: z.enum(volumeUnits).optional().default("l"),
  fuel_efficiency_unit: z
    .enum(fuelEfficiencyUnits)
    .optional()
    .default("l_per_100km"),
  weight_unit: z.enum(weightUnits).optional().default("kg"),
  require_2fa_for_privileged: z.boolean().optional().default(false),
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
  customer_accepted_at: z.string().nullable().optional().default(null),
  customer_acceptance_ref: z.string().nullable().optional().default(null),
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
  security_deposit_minor: nonNegInt.optional().default(0),
  deposit_status: z
    .enum(["none", "held", "refunded", "retained"])
    .optional()
    .default("none"),
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
  po_count: nonNegInt.optional(),
  total_spend_minor: nonNegInt.nullable().optional(),
  open_ap_minor: nonNegInt.nullable().optional(),
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

export const messageChannels = [
  "dispatch",
  "drivers",
  "customers",
  "support",
] as const;
export type MessageChannel = (typeof messageChannels)[number];

export const liveMessageSchema = z.object({
  id: numericId,
  company_id: numericId,
  branch_id: numericId.nullable().optional().default(null),
  sender_user_id: numericId,
  sender_name: z.string(),
  channel: z.enum(messageChannels),
  body: z.string(),
  related_entity_type: z.string().nullable().optional().default(null),
  related_entity_id: numericId.nullable().optional().default(null),
  is_read: z.boolean().optional().default(false),
  created_at: z.string(),
});

export const liveNotificationSchema = z.object({
  id: numericId,
  company_id: numericId,
  branch_id: numericId.nullable().optional().default(null),
  severity: z.enum(["info", "warning", "danger", "success"]).default("info"),
  title: z.string(),
  body: z.string(),
  href: z.string().nullable().optional().default(null),
  read_at: z.string().nullable().optional().default(null),
  created_at: z.string(),
});

export const dashboardSummarySchema = z.object({
  fleet: z.object({
    total: nonNegInt,
    available: nonNegInt,
    rented: nonNegInt,
    maintenance: nonNegInt,
    damaged: nonNegInt,
    utilization_pct: nonNegNumber,
  }),
  pipeline: z.object({
    quotations: nonNegInt,
    reservations: nonNegInt,
    active_rentals: nonNegInt,
    issued_invoices: nonNegInt,
  }),
  approvals: z.object({
    pending_discount_quotes: nonNegInt,
    pending_purchase_orders: nonNegInt,
    low_stock_parts: nonNegInt,
    overdue_invoices: nonNegInt,
  }),
  credit: z
    .object({
      total_receivables_minor: nonNegInt,
      overdue_90_plus_minor: nonNegInt,
      customers_on_hold: nonNegInt,
    })
    .nullable()
    .optional(),
  compliance: z
    .object({
      expired: nonNegInt,
      expiring_30d: nonNegInt,
    })
    .nullable()
    .optional(),
  operations_alerts: z
    .object({
      overdue_returns: nonNegInt,
      awaiting_inspection: nonNegInt,
      accident_or_repair: nonNegInt,
      pending_approvals: nonNegInt,
    })
    .nullable()
    .optional(),
  vehicle_profitability: z
    .array(
      z.object({
        vehicle_id: numericId,
        registration: z.string(),
        make_model: z.string(),
        revenue_minor: z.number().int(),
        cost_minor: z.number().int(),
        profit_minor: z.number().int(),
      }),
    )
    .optional(),
  finance: z
    .object({
      revenue_minor: z.coerce.number().int(),
      vat_minor: nonNegInt,
      receipts_minor: z.coerce.number().int(),
      expenses_minor: nonNegInt,
      outstanding_ar_minor: nonNegInt,
      net_position_minor: z.coerce.number().int(),
    })
    .nullable()
    .optional()
    .default(null),
  driver_summary: z
    .object({
      active_rentals: nonNegInt,
      upcoming_rentals: nonNegInt,
    })
    .nullable()
    .optional()
    .default(null),
});

export const financialReportSchema = z.object({
  summary: z.object({
    invoiced_minor: nonNegInt,
    vat_minor: nonNegInt,
    receipts_minor: nonNegInt,
    refunds_minor: nonNegInt,
    expenses_minor: nonNegInt,
    outstanding_ar_minor: nonNegInt,
    net_position_minor: z.coerce.number().int(),
  }),
  rows: z.array(
    z.object({
      id: z.string(),
      date: z.string(),
      type: z.enum(["invoice", "expense"]),
      reference: z.string(),
      counterparty: z.string(),
      amount_minor: z.coerce.number().int(),
      vat_minor: nonNegInt.optional().default(0),
      status: z.string(),
    }),
  ),
});

export const fleetReportRowSchema = z.object({
  vehicle_id: numericId,
  registration: z.string(),
  make_model: z.string(),
  status: z.string(),
  rental_count: nonNegInt,
  work_order_count: nonNegInt,
  downtime_hours: nonNegNumber,
  revenue_minor: z.coerce.number().int().nullable().optional().default(null),
  maintenance_cost_minor: z.coerce.number().int().nullable().optional().default(null),
  net_roi_minor: z.coerce.number().int().nullable().optional().default(null),
});

export const auditEventSchema = z.object({
  id: numericId,
  company_id: numericId,
  actor_name: z.string().nullable().optional().default(null),
  action: z.string(),
  entity_type: z.string().nullable().optional().default(null),
  entity_id: numericId.nullable().optional().default(null),
  summary: z.string(),
  created_at: z.string(),
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
  two_factor_enabled: z.boolean().optional().default(false),
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
export type LiveMessage = z.infer<typeof liveMessageSchema>;
export type LiveNotification = z.infer<typeof liveNotificationSchema>;
export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;
export type FinancialReport = z.infer<typeof financialReportSchema>;
export type FleetReportRow = z.infer<typeof fleetReportRowSchema>;
export type AuditEventRecord = z.infer<typeof auditEventSchema>;
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
export const canAccessReports = (user: User) =>
  !isDriverRole(user) &&
  (can(user, "reports.view") ||
    can(user, "invoices.view") ||
    can(user, "vehicles.view") ||
    can(user, "audit.view"));
export const canViewAudit = (user: User) => can(user, "audit.view");
export const canAccessMessages = (user: User) =>
  can(user, "messages.view") || isDriverRole(user);
export const canSendMessages = (user: User) =>
  can(user, "messages.send") || isDriverRole(user);
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
export const customerSummarySchema = z.object({
  customer_id: numericId,
  rental_count: nonNegInt,
  last_rental_at: z.string().nullable().optional().default(null),
  total_spent_minor: nonNegInt.nullable().optional().default(null),
  total_invoiced_minor: nonNegInt.nullable().optional().default(null),
  open_ar_minor: nonNegInt.nullable().optional().default(null),
  avg_rental_value_minor: nonNegInt.nullable().optional().default(null),
  recent_rentals: z
    .array(
      z.object({
        id: numericId,
        vehicle_registration: z.string().nullable().optional().default(null),
        status: z.string(),
        started_at: z.string().nullable().optional().default(null),
        returned_at: z.string().nullable().optional().default(null),
      }),
    )
    .optional()
    .default([]),
  recent_invoices: z
    .array(
      z.object({
        id: numericId,
        invoice_number: z.string().nullable().optional().default(null),
        status: z.string(),
        total_minor: nonNegInt,
        outstanding_minor: nonNegInt,
        due_at: z.string().nullable().optional().default(null),
      }),
    )
    .optional()
    .default([]),
});
export type CustomerSummary = z.infer<typeof customerSummarySchema>;

export const customerStatsSummaryMetaSchema = z.object({
  total_customers: nonNegInt,
  active_rentals_count: nonNegInt,
  total_spent_minor: nonNegInt.nullable().optional().default(null),
  total_open_ar_minor: nonNegInt.nullable().optional().default(null),
});
export type CustomerStatsSummaryMeta = z.infer<
  typeof customerStatsSummaryMetaSchema
>;

export const vehicleStatsSummaryMetaSchema = z.object({
  total_vehicles: nonNegInt,
  avg_utilization_pct: z.number().min(0).max(100),
  idle_over_14d_count: nonNegInt,
  unpriced_count: nonNegInt,
  total_net_roi_minor: z.number().int().nullable().optional().default(null),
});
export type VehicleStatsSummaryMeta = z.infer<
  typeof vehicleStatsSummaryMetaSchema
>;

export const branchStatsRowSchema = z.object({
  branch_id: numericId,
  branch_name: z.string(),
  fleet_total: nonNegInt,
  utilization_pct: z.number().min(0).max(100),
  rental_count: nonNegInt,
  work_order_count: nonNegInt,
  downtime_hours: z.number().nonnegative(),
  revenue_minor: z.number().int().nullable().optional().default(null),
  expenses_minor: z.number().int().nullable().optional().default(null),
  net_position_minor: z.number().int().nullable().optional().default(null),
  open_ar_minor: nonNegInt.nullable().optional().default(null),
});
export type BranchStatsRow = z.infer<typeof branchStatsRowSchema>;

export const savedFilterModules = [
  "customers",
  "vehicles",
  "stats_customers",
  "stats_vehicles",
  "stats_branches",
] as const;
export type SavedFilterModule = (typeof savedFilterModules)[number];

export const savedFilterSchema = z.object({
  id: numericId,
  company_id: numericId,
  user_id: numericId,
  module: z.enum(savedFilterModules),
  name: z.string().min(1).max(80),
  filters: z.record(z.string(), z.string()),
  is_shared: z.boolean().default(false),
  requires_finance: z.boolean().default(false),
  created_at: z.string().nullable().optional().default(null),
});
export type SavedFilter = z.infer<typeof savedFilterSchema>;

export const invitationStatuses = [
  "pending",
  "accepted",
  "revoked",
  "expired",
] as const;
export type InvitationStatus = (typeof invitationStatuses)[number];

export const invitationSchema = z.object({
  id: numericId,
  company_id: numericId,
  branch_id: numericId.nullable().optional().default(null),
  branch_name: z.string().nullable().optional().default(null),
  email: z.string(),
  role: z.string(),
  status: z.enum(invitationStatuses),
  invited_by_name: z.string().nullable().optional().default(null),
  expires_at: z.string(),
  accepted_at: z.string().nullable().optional().default(null),
  revoked_at: z.string().nullable().optional().default(null),
  created_at: z.string().nullable().optional().default(null),
});
export type Invitation = z.infer<typeof invitationSchema>;

export const invitationPreviewSchema = z.object({
  email: z.string(),
  company_name: z.string(),
  branch_name: z.string().nullable().optional().default(null),
  role: z.string(),
  expires_at: z.string(),
  account_exists: z.boolean(),
});
export type InvitationPreview = z.infer<typeof invitationPreviewSchema>;

export const fuelPolicies = [
  "full_to_full",
  "same_to_same",
  "prepaid",
] as const;
export type FuelPolicy = (typeof fuelPolicies)[number];

export const rateCardSchema = z.object({
  id: numericId,
  company_id: numericId,
  branch_id: numericId.nullable().optional().default(null),
  customer_id: numericId.nullable().optional().default(null),
  customer_name: z.string().nullable().optional().default(null),
  name: z.string(),
  vehicle_category: z.string().nullable().optional().default(null),
  daily_rate_minor: nonNegInt,
  weekly_rate_minor: nonNegInt.nullable().optional().default(null),
  monthly_rate_minor: nonNegInt.nullable().optional().default(null),
  chauffeur_daily_minor: nonNegInt.nullable().optional().default(null),
  daily_km_limit: nonNegInt.nullable().optional().default(null),
  excess_km_rate_minor: nonNegInt.optional().default(0),
  security_deposit_minor: nonNegInt.optional().default(0),
  late_return_hourly_minor: nonNegInt.optional().default(0),
  fuel_policy: z.enum(fuelPolicies).optional().default("full_to_full"),
  is_active: z.boolean().optional().default(true),
  created_at: z.string().nullable().optional().default(null),
});
export type RateCard = z.infer<typeof rateCardSchema>;

export const vehicleInspectionSchema = z.object({
  id: numericId,
  company_id: numericId,
  branch_id: numericId,
  rental_id: numericId,
  vehicle_id: numericId,
  recorded_by_name: z.string().nullable().optional().default(null),
  type: z.enum(["handover", "return"]),
  odometer: nonNegInt,
  fuel_level_pct: z.number().int().min(0).max(100),
  exterior_ok: z.boolean(),
  interior_ok: z.boolean(),
  tyres_ok: z.boolean(),
  spare_tyre_ok: z.boolean(),
  tools_ok: z.boolean(),
  accessories_ok: z.boolean(),
  documents_ok: z.boolean(),
  damage_notes: z.string().nullable().optional().default(null),
  customer_acknowledged_by: z.string().nullable().optional().default(null),
  customer_acknowledged_at: z.string().nullable().optional().default(null),
  created_at: z.string().nullable().optional().default(null),
});
export type VehicleInspection = z.infer<typeof vehicleInspectionSchema>;

export const maintenanceScheduleSchema = z.object({
  id: numericId,
  company_id: numericId,
  branch_id: numericId,
  vehicle_id: numericId,
  vehicle_registration: z.string().nullable().optional().default(null),
  vehicle_label: z.string().nullable().optional().default(null),
  current_odometer: nonNegInt.optional().default(0),
  service_name: z.string(),
  interval_km: nonNegInt.nullable().optional().default(null),
  interval_days: nonNegInt.nullable().optional().default(null),
  last_service_odometer: nonNegInt.optional().default(0),
  last_service_at: z.string().nullable().optional().default(null),
  next_due_odometer: nonNegInt.nullable().optional().default(null),
  next_due_at: z.string().nullable().optional().default(null),
  status: z.enum(["ok", "due_soon", "overdue"]),
  is_active: z.boolean().optional().default(true),
});
export type MaintenanceSchedule = z.infer<typeof maintenanceScheduleSchema>;

export const componentPositions = [
  "FL",
  "FR",
  "RL",
  "RR",
  "SPARE",
  "BATTERY",
] as const;
export type ComponentPosition = (typeof componentPositions)[number];

export const vehicleComponentSchema = z.object({
  id: numericId,
  company_id: numericId,
  branch_id: numericId,
  vehicle_id: numericId,
  vehicle_registration: z.string().nullable().optional().default(null),
  component_type: z.enum(["tyre", "battery"]),
  serial_number: z.string(),
  brand_model: z.string(),
  position: z.enum(componentPositions),
  installed_at: z.string(),
  installed_odometer: nonNegInt.optional().default(0),
  warranty_expires_at: z.string().nullable().optional().default(null),
  status: z.enum(["active", "replaced", "scrapped"]),
  replaced_at: z.string().nullable().optional().default(null),
  notes: z.string().nullable().optional().default(null),
});
export type VehicleComponent = z.infer<typeof vehicleComponentSchema>;

export const fuelTransactionSchema = z.object({
  id: numericId,
  company_id: numericId,
  branch_id: numericId,
  vehicle_id: numericId,
  vehicle_registration: z.string().nullable().optional().default(null),
  driver_user_id: numericId.nullable().optional().default(null),
  driver_name: z.string().nullable().optional().default(null),
  rental_id: numericId.nullable().optional().default(null),
  expense_id: numericId.nullable().optional().default(null),
  fuel_date: z.string(),
  station: z.string().nullable().optional().default(null),
  litres: nonNegNumber,
  amount_minor: nonNegInt,
  odometer: nonNegInt,
  payment_method: z.string().optional().default("cash"),
  km_since_last: nonNegInt.nullable().optional().default(null),
  litres_per_100km: nonNegNumber.nullable().optional().default(null),
  cost_per_km_minor: nonNegInt.nullable().optional().default(null),
  is_abnormal: z.boolean().optional().default(false),
  created_at: z.string().nullable().optional().default(null),
});
export type FuelTransaction = z.infer<typeof fuelTransactionSchema>;

export const creditAccountSchema = z.object({
  customer_id: numericId,
  company_id: numericId,
  branch_id: numericId,
  customer_name: z.string(),
  customer_type: z.enum(["individual", "corporate"]),
  tin: z.string().nullable().optional().default(null),
  credit_limit_minor: nonNegInt.nullable().optional().default(null),
  payment_terms_days: nonNegInt.optional().default(30),
  open_ar_minor: nonNegInt.optional().default(0),
  overdue_minor: nonNegInt.optional().default(0),
  is_on_credit_hold: z.boolean().optional().default(false),
  credit_hold_reason: z.string().nullable().optional().default(null),
});
export type CreditAccount = z.infer<typeof creditAccountSchema>;

export const collectionNoteTypes = [
  "reminder",
  "promise_to_pay",
  "dispute",
  "escalation",
  "general",
] as const;
export type CollectionNoteType = (typeof collectionNoteTypes)[number];

export const collectionNoteStatuses = [
  "open",
  "kept",
  "broken",
  "resolved",
] as const;
export type CollectionNoteStatus = (typeof collectionNoteStatuses)[number];

export const collectionNoteSchema = z.object({
  id: numericId,
  company_id: numericId,
  branch_id: numericId.nullable().optional().default(null),
  customer_id: numericId,
  customer_name: z.string().nullable().optional().default(null),
  created_by_name: z.string().nullable().optional().default(null),
  note_type: z.enum(collectionNoteTypes),
  promised_amount_minor: nonNegInt.nullable().optional().default(null),
  promised_date: z.string().nullable().optional().default(null),
  status: z.enum(collectionNoteStatuses),
  notes: z.string(),
  created_at: z.string().nullable().optional().default(null),
});
export type CollectionNote = z.infer<typeof collectionNoteSchema>;

export const customerStatementSchema = z.object({
  customer_id: numericId,
  customer_name: z.string(),
  from: z.string().nullable().optional().default(null),
  to: z.string().nullable().optional().default(null),
  opening_balance_minor: z.number().int(),
  closing_balance_minor: z.number().int(),
  rows: z.array(
    z.object({
      date: z.string(),
      type: z.enum(["invoice", "payment", "refund", "credit_note"]),
      reference: z.string(),
      description: z.string(),
      debit_minor: nonNegInt,
      credit_minor: nonNegInt,
      balance_minor: z.number().int(),
    }),
  ),
});
export type CustomerStatement = z.infer<typeof customerStatementSchema>;

export const approvalTypes = [
  "discount",
  "credit_limit",
  "vehicle_repair",
  "purchase",
  "refund_writeoff",
  "contract_amendment",
  "vehicle_disposal",
] as const;
export type ApprovalType = (typeof approvalTypes)[number];

export const approvalTypeLabels: Record<ApprovalType, string> = {
  discount: "Discount",
  credit_limit: "Credit limit / hold",
  vehicle_repair: "Vehicle repair",
  purchase: "Purchase",
  refund_writeoff: "Refund / write-off",
  contract_amendment: "Contract amendment",
  vehicle_disposal: "Vehicle disposal",
};

export const approvalStatuses = [
  "pending",
  "approved",
  "rejected",
  "cancelled",
] as const;
export type ApprovalStatus = (typeof approvalStatuses)[number];

export const approvalRequestSchema = z.object({
  id: numericId,
  company_id: numericId,
  branch_id: numericId.nullable().optional().default(null),
  type: z.enum(approvalTypes),
  entity_type: z.string().nullable().optional().default(null),
  entity_id: numericId.nullable().optional().default(null),
  title: z.string(),
  requester_id: numericId,
  requester_name: z.string().nullable().optional().default(null),
  approver_id: numericId.nullable().optional().default(null),
  approver_name: z.string().nullable().optional().default(null),
  previous_value: z.string().nullable().optional().default(null),
  requested_value: z.string(),
  approved_value: z.string().nullable().optional().default(null),
  reason: z.string(),
  decision_notes: z.string().nullable().optional().default(null),
  status: z.enum(approvalStatuses),
  decided_at: z.string().nullable().optional().default(null),
  created_at: z.string().nullable().optional().default(null),
});
export type ApprovalRequest = z.infer<typeof approvalRequestSchema>;

export const complianceCategories = [
  "insurance",
  "roadworthy",
  "vehicle_licence",
  "driver_licence",
  "contract",
  "kyc",
  "other",
] as const;
export type ComplianceCategory = (typeof complianceCategories)[number];

export const complianceBuckets = [
  "expired",
  "d7",
  "d14",
  "d30",
  "valid",
] as const;
export type ComplianceBucket = (typeof complianceBuckets)[number];

export const complianceExpiryRowSchema = z.object({
  document_id: numericId,
  company_id: numericId,
  branch_id: numericId,
  entity_type: z.string().nullable().optional().default(null),
  entity_id: numericId.nullable().optional().default(null),
  entity_label: z.string().nullable().optional().default(null),
  original_name: z.string(),
  category: z.enum(complianceCategories).optional().default("other"),
  expires_at: z.string(),
  days_remaining: z.number().int(),
  bucket: z.enum(complianceBuckets),
});
export type ComplianceExpiryRow = z.infer<typeof complianceExpiryRowSchema>;

export const complianceSummarySchema = z.object({
  expired: nonNegInt,
  d7: nonNegInt,
  d14: nonNegInt,
  d30: nonNegInt,
  valid: nonNegInt,
});
export type ComplianceSummary = z.infer<typeof complianceSummarySchema>;

export function canDecideApprovals(user: User): boolean {
  return (
    user.is_platform_admin ||
    user.permissions.includes("quotations.approve_discount") ||
    user.permissions.includes("purchase_orders.approve") ||
    user.permissions.includes("invoices.manage")
  );
}

// ---------- Milestone 15: Full Accounting (AP, Credit Notes, Banking, Fixed Assets, Statements) ----------

export const supplierInvoiceMatchStatuses = [
  "matched",
  "variance",
  "non_po",
] as const;
export type SupplierInvoiceMatchStatus =
  (typeof supplierInvoiceMatchStatuses)[number];

export const supplierInvoiceStatuses = [
  "draft",
  "pending_approval",
  "approved",
  "partially_paid",
  "paid",
  "void",
] as const;
export type SupplierInvoiceStatus = (typeof supplierInvoiceStatuses)[number];

export const supplierInvoiceSchema = z.object({
  id: numericId,
  company_id: numericId,
  branch_id: numericId,
  supplier_id: numericId,
  supplier_name: z.string().nullable().optional().default(null),
  purchase_order_id: numericId.nullable().optional().default(null),
  invoice_number: z.string(),
  invoice_date: z.string(),
  due_at: z.string(),
  subtotal_minor: nonNegInt,
  vat_minor: nonNegInt.optional().default(0),
  total_minor: nonNegInt,
  paid_minor: nonNegInt.optional().default(0),
  outstanding_minor: nonNegInt,
  expense_account_code: z.string().nullable().optional().default(null),
  match_status: z.enum(supplierInvoiceMatchStatuses),
  variance_minor: z.number().int().optional().default(0),
  approval_request_id: numericId.nullable().optional().default(null),
  status: z.enum(supplierInvoiceStatuses),
  notes: z.string().nullable().optional().default(null),
  created_at: z.string().nullable().optional().default(null),
});
export type SupplierInvoice = z.infer<typeof supplierInvoiceSchema>;

export const apAgeingSchema = z.object({
  total_open_minor: nonNegInt,
  buckets: z.object({
    current: nonNegInt,
    d1_30: nonNegInt,
    d31_60: nonNegInt,
    d61_90: nonNegInt,
    d90_plus: nonNegInt,
  }),
});
export type ApAgeing = z.infer<typeof apAgeingSchema>;

export const creditNoteStatuses = [
  "pending_approval",
  "posted",
  "rejected",
] as const;
export type CreditNoteStatus = (typeof creditNoteStatuses)[number];

export const creditNoteSchema = z.object({
  id: numericId,
  company_id: numericId,
  branch_id: numericId,
  invoice_id: numericId,
  invoice_number: z.string().nullable().optional().default(null),
  customer_id: numericId,
  customer_name: z.string().nullable().optional().default(null),
  credit_note_number: z.string(),
  subtotal_minor: nonNegInt,
  vat_minor: nonNegInt.optional().default(0),
  total_minor: nonNegInt,
  reason: z.string(),
  status: z.enum(creditNoteStatuses),
  approval_request_id: numericId.nullable().optional().default(null),
  posted_at: z.string().nullable().optional().default(null),
  created_at: z.string().nullable().optional().default(null),
});
export type CreditNote = z.infer<typeof creditNoteSchema>;

export const bankAccountSchema = z.object({
  id: numericId,
  company_id: numericId,
  branch_id: numericId.nullable().optional().default(null),
  name: z.string(),
  bank_name: z.string(),
  account_number_masked: z.string(),
  currency: z.string(),
  gl_account_code: z.string(),
  opening_balance_minor: z.number().int(),
  ledger_balance_minor: z.number().int(),
  last_reconciled_at: z.string().nullable().optional().default(null),
  is_active: z.boolean().optional().default(true),
});
export type BankAccount = z.infer<typeof bankAccountSchema>;

export const bankMatchCandidateSchema = z.object({
  entity_type: z.enum([
    "payment",
    "supplier_payment",
    "refund",
    "expense",
    "journal_entry",
  ]),
  entity_id: numericId,
  label: z.string(),
  date: z.string(),
  amount_minor: z.number().int(),
});
export type BankMatchCandidate = z.infer<typeof bankMatchCandidateSchema>;

export const bankTransactionSchema = z.object({
  id: numericId,
  bank_account_id: numericId,
  transaction_date: z.string(),
  description: z.string(),
  reference: z.string().nullable().optional().default(null),
  amount_minor: z.number().int(),
  match_status: z.enum(["unmatched", "matched", "adjusted"]),
  matched_entity_type: z.string().nullable().optional().default(null),
  matched_entity_id: numericId.nullable().optional().default(null),
  matched_label: z.string().nullable().optional().default(null),
  reconciliation_id: numericId.nullable().optional().default(null),
  suggested_matches: z.array(bankMatchCandidateSchema).optional().default([]),
});
export type BankTransaction = z.infer<typeof bankTransactionSchema>;

export const bankReconciliationSchema = z.object({
  id: numericId,
  bank_account_id: numericId,
  statement_date: z.string(),
  statement_closing_balance_minor: z.number().int(),
  reconciled_balance_minor: z.number().int(),
  status: z.enum(["open", "closed"]),
  closed_at: z.string().nullable().optional().default(null),
});
export type BankReconciliation = z.infer<typeof bankReconciliationSchema>;

export const fixedAssetCategories = [
  "vehicle",
  "workshop_equipment",
  "office_equipment",
  "other",
] as const;
export type FixedAssetCategory = (typeof fixedAssetCategories)[number];

export const depreciationMethods = [
  "straight_line",
  "reducing_balance",
] as const;
export type DepreciationMethod = (typeof depreciationMethods)[number];

export const fixedAssetSchema = z.object({
  id: numericId,
  company_id: numericId,
  branch_id: numericId,
  vehicle_id: numericId.nullable().optional().default(null),
  vehicle_registration: z.string().nullable().optional().default(null),
  asset_code: z.string(),
  name: z.string(),
  category: z.enum(fixedAssetCategories),
  acquisition_cost_minor: nonNegInt,
  residual_value_minor: nonNegInt,
  capitalisation_date: z.string(),
  useful_life_months: id,
  depreciation_method: z.enum(depreciationMethods),
  accumulated_depreciation_minor: nonNegInt,
  net_book_value_minor: nonNegInt,
  status: z.enum(["active", "pending_disposal", "disposed"]),
  disposal_type: z.enum(["sold", "decommissioned"]).nullable().optional().default(null),
  disposal_date: z.string().nullable().optional().default(null),
  disposal_proceeds_minor: nonNegInt.nullable().optional().default(null),
  disposal_gain_loss_minor: z.number().int().nullable().optional().default(null),
  disposal_approval_id: numericId.nullable().optional().default(null),
  disposal_approval_status: z.string().nullable().optional().default(null),
});
export type FixedAsset = z.infer<typeof fixedAssetSchema>;

export const depreciationRunResultSchema = z.object({
  period_month: z.string(),
  posted_count: nonNegInt,
  skipped_count: nonNegInt,
  total_depreciation_minor: nonNegInt,
});
export type DepreciationRunResult = z.infer<typeof depreciationRunResultSchema>;

export const statementLineSchema = z.object({
  account_code: z.string(),
  account_name: z.string(),
  amount_minor: z.number().int(),
});
export type StatementLine = z.infer<typeof statementLineSchema>;

export const pnlStatementSchema = z.object({
  from: z.string().nullable().optional().default(null),
  to: z.string().nullable().optional().default(null),
  revenue_lines: z.array(statementLineSchema),
  expense_lines: z.array(statementLineSchema),
  total_revenue_minor: z.number().int(),
  total_expenses_minor: z.number().int(),
  net_profit_minor: z.number().int(),
});
export type PnlStatement = z.infer<typeof pnlStatementSchema>;

export const balanceSheetSchema = z.object({
  as_of: z.string(),
  asset_lines: z.array(statementLineSchema),
  liability_lines: z.array(statementLineSchema),
  equity_lines: z.array(statementLineSchema),
  total_assets_minor: z.number().int(),
  total_liabilities_minor: z.number().int(),
  total_equity_minor: z.number().int(),
  is_balanced: z.boolean(),
});
export type BalanceSheet = z.infer<typeof balanceSheetSchema>;

export const cashFlowStatementSchema = z.object({
  from: z.string().nullable().optional().default(null),
  to: z.string().nullable().optional().default(null),
  operating_lines: z.array(statementLineSchema),
  investing_lines: z.array(statementLineSchema),
  financing_lines: z.array(statementLineSchema),
  operating_total_minor: z.number().int(),
  investing_total_minor: z.number().int(),
  financing_total_minor: z.number().int(),
  net_cash_change_minor: z.number().int(),
  opening_cash_minor: z.number().int(),
  closing_cash_minor: z.number().int(),
});
export type CashFlowStatement = z.infer<typeof cashFlowStatementSchema>;

export function canAccessAp(user: User): boolean {
  return (
    user.is_platform_admin ||
    user.permissions.includes("ap.view") ||
    user.permissions.includes("invoices.view") ||
    user.permissions.includes("expenses.view")
  );
}
export function canManageAp(user: User): boolean {
  return (
    user.is_platform_admin ||
    user.permissions.includes("ap.manage") ||
    user.permissions.includes("invoices.manage") ||
    user.permissions.includes("expenses.manage")
  );
}
export function canAccessBanking(user: User): boolean {
  return (
    user.is_platform_admin ||
    user.permissions.includes("banking.view") ||
    user.permissions.includes("gl.view")
  );
}
export function canManageBanking(user: User): boolean {
  return (
    user.is_platform_admin ||
    user.permissions.includes("banking.manage") ||
    user.permissions.includes("expenses.manage") ||
    user.permissions.includes("invoices.manage")
  );
}
export function canAccessAssets(user: User): boolean {
  return (
    user.is_platform_admin ||
    user.permissions.includes("assets.view") ||
    user.permissions.includes("gl.view")
  );
}
export function canManageAssets(user: User): boolean {
  return (
    user.is_platform_admin ||
    user.permissions.includes("assets.manage") ||
    user.permissions.includes("expenses.manage") ||
    user.permissions.includes("invoices.manage")
  );
}
export function canViewStatements(user: User): boolean {
  return (
    user.is_platform_admin ||
    user.permissions.includes("gl.view") ||
    user.permissions.includes("invoices.view")
  );
}

// ---------- Milestone 16: CRM Leads & Privileged TOTP 2FA ----------

export const leadStages = [
  "new",
  "contacted",
  "qualified",
  "proposal_sent",
  "won",
  "lost",
] as const;
export type LeadStage = (typeof leadStages)[number];

export const leadStageLabels: Record<LeadStage, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  proposal_sent: "Proposal sent",
  won: "Won",
  lost: "Lost",
};

export const leadSources = [
  "website",
  "referral",
  "corporate_outreach",
  "walk_in",
  "phone",
  "other",
] as const;
export type LeadSource = (typeof leadSources)[number];

export const leadSourceLabels: Record<LeadSource, string> = {
  website: "Website",
  referral: "Referral",
  corporate_outreach: "Corporate outreach",
  walk_in: "Walk-in",
  phone: "Phone inquiry",
  other: "Other",
};

export const leadSchema = z.object({
  id: numericId,
  company_id: numericId,
  branch_id: numericId,
  contact_name: z.string(),
  company_name: z.string().nullable().optional().default(null),
  customer_type: z.enum(["individual", "corporate"]),
  email: z.string().nullable().optional().default(null),
  phone: z.string().nullable().optional().default(null),
  source: z.enum(leadSources),
  stage: z.enum(leadStages),
  vehicle_requirements: z.string().nullable().optional().default(null),
  expected_start_date: z.string().nullable().optional().default(null),
  expected_days: nonNegInt.nullable().optional().default(null),
  estimated_value_minor: nonNegInt.nullable().optional().default(null),
  assigned_to_user_id: numericId.nullable().optional().default(null),
  assigned_to_name: z.string().nullable().optional().default(null),
  next_follow_up_at: z.string().nullable().optional().default(null),
  lost_reason: z.string().nullable().optional().default(null),
  customer_id: numericId.nullable().optional().default(null),
  quotation_id: numericId.nullable().optional().default(null),
  notes: z.string().nullable().optional().default(null),
  created_at: z.string().nullable().optional().default(null),
  updated_at: z.string().nullable().optional().default(null),
});
export type Lead = z.infer<typeof leadSchema>;

export const twoFactorSetupSchema = z.object({
  secret: z.string(),
  otpauth_uri: z.string(),
});
export type TwoFactorSetup = z.infer<typeof twoFactorSetupSchema>;

export const twoFactorConfirmSchema = z.object({
  two_factor_enabled: z.boolean(),
  recovery_codes: z.array(z.string()),
});
export type TwoFactorConfirm = z.infer<typeof twoFactorConfirmSchema>;

export function canAccessLeads(user: User): boolean {
  return (
    user.is_platform_admin ||
    user.permissions.includes("leads.view") ||
    user.permissions.includes("quotations.view")
  );
}

export function canManageLeads(user: User): boolean {
  return (
    user.is_platform_admin ||
    user.permissions.includes("leads.manage") ||
    user.permissions.includes("quotations.manage")
  );
}

// ---------- Milestone 16.5: Complete SRS Parity Schemas ----------

export const incidentTypes = [
  "accident",
  "breakdown",
  "damage",
  "theft_vandalism",
] as const;
export type IncidentType = (typeof incidentTypes)[number];

export const incidentSeverities = [
  "minor",
  "moderate",
  "major",
  "total_loss",
] as const;
export type IncidentSeverity = (typeof incidentSeverities)[number];

export const incidentStatuses = [
  "reported",
  "assessing",
  "repairing",
  "closed",
] as const;
export type IncidentStatus = (typeof incidentStatuses)[number];

export const vehicleIncidentSchema = z.object({
  id: numericId,
  company_id: numericId,
  branch_id: numericId,
  vehicle_id: numericId,
  vehicle_registration: z.string().nullable().optional().default(null),
  rental_id: numericId.nullable().optional().default(null),
  incident_type: z.enum(incidentTypes),
  severity: z.enum(incidentSeverities),
  occurred_at: z.string(),
  location: z.string().nullable().optional().default(null),
  driver_name: z.string().nullable().optional().default(null),
  insurance_claim_number: z.string().nullable().optional().default(null),
  estimated_cost_minor: nonNegInt.nullable().optional().default(null),
  description: z.string(),
  status: z.enum(incidentStatuses),
  work_order_id: numericId.nullable().optional().default(null),
  created_at: z.string().nullable().optional().default(null),
});
export type VehicleIncident = z.infer<typeof vehicleIncidentSchema>;

export const vehicleHistorySchema = z.object({
  vehicle_id: numericId,
  rentals: z.array(
    z.object({
      id: numericId,
      customer_name: z.string().nullable().optional().default(null),
      status: z.string(),
      started_at: z.string().nullable().optional().default(null),
      returned_at: z.string().nullable().optional().default(null),
      revenue_minor: nonNegInt.nullable().optional().default(null),
    }),
  ),
  fuel: z.array(
    z.object({
      id: numericId,
      filled_at: z.string(),
      litres: nonNegNumber,
      amount_minor: nonNegInt.nullable().optional().default(null),
      odometer_km: nonNegInt,
      litres_per_100km: nonNegNumber.nullable().optional().default(null),
      is_abnormal: z.boolean().optional().default(false),
    }),
  ),
  work_orders: z.array(
    z.object({
      id: numericId,
      title: z.string(),
      status: z.string(),
      total_cost_minor: nonNegInt.nullable().optional().default(null),
      created_at: z.string().nullable().optional().default(null),
    }),
  ),
  incidents: z.array(vehicleIncidentSchema),
  compliance: z.object({
    insurance_policy_number: z.string().nullable().optional().default(null),
    insurance_provider: z.string().nullable().optional().default(null),
    insurance_expires_at: z.string().nullable().optional().default(null),
    roadworthy_expires_at: z.string().nullable().optional().default(null),
    licence_expires_at: z.string().nullable().optional().default(null),
  }),
});
export type VehicleHistory = z.infer<typeof vehicleHistorySchema>;

export const purchaseRequisitionStatuses = [
  "pending",
  "approved",
  "rejected",
  "converted",
] as const;
export type PurchaseRequisitionStatus =
  (typeof purchaseRequisitionStatuses)[number];

export const purchaseRequisitionSchema = z.object({
  id: numericId,
  company_id: numericId,
  branch_id: numericId,
  requester_id: numericId,
  requester_name: z.string().nullable().optional().default(null),
  approver_id: numericId.nullable().optional().default(null),
  approver_name: z.string().nullable().optional().default(null),
  supplier_id: numericId.nullable().optional().default(null),
  supplier_name: z.string().nullable().optional().default(null),
  requisition_number: z.string(),
  department: z.string(),
  needed_by: z.string(),
  justification: z.string(),
  items: z.array(
    z.object({
      description: z.string(),
      quantity: numericId,
      estimated_unit_minor: nonNegInt,
    }),
  ),
  estimated_total_minor: nonNegInt,
  status: z.enum(purchaseRequisitionStatuses),
  purchase_order_id: numericId.nullable().optional().default(null),
  created_at: z.string().nullable().optional().default(null),
});
export type PurchaseRequisition = z.infer<typeof purchaseRequisitionSchema>;

export const supplierStatementSchema = z.object({
  supplier_id: numericId,
  supplier_name: z.string(),
  from: z.string().nullable().optional().default(null),
  to: z.string().nullable().optional().default(null),
  opening_balance_minor: z.number().int(),
  closing_balance_minor: z.number().int(),
  rows: z.array(
    z.object({
      date: z.string(),
      type: z.enum(["supplier_invoice", "supplier_payment"]),
      reference: z.string(),
      description: z.string(),
      debit_minor: nonNegInt,
      credit_minor: nonNegInt,
      balance_minor: z.number().int(),
    }),
  ),
});
export type SupplierStatement = z.infer<typeof supplierStatementSchema>;

export const vatReturnSchema = z.object({
  from: z.string().nullable().optional().default(null),
  to: z.string().nullable().optional().default(null),
  output_vat_minor: nonNegInt,
  credit_note_vat_minor: nonNegInt,
  net_output_vat_minor: z.number().int(),
  input_vat_minor: nonNegInt,
  net_vat_payable_minor: z.number().int(),
  taxable_sales_minor: nonNegInt,
  taxable_purchases_minor: nonNegInt,
});
export type VatReturn = z.infer<typeof vatReturnSchema>;

export const approvalThresholdSchema = z.object({
  type: z.enum(approvalTypes),
  threshold_minor: nonNegInt.nullable().optional().default(null),
  threshold_pct: nonNegNumber.nullable().optional().default(null),
  approver_role: z.string(),
  is_active: z.boolean().default(true),
});
export type ApprovalThreshold = z.infer<typeof approvalThresholdSchema>;

// ---------- M16.5.5 Internal Virtual Meetings ----------

export const meetingProviders = [
  "jitsi_embedded",
  "zoom",
  "teams",
  "google_meet",
] as const;
export type MeetingProvider = (typeof meetingProviders)[number];

export const meetingProviderLabels: Record<MeetingProvider, string> = {
  jitsi_embedded: "DriveCore Video (In-App)",
  zoom: "Zoom",
  teams: "Microsoft Teams",
  google_meet: "Google Meet",
};

export const meetingStatuses = [
  "scheduled",
  "live",
  "ended",
  "cancelled",
] as const;
export type MeetingStatus = (typeof meetingStatuses)[number];

export const meetingRsvpStatuses = [
  "pending",
  "accepted",
  "tentative",
  "declined",
] as const;
export type MeetingRsvpStatus = (typeof meetingRsvpStatuses)[number];

export const meetingRelatedEntityTypes = [
  "rental",
  "work_order",
  "incident",
  "customer",
  "vehicle",
  "quotation",
  "invoice",
] as const;
export type MeetingRelatedEntityType =
  (typeof meetingRelatedEntityTypes)[number];

export const meetingParticipantSchema = z.object({
  user_id: numericId,
  name: z.string(),
  email: z.string(),
  rsvp_status: z.enum(meetingRsvpStatuses),
  responded_at: z.string().nullable().optional().default(null),
});
export type MeetingParticipant = z.infer<typeof meetingParticipantSchema>;

export const meetingSchema = z.object({
  id: numericId,
  company_id: numericId,
  branch_id: numericId.nullable().optional().default(null),
  organizer_user_id: numericId,
  organizer_name: z.string(),
  title: z.string(),
  agenda: z.string().nullable().optional().default(null),
  provider: z.enum(meetingProviders),
  room_slug: z.string().nullable().optional().default(null),
  join_url: z.string(),
  starts_at: z.string(),
  ends_at: z.string(),
  status: z.enum(meetingStatuses),
  channel: z.enum(messageChannels).nullable().optional().default(null),
  related_entity_type: z
    .enum(meetingRelatedEntityTypes)
    .nullable()
    .optional()
    .default(null),
  related_entity_id: numericId.nullable().optional().default(null),
  minutes: z.string().nullable().optional().default(null),
  participants: z.array(meetingParticipantSchema).optional().default([]),
  created_at: z.string(),
  updated_at: z.string().nullable().optional().default(null),
});
export type LiveMeeting = z.infer<typeof meetingSchema>;

export function canAccessMeetings(user: User): boolean {
  return (
    user.is_platform_admin ||
    user.permissions.includes("meetings.view") ||
    user.permissions.includes("meetings.manage") ||
    user.permissions.includes("messages.view") ||
    isDriverRole(user)
  );
}

export function canManageMeetings(user: User): boolean {
  if (isDriverRole(user) && !user.permissions.includes("meetings.manage")) {
    return false;
  }
  return (
    user.is_platform_admin ||
    user.permissions.includes("meetings.manage") ||
    user.permissions.includes("messages.send")
  );
}

export function checkPasswordStrength(password: string) {
  const minLength = password.length >= 10;
  const hasLetter = /[A-Za-z]/.test(password);
  const hasNumber = /\d/.test(password);
  return {
    minLength,
    hasLetter,
    hasNumber,
    valid: minLength && hasLetter && hasNumber,
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
