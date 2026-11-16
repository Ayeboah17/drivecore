import { z } from "zod";
import type { Kind, Action, Entity } from "@/lib/demo/types";
import { displayStatus } from "@/lib/demo/selectors";
export interface Field {
  key: string;
  label: string;
  type?:
    | "text"
    | "email"
    | "number"
    | "money"
    | "datetime"
    | "textarea"
    | "permissions";
  options?: readonly string[];
  relation?: Kind | "record";
  optional?: boolean;
  default?: string;
  help?: string;
}
const name: Field = { key: "name", label: "Name" };
const period: Field[] = [
  {
    key: "startsAt",
    label: "Departure",
    type: "datetime",
    help: "Starting now is allowed in the demo.",
  },
  { key: "endsAt", label: "Expected return", type: "datetime" },
];
const customer: Field = {
  key: "customerId",
  label: "Customer",
  relation: "customer",
};
const vehicle: Field = {
  key: "vehicleId",
  label: "Vehicle",
  relation: "vehicle",
};
const amount: Field = { key: "amount", label: "Amount", type: "money" };
const notes: Field = {
  key: "notes",
  label: "Condition notes",
  type: "textarea",
};
const odometer: Field = {
  key: "odometer",
  label: "Odometer (demo km)",
  type: "number",
  default: "15000",
};
export interface Screen {
  kind: Kind;
  label: string;
  columns: string[];
  fields?: Field[];
  description: string;
}
export const screens: Record<Kind, Screen> = {
  company: {
    kind: "company",
    label: "Companies",
    columns: ["name", "currency"],
    fields: [
      name,
      {
        key: "currency",
        label: "Currency",
        options: ["USD", "EUR", "GHC", "ZMW"],
        default: "GHC",
      },
    ],
    description: "Independent demo organizations and billing currencies.",
  },
  branch: {
    kind: "branch",
    label: "Branches",
    columns: ["name", "companyId"],
    fields: [name],
    description: "Operating locations within the selected company.",
  },
  role: {
    kind: "role",
    label: "Roles & permissions",
    columns: ["name", "permissions"],
    fields: [
      name,
      { key: "permissions", label: "Capabilities", type: "permissions" },
    ],
    description: "Demo capabilities control navigation, records and commands.",
  },
  user: {
    kind: "user",
    label: "Users",
    columns: ["name", "email", "roleId", "active"],
    fields: [
      name,
      { key: "email", label: "Email", type: "email" },
      { key: "roleId", label: "Role", relation: "role" },
      {
        key: "assignedBranchId",
        label: "Restrict to branch",
        relation: "branch",
        optional: true,
      },
      {
        key: "active",
        label: "Account",
        options: ["true", "false"],
        default: "true",
      },
    ],
    description: "Synthetic demo accounts. No passwords or real sessions.",
  },
  customer: {
    kind: "customer",
    label: "Customers",
    columns: ["name", "type", "email", "phone", "branchId"],
    fields: [
      name,
      {
        key: "type",
        label: "Customer type",
        options: ["individual", "corporate"],
        default: "individual",
      },
      { key: "email", label: "Email", type: "email", optional: true },
      { key: "phone", label: "Phone", optional: true },
      { key: "address", label: "Address", type: "textarea", optional: true },
      {
        key: "active",
        label: "Account",
        options: ["true", "false"],
        default: "true",
      },
    ],
    description: "Individual and business customers, history and balances.",
  },
  vehicle: {
    kind: "vehicle",
    label: "Vehicles",
    columns: [
      "registration",
      "make",
      "model",
      "category",
      "dailyRate",
      "condition",
    ],
    fields: [
      { key: "registration", label: "Registration" },
      { key: "make", label: "Make" },
      { key: "model", label: "Model" },
      {
        key: "category",
        label: "Category",
        options: ["Economy", "SUV", "Van", "Pickup", "Executive"],
        default: "Economy",
      },
      { key: "year", label: "Year", type: "number", default: "2024" },
      { key: "dailyRate", label: "Daily rate", type: "money", default: "450" },
      odometer,
      {
        key: "condition",
        label: "Condition",
        options: ["available", "maintenance", "damaged", "inactive"],
        default: "available",
      },
      {
        key: "ownership",
        label: "Ownership",
        options: ["owned", "leased"],
        default: "owned",
      },
      { key: "seats", label: "Seats", type: "number", default: "5" },
      {
        key: "fuel",
        label: "Fuel",
        options: ["Petrol", "Diesel", "Electric", "Hybrid"],
        default: "Petrol",
      },
    ],
    description:
      "Availability, identity, inspections and service history. Reserved/rented status derives from allocations.",
  },
  quotation: {
    kind: "quotation",
    label: "Quotations",
    columns: [
      "customerId",
      "vehicleId",
      "startsAt",
      "endsAt",
      "total",
      "status",
    ],
    fields: [customer, vehicle, ...period],
    description:
      "Daily-rate quotes in started 24-hour blocks; no tax or conversion.",
  },
  reservation: {
    kind: "reservation",
    label: "Reservations",
    columns: ["customerId", "vehicleId", "startsAt", "endsAt", "status"],
    fields: [customer, vehicle, ...period],
    description: "Confirm allocations before creating a rental contract.",
  },
  rental: {
    kind: "rental",
    label: "Rental contracts",
    columns: [
      "customerId",
      "vehicleId",
      "startsAt",
      "endsAt",
      "total",
      "status",
    ],
    description:
      "Handover, extensions and returns update all related demo records.",
  },
  inspection: {
    kind: "inspection",
    label: "Inspections",
    columns: ["vehicleId", "stage", "odometer", "condition", "createdAt"],
    fields: [
      vehicle,
      odometer,
      { key: "condition", label: "Condition summary", default: "Checked" },
      notes,
    ],
    description: "Condition, damage notes and demo-kilometre readings.",
  },
  workOrder: {
    kind: "workOrder",
    label: "Work orders",
    columns: [
      "title",
      "vehicleId",
      "dueAt",
      "labourCost",
      "partsCost",
      "status",
    ],
    fields: [
      { key: "title", label: "Work order title" },
      vehicle,
      { key: "dueAt", label: "Scheduled service", type: "datetime" },
      { key: "labourCost", label: "Labour cost", type: "money", default: "0" },
    ],
    description: "Preventive schedules, vehicle downtime, parts and labour.",
  },
  part: {
    kind: "part",
    label: "Parts catalogue",
    columns: ["name", "sku", "unitCost", "minimum"],
    fields: [
      name,
      { key: "sku", label: "SKU" },
      {
        key: "unitCost",
        label: "Standard unit cost",
        type: "money",
        default: "0",
      },
      { key: "minimum", label: "Minimum stock", type: "number", default: "3" },
    ],
    description:
      "Stock is derived from movements. New items start at zero; adjust or receive stock.",
  },
  movement: {
    kind: "movement",
    label: "Stock movements",
    columns: ["partId", "quantity", "unitCost", "reason", "createdAt"],
    description: "Immutable receipts, consumption and counted adjustments.",
  },
  supplier: {
    kind: "supplier",
    label: "Suppliers",
    columns: ["name", "email", "phone", "active"],
    fields: [
      name,
      { key: "email", label: "Email", type: "email", optional: true },
      { key: "phone", label: "Phone", optional: true },
      {
        key: "active",
        label: "Account",
        options: ["true", "false"],
        default: "true",
      },
    ],
    description: "Synthetic suppliers for branch procurement.",
  },
  purchaseOrder: {
    kind: "purchaseOrder",
    label: "Purchase orders",
    columns: ["supplierId", "partId", "quantity", "total", "status"],
    fields: [
      { key: "supplierId", label: "Supplier", relation: "supplier" },
      { key: "partId", label: "Part", relation: "part" },
      { key: "quantity", label: "Quantity", type: "number", default: "10" },
      { key: "unitCost", label: "Unit cost", type: "money", default: "100" },
    ],
    description:
      "Submit a request, approve the order, then receive goods into stock.",
  },
  invoice: {
    kind: "invoice",
    label: "Invoices",
    columns: ["description", "customerId", "total", "dueAt", "status"],
    fields: [
      customer,
      { key: "description", label: "Description" },
      { key: "total", label: "Invoice total", type: "money" },
      { key: "dueAt", label: "Payment due", type: "datetime" },
    ],
    description:
      "Issue drafts to recognize receivables. Payments and refund/credits are linked transactions.",
  },
  payment: {
    kind: "payment",
    label: "Payments",
    columns: ["invoiceId", "amount", "method", "reference", "createdAt"],
    description: "Recorded receipts reduce invoice balances.",
  },
  refund: {
    kind: "refund",
    label: "Refunds & credits",
    columns: ["invoiceId", "amount", "reason", "createdAt"],
    description:
      "Demo refunds also create equivalent sales credits. Not a certified accounting engine.",
  },
  expense: {
    kind: "expense",
    label: "Expenses",
    columns: ["description", "category", "amount", "createdAt"],
    fields: [
      { key: "description", label: "Description" },
      {
        key: "category",
        label: "Category",
        options: ["General", "Fuel", "Insurance", "Maintenance"],
        default: "General",
      },
      amount,
    ],
    description: "Posted operating costs, including completed maintenance.",
  },
  document: {
    kind: "document",
    label: "Document metadata",
    columns: ["name", "entityId", "mimeType", "size", "expiresAt"],
    fields: [
      name,
      { key: "entityId", label: "Related record", relation: "record" },
      {
        key: "mimeType",
        label: "Type",
        options: ["application/pdf", "image/jpeg", "image/png"],
        default: "application/pdf",
      },
      {
        key: "size",
        label: "Synthetic size (bytes)",
        type: "number",
        default: "32000",
      },
      { key: "expiresAt", label: "Expires", type: "datetime", optional: true },
    ],
    description:
      "Metadata only: no real uploads, identification documents or external downloads.",
  },
  notification: {
    kind: "notification",
    label: "Notifications",
    columns: ["title", "entityId", "read", "createdAt"],
    description: "Events generated by actual demo state changes.",
  },
  audit: {
    kind: "audit",
    label: "Audit activity",
    columns: ["actorId", "action", "description", "createdAt"],
    description: "Append-only history of successful demo commands.",
  },
  setting: {
    kind: "setting",
    label: "Settings",
    columns: ["name", "value"],
    fields: [
      {
        key: "name",
        label: "Setting",
        options: ["Workspace note", "Rows per page"],
      },
      { key: "value", label: "Value", type: "textarea" },
    ],
    description:
      "Company notes and demo settings; these do not configure Laravel.",
  },
};
export const moduleScreens: Record<string, Kind[]> = {
  dashboard: ["notification"],
  operations: ["rental", "reservation", "inspection"],
  fleet: ["vehicle", "document", "inspection"],
  customers: ["customer"],
  rentals: ["quotation", "reservation", "rental"],
  maintenance: ["workOrder"],
  inventory: ["part", "movement"],
  finance: ["invoice", "payment", "refund", "expense"],
  procurement: ["purchaseOrder", "supplier"],
  administration: ["user", "role", "company", "branch", "setting", "audit"],
};
export interface WorkflowAction {
  action: Action;
  label: string;
  fields: Field[];
  description: string;
}
export function actions(entity: Entity): WorkflowAction[] {
  const action = (
    action: Action,
    label: string,
    fields: Field[] = [],
    description = "This changes the linked demo records and records an audit event.",
  ): WorkflowAction => ({ action, label, fields, description });
  const cancel = action(
    "cancel",
    "Cancel",
    [],
    "Confirm cancellation. Active rentals must be returned; posted records retain their history.",
  );
  switch (entity.kind) {
    case "quotation":
      return entity.status === "draft"
        ? [action("convert", "Convert to reservation"), cancel]
        : [];
    case "reservation":
      return ["draft", "confirmed"].includes(entity.status)
        ? [
            ...(entity.status === "draft"
              ? [action("confirm", "Confirm reservation")]
              : [action("contract", "Create rental contract")]),
            action("assign", "Assign vehicle", [vehicle]),
            cancel,
          ]
        : [];
    case "rental":
      return entity.status === "draft"
        ? [
            action(
              "handover",
              "Complete handover",
              [
                odometer,
                {
                  key: "condition",
                  label: "Condition summary",
                  default: "Checked",
                },
                notes,
              ],
              "The reservation must have started. Demo readings are in kilometres.",
            ),
            cancel,
          ]
        : entity.status === "active"
          ? [
              action(
                "extend",
                "Extend rental",
                [
                  {
                    key: "endsAt",
                    label: "New expected return",
                    type: "datetime",
                  },
                ],
                "Extra started 24-hour blocks are charged at the contract daily rate. Future allocations are checked.",
              ),
              action(
                "return",
                "Record return",
                [
                  odometer,
                  {
                    key: "condition",
                    label: "Returned condition",
                    options: ["available", "maintenance", "damaged"],
                    default: "available",
                  },
                  notes,
                  {
                    key: "additionalCharge",
                    label: "Additional agreed charge",
                    type: "money",
                    default: "0",
                  },
                ],
                "Late started days use the contract daily rate. Enter other agreed charges explicitly; damage costs are not invented.",
              ),
            ]
          : [];
    case "workOrder":
      return entity.status === "open"
        ? [action("start", "Start work"), cancel]
        : entity.status === "in_progress"
          ? [
              action("consume", "Consume parts", [
                { key: "partId", label: "Part", relation: "part" },
                {
                  key: "quantity",
                  label: "Quantity",
                  type: "number",
                  default: "1",
                },
              ]),
              action("complete", "Complete work"),
            ]
          : [];
    case "part":
      return [
        action("adjust", "Adjust stock", [
          {
            key: "quantity",
            label: "Signed quantity adjustment",
            type: "number",
            default: "1",
          },
          { key: "reason", label: "Adjustment reason" },
        ]),
      ];
    case "purchaseOrder":
      return entity.status === "draft"
        ? [action("submit", "Submit purchase request"), cancel]
        : entity.status === "submitted"
          ? [action("approve", "Approve order"), cancel]
          : entity.status === "approved"
            ? [action("receive", "Receive goods"), cancel]
            : [];
    case "invoice":
      return entity.status === "draft"
        ? [action("issue", "Issue invoice"), cancel]
        : entity.status === "issued"
          ? [
              action("pay", "Record payment", [
                amount,
                {
                  key: "method",
                  label: "Method",
                  options: ["Transfer", "Card", "Cash"],
                  default: "Transfer",
                },
                { key: "reference", label: "Payment reference" },
              ]),
              action("refund", "Refund & credit", [
                amount,
                { key: "reason", label: "Refund reason" },
              ]),
              cancel,
            ]
          : [];
    case "notification":
      return entity.read ? [] : [action("read", "Mark as read")];
    default:
      return [];
  }
}
export function formSchema(fields: Field[]) {
  const shape: Record<string, z.ZodString> = {};
  for (const field of fields)
    shape[field.key] = field.optional
      ? z.string()
      : z.string().trim().min(1, `Enter ${field.label.toLowerCase()}.`);
  return z.object(shape);
}
export const fieldLabel = (key: string, kind?: Kind) =>
  (kind
    ? screens[kind].fields?.find((f) => f.key === key)?.label
    : undefined) ??
  (
    {
      name: "Name",
      title: "Title",
      description: "Description",
      currency: "Currency",
      email: "Email",
      phone: "Phone",
      type: "Customer type",
      companyId: "Company",
      branchId: "Branch",
      customerId: "Customer",
      vehicleId: "Vehicle",
      createdAt: "Created",
      updatedAt: "Updated",
      total: "Total",
      status: "Status",
      partsCost: "Parts cost",
      invoiceId: "Invoice",
      partId: "Part",
      supplierId: "Supplier",
      roleId: "Role",
      actorId: "Actor",
      quantity: "Quantity",
      read: "Read",
      stage: "Stage",
      dueAt: "Due",
      startsAt: "Departure",
      endsAt: "Expected return",
      dailyRate: "Daily rate",
      unitCost: "Unit cost",
      labourCost: "Labour cost",
      amount: "Amount",
      registration: "Registration",
      make: "Make",
      model: "Model",
      category: "Category",
      condition: "Condition",
      entityId: "Related record",
      mimeType: "Type",
      size: "Size (bytes)",
      expiresAt: "Expires",
      permissions: "Capabilities",
      active: "Active",
      reference: "Reference",
      reason: "Reason",
      action: "Action",
      value: "Value",
      sku: "SKU",
      minimum: "Minimum stock",
    } as Record<string, string>
  )[key] ??
  key.replace(/([A-Z])/g, " $1");
export { displayStatus };

export const entityName = (kind: Kind) =>
  ({
    company: "company",
    branch: "branch",
    role: "role",
    user: "user",
    customer: "customer",
    vehicle: "vehicle",
    quotation: "quotation",
    reservation: "reservation",
    rental: "rental contract",
    inspection: "inspection",
    workOrder: "work order",
    part: "part",
    movement: "stock movement",
    supplier: "supplier",
    purchaseOrder: "purchase order",
    invoice: "invoice",
    payment: "payment",
    refund: "refund",
    expense: "expense",
    document: "document metadata",
    notification: "notification",
    audit: "audit record",
    setting: "setting",
  })[kind];
