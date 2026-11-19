// Synthetic contract server, loopback only. Not Laravel and never a staging substitute.
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
let sessions = new Map();
let customers = new Map();
let vehicles = new Map();
let companies = new Map();
let branches = new Map();
let managedUsers = new Map();
let reservations = new Map();
let rentals = new Map();
let documents = new Map();
let documentBlobs = new Map();
let control = {};
let nextId = 20;
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
    ],
  },
  { name: "driver", permissions: ["companies.view", "branches.view"] },
  {
    name: "operations",
    permissions: [
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
    ],
  },
  {
    name: "viewer",
    permissions: [
      "companies.view",
      "branches.view",
      "customers.view",
      "vehicles.view",
      "reservations.view",
      "rentals.view",
      "documents.view",
    ],
  },
];

function reset() {
  companies = new Map([
    [1, { id: 1, name: "Synthetic One", currency: "ZMW" }],
    [3, { id: 3, name: "Synthetic Three", currency: "EUR" }],
  ]);
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

createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1:3201");
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
        : role === "viewer"
          ? [
              "customers.view",
              "vehicles.view",
              "branches.view",
              "reservations.view",
              "rentals.view",
              "documents.view",
            ]
          : [
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
              ...(["admin", "companyadmin", "restrictedadmin"].includes(role)
                ? [
                    "branches.view",
                    "branches.manage",
                    "companies.manage",
                    "users.view",
                    "users.manage",
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
      paginateSlice(items);
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
      paginateSlice(items);
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
      paginateSlice(items);
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
      paginateSlice(items);
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
    /^\/api\/v1\/(customers|vehicles)(?:\/(\d+))?$/,
  );
  if (!match) {
    fail(404);
    return;
  }
  const domain = match[1];
  const id = match[2] ? Number(match[2]) : null;
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
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const typeFilter = url.searchParams.get("type");
    const statusFilter = url.searchParams.get("status");
    collectionReads++;
    const items = [...records.values()].filter((r) => {
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
    paginateSlice(items);
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
}).listen(3201, "127.0.0.1");
