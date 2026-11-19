import { z } from "zod";

export const kinds = [
  "company",
  "branch",
  "role",
  "user",
  "customer",
  "vehicle",
  "quotation",
  "reservation",
  "rental",
  "inspection",
  "workOrder",
  "part",
  "movement",
  "supplier",
  "purchaseOrder",
  "invoice",
  "payment",
  "refund",
  "expense",
  "document",
  "notification",
  "audit",
  "setting",
  "message",
] as const;

export type Kind = (typeof kinds)[number];

export const VEHICLE_FUNCTIONS = [
  "GPS Tracker",
  "Automatic",
  "4x4 / AWD",
  "A/C",
  "Chauffeur Eligible",
  "Bluetooth",
  "Child Seat",
] as const;

const base = {
  id: z.string().min(1),
  companyId: z.string(),
  branchId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
};
const text = z.string().trim().min(1).max(255);
const money = z.number().int().nonnegative().safe();
const quantity = z.number().int().nonnegative().safe();
const period = { startsAt: z.iso.datetime(), endsAt: z.iso.datetime() };

export const entitySchema = z.discriminatedUnion("kind", [
  z.object({
    ...base,
    kind: z.literal("company"),
    name: text,
    currency: z.enum(["USD", "EUR", "GHC", "ZMW"]),
  }),
  z.object({ ...base, kind: z.literal("branch"), name: text }),
  z.object({
    ...base,
    kind: z.literal("role"),
    name: text,
    permissions: z.array(z.string()),
  }),
  z.object({
    ...base,
    kind: z.literal("user"),
    name: text,
    email: z.email().max(255),
    roleId: text,
    companyIds: z.array(z.string()),
    branchIds: z.array(z.string()),
    active: z.boolean(),
  }),
  z.object({
    ...base,
    kind: z.literal("customer"),
    name: text,
    type: z.enum(["individual", "corporate"]),
    email: z.union([z.email(), z.literal("")]),
    phone: z.string().max(50),
    address: z.string().max(1000),
    active: z.boolean(),
  }),
  z.object({
    ...base,
    kind: z.literal("vehicle"),
    registration: text.max(40),
    make: text.max(100),
    model: text.max(100),
    category: z.enum(["Economy", "SUV", "Van", "Pickup", "Executive"]),
    year: z.number().int().min(1900).max(2100),
    dailyRate: money,
    odometer: quantity,
    condition: z.enum(["available", "maintenance", "damaged", "inactive"]),
    ownership: z.enum(["owned", "leased"]),
    seats: z.number().int().min(1).max(60),
    fuel: z.enum(["Petrol", "Diesel", "Electric", "Hybrid"]),
    functions: z.array(z.string()).default([]),
  }),
  z.object({
    ...base,
    kind: z.literal("quotation"),
    customerId: text,
    vehicleId: text,
    vehicleIds: z.array(text).default([]),
    ...period,
    dailyRate: money,
    subtotal: money.default(0),
    discountPct: z.number().min(0).max(100).default(0),
    discountAmount: money.default(0),
    discountStatus: z
      .enum(["none", "pending", "approved", "rejected"])
      .default("none"),
    discountApprovedBy: z.string().default(""),
    vatRate: z.number().min(0).max(100).default(15),
    vatAmount: money.default(0),
    total: money,
    status: z.enum(["draft", "pending_approval", "converted", "cancelled"]),
  }),
  z.object({
    ...base,
    kind: z.literal("reservation"),
    customerId: text,
    vehicleId: text,
    ...period,
    dailyRate: money,
    subtotal: money.default(0),
    discountAmount: money.default(0),
    vatRate: z.number().min(0).max(100).default(15),
    vatAmount: money.default(0),
    total: money,
    status: z.enum(["draft", "confirmed", "completed", "cancelled"]),
  }),
  z.object({
    ...base,
    kind: z.literal("rental"),
    reservationId: text,
    customerId: text,
    vehicleId: text,
    ...period,
    dailyRate: money,
    subtotal: money.default(0),
    discountAmount: money.default(0),
    vatRate: z.number().min(0).max(100).default(15),
    vatAmount: money.default(0),
    total: money,
    status: z.enum(["draft", "active", "completed", "cancelled"]),
    handoverAt: z.string(),
    returnedAt: z.string(),
    handoverOdometer: quantity,
    returnOdometer: quantity,
    notes: z.string().max(10000),
  }),
  z.object({
    ...base,
    kind: z.literal("inspection"),
    vehicleId: text,
    rentalId: z.string(),
    stage: z.enum(["handover", "return", "routine"]),
    odometer: quantity,
    condition: text,
    notes: z.string().max(10000),
  }),
  z.object({
    ...base,
    kind: z.literal("workOrder"),
    vehicleId: text,
    title: text,
    dueAt: z.iso.datetime(),
    status: z.enum(["open", "in_progress", "completed", "cancelled"]),
    labourCost: money,
    partsCost: money,
    startedAt: z.string(),
    completedAt: z.string(),
  }),
  z.object({
    ...base,
    kind: z.literal("part"),
    name: text,
    sku: text,
    unitCost: money,
    minimum: quantity,
  }),
  z.object({
    ...base,
    kind: z.literal("movement"),
    partId: text,
    quantity: z.number().int().safe(),
    unitCost: money,
    reason: text,
    workOrderId: z.string(),
    purchaseOrderId: z.string(),
  }),
  z.object({
    ...base,
    kind: z.literal("supplier"),
    name: text,
    email: z.union([z.email(), z.literal("")]),
    phone: z.string().max(50),
    active: z.boolean(),
  }),
  z.object({
    ...base,
    kind: z.literal("purchaseOrder"),
    supplierId: text,
    partId: text,
    quantity: quantity.min(1),
    unitCost: money,
    total: money,
    status: z.enum(["draft", "submitted", "approved", "received", "cancelled"]),
  }),
  z.object({
    ...base,
    kind: z.literal("invoice"),
    customerId: text,
    rentalId: z.string(),
    description: text,
    subtotal: money.default(0),
    discountAmount: money.default(0),
    vatRate: z.number().min(0).max(100).default(15),
    vatAmount: money.default(0),
    total: money,
    dueAt: z.iso.datetime(),
    status: z.enum(["draft", "issued", "void"]),
  }),
  z.object({
    ...base,
    kind: z.literal("payment"),
    invoiceId: text,
    amount: money.min(1),
    method: z.enum(["Cash", "Card", "Transfer"]),
    reference: text,
  }),
  z.object({
    ...base,
    kind: z.literal("refund"),
    invoiceId: text,
    amount: money.min(1),
    reason: text,
  }),
  z.object({
    ...base,
    kind: z.literal("expense"),
    description: text,
    category: z.enum(["Maintenance", "Fuel", "Insurance", "General"]),
    amount: money.min(1),
    workOrderId: z.string(),
  }),
  z.object({
    ...base,
    kind: z.literal("document"),
    name: text,
    entityId: text,
    mimeType: z.enum(["application/pdf", "image/jpeg", "image/png"]),
    size: quantity,
    expiresAt: z.string(),
  }),
  z.object({
    ...base,
    kind: z.literal("notification"),
    title: text,
    entityId: z.string(),
    read: z.boolean(),
  }),
  z.object({
    ...base,
    kind: z.literal("audit"),
    actorId: text,
    action: text,
    entityId: text,
    description: z.string(),
  }),
  z.object({
    ...base,
    kind: z.literal("setting"),
    name: text,
    value: z.string().max(1000),
  }),
  z.object({
    ...base,
    kind: z.literal("message"),
    channel: z.enum(["dispatch", "drivers", "customers", "support"]),
    senderId: text,
    senderName: text,
    body: z.string().trim().min(1).max(1000),
    relatedEntityId: z.string().default(""),
    readBy: z.array(z.string()).default([]),
  }),
]);

export type Entity = z.infer<typeof entitySchema>;
export type Of<K extends Kind> = Extract<Entity, { kind: K }>;

export const databaseSchema = z.object({
  version: z.literal(1),
  revision: quantity,
  seededAt: z.iso.datetime(),
  entities: z.array(entitySchema).max(20000),
});
export type Database = z.infer<typeof databaseSchema>;

export interface DemoContext {
  userId: string;
  companyId: string;
  branchId: string;
}

export type Values = Record<string, string>;

export type Action =
  | "convert"
  | "approve_discount"
  | "reject_discount"
  | "confirm"
  | "assign"
  | "contract"
  | "cancel"
  | "handover"
  | "extend"
  | "return"
  | "start"
  | "complete"
  | "consume"
  | "adjust"
  | "submit"
  | "approve"
  | "receive"
  | "issue"
  | "pay"
  | "refund"
  | "read";

export type Command =
  | { type: "save"; kind: Kind; id?: string; values: Values }
  | { type: "action"; id: string; action: Action; values: Values }
  | { type: "delete"; id: string };

export class DemoError extends Error {
  constructor(
    message: string,
    public fields: Record<string, string> = {},
  ) {
    super(message);
    this.name = "DemoError";
  }
}

export function entities<K extends Kind>(db: Database, kind: K): Of<K>[] {
  return db.entities.filter((e): e is Of<K> => e.kind === kind);
}

export function find<K extends Kind>(db: Database, kind: K, id: string): Of<K> {
  const value = entities(db, kind).find((e) => e.id === id);
  if (!value) throw new DemoError(`${kind} record is unavailable.`);
  return value;
}

export function valueOf(
  entity: Entity,
  key: string,
): string | number | boolean | string[] {
  const value = (entity as unknown as Record<string, unknown>)[key];
  return typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
    ? value
    : Array.isArray(value)
      ? value.filter((v): v is string => typeof v === "string")
      : "";
}
