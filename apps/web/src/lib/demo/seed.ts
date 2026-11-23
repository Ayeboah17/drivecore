import {
  databaseSchema,
  entitySchema,
  VEHICLE_FUNCTIONS,
  type Database,
  type Kind,
  type Of,
} from "./types";
import { modules } from "./permissions";
import { day, rentalPrice } from "./rules";
export function createSeed(at = new Date()): Database {
  const now = at.toISOString(),
    baseTime = at.getTime();
  const date = (days: number, hours = 0) =>
    new Date(baseTime + days * day + hours * 3600000).toISOString();
  const result: Database = {
    version: 1,
    revision: 0,
    seededAt: now,
    entities: [],
  };
  function add<K extends Kind>(
    kind: K,
    id: string,
    companyId: string,
    branchId: string,
    values: Omit<
      Of<K>,
      "id" | "kind" | "companyId" | "branchId" | "createdAt" | "updatedAt"
    >,
    createdAt = now,
  ) {
    result.entities.push(
      entitySchema.parse({
        id,
        kind,
        companyId,
        branchId,
        createdAt,
        updatedAt: createdAt,
        ...values,
      }),
    );
  }
  const all = modules.flatMap((m) => [`${m}.read`, `${m}.write`]);
  const perms = (read: string[], write: string[]) => [
    ...read.map((m) => `${m}.read`),
    ...write.map((m) => `${m}.write`),
  ];
  const roles = [
    { id: "platform", name: "Platform administrator", permissions: ["*"] },
    { id: "company-admin", name: "Company administrator", permissions: all },
    {
      id: "branch-manager",
      name: "Branch manager",
      permissions: all.filter((p) => !p.startsWith("administration.write")),
    },
    {
      id: "operations",
      name: "Operations staff",
      permissions: perms(
        ["dashboard", "operations", "fleet", "customers", "rentals", "reports"],
        ["dashboard", "operations", "rentals", "customers"],
      ),
    },
    {
      id: "fleet",
      name: "Fleet manager",
      permissions: perms(
        [
          "dashboard",
          "operations",
          "fleet",
          "maintenance",
          "inventory",
          "procurement",
          "reports",
        ],
        [
          "dashboard",
          "fleet",
          "operations",
          "maintenance",
          "inventory",
          "procurement",
        ],
      ),
    },
    {
      id: "finance",
      name: "Finance staff",
      permissions: perms(
        [
          "dashboard",
          "customers",
          "rentals",
          "finance",
          "procurement",
          "reports",
        ],
        ["dashboard", "finance", "procurement"],
      ),
    },
    { id: "viewer", name: "Viewer", permissions: perms([...modules], []) },
    {
      id: "driver",
      name: "Driver",
      permissions: perms(
        ["dashboard", "operations", "fleet", "customers", "rentals"],
        ["operations", "dashboard"],
      ),
    },
  ];
  roles.forEach((r) =>
    add("role", `role-${r.id}`, "", "", {
      name: r.name,
      permissions: r.permissions,
    }),
  );
  add("company", "co-1", "co-1", "", {
    name: "Aster Mobility Demo",
    currency: "GHC",
  });
  add("company", "co-2", "co-2", "", {
    name: "Copperline Rentals Demo",
    currency: "ZMW",
  });
  const names = [
    "North depot",
    "Airport branch",
    "Central depot",
    "Riverside branch",
  ];
  for (let i = 0; i < 4; i++)
    add("branch", `br-${i + 1}`, i < 2 ? "co-1" : "co-2", `br-${i + 1}`, {
      name: names[i],
    });
  roles.forEach((r, i) =>
    add("user", `user-${r.id}`, "co-1", i === 2 || i === 7 ? "br-1" : "", {
      name: [
        "Demo platform admin",
        "Demo company admin",
        "Demo branch manager",
        "Demo operations",
        "Demo fleet manager",
        "Demo finance",
        "Demo viewer",
        "Demo driver",
      ][i],
      email: `${r.id}@drivecore.example.test`,
      roleId: `role-${r.id}`,
      companyIds: r.id === "platform" ? [] : ["co-1"],
      branchIds: i === 2 || i === 7 ? ["br-1"] : [],
      active: true,
    }),
  );
  add("user", "user-copperline", "co-2", "", {
    name: "Demo Copperline manager",
    email: "copperline@example.test",
    roleId: "role-company-admin",
    companyIds: ["co-2"],
    branchIds: [],
    active: true,
  });
  for (let b = 1; b <= 4; b++) {
    const companyId = b <= 2 ? "co-1" : "co-2",
      branchId = `br-${b}`,
      ref = (kind: string, i: number) => `${kind}-${b}-${i}`;
    for (let i = 0; i < 9; i++)
      add(
        "customer",
        ref("customer", i),
        companyId,
        branchId,
        {
          name:
            i % 3 === 0
              ? `Example Business ${b}${i} Ltd`
              : `Demo Customer ${b}${i}`,
          type: i % 3 === 0 ? "corporate" : "individual",
          email: `customer-${b}-${i}@example.test`,
          phone: `+000 ${b}00 000 ${String(i).padStart(3, "0")}`,
          address: `${i + 1} Fictional Way, Demo District`,
          active: true,
        },
        date(-30 + i),
      );
    const models = [
      ["Aster", "City", "Economy"],
      ["Aster", "Tourer", "SUV"],
      ["Copper", "Cargo", "Van"],
      ["Aster", "Ridge", "Pickup"],
      ["Copper", "Executive", "Executive"],
      ["Aster", "Compact", "Economy"],
      ["Copper", "Safari", "SUV"],
      ["Aster", "Utility", "Van"],
    ] as const;
    models.forEach(([make, model, category], i) =>
      add(
        "vehicle",
        ref("vehicle", i),
        companyId,
        branchId,
        {
          registration: `DEMO-${b}${String(i + 1).padStart(3, "0")}`,
          make,
          model,
          category,
          year: 2022 + (i % 4),
          dailyRate: 45000 + i * 7500,
          odometer: 15000 + i * 3250,
          condition:
            i === 5
              ? "maintenance"
              : i === 6
                ? "damaged"
                : i === 7
                  ? "inactive"
                  : "available",
          ownership: i % 3 ? "owned" : "leased",
          seats: category === "Van" ? 8 : 5,
          fuel: i % 2 ? "Diesel" : "Petrol",
          functions: [
            VEHICLE_FUNCTIONS[0],
            VEHICLE_FUNCTIONS[3],
            ...(i % 2 === 0 ? [VEHICLE_FUNCTIONS[1], VEHICLE_FUNCTIONS[5]] : [VEHICLE_FUNCTIONS[2]]),
            ...(category === "Executive" ? [VEHICLE_FUNCTIONS[4]] : []),
          ],
        },
        date(-40 + i),
      ),
    );
    const reserve = (
      i: number,
      vehicle: number,
      start: number,
      end: number,
      status: Of<"reservation">["status"],
      hours = 0,
    ) => {
      const rate = 45000 + vehicle * 7500;
      const subtotal = rentalPrice(date(start, hours), date(end), rate);
      const vatAmount = Math.round((subtotal * 15) / 100);
      add(
        "reservation",
        ref("reservation", i),
        companyId,
        branchId,
        {
          customerId: ref("customer", i),
          vehicleId: ref("vehicle", vehicle),
          startsAt: date(start, hours),
          endsAt: date(end),
          dailyRate: rate,
          subtotal,
          discountAmount: 0,
          vatRate: 15,
          vatAmount,
          total: subtotal + vatAmount,
          status,
        },
        date(start - 2),
      );
    };
    reserve(0, 0, -1, 2, "confirmed"); // active rental
    reserve(1, 1, -4, -1, "confirmed"); // overdue active rental
    reserve(2, 2, -5, -3, "completed");
    reserve(3, 3, 0, 1, "confirmed", -1); // ready for handover
    reserve(4, 4, 1, 3, "confirmed");
    reserve(5, 2, 4, 6, "draft");
    reserve(6, 2, -12, -10, "cancelled");
    [0, 1, 2, 3, 6].forEach((i) => {
      const reservation = result.entities.find(
        (e) => e.kind === "reservation" && e.id === ref("reservation", i),
      ) as Of<"reservation">;
      add(
        "rental",
        ref("rental", i),
        companyId,
        branchId,
        {
          reservationId: reservation.id,
          customerId: reservation.customerId,
          vehicleId: reservation.vehicleId,
          startsAt: reservation.startsAt,
          endsAt: reservation.endsAt,
          dailyRate: reservation.dailyRate,
          subtotal: reservation.subtotal,
          discountAmount: reservation.discountAmount,
          vatRate: reservation.vatRate,
          vatAmount: reservation.vatAmount,
          total: reservation.total,
          status:
            i === 2
              ? "completed"
              : i === 3
                ? "draft"
                : i === 6
                  ? "cancelled"
                  : "active",
          handoverAt: i === 3 || i === 6 ? "" : reservation.startsAt,
          returnedAt: i === 2 ? reservation.endsAt : "",
          handoverOdometer: i === 3 || i === 6 ? 0 : 15000 + i * 3250,
          returnOdometer: i === 2 ? 21900 : 0,
          notes: "Synthetic inspection recorded; demo kilometres.",
        },
        reservation.startsAt,
      );
      if (i !== 6)
        add(
          "invoice",
          ref("invoice", i),
          companyId,
          branchId,
          {
            customerId: reservation.customerId,
            rentalId: ref("rental", i),
            description: `Demo rental ${b}-${i}`,
            subtotal: reservation.subtotal,
            discountAmount: reservation.discountAmount,
            vatRate: reservation.vatRate,
            vatAmount: reservation.vatAmount,
            total: reservation.total,
            dueAt: reservation.endsAt,
            status: i === 3 ? "draft" : "issued",
          },
          reservation.startsAt,
        );
      if (i === 0 || i === 2)
        add(
          "payment",
          ref("payment", i),
          companyId,
          branchId,
          {
            invoiceId: ref("invoice", i),
            amount:
              i === 2 ? reservation.total : Math.floor(reservation.total / 2),
            method: i === 2 ? "Card" : "Transfer",
            reference: `DEMO-RECEIPT-${b}-${i}`,
          },
          i === 2 ? date(-3) : date(-1),
        );
      if (i === 0 || i === 1 || i === 2)
        add(
          "inspection",
          ref("handover", i),
          companyId,
          branchId,
          {
            vehicleId: reservation.vehicleId,
            rentalId: ref("rental", i),
            stage: "handover",
            odometer: 15000 + i * 3250,
            condition: "Checked",
            notes: "Synthetic handover inspection recorded.",
          },
          reservation.startsAt,
        );
      if (i === 2)
        add(
          "refund",
          ref("refund", i),
          companyId,
          branchId,
          {
            invoiceId: ref("invoice", i),
            amount: 10000,
            reason: "Synthetic goodwill credit",
          },
          date(-2),
        );
      if (i === 2)
        add(
          "inspection",
          ref("inspection", i),
          companyId,
          branchId,
          {
            vehicleId: reservation.vehicleId,
            rentalId: ref("rental", i),
            stage: "return",
            odometer: 21900,
            condition: "available",
            notes: "Synthetic return inspection: no new damage.",
          },
          date(-3),
        );
    });
    // Completed readings must agree with the vehicle's current reading.
    const completedVehicle = result.entities.find(
      (e) => e.id === ref("vehicle", 2),
    ) as Of<"vehicle">;
    completedVehicle.odometer = 21900;
    for (let i = 0; i < 4; i++) {
      const vehicle = ref("vehicle", i % 2 ? 2 : 4);
      const extraVehicle = ref("vehicle", 0);
      const vehicleIds = i === 1 ? [vehicle, extraVehicle] : [vehicle];
      const rate = 45000 + (i % 2 ? 2 : 4) * 7500;
      const combinedRate = i === 1 ? rate + 45000 : rate;
      const subtotal = combinedRate * 2;
      const discountPct = i === 2 ? 15 : i === 1 ? 5 : 0;
      const discountAmount = Math.round((subtotal * discountPct) / 100);
      const taxable = subtotal - discountAmount;
      const vatAmount = Math.round((taxable * 15) / 100);
      add(
        "quotation",
        ref("quote", i),
        companyId,
        branchId,
        {
          customerId: ref("customer", i + 3),
          vehicleId: vehicle,
          vehicleIds,
          startsAt: date(3 + i),
          endsAt: date(5 + i),
          dailyRate: combinedRate,
          subtotal,
          discountPct,
          discountAmount,
          discountStatus:
            discountPct > 10 ? "pending" : discountPct > 0 ? "approved" : "none",
          discountApprovedBy: "",
          vatRate: 15,
          vatAmount,
          total: taxable + vatAmount,
          status:
            i === 3
              ? "cancelled"
              : i === 2
                ? "pending_approval"
                : "draft",
        },
        date(-3 + i),
      );
    }
    for (let i = 0; i < 5; i++) {
      add("part", ref("part", i), companyId, branchId, {
        name: [
          "Oil filter",
          "Brake pads",
          "Air filter",
          "Wiper set",
          "Engine oil (unit)",
        ][i],
        sku: `DEMO-P-${b}-${i}`,
        unitCost: [8500, 24000, 6500, 12000, 18000][i],
        minimum: i === 1 ? 8 : 3,
      });
      add(
        "movement",
        ref("opening", i),
        companyId,
        branchId,
        {
          partId: ref("part", i),
          quantity: i === 1 ? 2 : 12 + i * 3,
          unitCost: [8500, 24000, 6500, 12000, 18000][i],
          reason: "Seed opening stock",
          workOrderId: "",
          purchaseOrderId: "",
        },
        date(-30),
      );
    }
    add(
      "workOrder",
      ref("work", 0),
      companyId,
      branchId,
      {
        vehicleId: ref("vehicle", 5),
        title: "Preventive service and oil change",
        dueAt: date(1),
        status: "in_progress",
        labourCost: 30000,
        partsCost: 8500,
        startedAt: date(-1),
        completedAt: "",
      },
      date(-2),
    );
    add(
      "movement",
      ref("consumption", 0),
      companyId,
      branchId,
      {
        partId: ref("part", 0),
        quantity: -1,
        unitCost: 8500,
        reason: "Maintenance consumption",
        workOrderId: ref("work", 0),
        purchaseOrderId: "",
      },
      date(-1),
    );
    add("workOrder", ref("work", 1), companyId, branchId, {
      vehicleId: ref("vehicle", 6),
      title: "Bodywork assessment",
      dueAt: date(2),
      status: "open",
      labourCost: 55000,
      partsCost: 0,
      startedAt: "",
      completedAt: "",
    });
    add(
      "workOrder",
      ref("work", 2),
      companyId,
      branchId,
      {
        vehicleId: ref("vehicle", 2),
        title: "Completed tyre inspection",
        dueAt: date(-8),
        status: "completed",
        labourCost: 20000,
        partsCost: 0,
        startedAt: date(-9),
        completedAt: date(-8),
      },
      date(-10),
    );
    add(
      "expense",
      ref("expense", 0),
      companyId,
      branchId,
      {
        description: "Completed tyre inspection",
        category: "Maintenance",
        amount: 20000,
        workOrderId: ref("work", 2),
      },
      date(-8),
    );
    add(
      "expense",
      ref("expense", 1),
      companyId,
      branchId,
      {
        description: "Demo fleet insurance",
        category: "Insurance",
        amount: 95000,
        workOrderId: "",
      },
      date(-12),
    );
    for (let i = 0; i < 2; i++)
      add(
        "supplier",
        ref("supplier", i),
        companyId,
        branchId,
        {
          name: `Example Parts Supplier ${b}${i}`,
          email: `supplier-${b}-${i}@example.test`,
          phone: `+000 ${b}00 900 ${i}00`,
          active: true,
        },
        date(-30),
      );
    ["draft", "submitted", "approved", "received"].forEach((status, i) => {
      add(
        "purchaseOrder",
        ref("purchase", i),
        companyId,
        branchId,
        {
          supplierId: ref("supplier", 0),
          partId: ref("part", 1),
          quantity: 10,
          unitCost: 24000,
          total: 240000,
          status: status as Of<"purchaseOrder">["status"],
        },
        date(-5 + i),
      );
      if (status === "received")
        add(
          "movement",
          ref("receipt", i),
          companyId,
          branchId,
          {
            partId: ref("part", 1),
            quantity: 10,
            unitCost: 24000,
            reason: "Purchase receipt",
            workOrderId: "",
            purchaseOrderId: ref("purchase", i),
          },
          date(-2),
        );
    });
    // A second low-stock line remains visible after the receipt.
    add(
      "movement",
      ref("adjustment", 0),
      companyId,
      branchId,
      {
        partId: ref("part", 2),
        quantity: -17,
        unitCost: 6500,
        reason: "Seed counted stock adjustment",
        workOrderId: "",
        purchaseOrderId: "",
      },
      date(-1),
    );
    add("document", ref("document", 0), companyId, branchId, {
      name: "Synthetic vehicle registration.pdf",
      entityId: ref("vehicle", 0),
      mimeType: "application/pdf",
      size: 48000,
      expiresAt: date(180),
    });
    add("document", ref("document", 1), companyId, branchId, {
      name: "Synthetic customer identification.pdf",
      entityId: ref("customer", 0),
      mimeType: "application/pdf",
      size: 32000,
      expiresAt: date(90),
    });
    add("notification", ref("notification", 0), companyId, branchId, {
      title: "Overdue return requires follow-up",
      entityId: ref("rental", 1),
      read: false,
    });
    add("notification", ref("notification", 1), companyId, branchId, {
      title: "Preventive service is in progress",
      entityId: ref("work", 0),
      read: false,
    });
    add(
      "audit",
      ref("audit", 0),
      companyId,
      branchId,
      {
        actorId: "user-platform",
        action: "seeded",
        entityId: ref("rental", 0),
        description: "Synthetic rental and payment linked for demonstration.",
      },
      date(-1),
    );
    add(
      "message",
      ref("msg", 0),
      companyId,
      branchId,
      {
        channel: "dispatch",
        senderId: "user-operations",
        senderName: "Demo operations",
        body: `Branch ${b}: Vehicle ${ref("vehicle", 3)} cleared pre-dispatch inspection and is staged at bay 2.`,
        relatedEntityId: ref("vehicle", 3),
        readBy: ["user-operations"],
      },
      date(-1, 2),
    );
    add(
      "message",
      ref("msg", 1),
      companyId,
      branchId,
      {
        channel: "drivers",
        senderId: "user-driver",
        senderName: "Demo driver",
        body: `En route to Airport pickup with ${ref("vehicle", 0)}; fuel level verified at 85%.`,
        relatedEntityId: ref("rental", 0),
        readBy: ["user-driver"],
      },
      date(-1, 4),
    );
    add(
      "message",
      ref("msg", 2),
      companyId,
      branchId,
      {
        channel: "customers",
        senderId: "user-finance",
        senderName: "Demo finance",
        body: `Quotation ${ref("quote", 2)} carries a 15% requested discount and awaits approval before conversion.`,
        relatedEntityId: ref("quote", 2),
        readBy: ["user-finance"],
      },
      date(0, -1),
    );
  }
  for (const co of ["co-1", "co-2"])
    add("setting", `setting-${co}`, co, "", {
      name: "Workspace note",
      value:
        "Daily billing in started 24-hour blocks. Mandatory 15% VAT applied. Demo distance unit: km. Not production accounting.",
    });
  for (const co of ["co-1", "co-2"])
    add("setting", `setting-rows-${co}`, co, "", {
      name: "Rows per page",
      value: "10",
    });
  for (const co of ["co-1", "co-2"])
    add("setting", `setting-vat-${co}`, co, "", {
      name: "VAT rate (%)",
      value: "15",
    });
  for (const co of ["co-1", "co-2"])
    add("setting", `setting-discount-threshold-${co}`, co, "", {
      name: "Discount approval threshold (%)",
      value: "10",
    });
  return databaseSchema.parse(result);
}
