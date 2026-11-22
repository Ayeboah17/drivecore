const FIELD_LABELS: Record<string, string> = {
  vehicle_id: "Vehicle",
  vehicle_ids: "Vehicles",
  customer_id: "Customer",
  branch_id: "Branch",
  company_id: "Company",
  quotation_id: "Quotation",
  reservation_id: "Reservation",
  driver_user_id: "Driver",
  starts_at: "Departure",
  ends_at: "Expected return",
  daily_rate_minor: "Daily rate",
  discount_pct: "Discount (%)",
  vat_rate_pct: "VAT rate (%)",
  discount_approval_threshold_pct: "Discount approval threshold (%)",
  odometer: "Odometer",
  odometer_unit: "Odometer unit",
  vehicle_status: "Returned condition",
  entity_type: "Linked record type",
  entity_id: "Linked record",
  expires_at: "Expiry date",
  password_confirmation: "Password confirmation",
  is_active: "Account status",
  functions: "Vehicle functions",
  file: "Document file",
  notes: "Notes",
  invoice_id: "Invoice",
  due_at: "Due date",
  amount_minor: "Amount",
  unit_price_minor: "Unit price",
  extra_charge_minor: "Additional return charge",
  extra_charge_description: "Additional charge description",
  incurred_at: "Expense date",
  paid_at: "Payment date",
  refunded_at: "Refund date",
  method: "Payment method",
  reference: "Payment reference",
  reason: "Refund reason",
  lines: "Line items",
  custom_customer_name: "Custom customer name",
  custom_customer_email: "Custom customer email",
  custom_customer_phone: "Custom customer phone",
  part_id: "Spare part",
  supplier_id: "Supplier",
  work_order_id: "Work order",
  purchase_order_id: "Purchase order",
  labour_cost_minor: "Labour cost",
  unit_cost_minor: "Unit cost",
  min_stock: "Minimum stock",
  sku: "Part SKU",
  completion_notes: "Completion notes",
};

const MESSAGE_REPLACEMENTS: readonly [RegExp, string][] = [
  [/\bvehicle_id\b/gi, "vehicle"],
  [/\bvehicle id\b/gi, "vehicle"],
  [/\bcustomer_id\b/gi, "customer"],
  [/\bcustomer id\b/gi, "customer"],
  [/\bbranch_id\b/gi, "branch"],
  [/\bbranch id\b/gi, "branch"],
  [/\bcompany_id\b/gi, "company"],
  [/\bcompany id\b/gi, "company"],
  [/\breservation_id\b/gi, "reservation"],
  [/\breservation id\b/gi, "reservation"],
  [/\bdriver_user_id\b/gi, "driver"],
  [/\bdriver user id\b/gi, "driver"],
  [/\bstarts_at\b/gi, "departure"],
  [/\bstarts at\b/gi, "departure"],
  [/\bends_at\b/gi, "expected return"],
  [/\bends at\b/gi, "expected return"],
  [/\bdaily_rate_minor\b/gi, "daily rate"],
  [/\bdaily rate minor\b/gi, "daily rate"],
  [/\bentity_type\b/gi, "linked record type"],
  [/\bentity_id\b/gi, "linked record"],
  [/\bentity id\b/gi, "linked record"],
  [/\bexpires_at\b/gi, "expiry date"],
  [/\bexpires at\b/gi, "expiry date"],
  [/\bvehicle_status\b/gi, "returned condition"],
  [/\bvehicle status\b/gi, "returned condition"],
];

/** Converts raw API/database field keys (e.g. "vehicle_id", "functions.0") into friendly UI labels. */
export function humanizeFieldLabel(field: string): string {
  if (FIELD_LABELS[field]) return FIELD_LABELS[field];
  const base = field.split(".")[0] ?? field;
  if (FIELD_LABELS[base]) return FIELD_LABELS[base];
  const cleaned = base.replace(/_id$/i, "").replaceAll("_", " ").trim();
  if (!cleaned) return "Field";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/** Cleans raw snake_case / *_id tokens inside Laravel validation messages. */
export function humanizeFieldMessage(message: string): string {
  let result = message;
  for (const [pattern, replacement] of MESSAGE_REPLACEMENTS) {
    result = result.replace(pattern, (match, offset: number) => {
      const startsUpper =
        offset === 0 || (match.length > 0 && match[0] === match[0].toUpperCase() && match[0] !== match[0].toLowerCase());
      return startsUpper
        ? replacement.charAt(0).toUpperCase() + replacement.slice(1)
        : replacement;
    });
  }
  return result;
}
