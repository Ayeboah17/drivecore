import {
  entitySchema,
  entities,
  find,
  DemoError,
  type Database,
  type Entity,
  type Kind,
  type DemoContext,
  type Command,
  type Values,
  type Of,
  valueOf,
} from "./types";
import {
  assertWrite,
  inScope,
  capabilities,
  kindModule,
  allowed,
  branchOptions,
} from "./permissions";
export const day = 86400000;
export function rentalPrice(starts: string, ends: string, rate: number) {
  const length = Date.parse(ends) - Date.parse(starts);
  if (!Number.isFinite(length) || length <= 0)
    throw new DemoError("Return must be after departure.", {
      endsAt: "Choose a later return time.",
    });
  const total = Math.max(1, Math.ceil(length / day)) * rate;
  if (!Number.isSafeInteger(total) || total < 0)
    throw new DemoError("The amount is outside the supported demo range.");
  return total;
}
export function stock(db: Database, partId: string) {
  return entities(db, "movement")
    .filter((m) => m.partId === partId)
    .reduce((n, m) => n + m.quantity, 0);
}
export function invoiceBalance(db: Database, id: string) {
  const invoice = find(db, "invoice", id),
    payments = entities(db, "payment")
      .filter((p) => p.invoiceId === id)
      .reduce((n, p) => n + p.amount, 0),
    refunds = entities(db, "refund")
      .filter((p) => p.invoiceId === id)
      .reduce((n, p) => n + p.amount, 0);
  return {
    paid: payments - refunds,
    credits: refunds,
    total: invoice.total - refunds,
    outstanding: invoice.status === "issued" ? invoice.total - payments : 0,
  };
}
export function vehicleStatus(
  db: Database,
  v: Of<"vehicle">,
  now = Date.now(),
) {
  if (
    entities(db, "rental").some(
      (r) => r.vehicleId === v.id && r.status === "active",
    )
  )
    return "rented";
  if (
    entities(db, "workOrder").some(
      (w) => w.vehicleId === v.id && w.status === "in_progress",
    )
  )
    return "maintenance";
  if (v.condition !== "available") return v.condition;
  if (
    entities(db, "reservation").some(
      (r) =>
        r.vehicleId === v.id &&
        r.status === "confirmed" &&
        Date.parse(r.endsAt) > now,
    )
  )
    return "reserved";
  return "available";
}
export function assertAvailable(
  db: Database,
  vehicleId: string,
  starts: string,
  ends: string,
  exclude?: string,
) {
  const v = find(db, "vehicle", vehicleId);
  if (
    v.condition !== "available" ||
    entities(db, "workOrder").some(
      (w) => w.vehicleId === v.id && w.status === "in_progress",
    )
  )
    throw new DemoError("Vehicle is not available for allocation.");
  if (
    entities(db, "rental").some(
      (r) =>
        r.vehicleId === v.id &&
        r.status === "active" &&
        r.reservationId !== exclude,
    )
  )
    throw new DemoError(
      "The vehicle is currently rented. Record its return first.",
    );
  if (
    entities(db, "reservation").some(
      (r) =>
        r.id !== exclude &&
        r.vehicleId === v.id &&
        r.status === "confirmed" &&
        Date.parse(starts) < Date.parse(r.endsAt) &&
        Date.parse(ends) > Date.parse(r.startsAt),
    )
  )
    throw new DemoError(
      "This vehicle already has an overlapping confirmed reservation.",
      { vehicleId: "Choose another vehicle or non-overlapping dates." },
    );
}
const uid = () => crypto.randomUUID();
function put(db: Database, entity: Entity) {
  const index = db.entities.findIndex((e) => e.id === entity.id);
  if (index < 0) db.entities.push(entity);
  else db.entities[index] = entity;
}
function patch(
  db: Database,
  e: Entity,
  values: Record<string, unknown>,
  now: string,
) {
  const updated = entitySchema.parse({ ...e, ...values, updatedAt: now });
  put(db, updated);
  return updated;
}
function add<K extends Kind>(
  db: Database,
  kind: K,
  scope: Pick<Entity, "companyId" | "branchId">,
  values: Record<string, unknown>,
  now: string,
): Of<K> {
  const e = entitySchema.parse({
    id: uid(),
    kind,
    companyId: scope.companyId,
    branchId: scope.branchId,
    createdAt: now,
    updatedAt: now,
    ...values,
  });
  put(db, e);
  return e as Of<K>;
}
export function amount(value: string | undefined, field = "amount") {
  if (!/^\d+(\.\d{1,2})?$/.test(value ?? ""))
    throw new DemoError(
      "Enter a nonnegative amount with at most two decimal places.",
      { [field]: "Use an amount such as 250.00." },
    );
  const n = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(n)) throw new DemoError("Amount is too large.");
  return n;
}
function integer(value: string | undefined, field: string, min = 0) {
  if (
    !/^\d+$/.test(value ?? "") ||
    !Number.isSafeInteger(Number(value)) ||
    Number(value) < min
  )
    throw new DemoError(`Enter a whole ${field} of at least ${min}.`, {
      [field]: `Minimum ${min}; whole numbers only.`,
    });
  return Number(value);
}
function iso(value: string | undefined, field: string) {
  const d = new Date(value ?? "");
  if (!Number.isFinite(d.getTime()))
    throw new DemoError("Choose a valid date and time.", {
      [field]: "A valid date and time is required.",
    });
  return d.toISOString();
}
function relation<K extends Kind>(
  db: Database,
  scope: Pick<Entity, "companyId" | "branchId">,
  kind: K,
  id: string,
) {
  const e = find(db, kind, id);
  if (
    e.companyId !== scope.companyId ||
    (e.branchId && e.branchId !== scope.branchId)
  )
    throw new DemoError(
      "Related records must belong to the same company and branch.",
      { [`${kind}Id`]: "Choose a record in this branch." },
    );
  return e;
}
function touchEvent(
  db: Database,
  ctx: DemoContext,
  entity: Entity,
  action: string,
  now: string,
) {
  const subject = entity.kind.replace(/([A-Z])/g, " $1");
  const verb =
    (
      {
        created: "created",
        updated: "updated",
        convert: "converted",
        confirm: "confirmed",
        contract: "contract created",
        handover: "handed over",
        extend: "extended",
        return: "returned",
        start: "started",
        complete: "completed",
        consume: "parts consumed",
        adjust: "stock adjusted",
        submit: "submitted",
        approve: "approved",
        receive: "received",
        issue: "issued",
        pay: "payment recorded",
        refund: "refunded and credited",
        read: "marked read",
        cancel: "cancelled",
        deleted: "deleted",
      } as Record<string, string>
    )[action] ?? action;
  const title = subject.charAt(0).toUpperCase() + subject.slice(1);
  const reference =
    valueOf(entity, "name") ||
    valueOf(entity, "registration") ||
    valueOf(entity, "title") ||
    entity.id.slice(0, 12);
  add(
    db,
    "audit",
    entity,
    {
      actorId: ctx.userId,
      action,
      entityId: entity.id,
      description: `${title} ${reference}: ${verb}`,
    },
    now,
  );
  if (!["audit", "notification"].includes(entity.kind))
    add(
      db,
      "notification",
      entity,
      { title: `${title} ${verb}`, entityId: entity.id, read: false },
      now,
    );
}
function scopedBranch(
  db: Database,
  ctx: DemoContext,
  values: Values,
  old?: Entity,
) {
  const branchId =
    old?.branchId ||
    values.branchId ||
    (ctx.branchId !== "all" ? ctx.branchId : "");
  if (!branchOptions(db, ctx).some((b) => b.id === branchId))
    throw new DemoError("Choose an accessible branch.", {
      branchId: "A branch is required.",
    });
  return branchId;
}
const readonlyKinds: Kind[] = [
  "movement",
  "payment",
  "refund",
  "audit",
  "notification",
  "rental",
];
function save(
  db: Database,
  ctx: DemoContext,
  kind: Kind,
  values: Values,
  id: string | undefined,
  now: string,
) {
  const old = id
    ? db.entities.find((e) => e.id === id && e.kind === kind)
    : undefined;
  if (id && !old) throw new DemoError("This record no longer exists.");
  assertWrite(db, ctx, kind, old);
  if (readonlyKinds.includes(kind))
    throw new DemoError(
      "Use the linked workflow action to create or change this record.",
    );
  if (
    ["company", "role"].includes(kind) &&
    !capabilities(db, ctx).includes("*")
  )
    throw new DemoError(
      "Only a platform-capable demo account can create or change companies.",
    );
  if (
    (kind === "branch" || kind === "role" || kind === "user") &&
    !capabilities(db, ctx).includes("*") &&
    find(db, "user", ctx.userId).branchIds.length
  )
    throw new DemoError("Whole-company administration is required.");
  if (old && "status" in old && !["draft", "open"].includes(old.status))
    throw new DemoError(
      "Posted or active records are immutable. Use a workflow action instead.",
    );
  if (old?.kind === "vehicle" && vehicleStatus(db, old) === "rented")
    throw new DemoError("Return the rented vehicle before editing it.");
  const unscoped = ["company", "role", "user", "setting"].includes(kind);
  const branchId =
    kind === "branch"
      ? ""
      : unscoped
        ? (old?.branchId ?? "")
        : scopedBranch(db, ctx, values, old);
  const base = {
    id: old?.id ?? uid(),
    kind,
    companyId: old?.companyId ?? ctx.companyId,
    branchId,
    createdAt: old?.createdAt ?? now,
    updatedAt: now,
  };
  let data: Record<string, unknown> = { ...old, ...base };
  const name =
    values.name ??
    ("name" in (old ?? {}) ? String((old as Of<"customer">).name) : "");
  switch (kind) {
    case "company":
      if (
        old?.kind === "company" &&
        values.currency !== old.currency &&
        db.entities.some(
          (e) =>
            e.companyId === old.id &&
            ["invoice", "payment", "rental", "expense"].includes(e.kind),
        )
      )
        throw new DemoError(
          "Currency cannot change after financial records exist. Create a separate demo company; no conversion is simulated.",
          { currency: "Existing transactions lock the currency." },
        );
      data = { ...data, name, currency: values.currency ?? "GHC" };
      data.companyId = base.id;
      break;
    case "branch":
      data = { ...data, name, branchId: base.id };
      if (
        entities(db, "branch").some(
          (b) =>
            b.companyId === ctx.companyId && b.name === name && b.id !== id,
        )
      )
        throw new DemoError("A branch with this name already exists.");
      break;
    case "role": {
      const permissions = (values.permissions ?? "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      if (permissions.includes("*") && !capabilities(db, ctx).includes("*"))
        throw new DemoError(
          "Only a platform-capable account can grant platform access.",
        );
      const valid = new Set([
        "*",
        ...Object.values(kindModule).flatMap((m) => [
          `${m}.read`,
          `${m}.write`,
        ]),
      ]);
      if (permissions.some((p) => !valid.has(p)))
        throw new DemoError("Choose supported demo capabilities.");
      data = { ...data, name, companyId: "", permissions };
      break;
    }
    case "user": {
      const role = find(db, "role", values.roleId);
      if (
        role.permissions.includes("*") &&
        !capabilities(db, ctx).includes("*")
      )
        throw new DemoError("You cannot grant platform access.");
      data = {
        ...data,
        name,
        email: values.email,
        roleId: role.id,
        companyIds: old?.kind === "user" ? old.companyIds : [ctx.companyId],
        branchIds: values.assignedBranchId ? [values.assignedBranchId] : [],
        active: values.active !== "false",
      };
      if (values.assignedBranchId)
        relation(
          db,
          { companyId: ctx.companyId, branchId: values.assignedBranchId },
          "branch",
          values.assignedBranchId,
        );
      if (
        entities(db, "user").some(
          (u) => u.email === values.email && u.id !== id,
        )
      )
        throw new DemoError("That demo email already exists.");
      break;
    }
    case "customer":
      data = {
        ...data,
        name,
        type: values.type,
        email: values.email ?? "",
        phone: values.phone ?? "",
        address: values.address ?? "",
        active: values.active !== "false",
      };
      break;
    case "vehicle": {
      const registration = (values.registration ?? "").trim().toUpperCase();
      if (
        entities(db, "vehicle").some(
          (v) =>
            v.companyId === ctx.companyId &&
            v.registration === registration &&
            v.id !== id,
        )
      )
        throw new DemoError(
          "Registration already exists in this demo company.",
          { registration: "Choose a unique registration." },
        );
      const odometer = integer(values.odometer, "odometer");
      if (old?.kind === "vehicle" && odometer < old.odometer)
        throw new DemoError("Odometer cannot decrease.", {
          odometer: "Use the current reading or a higher value.",
        });
      if (
        values.condition !== "available" &&
        entities(db, "reservation").some(
          (r) =>
            r.vehicleId === id &&
            r.status === "confirmed" &&
            Date.parse(r.endsAt) > Date.parse(now),
        )
      )
        throw new DemoError(
          "Reassign or cancel confirmed reservations before restricting this vehicle.",
        );
      if (
        old?.kind === "vehicle" &&
        values.condition === "available" &&
        entities(db, "workOrder").some(
          (w) => w.vehicleId === old.id && w.status === "in_progress",
        )
      )
        throw new DemoError("Complete the active work order first.");
      data = {
        ...data,
        registration,
        make: values.make,
        model: values.model,
        category: values.category,
        year: integer(values.year, "year", 1900),
        dailyRate: amount(values.dailyRate, "dailyRate"),
        odometer,
        condition: values.condition ?? "available",
        ownership: values.ownership ?? "owned",
        seats: integer(values.seats, "seats", 1),
        fuel: values.fuel ?? "Petrol",
      };
      break;
    }
    case "quotation":
    case "reservation": {
      const customer = relation(db, base, "customer", values.customerId);
      if (!customer.active) throw new DemoError("This customer is inactive.");
      const vehicle = relation(db, base, "vehicle", values.vehicleId);
      let startsAt = iso(values.startsAt, "startsAt");
      const endsAt = iso(values.endsAt, "endsAt");
      if (Date.parse(startsAt) < Date.parse(now) - 300000)
        throw new DemoError("Departure cannot be in the past.", {
          startsAt: "Choose now or a future departure.",
        });
      if (Date.parse(startsAt) < Date.parse(now)) startsAt = now;
      data = {
        ...data,
        customerId: customer.id,
        vehicleId: vehicle.id,
        startsAt,
        endsAt,
        dailyRate: vehicle.dailyRate,
        total: rentalPrice(startsAt, endsAt, vehicle.dailyRate),
        status: "draft",
      };
      break;
    }
    case "inspection": {
      const vehicle = relation(db, base, "vehicle", values.vehicleId);
      if (old)
        throw new DemoError(
          "Inspection evidence is immutable. Record a new inspection.",
        );
      if (vehicleStatus(db, vehicle) === "rented")
        throw new DemoError(
          "Use the rental handover/return workflow for a rented vehicle.",
        );
      const reading = integer(values.odometer, "odometer", vehicle.odometer);
      patch(db, vehicle, { odometer: reading }, now);

      data = {
        ...data,
        vehicleId: vehicle.id,
        rentalId: "",
        stage: "routine",
        odometer: integer(values.odometer, "odometer"),
        condition: values.condition ?? "Checked",
        notes: values.notes ?? "",
      };
      break;
    }
    case "workOrder":
      relation(db, base, "vehicle", values.vehicleId);
      data = {
        ...data,
        vehicleId: values.vehicleId,
        title: values.title,
        dueAt: iso(values.dueAt, "dueAt"),
        status: "open",
        labourCost: amount(values.labourCost ?? "0", "labourCost"),
        partsCost: 0,
        startedAt: "",
        completedAt: "",
      };
      break;
    case "part":
      if (
        entities(db, "part").some(
          (p) =>
            p.companyId === ctx.companyId &&
            p.branchId === branchId &&
            p.sku === values.sku &&
            p.id !== id,
        )
      )
        throw new DemoError("This branch already has that SKU.");
      data = {
        ...data,
        name,
        sku: values.sku,
        unitCost: amount(values.unitCost, "unitCost"),
        minimum: integer(values.minimum, "minimum"),
      };
      break;
    case "supplier":
      data = {
        ...data,
        name,
        email: values.email ?? "",
        phone: values.phone ?? "",
        active: values.active !== "false",
      };
      break;
    case "purchaseOrder": {
      relation(db, base, "supplier", values.supplierId);
      const part = relation(db, base, "part", values.partId),
        quantity = integer(values.quantity, "quantity", 1),
        unitCost = amount(
          values.unitCost || String(part.unitCost / 100),
          "unitCost",
        );
      data = {
        ...data,
        supplierId: values.supplierId,
        partId: part.id,
        quantity,
        unitCost,
        total: quantity * unitCost,
        status: "draft",
      };
      break;
    }
    case "invoice":
      relation(db, base, "customer", values.customerId);
      data = {
        ...data,
        customerId: values.customerId,
        rentalId: "",
        description: values.description,
        total: amount(values.total, "total"),
        dueAt: iso(values.dueAt, "dueAt"),
        status: "draft",
      };
      break;
    case "expense":
      data = {
        ...data,
        description: values.description,
        category: values.category ?? "General",
        amount: amount(values.amount),
        workOrderId: "",
      };
      if (old)
        throw new DemoError(
          "Posted demo expenses cannot be edited. Create a correcting transaction.",
        );
      break;
    case "document": {
      const target = db.entities.find((e) => e.id === values.entityId);
      if (
        !target ||
        !inScope(db, ctx, target) ||
        !allowed(db, ctx, kindModule[target.kind]) ||
        target.companyId !== base.companyId ||
        target.branchId !== base.branchId
      )
        throw new DemoError("Choose a related record in this branch.");
      data = {
        ...data,
        name,
        entityId: target.id,
        mimeType: values.mimeType ?? "application/pdf",
        size: integer(values.size, "size"),
        expiresAt: values.expiresAt ? iso(values.expiresAt, "expiresAt") : "",
      };
      break;
    }
    case "setting":
      if (!["Workspace note", "Rows per page"].includes(name))
        throw new DemoError("Choose a supported application setting.");
      if (
        name === "Rows per page" &&
        !["10", "25", "50"].includes(values.value)
      )
        throw new DemoError("Rows per page must be 10, 25 or 50.", {
          value: "Use 10, 25 or 50.",
        });
      if (
        entities(db, "setting").some(
          (s) =>
            s.companyId === ctx.companyId && s.name === name && s.id !== id,
        )
      )
        throw new DemoError(
          "Edit the existing company setting instead of creating a duplicate.",
        );
      data = { ...data, name, value: values.value ?? "" };
      break;
    default:
      throw new DemoError("Use the appropriate workflow action.");
  }
  const parsed = entitySchema.safeParse(data);
  if (!parsed.success) {
    const fields = Object.fromEntries(
      parsed.error.issues.map((i) => [String(i.path[0]), i.message]),
    );
    throw new DemoError("Check the highlighted fields.", fields);
  }
  put(db, parsed.data);
  touchEvent(db, ctx, parsed.data, old ? "updated" : "created", now);
  return parsed.data;
}
function billCharge(
  db: Database,
  r: Of<"rental">,
  charge: number,
  description: string,
  now: string,
) {
  if (!charge) return;
  const draft = entities(db, "invoice").find(
    (i) => i.rentalId === r.id && i.status === "draft",
  );
  if (draft) patch(db, draft, { total: draft.total + charge }, now);
  else
    add(
      db,
      "invoice",
      r,
      {
        customerId: r.customerId,
        rentalId: r.id,
        description,
        total: charge,
        dueAt: r.endsAt,
        status: "draft",
      },
      now,
    );
}
function act(
  db: Database,
  ctx: DemoContext,
  id: string,
  action: string,
  v: Values,
  now: string,
) {
  const e = db.entities.find((e) => e.id === id);
  if (!e) throw new DemoError("This record no longer exists.");
  assertWrite(db, ctx, e.kind, e);
  const blocked = actionBlockReason(db, e, action);
  if (blocked) throw new DemoError(blocked);
  const ensure = (
    ok: boolean,
    message = "This transition is not available in the current state.",
  ) => {
    if (!ok) throw new DemoError(message);
  };
  if (e.kind === "quotation" && action === "convert") {
    ensure(e.status === "draft");
    add(
      db,
      "reservation",
      e,
      {
        customerId: e.customerId,
        vehicleId: e.vehicleId,
        startsAt: e.startsAt,
        endsAt: e.endsAt,
        dailyRate: e.dailyRate,
        total: e.total,
        status: "draft",
      },
      now,
    );
    patch(db, e, { status: "converted" }, now);
  } else if (e.kind === "reservation" && action === "confirm") {
    ensure(e.status === "draft");
    ensure(
      Date.parse(e.endsAt) > Date.parse(now),
      "This reservation has ended.",
    );
    assertAvailable(db, e.vehicleId, e.startsAt, e.endsAt, e.id);
    patch(db, e, { status: "confirmed" }, now);
  } else if (e.kind === "reservation" && action === "assign") {
    ensure(
      ["draft", "confirmed"].includes(e.status) &&
        !entities(db, "rental").some((r) => r.reservationId === e.id),
    );
    relation(db, e, "vehicle", v.vehicleId);
    if (e.status === "confirmed")
      assertAvailable(db, v.vehicleId, e.startsAt, e.endsAt, e.id);
    patch(db, e, { vehicleId: v.vehicleId }, now);
  } else if (e.kind === "reservation" && action === "contract") {
    ensure(
      e.status === "confirmed" &&
        !entities(db, "rental").some((r) => r.reservationId === e.id) &&
        Date.parse(e.endsAt) > Date.parse(now),
    );
    const r = add(
      db,
      "rental",
      e,
      {
        reservationId: e.id,
        customerId: e.customerId,
        vehicleId: e.vehicleId,
        startsAt: e.startsAt,
        endsAt: e.endsAt,
        dailyRate: e.dailyRate,
        total: e.total,
        status: "draft",
        handoverAt: "",
        returnedAt: "",
        handoverOdometer: 0,
        returnOdometer: 0,
        notes: "",
      },
      now,
    );
    add(
      db,
      "invoice",
      e,
      {
        customerId: e.customerId,
        rentalId: r.id,
        description: `Rental contract ${r.id.slice(0, 8)}`,
        total: r.total,
        dueAt: r.endsAt,
        status: "draft",
      },
      now,
    );
  } else if (e.kind === "rental" && action === "handover") {
    ensure(
      e.status === "draft" &&
        Date.parse(now) >= Date.parse(e.startsAt) &&
        Date.parse(now) < Date.parse(e.endsAt),
      "Handover requires a draft contract within its reservation window.",
    );
    const vehicle = find(db, "vehicle", e.vehicleId);
    assertAvailable(db, vehicle.id, e.startsAt, e.endsAt, e.reservationId);
    const odometer = integer(v.odometer, "odometer", vehicle.odometer);
    ensure(!!v.notes?.trim(), "Record the handover condition and notes.");
    patch(
      db,
      e,
      {
        status: "active",
        handoverAt: now,
        handoverOdometer: odometer,
        notes: v.notes,
      },
      now,
    );
    patch(db, vehicle, { odometer }, now);
    add(
      db,
      "inspection",
      e,
      {
        vehicleId: vehicle.id,
        rentalId: e.id,
        stage: "handover",
        odometer,
        condition: v.condition || "Checked",
        notes: v.notes,
      },
      now,
    );
  } else if (e.kind === "rental" && action === "extend") {
    ensure(e.status === "active");
    const endsAt = iso(v.endsAt, "endsAt");
    ensure(
      Date.parse(endsAt) > Date.parse(e.endsAt),
      "Choose a return later than the current expected return.",
    );
    assertAvailable(db, e.vehicleId, e.startsAt, endsAt, e.reservationId);
    const charge =
      rentalPrice(e.startsAt, endsAt, e.dailyRate) -
      rentalPrice(e.startsAt, e.endsAt, e.dailyRate);
    patch(db, e, { endsAt, total: e.total + charge }, now);
    patch(db, find(db, "reservation", e.reservationId), { endsAt }, now);
    billCharge(db, e, charge, "Rental extension", now);
  } else if (e.kind === "rental" && action === "return") {
    ensure(e.status === "active");
    const vehicle = find(db, "vehicle", e.vehicleId),
      odometer = integer(
        v.odometer,
        "odometer",
        Math.max(vehicle.odometer, e.handoverOdometer),
      );
    ensure(!!v.notes?.trim(), "Record the return condition and notes.");
    ensure(["available", "maintenance", "damaged"].includes(v.condition));
    const late =
        Math.max(0, Math.ceil((Date.parse(now) - Date.parse(e.endsAt)) / day)) *
        e.dailyRate,
      extra = amount(v.additionalCharge || "0", "additionalCharge"),
      charge = late + extra;
    patch(
      db,
      e,
      {
        status: "completed",
        returnedAt: now,
        returnOdometer: odometer,
        total: e.total + charge,
        notes: `${e.notes}\nReturn: ${v.notes}`,
      },
      now,
    );
    patch(
      db,
      find(db, "reservation", e.reservationId),
      { status: "completed" },
      now,
    );
    patch(db, vehicle, { condition: v.condition, odometer }, now);
    add(
      db,
      "inspection",
      e,
      {
        vehicleId: vehicle.id,
        rentalId: e.id,
        stage: "return",
        odometer,
        condition: v.condition,
        notes: v.notes,
      },
      now,
    );
    billCharge(
      db,
      e,
      charge,
      "Return: late days and recorded additional charges",
      now,
    );
  } else if (e.kind === "workOrder" && action === "start") {
    ensure(e.status === "open");
    const vehicle = find(db, "vehicle", e.vehicleId);
    ensure(
      !["rented", "reserved", "inactive"].includes(vehicleStatus(db, vehicle)),
      "Return/reassign reservations before starting maintenance.",
    );
    ensure(
      !entities(db, "workOrder").some(
        (w) => w.vehicleId === vehicle.id && w.status === "in_progress",
      ),
    );
    patch(db, e, { status: "in_progress", startedAt: now }, now);
    patch(db, vehicle, { condition: "maintenance" }, now);
  } else if (e.kind === "workOrder" && action === "consume") {
    ensure(e.status === "in_progress");
    const part = relation(db, e, "part", v.partId),
      quantity = integer(v.quantity, "quantity", 1);
    ensure(
      stock(db, part.id) >= quantity,
      "Insufficient stock. Receive goods or adjust stock first.",
    );
    add(
      db,
      "movement",
      e,
      {
        partId: part.id,
        quantity: -quantity,
        unitCost: part.unitCost,
        reason: "Maintenance consumption",
        workOrderId: e.id,
        purchaseOrderId: "",
      },
      now,
    );
    patch(db, e, { partsCost: e.partsCost + quantity * part.unitCost }, now);
  } else if (e.kind === "workOrder" && action === "complete") {
    ensure(e.status === "in_progress");
    patch(db, e, { status: "completed", completedAt: now }, now);
    patch(
      db,
      find(db, "vehicle", e.vehicleId),
      { condition: "available" },
      now,
    );
    const cost = e.labourCost + e.partsCost;
    if (cost)
      add(
        db,
        "expense",
        e,
        {
          description: e.title,
          category: "Maintenance",
          amount: cost,
          workOrderId: e.id,
        },
        now,
      );
  } else if (e.kind === "part" && action === "adjust") {
    const quantity = Number(v.quantity);
    ensure(
      Number.isSafeInteger(quantity) && quantity !== 0,
      "Enter a nonzero whole stock adjustment.",
    );
    ensure(stock(db, e.id) + quantity >= 0, "Stock cannot become negative.");
    ensure(!!v.reason?.trim(), "Record a reason for the stock adjustment.");
    add(
      db,
      "movement",
      e,
      {
        partId: e.id,
        quantity,
        unitCost: e.unitCost,
        reason: v.reason,
        workOrderId: "",
        purchaseOrderId: "",
      },
      now,
    );
  } else if (
    e.kind === "purchaseOrder" &&
    ["submit", "approve", "receive"].includes(action)
  ) {
    const previous = {
      submit: "draft",
      approve: "submitted",
      receive: "approved",
    }[action];
    ensure(e.status === previous);
    if (action === "approve")
      ensure(
        allowed(db, ctx, "administration", true) ||
          allowed(db, ctx, "finance", true),
        "Approval requires a demo administrator or finance capability.",
      );
    patch(
      db,
      e,
      {
        status:
          action === "submit"
            ? "submitted"
            : action === "approve"
              ? "approved"
              : "received",
      },
      now,
    );
    if (action === "receive")
      add(
        db,
        "movement",
        e,
        {
          partId: e.partId,
          quantity: e.quantity,
          unitCost: e.unitCost,
          reason: "Purchase receipt",
          workOrderId: "",
          purchaseOrderId: e.id,
        },
        now,
      );
  } else if (e.kind === "invoice" && action === "issue") {
    ensure(e.status === "draft" && e.total > 0);
    patch(db, e, { status: "issued" }, now);
  } else if (e.kind === "invoice" && action === "pay") {
    ensure(e.status === "issued");
    const payment = amount(v.amount);
    ensure(
      payment > 0 && payment <= invoiceBalance(db, e.id).outstanding,
      "Payment must be positive and no greater than the outstanding balance.",
    );
    add(
      db,
      "payment",
      e,
      {
        invoiceId: e.id,
        amount: payment,
        method: v.method || "Transfer",
        reference: v.reference || `Demo receipt ${uid().slice(0, 8)}`,
      },
      now,
    );
  } else if (e.kind === "invoice" && action === "refund") {
    ensure(e.status === "issued");
    const refund = amount(v.amount);
    ensure(
      refund > 0 && refund <= invoiceBalance(db, e.id).paid,
      "Refund cannot exceed net recorded payments.",
    );
    ensure(!!v.reason?.trim(), "Record a refund reason.");
    add(
      db,
      "refund",
      e,
      { invoiceId: e.id, amount: refund, reason: v.reason },
      now,
    );
  } else if (e.kind === "notification" && action === "read") {
    patch(db, e, { read: true }, now);
  } else if (
    action === "cancel" &&
    [
      "quotation",
      "reservation",
      "rental",
      "purchaseOrder",
      "workOrder",
      "invoice",
    ].includes(e.kind)
  ) {
    ensure("status" in e);
    if (e.kind === "quotation") ensure(e.status === "draft");
    if (e.kind === "reservation")
      ensure(
        ["draft", "confirmed"].includes(e.status) &&
          !entities(db, "rental").some((r) => r.reservationId === e.id),
        "Cancel the draft rental first; active rentals must be returned.",
      );
    if (e.kind === "rental") {
      ensure(
        e.status === "draft",
        "Active rentals must be returned before closure.",
      );
      patch(
        db,
        find(db, "reservation", e.reservationId),
        { status: "cancelled" },
        now,
      );
      const invoices = entities(db, "invoice").filter(
        (i) => i.rentalId === e.id,
      );
      ensure(
        !invoices.some((i) => i.status === "issued"),
        "Void/settle issued invoices before cancelling the contract.",
      );
      invoices.forEach((i) => patch(db, i, { status: "void" }, now));
    }
    if (e.kind === "purchaseOrder")
      ensure(["draft", "submitted", "approved"].includes(e.status));
    if (e.kind === "workOrder") ensure(e.status === "open");
    if (e.kind === "invoice")
      ensure(
        e.status === "draft" ||
          !entities(db, "payment").some((p) => p.invoiceId === e.id),
      );
    patch(db, e, { status: e.kind === "invoice" ? "void" : "cancelled" }, now);
  } else
    throw new DemoError("This action is not supported for the current record.");
  touchEvent(db, ctx, e, action, now);
  return db.entities.find((x) => x.id === e.id)!;
}
export function applyCommand(
  source: Database,
  ctx: DemoContext,
  command: Command,
  now = new Date().toISOString(),
): Database {
  const db = structuredClone(source);
  if (command.type === "save")
    save(db, ctx, command.kind, command.values, command.id, now);
  else if (command.type === "action")
    act(db, ctx, command.id, command.action, command.values, now);
  else {
    const e = db.entities.find((x) => x.id === command.id);
    if (!e) throw new DemoError("Record no longer exists.");
    assertWrite(db, ctx, e.kind, e);
    if (
      ![
        "customer",
        "vehicle",
        "supplier",
        "part",
        "document",
        "setting",
        "quotation",
        "purchaseOrder",
      ].includes(e.kind) ||
      ("status" in e && e.status !== "draft")
    )
      throw new DemoError(
        "This record cannot be deleted. Posted records are retained for history.",
      );
    const referenced = db.entities.some(
      (other) =>
        other.id !== e.id &&
        Object.entries(other).some(
          ([key, value]) =>
            key.endsWith("Id") &&
            !(
              key === "actorId" ||
              (key === "entityId" &&
                ["audit", "notification"].includes(other.kind))
            ) &&
            value === e.id,
        ),
    );
    if (referenced)
      throw new DemoError(
        "This record is linked to history. Edit or deactivate it instead.",
      );
    db.entities = db.entities.filter((x) => x.id !== e.id);
    touchEvent(db, ctx, e, "deleted", now);
  }
  db.revision++;
  return db;
}

export function actionBlockReason(
  db: Database,
  entity: Entity,
  action: string,
): string | null {
  if (entity.kind === "invoice" && entity.status === "issued") {
    const balance = invoiceBalance(db, entity.id);
    if (action === "pay" && balance.outstanding <= 0)
      return "This invoice has no outstanding balance.";
    if (action === "refund" && balance.paid <= 0)
      return "Refund cannot exceed net recorded payments; record a payment first.";
    if (
      action === "cancel" &&
      entities(db, "payment").some((p) => p.invoiceId === entity.id)
    )
      return "An invoice with recorded receipts is retained. Use a refund and credit instead.";
  }
  if (
    entity.kind === "reservation" &&
    ["contract", "assign", "cancel"].includes(action) &&
    entities(db, "rental").some((r) => r.reservationId === entity.id)
  )
    return "A rental contract already exists. Continue through its handover or return workflow.";
  return null;
}
