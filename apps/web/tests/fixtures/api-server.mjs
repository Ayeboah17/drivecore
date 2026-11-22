// Synthetic contract server, loopback only. Not Laravel and never a staging substitute.
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
let sessions = new Map();
let customers = new Map();
let vehicles = new Map();
let companies = new Map();
let branches = new Map();
let managedUsers = new Map();
let companySettings = new Map();
let quotations = new Map();
let reservations = new Map();
let rentals = new Map();
let invoices = new Map();
let payments = new Map();
let refunds = new Map();
let expenses = new Map();
let journalEntries = new Map();
let parts = new Map();
let stockMovements = new Map();
let suppliers = new Map();
let purchaseOrders = new Map();
let workOrders = new Map();
let messages = new Map();
let notifications = new Map();
let auditEvents = new Map();
let savedFilters = new Map();
let documents = new Map();
let documentBlobs = new Map();
let control = {};
let nextId = 20;
const SYSTEM_GL_ACCOUNTS = [
  { id: 1, code: "1000", name: "Cash & Bank", type: "asset", is_system: true },
  { id: 2, code: "1100", name: "Accounts Receivable", type: "asset", is_system: true },
  { id: 3, code: "1200", name: "Spare Parts Inventory", type: "asset", is_system: true },
  { id: 4, code: "1250", name: "Maintenance Work-in-Progress", type: "asset", is_system: true },
  { id: 5, code: "2000", name: "Supplier Payables", type: "liability", is_system: true },
  { id: 6, code: "2100", name: "VAT Payable", type: "liability", is_system: true },
  { id: 7, code: "4000", name: "Rental Revenue", type: "revenue", is_system: true },
  { id: 8, code: "4100", name: "Sales Refunds & Credits", type: "revenue", is_system: true },
  { id: 9, code: "5000", name: "Fleet & Operating Expenses", type: "expense", is_system: true },
];
let collectionReads = 0;
let completedWrites = 0;
const stamp = "2026-11-15T10:00:00Z";
const base = {
  company_id: 1,
  branch_id: 2,
  created_at: stamp,
  updated_at: stamp,
};
const ROLE_DEFS = [
  {
    name: "company-admin",
    permissions: [
      "companies.view",
      "companies.manage",
      "branches.view",
      "branches.manage",
      "customers.view",
      "customers.manage",
      "vehicles.view",
      "vehicles.manage",
      "reservations.view",
      "reservations.manage",
      "rentals.view",
      "rentals.manage",
      "documents.view",
      "documents.manage",
      "users.view",
      "users.manage",
      "settings.manage",
      "quotations.view",
      "quotations.manage",
      "quotations.approve_discount",
      "invoices.view",
      "invoices.manage",
      "payments.manage",
      "expenses.view",
      "expenses.manage",
      "gl.view",
      "work_orders.view",
      "work_orders.manage",
      "parts.view",
      "parts.manage",
      "suppliers.view",
      "suppliers.manage",
      "purchase_orders.view",
      "purchase_orders.manage",
      "purchase_orders.approve",
      "messages.view",
      "messages.send",
      "reports.view",
      "audit.view",
    ],
  },
  { name: "driver", permissions: ["companies.view", "branches.view"] },
  {
    name: "finance",
    permissions: [
      "companies.view",
      "branches.view",
      "customers.view",
      "vehicles.view",
      "reservations.view",
      "rentals.view",
      "documents.view",
      "quotations.view",
      "quotations.approve_discount",
      "invoices.view",
      "invoices.manage",
      "payments.manage",
      "expenses.view",
      "expenses.manage",
      "gl.view",
      "work_orders.view",
      "parts.view",
      "suppliers.view",
      "purchase_orders.view",
      "purchase_orders.approve",
      "messages.view",
      "messages.send",
      "reports.view",
    ],
  },
  {
    name: "operations",
    permissions: [
      "customers.view",
      "customers.manage",
      "vehicles.view",
      "vehicles.manage",
      "quotations.view",
      "quotations.manage",
      "reservations.view",
      "reservations.manage",
      "rentals.view",
      "rentals.manage",
      "documents.view",
      "documents.manage",
      "work_orders.view",
      "work_orders.manage",
      "parts.view",
      "parts.manage",
      "suppliers.view",
      "suppliers.manage",
      "purchase_orders.view",
      "purchase_orders.manage",
      "messages.view",
      "messages.send",
      "reports.view",
    ],
  },
  {
    name: "viewer",
    permissions: [
      "companies.view",
      "branches.view",
      "customers.view",
      "vehicles.view",
      "quotations.view",
      "reservations.view",
      "rentals.view",
      "documents.view",
      "invoices.view",
      "expenses.view",
      "work_orders.view",
      "parts.view",
      "suppliers.view",
      "purchase_orders.view",
      "messages.view",
      "reports.view",
    ],
  },
];

function reset() {
  companies = new Map([
    [1, { id: 1, name: "Synthetic One", currency: "ZMW" }],
    [3, { id: 3, name: "Synthetic Three", currency: "EUR" }],
  ]);
  companySettings = new Map([
    [
      1,
      {
        company_id: 1,
        currency: "ZMW",
        vat_rate_pct: 15,
        discount_approval_threshold_pct: 10,
      },
    ],
    [
      3,
      {
        company_id: 3,
        currency: "EUR",
        vat_rate_pct: 15,
        discount_approval_threshold_pct: 10,
      },
    ],
  ]);
  quotations = new Map();
  invoices = new Map();
  payments = new Map();
  refunds = new Map();
  expenses = new Map();
  journalEntries = new Map();
  parts = new Map();
  stockMovements = new Map();
  suppliers = new Map();
  purchaseOrders = new Map();
  workOrders = new Map();
  messages = new Map();
  notifications = new Map([
    [
      900,
      {
        id: 900,
        company_id: 1,
        branch_id: 2,
        required_permission: "rentals.view",
        severity: "info",
        title: "Rental #600 active handover logged",
        body: "Vehicle SYN-11 is currently on active rental.",
        href: "/companies/1/rentals/600?branch=2",
        read_by: [],
        created_at: stamp,
      },
    ],
  ]);
  auditEvents = new Map([
    [
      950,
      {
        id: 950,
        company_id: 1,
        actor_name: "Synthetic operator",
        action: "rental.handed_over",
        entity_type: "rental",
        entity_id: 600,
        summary: "Handed over Rental #600 (SYN-11) at 50 km.",
        created_at: stamp,
      },
    ],
  ]);
  savedFilters = new Map();
  branches = new Map([
    [2, { id: 2, company_id: 1, name: "Synthetic branch" }],
    [4, { id: 4, company_id: 3, name: "Other branch" }],
  ]);
  sessions = new Map();
  control = {};
  collectionReads = 0;
  completedWrites = 0;
  nextId = 20;
  customers = new Map([
    [
      10,
      {
        ...base,
        id: 10,
        name: "Synthetic customer",
        type: "individual",
        email: "customer10@example.test",
        phone: "+233 20 000 0010",
      },
    ],
    [
      11,
      {
        ...base,
        id: 11,
        name: "Apex Corporate Fleet",
        type: "corporate",
        email: "fleet@apex.test",
        phone: "+233 20 000 0011",
      },
    ],
    [
      12,
      {
        ...base,
        id: 12,
        company_id: 3,
        branch_id: 4,
        name: "Other company customer",
        type: "individual",
        email: null,
        phone: null,
      },
    ],
  ]);
  vehicles = new Map([
    [
      10,
      {
        ...base,
        id: 10,
        registration: "SYN-10",
        make: "Synthetic",
        model: "Fixture",
        year: null,
        odometer: 10,
        odometer_unit: "km",
        daily_rate_minor: 45000,
        functions: ["gps_tracker", "automatic"],
        status: "available",
      },
    ],
    [
      11,
      {
        ...base,
        id: 11,
        registration: "SYN-11",
        make: "Synthetic",
        model: "Rented",
        year: 2024,
        odometer: 50,
        odometer_unit: "km",
        daily_rate_minor: 0,
        functions: [],
        status: "rented",
      },
    ],
    [
      12,
      {
        ...base,
        id: 12,
        company_id: 3,
        branch_id: 4,
        registration: "OTH-12",
        make: "Other",
        model: "CompanyCar",
        year: 2023,
        odometer: 200,
        odometer_unit: "km",
        daily_rate_minor: 60000,
        functions: ["awd_4x4"],
        status: "available",
      },
    ],
  ]);
  managedUsers = new Map([
    [
      1,
      {
        id: 1,
        name: "Synthetic operator",
        email: "companyadmin@example.test",
        is_active: true,
        is_platform_admin: false,
        roles: ["company-admin"],
        memberships: [{ company_id: 1, branch_id: null }],
      },
    ],
    [
      2,
      {
        id: 2,
        name: "Fleet Driver",
        email: "driver-co1@example.test",
        is_active: true,
        is_platform_admin: false,
        roles: ["driver"],
        memberships: [{ company_id: 1, branch_id: 2 }],
      },
    ],
    [
      3,
      {
        id: 3,
        name: "Branch Viewer",
        email: "viewer-co1@example.test",
        is_active: false,
        is_platform_admin: false,
        roles: ["viewer"],
        memberships: [{ company_id: 1, branch_id: 2 }],
      },
    ],
    [
      4,
      {
        id: 4,
        name: "Shared Operator",
        email: "shared@example.test",
        is_active: true,
        is_platform_admin: false,
        roles: ["operations"],
        memberships: [
          { company_id: 1, branch_id: null },
          { company_id: 3, branch_id: null },
        ],
      },
    ],
  ]);
  const now = Date.now();
  const iso = (hoursOffset) => new Date(now + hoursOffset * 3600000).toISOString();
  reservations = new Map([
    [
      500,
      {
        ...base,
        id: 500,
        customer_id: 10,
        vehicle_id: 10,
        created_by: 1,
        starts_at: iso(-2),
        ends_at: iso(48),
        status: "confirmed",
      },
    ],
    [
      501,
      {
        ...base,
        id: 501,
        customer_id: 11,
        vehicle_id: 11,
        created_by: 1,
        starts_at: iso(-24),
        ends_at: iso(-1),
        status: "confirmed",
      },
    ],
    [
      502,
      {
        ...base,
        id: 502,
        customer_id: 10,
        vehicle_id: 10,
        created_by: 1,
        starts_at: iso(1440),
        ends_at: iso(1488),
        status: "confirmed",
      },
    ],
  ]);
  rentals = new Map([
    [
      600,
      {
        ...base,
        id: 600,
        reservation_id: 501,
        vehicle_id: 11,
        driver_user_id: 2,
        status: "active",
        handed_over_at: iso(-23),
        returned_at: null,
        handover_odometer: 50,
        return_odometer: null,
        handover_notes: "Outbound check complete.",
        return_notes: null,
      },
    ],
    [
      601,
      {
        ...base,
        id: 601,
        reservation_id: 502,
        vehicle_id: 10,
        driver_user_id: null,
        status: "draft",
        handed_over_at: null,
        returned_at: null,
        handover_odometer: null,
        return_odometer: null,
        handover_notes: null,
        return_notes: null,
      },
    ],
  ]);
  documents = new Map([
    [
      700,
      {
        ...base,
        id: 700,
        uploaded_by: 1,
        entity_type: "vehicle",
        entity_id: 10,
        original_name: "insurance-policy.pdf",
        mime_type: "application/pdf",
        size: 1024,
        expires_at: iso(240),
      },
    ],
  ]);
  documentBlobs = new Map([
    [700, Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF", "utf8")],
  ]);
}
reset();

function parseMultipart(buffer, contentType) {
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;\s]+))/i);
  if (!match) return null;
  const boundary = match[1] || match[2];
  const raw = buffer.toString("latin1");
  const parts = raw.split(`--${boundary}`).slice(1, -1);
  const fields = {};
  let file = null;
  for (const part of parts) {
    const splitIdx = part.indexOf("\r\n\r\n");
    if (splitIdx === -1) continue;
    const headerBlock = part.slice(0, splitIdx);
    const bodyStr = part.slice(splitIdx + 4).replace(/\r\n$/, "");
    const nameMatch = headerBlock.match(/name="([^"]+)"/i);
    if (!nameMatch) continue;
    const fieldName = nameMatch[1];
    const fileMatch = headerBlock.match(/filename="([^"]*)"/i);
    if (fileMatch) {
      const mimeMatch = headerBlock.match(/content-type:\s*([^\r\n]+)/i);
      file = {
        original_name: fileMatch[1] || "upload.pdf",
        mime_type: (mimeMatch?.[1] ?? "application/octet-stream").trim(),
        bytes: Buffer.from(bodyStr, "latin1"),
      };
    } else {
      fields[fieldName] = bodyStr;
    }
  }
  return { fields, file };
}

function decorateReservation(resRecord) {
  if (control.stripSummaryFields) {
    return { ...resRecord };
  }
  const customer = customers.get(resRecord.customer_id);
  const vehicle = vehicles.get(resRecord.vehicle_id);
  const linkedRental = [...rentals.values()].find(
    (r) => r.reservation_id === resRecord.id,
  );
  return {
    ...resRecord,
    customer_name: customer?.name ?? null,
    vehicle_registration: vehicle?.registration ?? null,
    vehicle_label: vehicle ? `${vehicle.make} ${vehicle.model}` : null,
    has_rental: !!linkedRental,
    rental_id: linkedRental?.id ?? null,
  };
}

function decorateRental(rentalRecord) {
  if (control.stripSummaryFields) {
    return { ...rentalRecord };
  }
  const resRecord = reservations.get(rentalRecord.reservation_id);
  const customer = resRecord ? customers.get(resRecord.customer_id) : null;
  const vehicle = vehicles.get(rentalRecord.vehicle_id);
  const driver = rentalRecord.driver_user_id
    ? managedUsers.get(rentalRecord.driver_user_id)
    : null;
  const linkedInvoice = [...invoices.values()].find(
    (inv) => inv.rental_id === rentalRecord.id,
  );
  return {
    ...rentalRecord,
    odometer_unit: "km",
    customer_id: resRecord?.customer_id ?? null,
    customer_name: customer?.name ?? null,
    vehicle_registration: vehicle?.registration ?? null,
    vehicle_label: vehicle ? `${vehicle.make} ${vehicle.model}` : null,
    driver_name: driver?.name ?? null,
    starts_at: resRecord?.starts_at ?? null,
    ends_at: resRecord?.ends_at ?? null,
    invoice_id: linkedInvoice?.id ?? null,
  };
}

function postJournalEntry({
  companyId,
  branchId,
  createdBy,
  sourceType,
  sourceId,
  reference,
  memo,
  lines,
}) {
  const cleanLines = lines
    .filter((l) => (l.debit_minor ?? 0) > 0 || (l.credit_minor ?? 0) > 0)
    .map((l, idx) => {
      const acc = SYSTEM_GL_ACCOUNTS.find((a) => a.code === l.account_code);
      return {
        id: nextId + idx,
        account_code: l.account_code,
        account_name: acc?.name ?? l.account_code,
        debit_minor: l.debit_minor ?? 0,
        credit_minor: l.credit_minor ?? 0,
      };
    });
  if (cleanLines.length === 0) return null;
  const id = nextId++;
  const entry = {
    id,
    company_id: companyId,
    branch_id: branchId,
    created_by: createdBy,
    source_type: sourceType,
    source_id: sourceId,
    reference,
    memo,
    posted_at: new Date().toISOString(),
    lines: cleanLines,
  };
  journalEntries.set(id, entry);
  return entry;
}

function computeInvoiceTotals(lines, discountPct, vatRatePct) {
  const normalizedLines = lines.map((line, idx) => {
    const qty = Math.max(1, Math.floor(Number(line.quantity)));
    const unit = Math.max(0, Math.round(Number(line.unit_price_minor)));
    return {
      id: idx + 1,
      description: String(line.description).trim(),
      quantity: qty,
      unit_price_minor: unit,
      line_total_minor: qty * unit,
    };
  });
  const subtotal_minor = normalizedLines.reduce(
    (sum, l) => sum + l.line_total_minor,
    0,
  );
  const discount_minor = Math.round(subtotal_minor * (discountPct / 100));
  const taxable = Math.max(0, subtotal_minor - discount_minor);
  const vat_minor = Math.round(taxable * (vatRatePct / 100));
  const total_minor = taxable + vat_minor;
  return {
    lines: normalizedLines,
    subtotal_minor,
    discount_minor,
    vat_minor,
    total_minor,
  };
}

function decorateInvoice(inv) {
  const cust = inv.customer_id ? customers.get(inv.customer_id) : null;
  const resolvedName = cust?.name ?? inv.custom_customer_name ?? null;
  const invPayments = [...payments.values()]
    .filter((p) => p.invoice_id === inv.id)
    .map((p) => ({
      ...p,
      invoice_number: inv.invoice_number,
      customer_name: resolvedName,
    }));
  const invRefunds = [...refunds.values()]
    .filter((r) => r.invoice_id === inv.id)
    .map((r) => ({
      ...r,
      invoice_number: inv.invoice_number,
      customer_name: resolvedName,
    }));
  const paid_minor = invPayments.reduce((s, p) => s + p.amount_minor, 0);
  const refunded_minor = invRefunds.reduce((s, r) => s + r.amount_minor, 0);
  const net_paid_minor = paid_minor - refunded_minor;
  const outstanding_minor =
    inv.status === "issued" ? Math.max(0, inv.total_minor - paid_minor) : 0;
  const is_overdue =
    inv.status === "issued" &&
    outstanding_minor > 0 &&
    Date.parse(inv.due_at) < Date.now();
  return {
    ...inv,
    customer_id: inv.customer_id ?? null,
    customer_name: resolvedName,
    custom_customer_name: inv.custom_customer_name ?? null,
    custom_customer_email: inv.custom_customer_email ?? null,
    custom_customer_phone: inv.custom_customer_phone ?? null,
    paid_minor,
    refunded_minor,
    net_paid_minor,
    outstanding_minor,
    is_overdue,
    payments: invPayments,
    refunds: invRefunds,
  };
}

function seedMany(domain) {
  for (let i = 1; i <= 27; i++) {
    const id = nextId++;
    if (domain === "customers") {
      customers.set(id, {
        ...base,
        id,
        name: `Needle Customer ${String(i).padStart(2, "0")}`,
        type: "corporate",
        email: `needle-${i}@example.test`,
        phone: `+233 50 000 ${String(i).padStart(4, "0")}`,
      });
    } else if (domain === "vehicles") {
      vehicles.set(id, {
        ...base,
        id,
        registration: `NED-${String(i).padStart(3, "0")}`,
        make: "Toyota",
        model: `Hilux ${i}`,
        year: 2025,
        odometer: 1000 + i * 10,
        odometer_unit: "km",
        daily_rate_minor: 55000,
        functions: ["gps_tracker", "awd_4x4"],
        status: "maintenance",
      });
    } else if (domain === "users") {
      managedUsers.set(id, {
        id,
        name: `Paged Driver ${String(i).padStart(2, "0")}`,
        email: `paged-driver-${i}@example.test`,
        is_active: true,
        is_platform_admin: false,
        roles: ["driver"],
        memberships: [{ company_id: 1, branch_id: 2 }],
      });
    }
  }
}

const fixturePort = Number(process.env.DRIVECORE_FIXTURE_PORT ?? 4201);
createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${fixturePort}`);
  const json = (status, value) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(value));
  };
  const fail = (status, errors = {}) =>
    json(status, { message: "Synthetic rejection", errors });
  const contentType = req.headers["content-type"] ?? "";
  const isMultipart = /^multipart\/form-data/i.test(contentType);
  const chunks = [];
  let totalBytes = 0;
  const maxBytes = isMultipart ? 11 * 1024 * 1024 : 70000;
  for await (const chunk of req) {
    chunks.push(chunk);
    totalBytes += chunk.length;
    if (totalBytes > maxBytes) {
      req.destroy();
      return;
    }
  }
  const rawBuffer = Buffer.concat(chunks);
  let input = {};
  let multipartData = null;
  if (isMultipart) {
    multipartData = parseMultipart(rawBuffer, contentType);
    if (!multipartData) {
      fail(400);
      return;
    }
  } else {
    const text = rawBuffer.toString("utf8");
    try {
      input = text ? JSON.parse(text) : {};
    } catch {
      fail(400);
      return;
    }
  }
  if (url.pathname === "/__test/reset") {
    reset();
    json(200, {});
    return;
  }
  if (url.pathname === "/__test/control") {
    Object.assign(control, input);
    if (input.emptyDirectory) {
      companies.clear();
      branches.clear();
    }
    if (input.seedMany) {
      seedMany(input.seedMany);
    }
    if (input.seedExtraAvailableVehicle) {
      vehicles.set(14, {
        ...base,
        id: 14,
        registration: "SYN-14",
        make: "Toyota",
        model: "Prado",
        year: 2025,
        odometer: 1200,
        odometer_unit: "km",
        daily_rate_minor: 65000,
        functions: ["awd_4x4"],
        status: "available",
      });
      vehicles.set(15, {
        ...base,
        id: 15,
        registration: "SYN-15",
        make: "Unpriced",
        model: "Sedan",
        year: 2024,
        odometer: 500,
        odometer_unit: "km",
        daily_rate_minor: 0,
        functions: [],
        status: "available",
      });
    }
    if (input.expire) sessions.clear();
    json(200, {});
    return;
  }
  if (url.pathname === "/__test/stats") {
    json(200, { collectionReads, completedWrites });
    return;
  }
  const cookies = Object.fromEntries(
    (req.headers.cookie ?? "").split(";").map((part) => part.trim().split("=")),
  );
  if (url.pathname === "/sanctum/csrf-cookie") {
    res.setHeader("Set-Cookie", [
      `XSRF-TOKEN=${encodeURIComponent(randomUUID() + "=")}; Path=/; SameSite=Lax`,
      `drivecore_test=${randomUUID()}; Path=/; HttpOnly; SameSite=Lax`,
    ]);
    res.writeHead(204);
    res.end();
    return;
  }
  if (
    req.method !== "GET" &&
    (!cookies["XSRF-TOKEN"] ||
      decodeURIComponent(cookies["XSRF-TOKEN"]) !== req.headers["x-xsrf-token"])
  ) {
    fail(419);
    return;
  }
  if (url.pathname === "/api/v1/auth/login") {
    if (control.loginStatus) {
      fail(control.loginStatus);
      return;
    }
    if (input.email?.startsWith("disabled")) {
      fail(422, { email: ["The provided credentials are incorrect."] });
      return;
    }
    const role = input.email?.split("@")[0];
    const permissions =
      role === "driver" || role === "activedriver"
        ? ["companies.view", "branches.view"]
        : role === "finance"
          ? [
              "companies.view",
              "branches.view",
              "customers.view",
              "vehicles.view",
              "quotations.view",
              "quotations.approve_discount",
              "reservations.view",
              "rentals.view",
              "documents.view",
              "invoices.view",
              "invoices.manage",
              "payments.manage",
              "expenses.view",
              "expenses.manage",
              "gl.view",
              "work_orders.view",
              "parts.view",
              "suppliers.view",
              "purchase_orders.view",
              "purchase_orders.approve",
              "messages.view",
              "messages.send",
              "reports.view",
            ]
        : role === "viewer"
          ? [
              "customers.view",
              "vehicles.view",
              "branches.view",
              "quotations.view",
              "reservations.view",
              "rentals.view",
              "documents.view",
              "invoices.view",
              "expenses.view",
              "work_orders.view",
              "parts.view",
              "suppliers.view",
              "purchase_orders.view",
              "messages.view",
              "reports.view",
            ]
          : [
              "customers.view",
              "customers.manage",
              "vehicles.view",
              "vehicles.manage",
              "quotations.view",
              "quotations.manage",
              "reservations.view",
              "reservations.manage",
              "rentals.view",
              "rentals.manage",
              "documents.view",
              "documents.manage",
              "work_orders.view",
              "work_orders.manage",
              "parts.view",
              "parts.manage",
              "suppliers.view",
              "suppliers.manage",
              "purchase_orders.view",
              "purchase_orders.manage",
              "messages.view",
              "messages.send",
              "reports.view",
              ...(["admin", "companyadmin", "restrictedadmin"].includes(role)
                ? [
                    "branches.view",
                    "branches.manage",
                    "companies.manage",
                    "users.view",
                    "users.manage",
                    "settings.manage",
                    "quotations.approve_discount",
                    "invoices.view",
                    "invoices.manage",
                    "payments.manage",
                    "expenses.view",
                    "expenses.manage",
                    "gl.view",
                    "purchase_orders.approve",
                    "audit.view",
                  ]
                : []),
            ];
    const user = {
      id: role === "activedriver" ? 2 : 1,
      name: role === "activedriver" ? "Fleet Driver" : "Synthetic operator",
      email:
        role === "activedriver"
          ? "driver-co1@example.test"
          : "synthetic@example.test",
      roles: [role === "activedriver" ? "driver" : role],
      is_platform_admin: role === "admin",
      permissions,
      companies:
        role === "admin"
          ? []
          : role === "driver"
            ? []
            : role === "activedriver"
              ? [{ id: 1, name: "Synthetic One", branch_id: 2 }]
              : [
                  {
                    id: 1,
                    name: "Synthetic One",
                    branch_id: ["unrestricted", "companyadmin"].includes(role)
                      ? null
                      : 2,
                  },
                  { id: 3, name: "Synthetic Three", branch_id: 4 },
                ],
    };
    const session = randomUUID();
    sessions.set(session, user);
    res.setHeader("Set-Cookie", [
      `drivecore_test=${session}; Path=/; HttpOnly; SameSite=Lax`,
      `XSRF-TOKEN=${encodeURIComponent(randomUUID() + "=")}; Path=/; SameSite=Lax`,
    ]);
    json(200, { data: user });
    return;
  }
  const user = sessions.get(cookies.drivecore_test);
  if (!user) {
    fail(401);
    return;
  }
  if (control.csrfFailure && req.method !== "GET") {
    fail(419);
    return;
  }
  if (control.disabled) {
    fail(403);
    return;
  }
  if (url.pathname === "/api/v1/auth/me") {
    json(200, { data: control.revoked ? { ...user, companies: [] } : user });
    return;
  }
  if (url.pathname === "/api/v1/auth/logout") {
    if (control.logoutFailure) {
      fail(503);
      return;
    }
    sessions.delete(cookies.drivecore_test);
    res.setHeader("Set-Cookie", "drivecore_test=; Max-Age=0; Path=/; HttpOnly");
    json(200, { data: { message: "Signed out." } });
    return;
  }

  const page = Number(url.searchParams.get("page") ?? 1);
  const sortItems = (items, accessors) => {
    const sortKey = url.searchParams.get("sort");
    const dir = url.searchParams.get("dir") === "desc" ? "desc" : "asc";
    if (!sortKey || !accessors[sortKey]) return items;
    const accessor = accessors[sortKey];
    const mult = dir === "desc" ? -1 : 1;
    return [...items].sort((a, b) => {
      const av = accessor(a);
      const bv = accessor(b);
      const aEmpty = av === null || av === undefined || av === "";
      const bEmpty = bv === null || bv === undefined || bv === "";
      if (aEmpty && bEmpty) return (a.id ?? 0) - (b.id ?? 0);
      if (aEmpty) return 1;
      if (bEmpty) return -1;
      let cmp = 0;
      if (typeof av === "number" && typeof bv === "number") {
        cmp = av - bv;
      } else if (typeof av === "boolean" && typeof bv === "boolean") {
        cmp = Number(av) - Number(bv);
      } else {
        cmp = String(av).localeCompare(String(bv), undefined, {
          numeric: true,
          sensitivity: "base",
        });
      }
      if (cmp !== 0) return cmp * mult;
      return (a.id ?? 0) - (b.id ?? 0);
    });
  };
  const paginateSlice = (items) => {
    const perPage = 25;
    const total = items.length;
    const lastPage = Math.max(1, Math.ceil(total / perPage));
    const slice = items.slice((page - 1) * perPage, page * perPage);
    json(200, {
      data: slice,
      links: {},
      meta: {
        current_page: page,
        last_page: lastPage,
        per_page: perPage,
        total,
      },
    });
  };
  const paginate = (data, last = 1) =>
    json(200, {
      data,
      links: {},
      meta: {
        current_page: page,
        last_page: last,
        per_page: 25,
        total: last === 2 ? 26 : data.length,
      },
    });

  if (url.pathname === "/api/v1/companies") {
    if (req.method === "POST") {
      if (!user.is_platform_admin) {
        fail(403);
        return;
      }
      if (control.setupValidation) {
        fail(422, { name: ["Synthetic company rejection."] });
        return;
      }
      if (
        !input.name ||
        input.name.length > 255 ||
        !/^[A-Z]{3}$/.test(input.currency)
      ) {
        fail(422, { currency: ["Enter three uppercase letters."] });
        return;
      }
      const created = {
        id: nextId++,
        name: input.name,
        currency: input.currency,
      };
      companies.set(created.id, created);
      completedWrites++;
      json(201, { data: created });
      return;
    }
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const records = [...companies.values()].filter(
      (c) => !q || c.name.toLowerCase().includes(q),
    );
    paginate(
      records.length > 1
        ? page === 1
          ? records.slice(0, 1)
          : records.slice(1)
        : records,
      records.length > 1 ? 2 : 1,
    );
    return;
  }
  if (url.pathname === "/api/v1/branches") {
    if (req.method === "POST") {
      if (
        !user.is_platform_admin &&
        (!user.permissions.includes("branches.manage") ||
          !user.companies.some(
            (c) => c.id === input.company_id && c.branch_id === null,
          ))
      ) {
        fail(403);
        return;
      }
      if (!companies.has(input.company_id)) {
        fail(404);
        return;
      }
      if (
        control.setupValidation ||
        [...branches.values()].some(
          (b) => b.company_id === input.company_id && b.name === input.name,
        )
      ) {
        fail(422, { name: ["The name has already been taken."] });
        return;
      }
      const created = {
        id: nextId++,
        company_id: input.company_id,
        name: input.name,
      };
      branches.set(created.id, created);
      completedWrites++;
      json(201, { data: created });
      return;
    }
    if (control.directoryFailure) {
      fail(503);
      return;
    }
    const companyFilter = url.searchParams.get("company_id")
      ? Number(url.searchParams.get("company_id"))
      : null;
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const list = [...branches.values()].filter(
      (b) =>
        (!companyFilter || b.company_id === companyFilter) &&
        (!q || b.name.toLowerCase().includes(q)),
    );
    paginate(list);
    return;
  }

  // --- M5 Roles & Users Administration ---
  const requireUserWorkspace = (companyId) => {
    if (!Number.isInteger(companyId) || companyId < 1) {
      fail(422, { company_id: ["The company id field is required."] });
      return null;
    }
    if (!companies.has(companyId)) {
      fail(404);
      return null;
    }
    if (user.is_platform_admin) return companyId;
    const membership = user.companies.find((c) => c.id === companyId);
    if (!membership) {
      fail(404);
      return null;
    }
    if (membership.branch_id !== null) {
      fail(403);
      return null;
    }
    return companyId;
  };

  if (url.pathname === "/api/v1/roles" && req.method === "GET") {
    if (!user.is_platform_admin && !user.permissions.includes("users.view")) {
      fail(403);
      return;
    }
    const companyId = Number(url.searchParams.get("company_id"));
    if (!requireUserWorkspace(companyId)) return;
    json(200, { data: ROLE_DEFS });
    return;
  }

  const userMatch = url.pathname.match(/^\/api\/v1\/users(?:\/(\d+))?$/);
  if (userMatch) {
    const targetId = userMatch[1] ? Number(userMatch[1]) : null;
    if (req.method === "GET" && !targetId) {
      if (!user.is_platform_admin && !user.permissions.includes("users.view")) {
        fail(403);
        return;
      }
      const companyId = Number(url.searchParams.get("company_id"));
      if (!requireUserWorkspace(companyId)) return;
      const branchId = url.searchParams.get("branch_id")
        ? Number(url.searchParams.get("branch_id"))
        : null;
      const roleFilter = url.searchParams.get("role");
      const activeParam = url.searchParams.get("is_active");
      const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();

      const items = [...managedUsers.values()]
        .filter((u) => {
          const m = u.memberships.find((x) => x.company_id === companyId);
          if (!m) return false;
          if (!user.is_platform_admin && u.is_platform_admin) return false;
          if (branchId !== null && m.branch_id !== branchId) return false;
          if (roleFilter && !u.roles.includes(roleFilter)) return false;
          if (activeParam !== null) {
            const want = activeParam === "1" || activeParam === "true";
            if (u.is_active !== want) return false;
          }
          if (
            q &&
            !u.name.toLowerCase().includes(q) &&
            !u.email.toLowerCase().includes(q)
          )
            return false;
          return true;
        })
        .map((u) => {
          const m = u.memberships.find((x) => x.company_id === companyId);
          return {
            id: u.id,
            name: u.name,
            email: u.email,
            is_active: u.is_active,
            roles: u.roles,
            company_id: companyId,
            branch_id: m?.branch_id ?? null,
          };
        });
      paginateSlice(
        sortItems(items, {
          name: (u) => u.name,
          email: (u) => u.email,
          role: (u) => u.roles[0] ?? "",
          is_active: (u) => u.is_active,
          id: (u) => u.id,
        }),
      );
      return;
    }

    if (req.method === "POST" && !targetId) {
      if (
        !user.is_platform_admin &&
        !user.permissions.includes("users.manage")
      ) {
        fail(403);
        return;
      }
      const companyId = Number(input.company_id);
      if (!requireUserWorkspace(companyId)) return;
      if (
        !input.password ||
        input.password.length < 12 ||
        input.password !== input.password_confirmation
      ) {
        fail(422, { password: ["Invalid password confirmation."] });
        return;
      }
      if (
        [...managedUsers.values()].some(
          (u) => u.email.toLowerCase() === String(input.email).toLowerCase(),
        )
      ) {
        fail(422, { email: ["The email has already been taken."] });
        return;
      }
      const id = nextId++;
      const created = {
        id,
        name: input.name,
        email: String(input.email).toLowerCase(),
        is_active: true,
        is_platform_admin: false,
        roles: [input.role],
        memberships: [
          { company_id: companyId, branch_id: input.branch_id ?? null },
        ],
      };
      managedUsers.set(id, created);
      completedWrites++;
      json(201, {
        data: {
          id: created.id,
          name: created.name,
          email: created.email,
          is_platform_admin: false,
          roles: created.roles,
          permissions:
            ROLE_DEFS.find((r) => r.name === input.role)?.permissions ?? [],
          companies: [
            {
              id: companyId,
              name: companies.get(companyId)?.name ?? "Synthetic",
              branch_id: input.branch_id ?? null,
            },
          ],
        },
      });
      return;
    }

    if (req.method === "PATCH" && targetId) {
      if (
        !user.is_platform_admin &&
        !user.permissions.includes("users.manage")
      ) {
        fail(403);
        return;
      }
      const companyId = Number(input.company_id);
      if (!requireUserWorkspace(companyId)) return;
      const target = managedUsers.get(targetId);
      const membership = target?.memberships.find(
        (m) => m.company_id === companyId,
      );
      if (!target || !membership) {
        fail(404);
        return;
      }
      if (target.id === user.id) {
        fail(409);
        return;
      }
      if (
        !user.is_platform_admin &&
        (input.role !== undefined || input.is_active !== undefined) &&
        target.memberships.length > 1
      ) {
        fail(409);
        return;
      }
      if (input.role !== undefined) target.roles = [input.role];
      if (input.is_active !== undefined) target.is_active = !!input.is_active;
      if (Object.prototype.hasOwnProperty.call(input, "branch_id")) {
        membership.branch_id = input.branch_id ?? null;
      }
      completedWrites++;
      json(200, {
        data: {
          id: target.id,
          name: target.name,
          email: target.email,
          is_active: target.is_active,
          roles: target.roles,
          company_id: companyId,
          branch_id: membership.branch_id,
        },
      });
      return;
    }
    fail(404);
    return;
  }

  // --- M7 Company Settings, Quotations & PDFs ---
  const settingsMatch = url.pathname.match(/^\/api\/v1\/companies\/(\d+)\/settings$/);
  if (settingsMatch) {
    const companyId = Number(settingsMatch[1]);
    const membership = user.companies.find((c) => c.id === companyId);
    if (!user.is_platform_admin && !membership) {
      fail(404);
      return;
    }
    const existing = companySettings.get(companyId);
    if (!existing) {
      fail(404);
      return;
    }
    if (req.method === "GET") {
      json(200, { data: existing });
      return;
    }
    if (req.method === "PATCH") {
      if (
        !user.is_platform_admin &&
        (!user.permissions.includes("settings.manage") ||
          membership?.branch_id !== null)
      ) {
        fail(403);
        return;
      }
      const vat = Number(input.vat_rate_pct);
      const threshold = Number(input.discount_approval_threshold_pct);
      if (Number.isNaN(vat) || vat < 0 || vat > 100) {
        fail(422, { vat_rate_pct: ["VAT rate must be between 0 and 100."] });
        return;
      }
      if (Number.isNaN(threshold) || threshold < 0 || threshold > 100) {
        fail(422, {
          discount_approval_threshold_pct: [
            "Discount approval threshold must be between 0 and 100.",
          ],
        });
        return;
      }
      const updated = {
        ...existing,
        vat_rate_pct: vat,
        discount_approval_threshold_pct: threshold,
      };
      companySettings.set(companyId, updated);
      completedWrites++;
      json(200, { data: updated });
      return;
    }
    fail(405);
    return;
  }

  const pdfMatch = url.pathname.match(
    /^\/api\/v1\/(quotations|reservations|rentals|invoices)\/(\d+)\/pdf$/,
  );
  if (pdfMatch && req.method === "GET") {
    const domain = pdfMatch[1];
    const targetId = Number(pdfMatch[2]);
    const pdfBytes = Buffer.from(
      `%PDF-1.4\n% DriveCore Synthetic ${domain} #${targetId}\n%%EOF`,
    );
    res.writeHead(200, {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${domain}-${targetId}.pdf"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(pdfBytes);
    return;
  }

  const quoteMatch = url.pathname.match(
    /^\/api\/v1\/quotations(?:\/(\d+)(?:\/(approve-discount|reject-discount|cancel|convert))?)?$/,
  );
  if (quoteMatch) {
    const quoteId = quoteMatch[1] ? Number(quoteMatch[1]) : null;
    const action = quoteMatch[2] ?? null;
    if (req.method === "GET" && !quoteId) {
      if (
        !user.is_platform_admin &&
        !user.permissions.includes("quotations.view")
      ) {
        fail(403);
        return;
      }
      const companyId = Number(url.searchParams.get("company_id"));
      const branchId = url.searchParams.get("branch_id")
        ? Number(url.searchParams.get("branch_id"))
        : null;
      const statusFilter = url.searchParams.get("status");
      const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
      const items = [...quotations.values()].filter((item) => {
        if (item.company_id !== companyId) return false;
        if (branchId !== null && item.branch_id !== branchId) return false;
        if (statusFilter && item.status !== statusFilter) return false;
        if (
          q &&
          ![
            String(item.id),
            item.customer_name ?? "",
            ...item.vehicles.map((v) => v.registration),
          ].some((s) => s.toLowerCase().includes(q))
        ) {
          return false;
        }
        return true;
      });
      paginateSlice(
        sortItems(items, {
          id: (item) => item.id,
          customer_name: (item) => item.customer_name,
          starts_at: (item) => item.starts_at,
          total_minor: (item) => item.total_minor,
          status: (item) => item.status,
          created_at: (item) => item.created_at,
        }),
      );
      return;
    }
    if (req.method === "GET" && quoteId && !action) {
      if (
        !user.is_platform_admin &&
        !user.permissions.includes("quotations.view")
      ) {
        fail(403);
        return;
      }
      const rec = quotations.get(quoteId);
      if (!rec) fail(404);
      else json(200, { data: rec });
      return;
    }
    if (req.method === "POST" && !quoteId) {
      if (
        !user.is_platform_admin &&
        !user.permissions.includes("quotations.manage")
      ) {
        fail(403);
        return;
      }
      const companyId = Number(input.company_id);
      const branchId = Number(input.branch_id);
      const customerId = Number(input.customer_id);
      const vehicleIds = Array.isArray(input.vehicle_ids)
        ? [...new Set(input.vehicle_ids.map(Number))]
        : [];
      if (vehicleIds.length === 0) {
        fail(422, { vehicle_ids: ["Select at least one vehicle."] });
        return;
      }
      const startMs = Date.parse(input.starts_at);
      const endMs = Date.parse(input.ends_at);
      if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
        fail(422, { ends_at: ["Expected return must be after departure."] });
        return;
      }
      const rentalDays = Math.max(1, Math.ceil((endMs - startMs) / 86_400_000));
      const picked = [];
      for (const vId of vehicleIds) {
        const v = vehicles.get(vId);
        if (!v || v.company_id !== companyId || v.branch_id !== branchId || v.status !== "available") {
          fail(422, { vehicle_ids: ["One or more selected vehicles are unavailable."] });
          return;
        }
        if (v.daily_rate_minor <= 0) {
          fail(422, { vehicle_ids: ["All quoted vehicles must have a daily rate greater than zero."] });
          return;
        }
        picked.push(v);
      }
      const settings = companySettings.get(companyId) ?? {
        vat_rate_pct: 15,
        discount_approval_threshold_pct: 10,
      };
      const discountPct = Number(input.discount_pct ?? 0);
      if (Number.isNaN(discountPct) || discountPct < 0 || discountPct > 100) {
        fail(422, { discount_pct: ["Discount must be between 0 and 100."] });
        return;
      }
      const quoteVehicles = picked.map((v) => ({
        vehicle_id: v.id,
        registration: v.registration,
        make: v.make,
        model: v.model,
        daily_rate_minor: v.daily_rate_minor,
        line_subtotal_minor: v.daily_rate_minor * rentalDays,
        reservation_id: null,
      }));
      const subtotalMinor = quoteVehicles.reduce(
        (sum, v) => sum + v.line_subtotal_minor,
        0,
      );
      const discountMinor = Math.round(subtotalMinor * (discountPct / 100));
      const taxableMinor = Math.max(0, subtotalMinor - discountMinor);
      const vatMinor = Math.round(taxableMinor * (settings.vat_rate_pct / 100));
      const totalMinor = taxableMinor + vatMinor;
      const needsApproval =
        discountPct > settings.discount_approval_threshold_pct;
      const customer = customers.get(customerId);
      const id = nextId++;
      const created = {
        id,
        company_id: companyId,
        branch_id: branchId,
        customer_id: customerId,
        created_by: user.id,
        customer_name: customer?.name ?? null,
        starts_at: new Date(startMs).toISOString(),
        ends_at: new Date(endMs).toISOString(),
        rental_days: rentalDays,
        status: needsApproval ? "pending_approval" : "approved",
        discount_pct: discountPct,
        discount_status: needsApproval ? "pending" : "not_required",
        discount_decided_by: null,
        discount_decided_by_name: null,
        discount_decided_at: null,
        discount_decision_notes: null,
        subtotal_minor: subtotalMinor,
        discount_minor: discountMinor,
        vat_rate_pct: settings.vat_rate_pct,
        vat_minor: vatMinor,
        total_minor: totalMinor,
        notes: input.notes ? String(input.notes) : null,
        converted_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        vehicles: quoteVehicles,
        reservation_ids: [],
      };
      quotations.set(id, created);
      completedWrites++;
      json(201, { data: created });
      return;
    }
    if (req.method === "POST" && quoteId && (action === "approve-discount" || action === "reject-discount")) {
      if (
        !user.is_platform_admin &&
        !user.permissions.includes("quotations.approve_discount")
      ) {
        fail(403);
        return;
      }
      const rec = quotations.get(quoteId);
      if (!rec) {
        fail(404);
        return;
      }
      if (rec.status !== "pending_approval" || rec.discount_status !== "pending") {
        fail(409);
        return;
      }
      const approve = action === "approve-discount";
      rec.status = approve ? "approved" : "rejected";
      rec.discount_status = approve ? "approved" : "rejected";
      rec.discount_decided_by = user.id;
      rec.discount_decided_by_name = user.name;
      rec.discount_decided_at = new Date().toISOString();
      rec.discount_decision_notes = input.notes ? String(input.notes) : null;
      rec.updated_at = new Date().toISOString();
      completedWrites++;
      json(200, { data: rec });
      return;
    }
    if (req.method === "POST" && quoteId && action === "cancel") {
      if (
        !user.is_platform_admin &&
        !user.permissions.includes("quotations.manage")
      ) {
        fail(403);
        return;
      }
      const rec = quotations.get(quoteId);
      if (!rec) {
        fail(404);
        return;
      }
      if (rec.status !== "pending_approval" && rec.status !== "approved") {
        fail(409);
        return;
      }
      rec.status = "cancelled";
      rec.updated_at = new Date().toISOString();
      completedWrites++;
      json(200, { data: rec });
      return;
    }
    if (req.method === "POST" && quoteId && action === "convert") {
      if (
        !user.is_platform_admin &&
        (!user.permissions.includes("quotations.manage") ||
          !user.permissions.includes("reservations.manage"))
      ) {
        fail(403);
        return;
      }
      const rec = quotations.get(quoteId);
      if (!rec) {
        fail(404);
        return;
      }
      if (rec.status !== "approved") {
        fail(409);
        return;
      }
      const startMs = Date.parse(rec.starts_at);
      const endMs = Date.parse(rec.ends_at);
      // Verify ALL vehicles before creating ANY reservation (atomic rollback semantics)
      for (const qv of rec.vehicles) {
        const v = vehicles.get(qv.vehicle_id);
        const overlap = [...reservations.values()].some(
          (r) =>
            r.vehicle_id === qv.vehicle_id &&
            r.status === "confirmed" &&
            Date.parse(r.starts_at) < endMs &&
            Date.parse(r.ends_at) > startMs,
        );
        if (!v || v.status !== "available" || overlap) {
          fail(409);
          return;
        }
      }
      const createdIds = [];
      for (const qv of rec.vehicles) {
        const resId = nextId++;
        reservations.set(resId, {
          id: resId,
          company_id: rec.company_id,
          branch_id: rec.branch_id,
          customer_id: rec.customer_id,
          vehicle_id: qv.vehicle_id,
          created_by: user.id,
          starts_at: rec.starts_at,
          ends_at: rec.ends_at,
          status: "confirmed",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        qv.reservation_id = resId;
        createdIds.push(resId);
      }
      rec.status = "converted";
      rec.converted_at = new Date().toISOString();
      rec.reservation_ids = createdIds;
      rec.updated_at = new Date().toISOString();
      completedWrites++;
      json(200, { data: rec });
      return;
    }
    fail(404);
    return;
  }

  // --- M11 Detailed Stats, Customer 360 & Saved Filters ---
  function inDateRange(iso, from, to) {
    if (!from && !to) return true;
    if (!iso) return false;
    const day = iso.slice(0, 10);
    if (from && day < from) return false;
    if (to && day > to) return false;
    return true;
  }

  function computeCustomerStats(c, { from, to, canSeeFinance }) {
    const custRentals = [...rentals.values()].filter(
      (r) => r.customer_id === c.id && inDateRange(r.started_at || r.created_at, from, to),
    );
    const allCustRentals = [...rentals.values()].filter(
      (r) => r.customer_id === c.id,
    );
    const sortedRentals = [...allCustRentals].sort((a, b) =>
      String(b.started_at || b.created_at).localeCompare(
        String(a.started_at || a.created_at),
      ),
    );
    const last_rental_at = sortedRentals[0]
      ? sortedRentals[0].started_at || sortedRentals[0].created_at
      : null;

    if (!canSeeFinance) {
      return {
        rental_count: custRentals.length,
        last_rental_at,
        total_spent_minor: null,
        total_invoiced_minor: null,
        open_ar_minor: null,
        avg_rental_value_minor: null,
      };
    }

    const allIssued = [...invoices.values()]
      .map(decorateInvoice)
      .filter((i) => i.customer_id === c.id && i.status === "issued");
    // Open AR is ALWAYS live point-in-time regardless of from/to
    const open_ar_minor = allIssued.reduce(
      (sum, i) => sum + i.outstanding_minor,
      0,
    );
    const periodIssued = allIssued.filter((i) =>
      inDateRange(i.issued_at || i.created_at, from, to),
    );
    const total_invoiced_minor = periodIssued.reduce(
      (sum, i) => sum + i.total_minor,
      0,
    );
    const custInvoiceIds = new Set(allIssued.map((i) => i.id));
    const periodPaid = [...payments.values()]
      .filter(
        (p) =>
          custInvoiceIds.has(p.invoice_id) &&
          inDateRange(p.paid_at || p.created_at, from, to),
      )
      .reduce((sum, p) => sum + p.amount_minor, 0);
    const periodRefunded = [...refunds.values()]
      .filter(
        (rf) =>
          custInvoiceIds.has(rf.invoice_id) &&
          inDateRange(rf.refunded_at || rf.created_at, from, to),
      )
      .reduce((sum, rf) => sum + rf.amount_minor, 0);
    const total_spent_minor = Math.max(0, periodPaid - periodRefunded);
    const avg_rental_value_minor =
      custRentals.length > 0
        ? Math.round(total_invoiced_minor / custRentals.length)
        : 0;

    return {
      rental_count: custRentals.length,
      last_rental_at,
      total_spent_minor,
      total_invoiced_minor,
      open_ar_minor,
      avg_rental_value_minor,
    };
  }

  function computeVehicleStats(v, { from, to, canSeeFinance }) {
    const vehRentals = [...rentals.values()].filter(
      (r) =>
        r.vehicle_id === v.id &&
        inDateRange(r.started_at || r.created_at, from, to),
    );
    const utilization_pct =
      v.status === "rented"
        ? 100
        : Math.min(95, vehRentals.length * 25);
    const total_km_driven = vehRentals.reduce(
      (sum, r) =>
        sum +
        Math.max(
          0,
          (r.end_odometer ?? r.start_odometer ?? 0) - (r.start_odometer ?? 0),
        ),
      0,
    );
    const idle_days =
      v.status === "rented" ? 0 : vehRentals.length > 0 ? 5 : 21;

    if (!canSeeFinance) {
      return {
        rental_count: vehRentals.length,
        utilization_pct,
        total_km_driven,
        idle_days,
        revenue_minor: null,
        expense_minor: null,
        net_roi_minor: null,
      };
    }

    const rentalIds = new Set(vehRentals.map((r) => r.id));
    const revenue_minor = [...invoices.values()]
      .map(decorateInvoice)
      .filter(
        (i) =>
          i.status === "issued" &&
          i.rental_id &&
          rentalIds.has(i.rental_id) &&
          inDateRange(i.issued_at || i.created_at, from, to),
      )
      .reduce((sum, i) => sum + Math.max(0, i.total_minor - i.refunded_minor), 0);
    const expense_minor = [...expenses.values()]
      .filter(
        (e) =>
          e.vehicle_id === v.id &&
          inDateRange(e.incurred_at || e.created_at, from, to),
      )
      .reduce((sum, e) => sum + e.amount_minor, 0);

    return {
      rental_count: vehRentals.length,
      utilization_pct,
      total_km_driven,
      idle_days,
      revenue_minor,
      expense_minor,
      net_roi_minor: revenue_minor - expense_minor,
    };
  }

  const custSummaryMatch = url.pathname.match(
    /^\/api\/v1\/customers\/(\d+)\/summary$/,
  );
  if (custSummaryMatch && req.method === "GET") {
    if (!user.is_platform_admin && !user.permissions.includes("customers.view")) {
      fail(403);
      return;
    }
    const custId = Number(custSummaryMatch[1]);
    const c = customers.get(custId);
    if (!c) {
      fail(404);
      return;
    }
    const canSeeFinance =
      user.is_platform_admin || user.permissions.includes("invoices.view");
    const stats = computeCustomerStats(c, {
      from: "",
      to: "",
      canSeeFinance,
    });
    const recent_rentals = [...rentals.values()]
      .filter((r) => r.customer_id === custId)
      .sort((a, b) => b.id - a.id)
      .slice(0, 5)
      .map((r) => ({
        id: r.id,
        vehicle_registration: vehicles.get(r.vehicle_id)?.registration ?? null,
        status: r.status,
        started_at: r.started_at ?? r.created_at ?? null,
        returned_at: r.returned_at ?? null,
      }));
    const recent_invoices = canSeeFinance
      ? [...invoices.values()]
          .map(decorateInvoice)
          .filter((i) => i.customer_id === custId)
          .sort((a, b) => b.id - a.id)
          .slice(0, 5)
          .map((i) => ({
            id: i.id,
            invoice_number: i.invoice_number ?? `INV-${i.id}`,
            status: i.status,
            total_minor: i.total_minor,
            outstanding_minor: i.outstanding_minor,
            due_at: i.due_at ?? null,
          }))
      : [];
    json(200, {
      data: {
        customer_id: custId,
        ...stats,
        recent_rentals,
        recent_invoices,
      },
    });
    return;
  }

  if (url.pathname === "/api/v1/stats/branches" && req.method === "GET") {
    if (!user.is_platform_admin && !user.permissions.includes("reports.view")) {
      fail(403);
      return;
    }
    const companyId = Number(url.searchParams.get("company_id"));
    const reqBranch = url.searchParams.get("branch_id")
      ? Number(url.searchParams.get("branch_id"))
      : null;
    const from = url.searchParams.get("from") ?? "";
    const to = url.searchParams.get("to") ?? "";
    const membership = user.companies.find((c) => c.id === companyId);
    const effectiveBranch =
      !user.is_platform_admin && membership?.branch_id !== null
        ? membership.branch_id
        : reqBranch;
    const canSeeFinance =
      user.is_platform_admin || user.permissions.includes("invoices.view");

    const scopedBranches = [...branches.values()].filter(
      (b) =>
        b.company_id === companyId &&
        (effectiveBranch === null || b.id === effectiveBranch),
    );
    const rows = scopedBranches.map((b) => {
      const bVehs = [...vehicles.values()].filter(
        (v) => v.company_id === companyId && v.branch_id === b.id,
      );
      const rented = bVehs.filter((v) => v.status === "rented").length;
      const bRentals = [...rentals.values()].filter(
        (r) =>
          r.company_id === companyId &&
          r.branch_id === b.id &&
          inDateRange(r.started_at || r.created_at, from, to),
      );
      const bWos = [...workOrders.values()].filter(
        (w) => w.company_id === companyId && w.branch_id === b.id,
      );
      const bInvoices = [...invoices.values()]
        .map(decorateInvoice)
        .filter(
          (i) =>
            i.company_id === companyId &&
            i.branch_id === b.id &&
            i.status === "issued",
        );
      const periodInvoices = bInvoices.filter((i) =>
        inDateRange(i.issued_at || i.created_at, from, to),
      );
      const bExpenses = [...expenses.values()].filter(
        (e) =>
          e.company_id === companyId &&
          e.branch_id === b.id &&
          inDateRange(e.incurred_at || e.created_at, from, to),
      );
      const rev = periodInvoices.reduce(
        (s, i) => s + Math.max(0, i.total_minor - i.refunded_minor),
        0,
      );
      const exp = bExpenses.reduce((s, e) => s + e.amount_minor, 0);
      const openAr = bInvoices.reduce((s, i) => s + i.outstanding_minor, 0);
      return {
        branch_id: b.id,
        branch_name: b.name,
        fleet_total: bVehs.length,
        utilization_pct:
          bVehs.length > 0 ? Math.round((rented / bVehs.length) * 100) : 0,
        rental_count: bRentals.length,
        work_order_count: bWos.length,
        downtime_hours: bWos.length * 4,
        revenue_minor: canSeeFinance ? rev : null,
        expenses_minor: canSeeFinance ? exp : null,
        net_position_minor: canSeeFinance ? rev - exp : null,
        open_ar_minor: canSeeFinance ? openAr : null,
      };
    });
    json(200, { data: rows });
    return;
  }

  const sfMatch = url.pathname.match(/^\/api\/v1\/saved-filters(?:\/(\d+))?$/);
  if (sfMatch) {
    const sfId = sfMatch[1] ? Number(sfMatch[1]) : null;
    const canSeeFinance =
      user.is_platform_admin || user.permissions.includes("invoices.view");
    const isAdmin =
      user.is_platform_admin ||
      user.roles.includes("company-admin") ||
      user.permissions.includes("users.manage");

    if (req.method === "GET" && !sfId) {
      const companyId = Number(url.searchParams.get("company_id"));
      const mod = url.searchParams.get("module");
      const items = [...savedFilters.values()].filter((f) => {
        if (f.company_id !== companyId) return false;
        if (mod && f.module !== mod) return false;
        if (f.is_shared) {
          if (f.requires_finance && !canSeeFinance) return false;
          return true;
        }
        return f.user_id === user.id;
      });
      json(200, { data: items });
      return;
    }

    if (req.method === "POST" && !sfId) {
      const companyId = Number(input.company_id);
      const mod = String(input.module ?? "");
      const name = String(input.name ?? "").trim();
      const filtersObj =
        input.filters && typeof input.filters === "object" ? input.filters : {};
      const wantShared = Boolean(input.is_shared);
      if (!name || name.length > 80) {
        fail(422, { name: ["Provide a view name up to 80 characters."] });
        return;
      }
      if (wantShared && !isAdmin) {
        fail(403);
        return;
      }
      const existingCount = [...savedFilters.values()].filter(
        (f) => f.company_id === companyId && f.module === mod,
      ).length;
      if (existingCount >= 50) {
        fail(422, { name: ["Maximum of 50 saved views reached for this module."] });
        return;
      }
      const monetaryKeys = new Set([
        "min_spend_minor",
        "max_spend_minor",
        "has_open_ar",
      ]);
      const monetarySorts = new Set([
        "total_spent_minor",
        "open_ar_minor",
        "revenue_minor",
        "net_roi_minor",
      ]);
      const requiresFinance =
        Object.keys(filtersObj).some((k) => monetaryKeys.has(k)) ||
        monetarySorts.has(String(filtersObj.sort ?? ""));
      if (requiresFinance && !canSeeFinance) {
        fail(403);
        return;
      }
      const id = nextId++;
      const rec = {
        id,
        company_id: companyId,
        user_id: user.id,
        module: mod,
        name,
        filters: filtersObj,
        is_shared: wantShared,
        requires_finance: requiresFinance,
        created_at: new Date().toISOString(),
      };
      savedFilters.set(id, rec);
      completedWrites++;
      json(201, { data: rec });
      return;
    }

    if (req.method === "DELETE" && sfId) {
      const rec = savedFilters.get(sfId);
      if (!rec) {
        fail(404);
        return;
      }
      const allowed =
        (!rec.is_shared && rec.user_id === user.id) ||
        (rec.is_shared && isAdmin);
      if (!allowed) {
        fail(403);
        return;
      }
      savedFilters.delete(sfId);
      completedWrites++;
      res.writeHead(204);
      res.end();
      return;
    }
  }

  // --- M10 Dashboard Summary, Messages, Notifications, Reports & Audit ---
  const isDriverOnly =
    !user.is_platform_admin &&
    user.roles.includes("driver") &&
    !user.permissions.includes("rentals.view");

  if (url.pathname === "/api/v1/dashboard/summary" && req.method === "GET") {
    const companyId = Number(url.searchParams.get("company_id"));
    const branchId = url.searchParams.get("branch_id")
      ? Number(url.searchParams.get("branch_id"))
      : null;
    const vehs = [...vehicles.values()].filter(
      (v) =>
        v.company_id === companyId &&
        (branchId === null || v.branch_id === branchId),
    );
    const total = vehs.length;
    const available = vehs.filter((v) => v.status === "available").length;
    const rented = vehs.filter((v) => v.status === "rented").length;
    const maintenance = vehs.filter((v) => v.status === "maintenance").length;
    const damaged = vehs.filter((v) => v.status === "damaged").length;
    const utilization_pct = total > 0 ? Math.round((rented / total) * 100) : 0;

    const scopedQuotes = [...quotations.values()].filter(
      (q) =>
        q.company_id === companyId &&
        (branchId === null || q.branch_id === branchId),
    );
    const scopedRes = [...reservations.values()].filter(
      (r) =>
        r.company_id === companyId &&
        (branchId === null || r.branch_id === branchId),
    );
    const scopedRentals = [...rentals.values()].filter(
      (r) =>
        r.company_id === companyId &&
        (branchId === null || r.branch_id === branchId),
    );
    const scopedInvoices = [...invoices.values()]
      .map(decorateInvoice)
      .filter(
        (i) =>
          i.company_id === companyId &&
          (branchId === null || i.branch_id === branchId),
      );
    const scopedExpenses = [...expenses.values()].filter(
      (e) =>
        e.company_id === companyId &&
        (branchId === null || e.branch_id === branchId),
    );
    const scopedPos = [...purchaseOrders.values()].filter(
      (po) =>
        po.company_id === companyId &&
        (branchId === null || po.branch_id === branchId),
    );
    const scopedParts = [...parts.values()]
      .map(decoratePart)
      .filter(
        (p) =>
          p.company_id === companyId &&
          (branchId === null || p.branch_id === branchId),
      );

    const canSeeFinance =
      user.is_platform_admin || user.permissions.includes("invoices.view");
    const issued = scopedInvoices.filter((i) => i.status === "issued");
    const finance = canSeeFinance
      ? (() => {
          const revenue_minor = issued.reduce(
            (s, i) => s + Math.max(0, i.total_minor - i.refunded_minor),
            0,
          );
          const vat_minor = issued.reduce((s, i) => s + i.vat_minor, 0);
          const receipts_minor = issued.reduce((s, i) => s + i.net_paid_minor, 0);
          const expenses_minor = scopedExpenses.reduce(
            (s, e) => s + e.amount_minor,
            0,
          );
          const outstanding_ar_minor = issued.reduce(
            (s, i) => s + i.outstanding_minor,
            0,
          );
          return {
            revenue_minor,
            vat_minor,
            receipts_minor,
            expenses_minor,
            outstanding_ar_minor,
            net_position_minor: revenue_minor - expenses_minor,
          };
        })()
      : null;

    const driver_summary = isDriverOnly
      ? {
          active_rentals: scopedRentals.filter(
            (r) => r.driver_user_id === user.id && r.status === "active",
          ).length,
          upcoming_rentals: scopedRentals.filter(
            (r) => r.driver_user_id === user.id && r.status === "draft",
          ).length,
        }
      : null;

    json(200, {
      data: {
        fleet: { total, available, rented, maintenance, damaged, utilization_pct },
        pipeline: {
          quotations: scopedQuotes.length,
          reservations: scopedRes.length,
          active_rentals: scopedRentals.filter((r) => r.status === "active").length,
          issued_invoices: issued.length,
        },
        approvals: {
          pending_discount_quotes: scopedQuotes.filter(
            (q) => q.status === "pending_approval",
          ).length,
          pending_purchase_orders: scopedPos.filter(
            (po) => po.status === "submitted",
          ).length,
          low_stock_parts: scopedParts.filter((p) => p.is_low_stock).length,
          overdue_invoices: issued.filter((i) => i.is_overdue).length,
        },
        finance,
        driver_summary,
      },
    });
    return;
  }

  const msgMatch = url.pathname.match(/^\/api\/v1\/messages(?:\/(\d+)\/read)?$/);
  if (msgMatch) {
    const readId = msgMatch[1] ? Number(msgMatch[1]) : null;
    if (req.method === "GET" && !readId) {
      if (
        !user.is_platform_admin &&
        !user.permissions.includes("messages.view") &&
        !isDriverOnly
      ) {
        fail(403);
        return;
      }
      const companyId = Number(url.searchParams.get("company_id"));
      const branchId = url.searchParams.get("branch_id")
        ? Number(url.searchParams.get("branch_id"))
        : null;
      const channel = url.searchParams.get("channel");
      if (
        isDriverOnly &&
        channel &&
        !["drivers", "dispatch"].includes(channel)
      ) {
        fail(403);
        return;
      }
      const scoped = [...messages.values()]
        .filter((m) => {
          if (m.company_id !== companyId) return false;
          if (branchId !== null && m.branch_id !== null && m.branch_id !== branchId)
            return false;
          if (isDriverOnly && !["drivers", "dispatch"].includes(m.channel))
            return false;
          if (channel && m.channel !== channel) return false;
          return true;
        })
        .sort((a, b) => b.id - a.id)
        .map((m) => ({
          id: m.id,
          company_id: m.company_id,
          branch_id: m.branch_id,
          sender_user_id: m.sender_user_id,
          sender_name: m.sender_name,
          channel: m.channel,
          body: m.body,
          related_entity_type: m.related_entity_type,
          related_entity_id: m.related_entity_id,
          is_read: m.read_by.includes(user.id),
          created_at: m.created_at,
        }));
      const unread_count = scoped.filter((m) => !m.is_read).length;
      json(200, {
        data: scoped.slice(0, 25),
        meta: {
          current_page: 1,
          last_page: 1,
          per_page: 25,
          total: scoped.length,
          unread_count,
        },
      });
      return;
    }
    if (req.method === "POST" && !readId) {
      if (
        !user.is_platform_admin &&
        !user.permissions.includes("messages.send") &&
        !isDriverOnly
      ) {
        fail(403);
        return;
      }
      const channel = String(input.channel ?? "dispatch");
      if (isDriverOnly && !["drivers", "dispatch"].includes(channel)) {
        fail(403);
        return;
      }
      const bodyStr = String(input.body ?? "").trim();
      if (!bodyStr || bodyStr.length > 1000) {
        fail(422, { body: ["Enter a message between 1 and 1000 characters."] });
        return;
      }
      const id = nextId++;
      const created = {
        id,
        company_id: Number(input.company_id),
        branch_id: input.branch_id ? Number(input.branch_id) : null,
        sender_user_id: user.id,
        sender_name: user.name,
        channel,
        body: bodyStr,
        related_entity_type: input.related_entity_type ?? null,
        related_entity_id: input.related_entity_id
          ? Number(input.related_entity_id)
          : null,
        read_by: [user.id],
        created_at: new Date().toISOString(),
      };
      messages.set(id, created);
      completedWrites++;
      json(201, { data: { ...created, is_read: true } });
      return;
    }
    if (req.method === "POST" && readId) {
      const m = messages.get(readId);
      if (!m) {
        fail(404);
        return;
      }
      if (!m.read_by.includes(user.id)) m.read_by.push(user.id);
      json(200, { data: { ok: true } });
      return;
    }
  }

  const notifMatch = url.pathname.match(
    /^\/api\/v1\/notifications(?:\/(read-all|(\d+)\/read))?$/,
  );
  if (notifMatch) {
    if (req.method === "GET" && !notifMatch[1]) {
      const companyId = Number(url.searchParams.get("company_id"));
      const branchId = url.searchParams.get("branch_id")
        ? Number(url.searchParams.get("branch_id"))
        : null;
      const scoped = [...notifications.values()]
        .filter((n) => {
          if (n.company_id !== companyId) return false;
          if (branchId !== null && n.branch_id !== null && n.branch_id !== branchId)
            return false;
          if (
            n.required_permission &&
            !user.is_platform_admin &&
            !user.permissions.includes(n.required_permission)
          )
            return false;
          return true;
        })
        .sort((a, b) => b.id - a.id)
        .map((n) => ({
          id: n.id,
          company_id: n.company_id,
          branch_id: n.branch_id,
          severity: n.severity,
          title: n.title,
          body: n.body,
          href: n.href,
          read_at: n.read_by.includes(user.id) ? n.created_at : null,
          created_at: n.created_at,
        }));
      const unread_count = scoped.filter((n) => !n.read_at).length;
      json(200, {
        data: scoped.slice(0, 25),
        meta: {
          current_page: 1,
          last_page: 1,
          per_page: 25,
          total: scoped.length,
          unread_count,
        },
      });
      return;
    }
    if (req.method === "POST" && notifMatch[1] === "read-all") {
      const companyId = Number(input.company_id);
      for (const n of notifications.values()) {
        if (n.company_id === companyId && !n.read_by.includes(user.id)) {
          n.read_by.push(user.id);
        }
      }
      json(200, { data: { ok: true } });
      return;
    }
    if (req.method === "POST" && notifMatch[2]) {
      const n = notifications.get(Number(notifMatch[2]));
      if (!n) {
        fail(404);
        return;
      }
      if (!n.read_by.includes(user.id)) n.read_by.push(user.id);
      json(200, { data: { ok: true } });
      return;
    }
  }

  if (url.pathname === "/api/v1/reports/financial" && req.method === "GET") {
    if (!user.is_platform_admin && !user.permissions.includes("invoices.view")) {
      fail(403);
      return;
    }
    const companyId = Number(url.searchParams.get("company_id"));
    const branchId = url.searchParams.get("branch_id")
      ? Number(url.searchParams.get("branch_id"))
      : null;
    const invs = [...invoices.values()]
      .map(decorateInvoice)
      .filter(
        (i) =>
          i.company_id === companyId &&
          (branchId === null || i.branch_id === branchId) &&
          i.status === "issued",
      );
    const exps = [...expenses.values()].filter(
      (e) =>
        e.company_id === companyId &&
        (branchId === null || e.branch_id === branchId),
    );
    const invoiced_minor = invs.reduce((s, i) => s + i.total_minor, 0);
    const vat_minor = invs.reduce((s, i) => s + i.vat_minor, 0);
    const receipts_minor = invs.reduce((s, i) => s + i.paid_minor, 0);
    const refunds_minor = invs.reduce((s, i) => s + i.refunded_minor, 0);
    const expenses_minor = exps.reduce((s, e) => s + e.amount_minor, 0);
    const outstanding_ar_minor = invs.reduce((s, i) => s + i.outstanding_minor, 0);
    const rows = [
      ...invs.map((i) => ({
        id: `inv-${i.id}`,
        date: i.issued_at ?? i.created_at,
        type: "invoice",
        reference: i.invoice_number,
        counterparty: i.customer_name ?? i.custom_customer_name ?? "Customer",
        amount_minor: i.total_minor,
        vat_minor: i.vat_minor,
        status: i.outstanding_minor === 0 ? "paid" : "issued",
      })),
      ...exps.map((e) => ({
        id: `exp-${e.id}`,
        date: e.incurred_at,
        type: "expense",
        reference: `EXP-${e.id}`,
        counterparty: e.description,
        amount_minor: -e.amount_minor,
        vat_minor: 0,
        status: e.category,
      })),
    ];
    json(200, {
      data: {
        summary: {
          invoiced_minor,
          vat_minor,
          receipts_minor,
          refunds_minor,
          expenses_minor,
          outstanding_ar_minor,
          net_position_minor: invoiced_minor - refunds_minor - expenses_minor,
        },
        rows,
      },
    });
    return;
  }

  if (url.pathname === "/api/v1/reports/fleet" && req.method === "GET") {
    if (!user.is_platform_admin && !user.permissions.includes("vehicles.view")) {
      fail(403);
      return;
    }
    const companyId = Number(url.searchParams.get("company_id"));
    const branchId = url.searchParams.get("branch_id")
      ? Number(url.searchParams.get("branch_id"))
      : null;
    const canSeeFinance =
      user.is_platform_admin || user.permissions.includes("invoices.view");
    const rows = [...vehicles.values()]
      .filter(
        (v) =>
          v.company_id === companyId &&
          (branchId === null || v.branch_id === branchId),
      )
      .map((v) => {
        const vehRentals = [...rentals.values()].filter(
          (r) => r.vehicle_id === v.id,
        );
        const vehWos = [...workOrders.values()].filter(
          (w) => w.vehicle_id === v.id,
        );
        const maintCost = vehWos
          .filter((w) => w.status === "completed")
          .reduce((s, w) => s + w.labour_cost_minor + w.parts_cost_minor, 0);
        const rentalIds = new Set(vehRentals.map((r) => r.id));
        const rev = [...invoices.values()]
          .filter((i) => i.status === "issued" && i.rental_id && rentalIds.has(i.rental_id))
          .reduce((s, i) => s + i.total_minor, 0);
        return {
          vehicle_id: v.id,
          registration: v.registration,
          make_model: `${v.make} ${v.model}`,
          status: v.status,
          rental_count: vehRentals.length,
          work_order_count: vehWos.length,
          downtime_hours: vehWos.filter((w) => w.started_at).length * 2,
          revenue_minor: canSeeFinance ? rev : null,
          maintenance_cost_minor: canSeeFinance ? maintCost : null,
          net_roi_minor: canSeeFinance ? rev - maintCost : null,
        };
      });
    json(200, { data: rows });
    return;
  }

  if (url.pathname === "/api/v1/audit-events" && req.method === "GET") {
    if (!user.is_platform_admin && !user.permissions.includes("audit.view")) {
      fail(403);
      return;
    }
    const companyId = Number(url.searchParams.get("company_id"));
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const items = [...auditEvents.values()]
      .filter((a) => {
        if (a.company_id !== companyId) return false;
        if (
          q &&
          ![a.actor_name ?? "", a.action, a.summary].some((s) =>
            s.toLowerCase().includes(q),
          )
        )
          return false;
        return true;
      })
      .sort((a, b) => b.id - a.id);
    paginateSlice(items);
    return;
  }

  // --- M9 Maintenance, Inventory, Procurement & Vehicle 360 ---
  function partOnHand(partId) {
    return [...stockMovements.values()]
      .filter((m) => m.part_id === partId)
      .reduce((sum, m) => sum + m.quantity, 0);
  }

  function decoratePart(part) {
    const on_hand = partOnHand(part.id);
    return { ...part, on_hand, is_low_stock: on_hand <= part.min_stock };
  }

  function decorateMovement(m) {
    const p = parts.get(m.part_id);
    return { ...m, part_sku: p?.sku ?? null, part_name: p?.name ?? null };
  }

  function decorateWorkOrder(wo) {
    const v = vehicles.get(wo.vehicle_id);
    const movements = [...stockMovements.values()]
      .filter((m) => m.work_order_id === wo.id)
      .map(decorateMovement);
    return {
      ...wo,
      vehicle_registration: v?.registration ?? null,
      vehicle_label: v ? `${v.make} ${v.model}` : null,
      total_cost_minor: wo.labour_cost_minor + wo.parts_cost_minor,
      movements,
    };
  }

  function decoratePo(po) {
    const sup = suppliers.get(po.supplier_id);
    return {
      ...po,
      supplier_name: sup?.name ?? null,
      lines: po.lines.map((l) => {
        const p = parts.get(l.part_id);
        return { ...l, part_sku: p?.sku ?? null, part_name: p?.name ?? null };
      }),
    };
  }

  const summaryMatch = url.pathname.match(/^\/api\/v1\/vehicles\/(\d+)\/summary$/);
  if (summaryMatch && req.method === "GET") {
    if (!user.is_platform_admin && !user.permissions.includes("vehicles.view")) {
      fail(403);
      return;
    }
    const vehicleId = Number(summaryMatch[1]);
    const v = vehicles.get(vehicleId);
    if (!v) {
      fail(404);
      return;
    }
    const vehWos = [...workOrders.values()]
      .filter((w) => w.vehicle_id === vehicleId)
      .sort((a, b) => b.id - a.id);
    const nowMs = Date.now();
    const totalDowntimeHours = vehWos.reduce((hrs, w) => {
      if (!w.started_at) return hrs;
      const endMs = w.completed_at ? Date.parse(w.completed_at) : nowMs;
      return hrs + Math.max(0, (endMs - Date.parse(w.started_at)) / 3_600_000);
    }, 0);
    const canSeeFinance =
      user.is_platform_admin || user.permissions.includes("invoices.view");
    let cumulativeRevenue = null;
    let maintCost = null;
    let otherExpenses = null;
    let netRoi = null;
    if (canSeeFinance) {
      const vehRentalIds = new Set(
        [...rentals.values()]
          .filter((r) => r.vehicle_id === vehicleId)
          .map((r) => r.id),
      );
      cumulativeRevenue = [...invoices.values()]
        .filter((i) => i.status === "issued" && i.rental_id && vehRentalIds.has(i.rental_id))
        .reduce((sum, i) => {
          const dec = decorateInvoice(i);
          return sum + Math.max(0, dec.total_minor - dec.refunded_minor);
        }, 0);
      maintCost = vehWos
        .filter((w) => w.status === "completed")
        .reduce((sum, w) => sum + w.labour_cost_minor + w.parts_cost_minor, 0);
      const woExpenseIds = new Set(
        vehWos.map((w) => w.expense_id).filter(Boolean),
      );
      otherExpenses = [...expenses.values()]
        .filter((e) => e.vehicle_id === vehicleId && !woExpenseIds.has(e.id))
        .reduce((sum, e) => sum + e.amount_minor, 0);
      netRoi = cumulativeRevenue - maintCost - otherExpenses;
    }
    json(200, {
      data: {
        vehicle_id: vehicleId,
        work_order_count: vehWos.length,
        open_work_order_count: vehWos.filter(
          (w) => w.status === "open" || w.status === "in_progress",
        ).length,
        total_downtime_hours: Number(totalDowntimeHours.toFixed(1)),
        cumulative_revenue_minor: cumulativeRevenue,
        maintenance_cost_minor: maintCost,
        other_expenses_minor: otherExpenses,
        net_roi_minor: netRoi,
        recent_work_orders: vehWos.slice(0, 5).map(decorateWorkOrder),
      },
    });
    return;
  }

  const woMatch = url.pathname.match(
    /^\/api\/v1\/work-orders(?:\/(\d+)(?:\/(start|consume-parts|complete|cancel))?)?$/,
  );
  if (woMatch) {
    const woId = woMatch[1] ? Number(woMatch[1]) : null;
    const action = woMatch[2] ?? null;
    if (req.method === "GET" && !woId) {
      if (!user.is_platform_admin && !user.permissions.includes("work_orders.view")) {
        fail(403);
        return;
      }
      const companyId = Number(url.searchParams.get("company_id"));
      const branchId = url.searchParams.get("branch_id")
        ? Number(url.searchParams.get("branch_id"))
        : null;
      const statusFilter = url.searchParams.get("status");
      const vehicleFilter = url.searchParams.get("vehicle_id")
        ? Number(url.searchParams.get("vehicle_id"))
        : null;
      const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
      const items = [...workOrders.values()]
        .map(decorateWorkOrder)
        .filter((w) => {
          if (w.company_id !== companyId) return false;
          if (branchId !== null && w.branch_id !== branchId) return false;
          if (statusFilter && w.status !== statusFilter) return false;
          if (vehicleFilter !== null && w.vehicle_id !== vehicleFilter) return false;
          if (
            q &&
            ![w.title, w.vehicle_registration ?? "", w.notes ?? ""].some((s) =>
              s.toLowerCase().includes(q),
            )
          )
            return false;
          return true;
        });
      paginateSlice(
        sortItems(items, {
          id: (w) => w.id,
          vehicle_registration: (w) => w.vehicle_registration,
          title: (w) => w.title,
          due_at: (w) => w.due_at,
          total_cost_minor: (w) => w.total_cost_minor,
          status: (w) => w.status,
        }),
      );
      return;
    }
    if (req.method === "GET" && woId && !action) {
      if (!user.is_platform_admin && !user.permissions.includes("work_orders.view")) {
        fail(403);
        return;
      }
      const wo = workOrders.get(woId);
      if (!wo) fail(404);
      else json(200, { data: decorateWorkOrder(wo) });
      return;
    }
    if (req.method === "POST" && !woId) {
      if (!user.is_platform_admin && !user.permissions.includes("work_orders.manage")) {
        fail(403);
        return;
      }
      const id = nextId++;
      const created = {
        id,
        company_id: Number(input.company_id),
        branch_id: Number(input.branch_id),
        vehicle_id: Number(input.vehicle_id),
        created_by: user.id,
        title: String(input.title ?? "").trim(),
        status: "open",
        due_at: input.due_at || new Date(Date.now() + 86_400_000).toISOString(),
        started_at: null,
        completed_at: null,
        labour_cost_minor: Number(input.labour_cost_minor ?? 0),
        parts_cost_minor: 0,
        notes: input.notes ? String(input.notes) : null,
        completion_notes: null,
        expense_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      workOrders.set(id, created);
      completedWrites++;
      json(201, { data: decorateWorkOrder(created) });
      return;
    }
    if (req.method === "POST" && woId && action) {
      if (!user.is_platform_admin && !user.permissions.includes("work_orders.manage")) {
        fail(403);
        return;
      }
      const wo = workOrders.get(woId);
      if (!wo) {
        fail(404);
        return;
      }
      const v = vehicles.get(wo.vehicle_id);
      if (action === "start") {
        const hasFutureRes = [...reservations.values()].some(
          (r) =>
            r.vehicle_id === wo.vehicle_id &&
            r.status === "confirmed" &&
            Date.parse(r.ends_at) > Date.now(),
        );
        const hasActiveWo = [...workOrders.values()].some(
          (other) =>
            other.id !== wo.id &&
            other.vehicle_id === wo.vehicle_id &&
            other.status === "in_progress",
        );
        if (
          wo.status !== "open" ||
          !v ||
          v.status === "rented" ||
          hasFutureRes ||
          hasActiveWo
        ) {
          fail(409);
          return;
        }
        wo.status = "in_progress";
        wo.started_at = new Date().toISOString();
        wo.updated_at = wo.started_at;
        v.status = "maintenance";
        completedWrites++;
        json(200, { data: decorateWorkOrder(wo) });
        return;
      }
      if (action === "consume-parts") {
        if (wo.status !== "in_progress") {
          fail(409);
          return;
        }
        const part = parts.get(Number(input.part_id));
        const qty = Number(input.quantity);
        if (!part || !Number.isInteger(qty) || qty < 1) {
          fail(422, { quantity: ["Select a valid part and positive quantity."] });
          return;
        }
        if (partOnHand(part.id) < qty) {
          fail(422, { quantity: ["Insufficient stock on hand for this part."] });
          return;
        }
        const mId = nextId++;
        stockMovements.set(mId, {
          id: mId,
          company_id: wo.company_id,
          branch_id: wo.branch_id,
          part_id: part.id,
          recorded_by: user.id,
          quantity: -qty,
          unit_cost_minor: part.unit_cost_minor,
          reason: "Maintenance consumption",
          work_order_id: wo.id,
          purchase_order_id: null,
          created_at: new Date().toISOString(),
        });
        const lineCost = qty * part.unit_cost_minor;
        wo.parts_cost_minor += lineCost;
        wo.updated_at = new Date().toISOString();
        if (lineCost > 0) {
          postJournalEntry({
            companyId: wo.company_id,
            branchId: wo.branch_id,
            createdBy: user.id,
            sourceType: "work_order",
            sourceId: wo.id,
            reference: `WO-${wo.id}`,
            memo: `Parts consumed on WO #${wo.id}`,
            lines: [
              { account_code: "1250", debit_minor: lineCost, credit_minor: 0 },
              { account_code: "1200", debit_minor: 0, credit_minor: lineCost },
            ],
          });
        }
        completedWrites++;
        json(200, { data: decorateWorkOrder(wo) });
        return;
      }
      if (action === "complete") {
        if (wo.status !== "in_progress") {
          fail(409);
          return;
        }
        if (input.labour_cost_minor !== undefined) {
          wo.labour_cost_minor = Math.max(0, Number(input.labour_cost_minor));
        }
        if (input.completion_notes) {
          wo.completion_notes = String(input.completion_notes);
        }
        wo.status = "completed";
        wo.completed_at = new Date().toISOString();
        wo.updated_at = wo.completed_at;
        if (v) v.status = "available";
        const total = wo.labour_cost_minor + wo.parts_cost_minor;
        if (total > 0) {
          const expId = nextId++;
          expenses.set(expId, {
            id: expId,
            company_id: wo.company_id,
            branch_id: wo.branch_id,
            vehicle_id: wo.vehicle_id,
            vehicle_registration: v?.registration ?? null,
            recorded_by: user.id,
            category: "maintenance",
            description: `Work order #${wo.id}: ${wo.title}`,
            amount_minor: total,
            incurred_at: wo.completed_at,
            created_at: wo.completed_at,
          });
          wo.expense_id = expId;
          postJournalEntry({
            companyId: wo.company_id,
            branchId: wo.branch_id,
            createdBy: user.id,
            sourceType: "work_order",
            sourceId: wo.id,
            reference: `WO-${wo.id}`,
            memo: `Completed work order #${wo.id}: ${wo.title}`,
            lines: [
              { account_code: "5000", debit_minor: total, credit_minor: 0 },
              {
                account_code: "1250",
                debit_minor: 0,
                credit_minor: wo.parts_cost_minor,
              },
              {
                account_code: "1000",
                debit_minor: 0,
                credit_minor: wo.labour_cost_minor,
              },
            ],
          });
        }
        completedWrites++;
        json(200, { data: decorateWorkOrder(wo) });
        return;
      }
      if (action === "cancel") {
        if (wo.status !== "open") {
          fail(409);
          return;
        }
        wo.status = "cancelled";
        wo.updated_at = new Date().toISOString();
        completedWrites++;
        json(200, { data: decorateWorkOrder(wo) });
        return;
      }
    }
    fail(404);
    return;
  }

  const partMatch = url.pathname.match(/^\/api\/v1\/parts(?:\/(\d+)(?:\/(adjust))?)?$/);
  if (partMatch) {
    const partId = partMatch[1] ? Number(partMatch[1]) : null;
    const action = partMatch[2] ?? null;
    if (req.method === "GET" && !partId) {
      if (!user.is_platform_admin && !user.permissions.includes("parts.view")) {
        fail(403);
        return;
      }
      const companyId = Number(url.searchParams.get("company_id"));
      const branchId = url.searchParams.get("branch_id")
        ? Number(url.searchParams.get("branch_id"))
        : null;
      const lowOnly =
        url.searchParams.get("low_stock_only") === "1" ||
        url.searchParams.get("low_stock_only") === "true";
      const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
      const items = [...parts.values()]
        .map(decoratePart)
        .filter((p) => {
          if (p.company_id !== companyId) return false;
          if (branchId !== null && p.branch_id !== branchId) return false;
          if (lowOnly && !p.is_low_stock) return false;
          if (
            q &&
            ![p.sku, p.name].some((s) => s.toLowerCase().includes(q))
          )
            return false;
          return true;
        });
      paginateSlice(
        sortItems(items, {
          id: (p) => p.id,
          sku: (p) => p.sku,
          name: (p) => p.name,
          unit_cost_minor: (p) => p.unit_cost_minor,
          on_hand: (p) => p.on_hand,
          min_stock: (p) => p.min_stock,
        }),
      );
      return;
    }
    if (req.method === "POST" && !partId) {
      if (!user.is_platform_admin && !user.permissions.includes("parts.manage")) {
        fail(403);
        return;
      }
      const id = nextId++;
      const created = {
        id,
        company_id: Number(input.company_id),
        branch_id: Number(input.branch_id),
        sku: String(input.sku ?? "").trim().toUpperCase(),
        name: String(input.name ?? "").trim(),
        unit_cost_minor: Math.max(0, Number(input.unit_cost_minor ?? 0)),
        min_stock: Math.max(0, Number(input.min_stock ?? 0)),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      parts.set(id, created);
      completedWrites++;
      json(201, { data: decoratePart(created) });
      return;
    }
    if (req.method === "PATCH" && partId && !action) {
      if (!user.is_platform_admin && !user.permissions.includes("parts.manage")) {
        fail(403);
        return;
      }
      const p = parts.get(partId);
      if (!p) {
        fail(404);
        return;
      }
      Object.assign(p, {
        sku: input.sku ? String(input.sku).trim().toUpperCase() : p.sku,
        name: input.name ? String(input.name).trim() : p.name,
        unit_cost_minor:
          input.unit_cost_minor !== undefined
            ? Math.max(0, Number(input.unit_cost_minor))
            : p.unit_cost_minor,
        min_stock:
          input.min_stock !== undefined
            ? Math.max(0, Number(input.min_stock))
            : p.min_stock,
        updated_at: new Date().toISOString(),
      });
      completedWrites++;
      json(200, { data: decoratePart(p) });
      return;
    }
    if (req.method === "POST" && partId && action === "adjust") {
      if (!user.is_platform_admin && !user.permissions.includes("parts.manage")) {
        fail(403);
        return;
      }
      const p = parts.get(partId);
      if (!p) {
        fail(404);
        return;
      }
      const qty = Number(input.quantity);
      if (!Number.isInteger(qty) || qty === 0) {
        fail(422, { quantity: ["Enter a nonzero whole stock adjustment."] });
        return;
      }
      if (partOnHand(p.id) + qty < 0) {
        fail(422, { quantity: ["Stock on hand cannot become negative."] });
        return;
      }
      const mId = nextId++;
      stockMovements.set(mId, {
        id: mId,
        company_id: p.company_id,
        branch_id: p.branch_id,
        part_id: p.id,
        recorded_by: user.id,
        quantity: qty,
        unit_cost_minor: p.unit_cost_minor,
        reason: String(input.reason ?? "Stock adjustment").trim(),
        work_order_id: null,
        purchase_order_id: null,
        created_at: new Date().toISOString(),
      });
      const val = Math.abs(qty) * p.unit_cost_minor;
      if (val > 0) {
        postJournalEntry({
          companyId: p.company_id,
          branchId: p.branch_id,
          createdBy: user.id,
          sourceType: "stock_adjustment",
          sourceId: mId,
          reference: `ADJ-${mId} (${p.sku})`,
          memo: String(input.reason ?? "Stock adjustment").trim(),
          lines:
            qty > 0
              ? [
                  { account_code: "1200", debit_minor: val, credit_minor: 0 },
                  { account_code: "5000", debit_minor: 0, credit_minor: val },
                ]
              : [
                  { account_code: "5000", debit_minor: val, credit_minor: 0 },
                  { account_code: "1200", debit_minor: 0, credit_minor: val },
                ],
        });
      }
      completedWrites++;
      json(200, { data: decoratePart(p) });
      return;
    }
    fail(404);
    return;
  }

  if (url.pathname === "/api/v1/stock-movements" && req.method === "GET") {
    if (!user.is_platform_admin && !user.permissions.includes("parts.view")) {
      fail(403);
      return;
    }
    const companyId = Number(url.searchParams.get("company_id"));
    const branchId = url.searchParams.get("branch_id")
      ? Number(url.searchParams.get("branch_id"))
      : null;
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const items = [...stockMovements.values()]
      .map(decorateMovement)
      .filter((m) => {
        if (m.company_id !== companyId) return false;
        if (branchId !== null && m.branch_id !== branchId) return false;
        if (
          q &&
          ![m.part_name ?? "", m.part_sku ?? "", m.reason].some((s) =>
            s.toLowerCase().includes(q),
          )
        )
          return false;
        return true;
      })
      .sort((a, b) => b.id - a.id);
    paginateSlice(
      sortItems(items, {
        id: (m) => m.id,
        created_at: (m) => m.created_at,
        part_name: (m) => m.part_name,
        quantity: (m) => m.quantity,
        unit_cost_minor: (m) => m.unit_cost_minor,
      }),
    );
    return;
  }

  const supMatch = url.pathname.match(/^\/api\/v1\/suppliers(?:\/(\d+))?$/);
  if (supMatch) {
    const supId = supMatch[1] ? Number(supMatch[1]) : null;
    if (req.method === "GET" && !supId) {
      if (!user.is_platform_admin && !user.permissions.includes("suppliers.view")) {
        fail(403);
        return;
      }
      const companyId = Number(url.searchParams.get("company_id"));
      const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
      const items = [...suppliers.values()].filter((s) => {
        if (s.company_id !== companyId) return false;
        if (q && ![s.name, s.email ?? ""].some((v) => v.toLowerCase().includes(q)))
          return false;
        return true;
      });
      paginateSlice(
        sortItems(items, {
          id: (s) => s.id,
          name: (s) => s.name,
          email: (s) => s.email,
          is_active: (s) => s.is_active,
        }),
      );
      return;
    }
    if (req.method === "POST" && !supId) {
      if (!user.is_platform_admin && !user.permissions.includes("suppliers.manage")) {
        fail(403);
        return;
      }
      const id = nextId++;
      const created = {
        id,
        company_id: Number(input.company_id),
        name: String(input.name ?? "").trim(),
        email: input.email ? String(input.email).trim() : null,
        phone: input.phone ? String(input.phone).trim() : null,
        is_active: input.is_active !== false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      suppliers.set(id, created);
      completedWrites++;
      json(201, { data: created });
      return;
    }
    fail(404);
    return;
  }

  const poMatch = url.pathname.match(
    /^\/api\/v1\/purchase-orders(?:\/(\d+)(?:\/(submit|approve|receive|cancel))?)?$/,
  );
  if (poMatch) {
    const poId = poMatch[1] ? Number(poMatch[1]) : null;
    const action = poMatch[2] ?? null;
    if (req.method === "GET" && !poId) {
      if (
        !user.is_platform_admin &&
        !user.permissions.includes("purchase_orders.view")
      ) {
        fail(403);
        return;
      }
      const companyId = Number(url.searchParams.get("company_id"));
      const branchId = url.searchParams.get("branch_id")
        ? Number(url.searchParams.get("branch_id"))
        : null;
      const statusFilter = url.searchParams.get("status");
      const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
      const items = [...purchaseOrders.values()]
        .map(decoratePo)
        .filter((po) => {
          if (po.company_id !== companyId) return false;
          if (branchId !== null && po.branch_id !== branchId) return false;
          if (statusFilter && po.status !== statusFilter) return false;
          if (
            q &&
            ![po.po_number, po.supplier_name ?? ""].some((s) =>
              s.toLowerCase().includes(q),
            )
          )
            return false;
          return true;
        });
      paginateSlice(
        sortItems(items, {
          id: (po) => po.id,
          supplier_name: (po) => po.supplier_name,
          total_minor: (po) => po.total_minor,
          status: (po) => po.status,
          created_at: (po) => po.created_at,
        }),
      );
      return;
    }
    if (req.method === "GET" && poId && !action) {
      if (
        !user.is_platform_admin &&
        !user.permissions.includes("purchase_orders.view")
      ) {
        fail(403);
        return;
      }
      const po = purchaseOrders.get(poId);
      if (!po) fail(404);
      else json(200, { data: decoratePo(po) });
      return;
    }
    if (req.method === "POST" && !poId) {
      if (
        !user.is_platform_admin &&
        !user.permissions.includes("purchase_orders.manage")
      ) {
        fail(403);
        return;
      }
      const rawLines = Array.isArray(input.lines) ? input.lines : [];
      if (rawLines.length === 0) {
        fail(422, { lines: ["Add at least one order line."] });
        return;
      }
      const normLines = rawLines.map((l, idx) => {
        const qty = Math.max(1, Number(l.quantity));
        const cost = Math.max(0, Number(l.unit_cost_minor));
        return {
          id: idx + 1,
          part_id: Number(l.part_id),
          quantity: qty,
          unit_cost_minor: cost,
          line_total_minor: qty * cost,
        };
      });
      const id = nextId++;
      const created = {
        id,
        company_id: Number(input.company_id),
        branch_id: Number(input.branch_id),
        supplier_id: Number(input.supplier_id),
        created_by: user.id,
        approved_by: null,
        approved_by_name: null,
        po_number: `PO-${String(id).padStart(5, "0")}`,
        status: "draft",
        total_minor: normLines.reduce((s, l) => s + l.line_total_minor, 0),
        notes: input.notes ? String(input.notes) : null,
        submitted_at: null,
        approved_at: null,
        received_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        lines: normLines,
      };
      purchaseOrders.set(id, created);
      completedWrites++;
      json(201, { data: decoratePo(created) });
      return;
    }
    if (req.method === "POST" && poId && action) {
      const reqPerm =
        action === "approve"
          ? "purchase_orders.approve"
          : "purchase_orders.manage";
      if (!user.is_platform_admin && !user.permissions.includes(reqPerm)) {
        fail(403);
        return;
      }
      const po = purchaseOrders.get(poId);
      if (!po) {
        fail(404);
        return;
      }
      if (action === "submit") {
        if (po.status !== "draft") {
          fail(409);
          return;
        }
        po.status = "submitted";
        po.submitted_at = new Date().toISOString();
      } else if (action === "approve") {
        if (po.status !== "submitted") {
          fail(409);
          return;
        }
        po.status = "approved";
        po.approved_by = user.id;
        po.approved_by_name = user.name;
        po.approved_at = new Date().toISOString();
      } else if (action === "receive") {
        if (po.status !== "approved") {
          fail(409);
          return;
        }
        po.status = "received";
        po.received_at = new Date().toISOString();
        for (const line of po.lines) {
          const mId = nextId++;
          stockMovements.set(mId, {
            id: mId,
            company_id: po.company_id,
            branch_id: po.branch_id,
            part_id: line.part_id,
            recorded_by: user.id,
            quantity: line.quantity,
            unit_cost_minor: line.unit_cost_minor,
            reason: `Purchase receipt (${po.po_number})`,
            work_order_id: null,
            purchase_order_id: po.id,
            created_at: po.received_at,
          });
        }
        if (po.total_minor > 0) {
          postJournalEntry({
            companyId: po.company_id,
            branchId: po.branch_id,
            createdBy: user.id,
            sourceType: "purchase_order",
            sourceId: po.id,
            reference: po.po_number,
            memo: `Received goods on ${po.po_number}`,
            lines: [
              { account_code: "1200", debit_minor: po.total_minor, credit_minor: 0 },
              { account_code: "2000", debit_minor: 0, credit_minor: po.total_minor },
            ],
          });
        }
      } else if (action === "cancel") {
        if (!["draft", "submitted", "approved"].includes(po.status)) {
          fail(409);
          return;
        }
        po.status = "cancelled";
      }
      po.updated_at = new Date().toISOString();
      completedWrites++;
      json(200, { data: decoratePo(po) });
      return;
    }
    fail(404);
    return;
  }

  // --- M8 Live Finance, Invoicing, Payments, Refunds, Expenses & GL ---
  if (url.pathname === "/api/v1/invoices/ageing" && req.method === "GET") {
    if (!user.is_platform_admin && !user.permissions.includes("invoices.view")) {
      fail(403);
      return;
    }
    const companyId = Number(url.searchParams.get("company_id"));
    const branchId = url.searchParams.get("branch_id")
      ? Number(url.searchParams.get("branch_id"))
      : null;
    const buckets = [
      { key: "current", label: "Current", count: 0, amount_minor: 0 },
      { key: "d1_30", label: "1–30 Days", count: 0, amount_minor: 0 },
      { key: "d31_60", label: "31–60 Days", count: 0, amount_minor: 0 },
      { key: "d61_90", label: "61–90 Days", count: 0, amount_minor: 0 },
      { key: "d90_plus", label: "90+ Days", count: 0, amount_minor: 0 },
    ];
    let totalOutstanding = 0;
    const byCust = new Map();
    const nowMs = Date.now();
    for (const rawInv of invoices.values()) {
      if (rawInv.company_id !== companyId) continue;
      if (branchId !== null && rawInv.branch_id !== branchId) continue;
      const inv = decorateInvoice(rawInv);
      if (inv.status !== "issued" || inv.outstanding_minor <= 0) continue;
      const daysPastDue = Math.floor((nowMs - Date.parse(inv.due_at)) / 86_400_000);
      const idx =
        daysPastDue > 90
          ? 4
          : daysPastDue > 60
            ? 3
            : daysPastDue > 30
              ? 2
              : daysPastDue > 0
                ? 1
                : 0;
      buckets[idx].count += 1;
      buckets[idx].amount_minor += inv.outstanding_minor;
      totalOutstanding += inv.outstanding_minor;
      const expKey =
        inv.customer_id !== null
          ? `crm:${inv.customer_id}`
          : `custom:${inv.customer_name ?? "Custom"}`;
      const cur = byCust.get(expKey) ?? {
        customer_id: inv.customer_id,
        customer_name:
          inv.customer_name ??
          (inv.customer_id ? `Customer #${inv.customer_id}` : "Custom customer"),
        customer_type:
          inv.customer_id !== null
            ? (customers.get(inv.customer_id)?.type ?? "individual")
            : "custom",
        outstanding_minor: 0,
        overdue_count: 0,
      };
      cur.outstanding_minor += inv.outstanding_minor;
      if (daysPastDue > 0) cur.overdue_count += 1;
      byCust.set(expKey, cur);
    }
    json(200, {
      data: {
        buckets,
        total_outstanding_minor: totalOutstanding,
        exposures: [...byCust.values()].sort(
          (a, b) => b.outstanding_minor - a.outstanding_minor,
        ),
      },
    });
    return;
  }

  const invoiceMatch = url.pathname.match(
    /^\/api\/v1\/invoices(?:\/(\d+)(?:\/(issue|void|payments|refunds))?)?$/,
  );
  if (invoiceMatch) {
    const invoiceId = invoiceMatch[1] ? Number(invoiceMatch[1]) : null;
    const action = invoiceMatch[2] ?? null;

    if (req.method === "GET" && !invoiceId) {
      if (!user.is_platform_admin && !user.permissions.includes("invoices.view")) {
        fail(403);
        return;
      }
      const companyId = Number(url.searchParams.get("company_id"));
      const branchId = url.searchParams.get("branch_id")
        ? Number(url.searchParams.get("branch_id"))
        : null;
      const statusFilter = url.searchParams.get("status");
      const customerFilter = url.searchParams.get("customer_id")
        ? Number(url.searchParams.get("customer_id"))
        : null;
      const rentalFilter = url.searchParams.get("rental_id")
        ? Number(url.searchParams.get("rental_id"))
        : null;
      const bucketFilter = url.searchParams.get("ageing_bucket");
      const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
      const nowMs = Date.now();
      const items = [...invoices.values()]
        .map(decorateInvoice)
        .filter((inv) => {
          if (inv.company_id !== companyId) return false;
          if (branchId !== null && inv.branch_id !== branchId) return false;
          if (customerFilter !== null && inv.customer_id !== customerFilter)
            return false;
          if (rentalFilter !== null && inv.rental_id !== rentalFilter)
            return false;
          if (statusFilter) {
            const disp =
              inv.status === "void"
                ? "void"
                : inv.status === "draft"
                  ? "draft"
                  : inv.outstanding_minor === 0 && inv.paid_minor > 0
                    ? "paid"
                    : inv.is_overdue
                      ? "overdue"
                      : "issued";
            if (statusFilter === "issued") {
              if (inv.status !== "issued") return false;
            } else if (disp !== statusFilter) {
              return false;
            }
          }
          if (bucketFilter) {
            if (inv.status !== "issued" || inv.outstanding_minor <= 0)
              return false;
            const daysPastDue = Math.floor(
              (nowMs - Date.parse(inv.due_at)) / 86_400_000,
            );
            const bKey =
              daysPastDue > 90
                ? "d90_plus"
                : daysPastDue > 60
                  ? "d61_90"
                  : daysPastDue > 30
                    ? "d31_60"
                    : daysPastDue > 0
                      ? "d1_30"
                      : "current";
            if (bKey !== bucketFilter) return false;
          }
          if (
            q &&
            ![
              inv.invoice_number,
              inv.customer_name ?? "",
              inv.notes ?? "",
            ].some((s) => s.toLowerCase().includes(q))
          ) {
            return false;
          }
          return true;
        });
      paginateSlice(
        sortItems(items, {
          id: (inv) => inv.id,
          customer_name: (inv) => inv.customer_name,
          due_at: (inv) => inv.due_at,
          total_minor: (inv) => inv.total_minor,
          outstanding_minor: (inv) => inv.outstanding_minor,
          status: (inv) => inv.status,
          created_at: (inv) => inv.created_at,
        }),
      );
      return;
    }

    if (req.method === "GET" && invoiceId && !action) {
      if (!user.is_platform_admin && !user.permissions.includes("invoices.view")) {
        fail(403);
        return;
      }
      const inv = invoices.get(invoiceId);
      if (!inv) fail(404);
      else json(200, { data: decorateInvoice(inv) });
      return;
    }

    if (req.method === "POST" && !invoiceId) {
      if (
        !user.is_platform_admin &&
        !user.permissions.includes("invoices.manage")
      ) {
        fail(403);
        return;
      }
      const companyId = Number(input.company_id);
      const branchId = Number(input.branch_id);
      const hasCustomerId =
        input.customer_id !== undefined && input.customer_id !== null;
      const customName = String(input.custom_customer_name ?? "").trim();
      if ((hasCustomerId && customName) || (!hasCustomerId && !customName)) {
        fail(422, {
          custom_customer_name: [
            "Provide either an existing customer or a custom customer name.",
          ],
        });
        return;
      }
      const customerId = hasCustomerId ? Number(input.customer_id) : null;
      const rawLines = Array.isArray(input.lines) ? input.lines : [];
      if (rawLines.length === 0) {
        fail(422, { lines: ["At least one line item is required."] });
        return;
      }
      const settings = companySettings.get(companyId) ?? { vat_rate_pct: 15 };
      const discountPct = Number(input.discount_pct ?? 0);
      const totals = computeInvoiceTotals(
        rawLines,
        discountPct,
        settings.vat_rate_pct,
      );
      const id = nextId++;
      const created = {
        id,
        company_id: companyId,
        branch_id: branchId,
        customer_id: customerId,
        custom_customer_name: customerId === null ? customName : null,
        custom_customer_email:
          customerId === null && input.custom_customer_email
            ? String(input.custom_customer_email).trim()
            : null,
        custom_customer_phone:
          customerId === null && input.custom_customer_phone
            ? String(input.custom_customer_phone).trim()
            : null,
        rental_id: null,
        created_by: user.id,
        invoice_number: `INV-${String(id).padStart(5, "0")}`,
        status: "draft",
        due_at: input.due_at || new Date(Date.now() + 14 * 86_400_000).toISOString(),
        issued_at: null,
        voided_at: null,
        discount_pct: discountPct,
        vat_rate_pct: settings.vat_rate_pct,
        ...totals,
        notes: input.notes ? String(input.notes) : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      invoices.set(id, created);
      completedWrites++;
      json(201, { data: decorateInvoice(created) });
      return;
    }

    if (req.method === "PATCH" && invoiceId && !action) {
      if (
        !user.is_platform_admin &&
        !user.permissions.includes("invoices.manage")
      ) {
        fail(403);
        return;
      }
      const inv = invoices.get(invoiceId);
      if (!inv) {
        fail(404);
        return;
      }
      if (inv.status !== "draft") {
        fail(409);
        return;
      }
      const rawLines = Array.isArray(input.lines) ? input.lines : inv.lines;
      if (rawLines.length === 0) {
        fail(422, { lines: ["At least one line item is required."] });
        return;
      }
      const discountPct =
        input.discount_pct !== undefined
          ? Number(input.discount_pct)
          : inv.discount_pct;
      const totals = computeInvoiceTotals(rawLines, discountPct, inv.vat_rate_pct);
      Object.assign(inv, totals, {
        discount_pct: discountPct,
        due_at: input.due_at || inv.due_at,
        ...(inv.customer_id === null && input.custom_customer_name !== undefined
          ? {
              custom_customer_name: String(input.custom_customer_name).trim(),
              custom_customer_email: input.custom_customer_email
                ? String(input.custom_customer_email).trim()
                : null,
              custom_customer_phone: input.custom_customer_phone
                ? String(input.custom_customer_phone).trim()
                : null,
            }
          : {}),
        notes:
          input.notes !== undefined
            ? input.notes
              ? String(input.notes)
              : null
            : inv.notes,
        updated_at: new Date().toISOString(),
      });
      completedWrites++;
      json(200, { data: decorateInvoice(inv) });
      return;
    }

    if (req.method === "POST" && invoiceId && action === "issue") {
      if (
        !user.is_platform_admin &&
        !user.permissions.includes("invoices.manage")
      ) {
        fail(403);
        return;
      }
      const inv = invoices.get(invoiceId);
      if (!inv) {
        fail(404);
        return;
      }
      if (inv.status !== "draft") {
        fail(409);
        return;
      }
      if (inv.total_minor <= 0) {
        fail(422, { lines: ["Invoice total must be greater than zero to issue."] });
        return;
      }
      inv.status = "issued";
      inv.issued_at = new Date().toISOString();
      inv.updated_at = inv.issued_at;
      postJournalEntry({
        companyId: inv.company_id,
        branchId: inv.branch_id,
        createdBy: user.id,
        sourceType: "invoice",
        sourceId: inv.id,
        reference: inv.invoice_number,
        memo: `Issued invoice ${inv.invoice_number}`,
        lines: [
          { account_code: "1100", debit_minor: inv.total_minor, credit_minor: 0 },
          {
            account_code: "4000",
            debit_minor: 0,
            credit_minor: inv.total_minor - inv.vat_minor,
          },
          { account_code: "2100", debit_minor: 0, credit_minor: inv.vat_minor },
        ],
      });
      completedWrites++;
      json(200, { data: decorateInvoice(inv) });
      return;
    }

    if (req.method === "POST" && invoiceId && action === "void") {
      if (
        !user.is_platform_admin &&
        !user.permissions.includes("invoices.manage")
      ) {
        fail(403);
        return;
      }
      const inv = invoices.get(invoiceId);
      if (!inv) {
        fail(404);
        return;
      }
      const dec = decorateInvoice(inv);
      if (inv.status === "void" || dec.paid_minor > 0) {
        fail(409);
        return;
      }
      const wasIssued = inv.status === "issued";
      inv.status = "void";
      inv.voided_at = new Date().toISOString();
      inv.updated_at = inv.voided_at;
      if (wasIssued) {
        postJournalEntry({
          companyId: inv.company_id,
          branchId: inv.branch_id,
          createdBy: user.id,
          sourceType: "invoice",
          sourceId: inv.id,
          reference: `${inv.invoice_number} (VOID)`,
          memo: `Voided issued invoice ${inv.invoice_number}`,
          lines: [
            {
              account_code: "4000",
              debit_minor: inv.total_minor - inv.vat_minor,
              credit_minor: 0,
            },
            { account_code: "2100", debit_minor: inv.vat_minor, credit_minor: 0 },
            { account_code: "1100", debit_minor: 0, credit_minor: inv.total_minor },
          ],
        });
      }
      completedWrites++;
      json(200, { data: decorateInvoice(inv) });
      return;
    }

    if (req.method === "POST" && invoiceId && action === "payments") {
      if (
        !user.is_platform_admin &&
        !user.permissions.includes("payments.manage")
      ) {
        fail(403);
        return;
      }
      const inv = invoices.get(invoiceId);
      if (!inv) {
        fail(404);
        return;
      }
      if (inv.status !== "issued") {
        fail(409);
        return;
      }
      const dec = decorateInvoice(inv);
      const amountMinor = Number(input.amount_minor);
      if (
        !Number.isInteger(amountMinor) ||
        amountMinor <= 0 ||
        amountMinor > dec.outstanding_minor
      ) {
        fail(422, {
          amount_minor: [
            "Payment amount must be positive and cannot exceed the outstanding balance.",
          ],
        });
        return;
      }
      const id = nextId++;
      const created = {
        id,
        company_id: inv.company_id,
        branch_id: inv.branch_id,
        invoice_id: inv.id,
        invoice_number: inv.invoice_number,
        customer_name: dec.customer_name,
        recorded_by: user.id,
        amount_minor: amountMinor,
        method: input.method || "bank_transfer",
        reference: String(input.reference || `RCPT-${id}`),
        paid_at: input.paid_at || new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      payments.set(id, created);
      postJournalEntry({
        companyId: inv.company_id,
        branchId: inv.branch_id,
        createdBy: user.id,
        sourceType: "payment",
        sourceId: id,
        reference: created.reference,
        memo: `Payment on ${inv.invoice_number}`,
        lines: [
          { account_code: "1000", debit_minor: amountMinor, credit_minor: 0 },
          { account_code: "1100", debit_minor: 0, credit_minor: amountMinor },
        ],
      });
      completedWrites++;
      json(201, { data: created });
      return;
    }

    if (req.method === "POST" && invoiceId && action === "refunds") {
      if (
        !user.is_platform_admin &&
        !user.permissions.includes("payments.manage")
      ) {
        fail(403);
        return;
      }
      const inv = invoices.get(invoiceId);
      if (!inv) {
        fail(404);
        return;
      }
      if (inv.status !== "issued") {
        fail(409);
        return;
      }
      const dec = decorateInvoice(inv);
      const amountMinor = Number(input.amount_minor);
      if (
        !Number.isInteger(amountMinor) ||
        amountMinor <= 0 ||
        amountMinor > dec.net_paid_minor
      ) {
        fail(422, {
          amount_minor: [
            "Refund amount must be positive and cannot exceed net recorded payments.",
          ],
        });
        return;
      }
      if (!String(input.reason ?? "").trim()) {
        fail(422, { reason: ["A refund reason is required."] });
        return;
      }
      const id = nextId++;
      const created = {
        id,
        company_id: inv.company_id,
        branch_id: inv.branch_id,
        invoice_id: inv.id,
        invoice_number: inv.invoice_number,
        customer_name: dec.customer_name,
        recorded_by: user.id,
        amount_minor: amountMinor,
        reason: String(input.reason).trim(),
        refunded_at: input.refunded_at || new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      refunds.set(id, created);
      postJournalEntry({
        companyId: inv.company_id,
        branchId: inv.branch_id,
        createdBy: user.id,
        sourceType: "refund",
        sourceId: id,
        reference: `REF-${id} (${inv.invoice_number})`,
        memo: `Refund on ${inv.invoice_number}: ${created.reason}`,
        lines: [
          { account_code: "4100", debit_minor: amountMinor, credit_minor: 0 },
          { account_code: "1000", debit_minor: 0, credit_minor: amountMinor },
        ],
      });
      completedWrites++;
      json(201, { data: created });
      return;
    }

    fail(404);
    return;
  }

  if (url.pathname === "/api/v1/payments" && req.method === "GET") {
    if (!user.is_platform_admin && !user.permissions.includes("invoices.view")) {
      fail(403);
      return;
    }
    const companyId = Number(url.searchParams.get("company_id"));
    const branchId = url.searchParams.get("branch_id")
      ? Number(url.searchParams.get("branch_id"))
      : null;
    const methodFilter = url.searchParams.get("method");
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const items = [...payments.values()].filter((p) => {
      if (p.company_id !== companyId) return false;
      if (branchId !== null && p.branch_id !== branchId) return false;
      if (methodFilter && p.method !== methodFilter) return false;
      if (
        q &&
        ![p.reference, p.invoice_number ?? "", p.customer_name ?? ""].some((s) =>
          s.toLowerCase().includes(q),
        )
      )
        return false;
      return true;
    });
    paginateSlice(
      sortItems(items, {
        id: (p) => p.id,
        paid_at: (p) => p.paid_at,
        amount_minor: (p) => p.amount_minor,
        method: (p) => p.method,
      }),
    );
    return;
  }

  if (url.pathname === "/api/v1/refunds" && req.method === "GET") {
    if (!user.is_platform_admin && !user.permissions.includes("invoices.view")) {
      fail(403);
      return;
    }
    const companyId = Number(url.searchParams.get("company_id"));
    const branchId = url.searchParams.get("branch_id")
      ? Number(url.searchParams.get("branch_id"))
      : null;
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const items = [...refunds.values()].filter((r) => {
      if (r.company_id !== companyId) return false;
      if (branchId !== null && r.branch_id !== branchId) return false;
      if (
        q &&
        ![r.reason, r.invoice_number ?? "", r.customer_name ?? ""].some((s) =>
          s.toLowerCase().includes(q),
        )
      )
        return false;
      return true;
    });
    paginateSlice(
      sortItems(items, {
        id: (r) => r.id,
        refunded_at: (r) => r.refunded_at,
        amount_minor: (r) => r.amount_minor,
      }),
    );
    return;
  }

  if (url.pathname === "/api/v1/expenses") {
    if (req.method === "GET") {
      if (!user.is_platform_admin && !user.permissions.includes("expenses.view")) {
        fail(403);
        return;
      }
      const companyId = Number(url.searchParams.get("company_id"));
      const branchId = url.searchParams.get("branch_id")
        ? Number(url.searchParams.get("branch_id"))
        : null;
      const categoryFilter = url.searchParams.get("category");
      const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
      const items = [...expenses.values()].filter((e) => {
        if (e.company_id !== companyId) return false;
        if (branchId !== null && e.branch_id !== branchId) return false;
        if (categoryFilter && e.category !== categoryFilter) return false;
        if (
          q &&
          ![e.description, e.vehicle_registration ?? ""].some((s) =>
            s.toLowerCase().includes(q),
          )
        )
          return false;
        return true;
      });
      paginateSlice(
        sortItems(items, {
          id: (e) => e.id,
          incurred_at: (e) => e.incurred_at,
          description: (e) => e.description,
          category: (e) => e.category,
          amount_minor: (e) => e.amount_minor,
        }),
      );
      return;
    }
    if (req.method === "POST") {
      if (
        !user.is_platform_admin &&
        !user.permissions.includes("expenses.manage")
      ) {
        fail(403);
        return;
      }
      const amountMinor = Number(input.amount_minor);
      if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
        fail(422, { amount_minor: ["Expense amount must be greater than zero."] });
        return;
      }
      const vehicle = input.vehicle_id ? vehicles.get(Number(input.vehicle_id)) : null;
      const id = nextId++;
      const created = {
        id,
        company_id: Number(input.company_id),
        branch_id: Number(input.branch_id),
        vehicle_id: vehicle?.id ?? null,
        vehicle_registration: vehicle?.registration ?? null,
        recorded_by: user.id,
        category: input.category || "general",
        description: String(input.description ?? "").trim(),
        amount_minor: amountMinor,
        incurred_at: input.incurred_at || new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      expenses.set(id, created);
      postJournalEntry({
        companyId: created.company_id,
        branchId: created.branch_id,
        createdBy: user.id,
        sourceType: "expense",
        sourceId: id,
        reference: `EXP-${id}`,
        memo: `${created.category}: ${created.description}`,
        lines: [
          { account_code: "5000", debit_minor: amountMinor, credit_minor: 0 },
          { account_code: "1000", debit_minor: 0, credit_minor: amountMinor },
        ],
      });
      completedWrites++;
      json(201, { data: created });
      return;
    }
  }

  if (url.pathname === "/api/v1/gl/accounts" && req.method === "GET") {
    if (!user.is_platform_admin && !user.permissions.includes("gl.view")) {
      fail(403);
      return;
    }
    const companyId = Number(url.searchParams.get("company_id"));
    const branchId = url.searchParams.get("branch_id")
      ? Number(url.searchParams.get("branch_id"))
      : null;
    const totals = new Map(
      SYSTEM_GL_ACCOUNTS.map((a) => [a.code, { debit: 0, credit: 0 }]),
    );
    let totalDebits = 0;
    let totalCredits = 0;
    for (const entry of journalEntries.values()) {
      if (entry.company_id !== companyId) continue;
      if (branchId !== null && entry.branch_id !== branchId) continue;
      for (const line of entry.lines) {
        const cur = totals.get(line.account_code) ?? { debit: 0, credit: 0 };
        cur.debit += line.debit_minor;
        cur.credit += line.credit_minor;
        totals.set(line.account_code, cur);
        totalDebits += line.debit_minor;
        totalCredits += line.credit_minor;
      }
    }
    json(200, {
      data: {
        accounts: SYSTEM_GL_ACCOUNTS.map((a) => {
          const t = totals.get(a.code) ?? { debit: 0, credit: 0 };
          return {
            ...a,
            debit_minor: t.debit,
            credit_minor: t.credit,
            balance_minor: t.debit - t.credit,
          };
        }),
        total_debits_minor: totalDebits,
        total_credits_minor: totalCredits,
        is_balanced: totalDebits === totalCredits,
      },
    });
    return;
  }

  if (url.pathname === "/api/v1/gl/journal-entries" && req.method === "GET") {
    if (!user.is_platform_admin && !user.permissions.includes("gl.view")) {
      fail(403);
      return;
    }
    const companyId = Number(url.searchParams.get("company_id"));
    const branchId = url.searchParams.get("branch_id")
      ? Number(url.searchParams.get("branch_id"))
      : null;
    const accountCode = url.searchParams.get("account_code");
    const sourceType = url.searchParams.get("source_type");
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const items = [...journalEntries.values()]
      .filter((e) => {
        if (e.company_id !== companyId) return false;
        if (branchId !== null && e.branch_id !== branchId) return false;
        if (sourceType && e.source_type !== sourceType) return false;
        if (accountCode && !e.lines.some((l) => l.account_code === accountCode))
          return false;
        if (
          q &&
          ![e.reference, e.memo].some((s) => s.toLowerCase().includes(q))
        )
          return false;
        return true;
      })
      .sort((a, b) => b.id - a.id);
    paginateSlice(items);
    return;
  }

  // --- M6 Reservations, Rentals & Documents ---
  const isDriverSelf =
    !user.is_platform_admin &&
    user.roles.includes("driver") &&
    !user.permissions.includes("rentals.view");

  const resMatch = url.pathname.match(
    /^\/api\/v1\/reservations(?:\/(\d+)(?:\/(cancel))?)?$/,
  );
  if (resMatch) {
    const resId = resMatch[1] ? Number(resMatch[1]) : null;
    const action = resMatch[2] ?? null;
    if (req.method === "GET" && !resId) {
      if (
        !user.is_platform_admin &&
        !user.permissions.includes("reservations.view")
      ) {
        fail(403);
        return;
      }
      const companyId = Number(url.searchParams.get("company_id"));
      const branchId = url.searchParams.get("branch_id")
        ? Number(url.searchParams.get("branch_id"))
        : null;
      const statusFilter = url.searchParams.get("status");
      const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
      const items = [...reservations.values()]
        .filter((r) => {
          if (r.company_id !== companyId) return false;
          if (branchId !== null && r.branch_id !== branchId) return false;
          if (statusFilter && r.status !== statusFilter) return false;
          const dec = decorateReservation(r);
          if (
            q &&
            ![
              String(r.id),
              dec.customer_name ?? "",
              dec.vehicle_registration ?? "",
            ].some((s) => s.toLowerCase().includes(q))
          )
            return false;
          return true;
        })
        .map(decorateReservation);
      paginateSlice(
        sortItems(items, {
          id: (r) => r.id,
          customer_name: (r) => r.customer_name,
          vehicle_registration: (r) => r.vehicle_registration,
          starts_at: (r) => r.starts_at,
          ends_at: (r) => r.ends_at,
          status: (r) => r.status,
        }),
      );
      return;
    }
    if (req.method === "GET" && resId && !action) {
      if (
        !user.is_platform_admin &&
        !user.permissions.includes("reservations.view")
      ) {
        fail(403);
        return;
      }
      const rec = reservations.get(resId);
      if (!rec) fail(404);
      else json(200, { data: decorateReservation(rec) });
      return;
    }
    if (req.method === "POST" && !resId) {
      if (
        !user.is_platform_admin &&
        !user.permissions.includes("reservations.manage")
      ) {
        fail(403);
        return;
      }
      const vehicle = vehicles.get(Number(input.vehicle_id));
      if (!vehicle || vehicle.status !== "available") {
        fail(422, { vehicle_id: ["Vehicle is not available."] });
        return;
      }
      const startMs = Date.parse(input.starts_at);
      const endMs = Date.parse(input.ends_at);
      const overlap = [...reservations.values()].some(
        (r) =>
          r.vehicle_id === vehicle.id &&
          r.status === "confirmed" &&
          Date.parse(r.starts_at) < endMs &&
          Date.parse(r.ends_at) > startMs,
      );
      if (overlap) {
        fail(422, {
          vehicle_id: ["vehicle_id could not be booked for this period."],
        });
        return;
      }
      const id = nextId++;
      const created = {
        id,
        company_id: Number(input.company_id),
        branch_id: Number(input.branch_id),
        customer_id: Number(input.customer_id),
        vehicle_id: Number(input.vehicle_id),
        created_by: user.id,
        starts_at: new Date(startMs).toISOString(),
        ends_at: new Date(endMs).toISOString(),
        status: "confirmed",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      reservations.set(id, created);
      completedWrites++;
      json(201, { data: decorateReservation(created) });
      return;
    }
    if (req.method === "POST" && resId && action === "cancel") {
      if (
        !user.is_platform_admin &&
        !user.permissions.includes("reservations.manage")
      ) {
        fail(403);
        return;
      }
      const rec = reservations.get(resId);
      if (!rec) {
        fail(404);
        return;
      }
      if (
        rec.status !== "confirmed" ||
        [...rentals.values()].some((r) => r.reservation_id === rec.id)
      ) {
        fail(409);
        return;
      }
      rec.status = "cancelled";
      rec.updated_at = new Date().toISOString();
      completedWrites++;
      json(200, { data: decorateReservation(rec) });
      return;
    }
    fail(404);
    return;
  }

  const rentalMatch = url.pathname.match(
    /^\/api\/v1\/rentals(?:\/(\d+)(?:\/(handover|return|extend|assign-driver))?)?$/,
  );
  if (rentalMatch) {
    const rentalId = rentalMatch[1] ? Number(rentalMatch[1]) : null;
    const action = rentalMatch[2] ?? null;
    if (req.method === "GET" && !rentalId) {
      if (
        !user.is_platform_admin &&
        !user.permissions.includes("rentals.view") &&
        !isDriverSelf
      ) {
        fail(403);
        return;
      }
      const companyId = Number(url.searchParams.get("company_id"));
      const branchId = url.searchParams.get("branch_id")
        ? Number(url.searchParams.get("branch_id"))
        : null;
      const statusFilter = url.searchParams.get("status");
      const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
      const items = [...rentals.values()]
        .filter((r) => {
          if (r.company_id !== companyId) return false;
          if (branchId !== null && r.branch_id !== branchId) return false;
          if (isDriverSelf && r.driver_user_id !== user.id) return false;
          if (statusFilter && r.status !== statusFilter) return false;
          const dec = decorateRental(r);
          if (
            q &&
            ![
              String(r.id),
              dec.vehicle_registration ?? "",
              dec.customer_name ?? "",
              r.handover_notes ?? "",
              r.return_notes ?? "",
            ].some((s) => s.toLowerCase().includes(q))
          )
            return false;
          return true;
        })
        .map(decorateRental);
      paginateSlice(
        sortItems(items, {
          id: (r) => r.id,
          vehicle_registration: (r) => r.vehicle_registration,
          customer_name: (r) => r.customer_name,
          driver_name: (r) => r.driver_name,
          status: (r) => r.status,
          handed_over_at: (r) => r.handed_over_at,
        }),
      );
      return;
    }
    if (req.method === "GET" && rentalId && !action) {
      const rec = rentals.get(rentalId);
      if (!rec) {
        fail(404);
        return;
      }
      if (
        !user.is_platform_admin &&
        !user.permissions.includes("rentals.view") &&
        !(isDriverSelf && rec.driver_user_id === user.id)
      ) {
        fail(403);
        return;
      }
      json(200, { data: decorateRental(rec) });
      return;
    }
    if (req.method === "POST" && !rentalId) {
      if (
        !user.is_platform_admin &&
        !user.permissions.includes("rentals.manage")
      ) {
        fail(403);
        return;
      }
      const resRec = reservations.get(Number(input.reservation_id));
      if (
        !resRec ||
        resRec.status !== "confirmed" ||
        [...rentals.values()].some((r) => r.reservation_id === resRec.id)
      ) {
        fail(409);
        return;
      }
      const id = nextId++;
      const created = {
        id,
        company_id: resRec.company_id,
        branch_id: resRec.branch_id,
        reservation_id: resRec.id,
        vehicle_id: resRec.vehicle_id,
        driver_user_id: input.driver_user_id
          ? Number(input.driver_user_id)
          : null,
        status: "draft",
        handed_over_at: null,
        returned_at: null,
        handover_odometer: null,
        return_odometer: null,
        handover_notes: null,
        return_notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      rentals.set(id, created);
      completedWrites++;
      json(201, { data: decorateRental(created) });
      return;
    }
    if (req.method === "POST" && rentalId && action) {
      const rec = rentals.get(rentalId);
      if (!rec) {
        fail(404);
        return;
      }
      const vehicle = vehicles.get(rec.vehicle_id);
      const resRec = reservations.get(rec.reservation_id);
      if (action === "handover" || action === "return") {
        if (
          !user.is_platform_admin &&
          !user.permissions.includes("rentals.manage") &&
          !(isDriverSelf && rec.driver_user_id === user.id)
        ) {
          fail(403);
          return;
        }
        if (action === "handover") {
          if (rec.status !== "draft" || vehicle?.status !== "available") {
            fail(409);
            return;
          }
          if (Number(input.odometer) < (vehicle?.odometer ?? 0)) {
            fail(422, { odometer: ["Odometer cannot decrease."] });
            return;
          }
          rec.status = "active";
          rec.handed_over_at = new Date().toISOString();
          rec.handover_odometer = Number(input.odometer);
          rec.handover_notes = String(input.notes ?? "");
          rec.updated_at = new Date().toISOString();
          if (vehicle) {
            vehicle.status = "rented";
            vehicle.odometer = Number(input.odometer);
          }
        } else {
          if (rec.status !== "active") {
            fail(409);
            return;
          }
          const minOdo = Math.max(
            vehicle?.odometer ?? 0,
            rec.handover_odometer ?? 0,
          );
          if (Number(input.odometer) < minOdo) {
            fail(422, { odometer: ["Odometer cannot decrease."] });
            return;
          }
          rec.status = "returned";
          rec.returned_at = new Date().toISOString();
          rec.return_odometer = Number(input.odometer);
          rec.return_notes = String(input.notes ?? "");
          rec.updated_at = new Date().toISOString();
          if (vehicle) {
            vehicle.status = input.vehicle_status ?? "available";
            vehicle.odometer = Number(input.odometer);
          }
          if (resRec) resRec.status = "completed";
          // Auto-create draft invoice on return carrying quotation discount/VAT or vehicle rate
          const settings = companySettings.get(rec.company_id) ?? {
            vat_rate_pct: 15,
          };
          const linkedQuote = [...quotations.values()].find((q) =>
            q.reservation_ids.includes(rec.reservation_id),
          );
          const quoteVeh = linkedQuote?.vehicles.find(
            (v) => v.vehicle_id === rec.vehicle_id,
          );
          const rentalDays = resRec
            ? Math.max(
                1,
                Math.ceil(
                  (Date.parse(resRec.ends_at) - Date.parse(resRec.starts_at)) /
                    86_400_000,
                ),
              )
            : 1;
          const unitRate =
            quoteVeh?.daily_rate_minor ?? vehicle?.daily_rate_minor ?? 0;
          const invLines = [
            {
              description: `Rental #${rec.id} (${vehicle?.registration ?? `Vehicle #${rec.vehicle_id}`})`,
              quantity: rentalDays,
              unit_price_minor: unitRate,
            },
          ];
          const extraMinor = Number(input.extra_charge_minor ?? 0);
          if (extraMinor > 0) {
            invLines.push({
              description:
                String(input.extra_charge_description ?? "").trim() ||
                "Additional return charge",
              quantity: 1,
              unit_price_minor: extraMinor,
            });
          }
          const discountPct = linkedQuote?.discount_pct ?? 0;
          const vatRatePct = linkedQuote?.vat_rate_pct ?? settings.vat_rate_pct;
          const totals = computeInvoiceTotals(invLines, discountPct, vatRatePct);
          const invId = nextId++;
          invoices.set(invId, {
            id: invId,
            company_id: rec.company_id,
            branch_id: rec.branch_id,
            customer_id: resRec?.customer_id ?? 10,
            rental_id: rec.id,
            created_by: user.id,
            invoice_number: `INV-${String(invId).padStart(5, "0")}`,
            status: "draft",
            due_at: new Date(Date.now() + 14 * 86_400_000).toISOString(),
            issued_at: null,
            voided_at: null,
            discount_pct: discountPct,
            vat_rate_pct: vatRatePct,
            ...totals,
            notes: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
        completedWrites++;
        json(200, { data: decorateRental(rec) });
        return;
      }
      if (
        !user.is_platform_admin &&
        !user.permissions.includes("rentals.manage")
      ) {
        fail(403);
        return;
      }
      if (action === "extend") {
        if (rec.status !== "active" || !resRec) {
          fail(409);
          return;
        }
        const nextEnd = Date.parse(input.ends_at);
        const curEnd = Date.parse(resRec.ends_at);
        if (Number.isNaN(nextEnd) || nextEnd <= curEnd) {
          fail(422, { ends_at: ["New return date must be after current end."] });
          return;
        }
        const overlap = [...reservations.values()].some(
          (other) =>
            other.id !== resRec.id &&
            other.vehicle_id === rec.vehicle_id &&
            other.status === "confirmed" &&
            Date.parse(other.starts_at) < nextEnd &&
            Date.parse(other.ends_at) > curEnd,
        );
        if (overlap || control.extendConflict) {
          fail(409);
          return;
        }
        resRec.ends_at = new Date(nextEnd).toISOString();
        rec.updated_at = new Date().toISOString();
        completedWrites++;
        json(200, { data: decorateRental(rec) });
        return;
      }
      if (action === "assign-driver") {
        if (rec.status === "returned") {
          fail(409);
          return;
        }
        rec.driver_user_id = input.driver_user_id
          ? Number(input.driver_user_id)
          : null;
        rec.updated_at = new Date().toISOString();
        completedWrites++;
        json(200, { data: decorateRental(rec) });
        return;
      }
    }
    fail(404);
    return;
  }

  const docMatch = url.pathname.match(/^\/api\/v1\/documents(?:\/(\d+))?$/);
  if (docMatch) {
    const docId = docMatch[1] ? Number(docMatch[1]) : null;
    if (req.method === "GET" && !docId) {
      const companyId = Number(url.searchParams.get("company_id"));
      const branchId = url.searchParams.get("branch_id")
        ? Number(url.searchParams.get("branch_id"))
        : null;
      const entityType = url.searchParams.get("entity_type");
      const entityId = url.searchParams.get("entity_id")
        ? Number(url.searchParams.get("entity_id"))
        : null;
      const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
      if (isDriverSelf) {
        const rental =
          entityType === "rental" && entityId ? rentals.get(entityId) : null;
        if (!rental || rental.driver_user_id !== user.id) {
          fail(403);
          return;
        }
      } else if (
        !user.is_platform_admin &&
        !user.permissions.includes("documents.view")
      ) {
        fail(403);
        return;
      }
      const items = [...documents.values()].filter((d) => {
        if (d.company_id !== companyId) return false;
        if (branchId !== null && d.branch_id !== branchId) return false;
        if (entityType && d.entity_type !== entityType) return false;
        if (entityId !== null && d.entity_id !== entityId) return false;
        if (
          q &&
          !d.original_name.toLowerCase().includes(q) &&
          !d.mime_type.toLowerCase().includes(q)
        )
          return false;
        return true;
      });
      paginateSlice(
        sortItems(items, {
          original_name: (d) => d.original_name,
          size: (d) => d.size,
          expires_at: (d) => d.expires_at,
          created_at: (d) => d.created_at,
        }),
      );
      return;
    }
    if (req.method === "GET" && docId) {
      const rec = documents.get(docId);
      if (!rec) {
        fail(404);
        return;
      }
      const allowedDriver =
        isDriverSelf &&
        rec.entity_type === "rental" &&
        rentals.get(rec.entity_id)?.driver_user_id === user.id;
      if (
        !user.is_platform_admin &&
        !user.permissions.includes("documents.view") &&
        !allowedDriver
      ) {
        fail(403);
        return;
      }
      const blob =
        documentBlobs.get(docId) ?? Buffer.from("%PDF-1.4\n%%EOF", "utf8");
      res.writeHead(200, {
        "Content-Type": rec.mime_type,
        "Content-Disposition": `attachment; filename="${rec.original_name}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      });
      res.end(blob);
      return;
    }
    if (req.method === "POST" && !docId && multipartData) {
      const fields = multipartData.fields;
      const entityType = fields.entity_type || null;
      const entityId = fields.entity_id ? Number(fields.entity_id) : null;
      const allowedDriver =
        isDriverSelf &&
        entityType === "rental" &&
        entityId &&
        rentals.get(entityId)?.driver_user_id === user.id;
      if (
        !user.is_platform_admin &&
        !user.permissions.includes("documents.manage") &&
        !allowedDriver
      ) {
        fail(403);
        return;
      }
      if (!multipartData.file) {
        fail(422, { file: ["A file is required."] });
        return;
      }
      const id = nextId++;
      const created = {
        id,
        company_id: Number(fields.company_id),
        branch_id: Number(fields.branch_id),
        uploaded_by: user.id,
        entity_type: entityType,
        entity_id: entityId,
        original_name: multipartData.file.original_name,
        mime_type: multipartData.file.mime_type,
        size: multipartData.file.bytes.length,
        expires_at: fields.expires_at || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      documents.set(id, created);
      documentBlobs.set(id, multipartData.file.bytes);
      completedWrites++;
      // Mirror real Laravel multipart Document::create() returning string IDs before refresh()
      json(201, {
        data: {
          ...created,
          company_id: String(created.company_id),
          branch_id: String(created.branch_id),
        },
      });
      return;
    }
    fail(404);
    return;
  }

  // --- Customers & Vehicles ---
  const match = url.pathname.match(
    /^\/api\/v1\/(?:(stats)\/)?(customers|vehicles)(?:\/(\d+))?$/,
  );
  if (!match) {
    fail(404);
    return;
  }
  const isStatsEndpoint = match[1] === "stats";
  const domain = match[2];
  const id = match[3] ? Number(match[3]) : null;
  const records = domain === "customers" ? customers : vehicles;
  if (!id && req.method === "GET") {
    if (
      !user.is_platform_admin &&
      !user.permissions.includes(`${domain}.view`)
    ) {
      fail(403);
      return;
    }
    const companyId = Number(url.searchParams.get("company_id"));
    if (!Number.isInteger(companyId) || companyId < 1) {
      fail(422, { company_id: ["The company id field is required."] });
      return;
    }
    const membership = user.companies.find((c) => c.id === companyId);
    if (!user.is_platform_admin && !membership) {
      fail(404);
      return;
    }
    const branchId = url.searchParams.get("branch_id")
      ? Number(url.searchParams.get("branch_id"))
      : null;
    if (
      !user.is_platform_admin &&
      membership?.branch_id !== null &&
      branchId !== null &&
      membership.branch_id !== branchId
    ) {
      fail(404);
      return;
    }
    const canSeeFinance =
      user.is_platform_admin || user.permissions.includes("invoices.view");
    const sortParam = url.searchParams.get("sort") ?? "";
    const monetarySortKeys = [
      "total_spent_minor",
      "open_ar_minor",
      "revenue_minor",
      "net_roi_minor",
    ];
    if (
      !canSeeFinance &&
      (url.searchParams.has("min_spend_minor") ||
        url.searchParams.has("max_spend_minor") ||
        url.searchParams.get("has_open_ar") === "1" ||
        monetarySortKeys.includes(sortParam))
    ) {
      fail(403);
      return;
    }

    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const typeFilter = url.searchParams.get("type");
    const statusFilter = url.searchParams.get("status");
    const includeStats =
      isStatsEndpoint || url.searchParams.get("include_stats") === "1";
    const from = url.searchParams.get("from") ?? "";
    const to = url.searchParams.get("to") ?? "";
    const minSpend = url.searchParams.has("min_spend_minor")
      ? Number(url.searchParams.get("min_spend_minor"))
      : null;
    const maxSpend = url.searchParams.has("max_spend_minor")
      ? Number(url.searchParams.get("max_spend_minor"))
      : null;
    const hasOpenAr = url.searchParams.get("has_open_ar") === "1";
    const minRate = url.searchParams.has("min_rate_minor")
      ? Number(url.searchParams.get("min_rate_minor"))
      : null;
    const maxRate = url.searchParams.has("max_rate_minor")
      ? Number(url.searchParams.get("max_rate_minor"))
      : null;
    const idleDaysMin = url.searchParams.has("idle_days_min")
      ? Number(url.searchParams.get("idle_days_min"))
      : null;
    const unpricedOnly = url.searchParams.get("unpriced_only") === "1";
    const functionsFilter = (url.searchParams.get("functions") ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    collectionReads++;
    let items = [...records.values()].filter((r) => {
      if (r.company_id !== companyId) return false;
      if (
        !user.is_platform_admin &&
        membership?.branch_id !== null &&
        r.branch_id !== membership.branch_id
      )
        return false;
      if (branchId !== null && r.branch_id !== branchId) return false;
      if (domain === "customers") {
        if (typeFilter && r.type !== typeFilter) return false;
        if (
          q &&
          ![r.name, r.email ?? "", r.phone ?? ""].some((v) =>
            v.toLowerCase().includes(q),
          )
        )
          return false;
      } else {
        if (statusFilter && r.status !== statusFilter) return false;
        if (minRate !== null && r.daily_rate_minor < minRate) return false;
        if (maxRate !== null && r.daily_rate_minor > maxRate) return false;
        if (unpricedOnly && r.daily_rate_minor > 0) return false;
        if (functionsFilter.length) {
          const lowerFns = (r.functions ?? []).map((f) => f.toLowerCase());
          if (!functionsFilter.every((f) => lowerFns.includes(f))) return false;
        }
        if (
          q &&
          ![r.registration, r.make, r.model].some((v) =>
            v.toLowerCase().includes(q),
          )
        )
          return false;
      }
      return true;
    });

    if (includeStats) {
      if (domain === "customers") {
        items = items
          .map((c) => ({
            ...c,
            stats: computeCustomerStats(c, { from, to, canSeeFinance }),
          }))
          .filter((c) => {
            if (minSpend !== null && (c.stats.total_spent_minor ?? 0) < minSpend)
              return false;
            if (maxSpend !== null && (c.stats.total_spent_minor ?? 0) > maxSpend)
              return false;
            if (hasOpenAr && (c.stats.open_ar_minor ?? 0) <= 0) return false;
            return true;
          });
      } else {
        items = items
          .map((v) => ({
            ...v,
            stats: computeVehicleStats(v, { from, to, canSeeFinance }),
          }))
          .filter((v) => {
            if (
              idleDaysMin !== null &&
              (v.stats.idle_days === null || v.stats.idle_days < idleDaysMin)
            )
              return false;
            return true;
          });
      }
    }

    const sorted = sortItems(
      items,
      domain === "customers"
        ? {
            name: (r) => r.name,
            type: (r) => r.type,
            email: (r) => r.email,
            rental_count: (r) => r.stats?.rental_count ?? 0,
            total_spent_minor: (r) => r.stats?.total_spent_minor ?? 0,
            open_ar_minor: (r) => r.stats?.open_ar_minor ?? 0,
            last_rental_at: (r) => r.stats?.last_rental_at ?? "",
            id: (r) => r.id,
          }
        : {
            registration: (r) => r.registration,
            make: (r) => `${r.make} ${r.model}`,
            daily_rate_minor: (r) => r.daily_rate_minor,
            odometer: (r) => r.odometer,
            status: (r) => r.status,
            rental_count: (r) => r.stats?.rental_count ?? 0,
            utilization_pct: (r) => r.stats?.utilization_pct ?? 0,
            idle_days: (r) => r.stats?.idle_days ?? 0,
            revenue_minor: (r) => r.stats?.revenue_minor ?? 0,
            net_roi_minor: (r) => r.stats?.net_roi_minor ?? 0,
            id: (r) => r.id,
          },
    );

    const perPage = 25;
    const total = sorted.length;
    const lastPage = Math.max(1, Math.ceil(total / perPage));
    const pageNum = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
    const slice = sorted.slice((pageNum - 1) * perPage, pageNum * perPage);
    let summary = undefined;
    if (includeStats) {
      if (domain === "customers") {
        const activeRentalsCount = [...rentals.values()].filter(
          (r) =>
            r.company_id === companyId &&
            (branchId === null || r.branch_id === branchId) &&
            r.status === "active",
        ).length;
        summary = {
          total_customers: total,
          active_rentals_count: activeRentalsCount,
          total_spent_minor: canSeeFinance
            ? sorted.reduce((s, c) => s + (c.stats?.total_spent_minor ?? 0), 0)
            : null,
          total_open_ar_minor: canSeeFinance
            ? sorted.reduce((s, c) => s + (c.stats?.open_ar_minor ?? 0), 0)
            : null,
        };
      } else {
        summary = {
          total_vehicles: total,
          avg_utilization_pct:
            total > 0
              ? Math.round(
                  sorted.reduce((s, v) => s + (v.stats?.utilization_pct ?? 0), 0) /
                    total,
                )
              : 0,
          idle_over_14d_count: sorted.filter(
            (v) => (v.stats?.idle_days ?? 0) >= 14,
          ).length,
          unpriced_count: sorted.filter((v) => v.daily_rate_minor === 0).length,
          total_net_roi_minor: canSeeFinance
            ? sorted.reduce((s, v) => s + (v.stats?.net_roi_minor ?? 0), 0)
            : null,
        };
      }
    }
    json(200, {
      data: slice,
      meta: {
        current_page: pageNum,
        last_page: lastPage,
        per_page: perPage,
        total,
        ...(summary ? { summary } : {}),
      },
    });
    return;
  }
  if (req.method === "GET") {
    if (control.delay)
      await new Promise((resolve) => setTimeout(resolve, control.delay));
    const record = records.get(id);
    if (!record) fail(404);
    else json(200, { data: record });
    return;
  }
  if (
    !user.is_platform_admin &&
    !user.permissions.includes(`${domain}.manage`)
  ) {
    fail(403);
    return;
  }
  if (control.validation) {
    fail(
      422,
      domain === "customers"
        ? { name: ["Synthetic name rejection."] }
        : { registration: ["The registration has already been taken."] },
    );
    return;
  }
  if (control.conflict) {
    fail(409);
    return;
  }
  const recordId = id ?? nextId++;
  const old = records.get(recordId);
  if (req.method === "PATCH" && !old) {
    fail(404);
    return;
  }
  if (
    domain === "vehicles" &&
    req.method === "PATCH" &&
    typeof input.odometer === "number" &&
    input.odometer < old.odometer
  ) {
    fail(422, { odometer: ["Odometer cannot decrease."] });
    return;
  }
  if (domain === "vehicles" && Array.isArray(input.functions)) {
    const normalized = input.functions.map((item) =>
      typeof item === "string" ? item.trim().replace(/\s+/g, " ") : item,
    );
    if (normalized.length > 20) {
      fail(422, { functions: ["The functions field must not have more than 20 items."] });
      return;
    }
    const seen = new Set();
    for (let i = 0; i < normalized.length; i++) {
      const fn = normalized[i];
      if (typeof fn !== "string" || fn.length < 1 || fn.length > 50) {
        fail(422, { [`functions.${i}`]: ["Each function must be between 1 and 50 characters."] });
        return;
      }
      const key = fn.toLowerCase();
      if (seen.has(key)) {
        fail(422, { [`functions.${i}`]: ["Duplicate vehicle function."] });
        return;
      }
      seen.add(key);
    }
    input.functions = normalized;
  }
  const record = {
    ...base,
    ...(domain === "customers"
      ? { email: null, phone: null }
      : {
          year: null,
          status: "available",
          odometer: 0,
          odometer_unit: "km",
          daily_rate_minor: 0,
          functions: [],
        }),
    ...old,
    ...input,
    id: recordId,
    ...(domain === "vehicles" ? { odometer_unit: "km" } : {}),
    updated_at: new Date().toISOString(),
  };
  if (domain === "vehicles")
    record.registration = record.registration.toUpperCase();
  records.set(recordId, record);
  if (control.mutationDelay)
    await new Promise((resolve) => setTimeout(resolve, control.mutationDelay));
  completedWrites++;
  json(id ? 200 : 201, { data: record });
}).listen(fixturePort, "127.0.0.1");
