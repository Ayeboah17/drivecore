// Synthetic contract server, loopback only. Not Laravel and never a staging substitute.
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
let sessions = new Map();
let customers = new Map();
let vehicles = new Map();
let companies = new Map();
let branches = new Map();
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
        email: null,
        phone: null,
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
        status: "rented",
      },
    ],
  ]);
}
reset();
createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1:3201");
  const json = (status, value) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(value));
  };
  const fail = (status, errors = {}) =>
    json(status, { message: "Synthetic rejection", errors });
  let text = "";
  for await (const chunk of req) {
    text += chunk;
    if (text.length > 70000) {
      req.destroy();
      return;
    }
  }
  let input = {};
  try {
    input = text ? JSON.parse(text) : {};
  } catch {
    fail(400);
    return;
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
      role === "driver"
        ? []
        : role === "viewer"
          ? ["customers.view", "vehicles.view", "branches.view"]
          : [
              "customers.view",
              "customers.manage",
              "vehicles.view",
              "vehicles.manage",
              ...(["admin", "companyadmin", "restrictedadmin"].includes(role)
                ? ["branches.view", "branches.manage", "companies.manage"]
                : []),
            ];
    const user = {
      id: 1,
      name: "Synthetic operator",
      email: "synthetic@example.test",
      roles: [role],
      is_platform_admin: role === "admin",
      permissions,
      companies:
        role === "admin"
          ? []
          : role === "driver"
            ? []
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
    const records = [...companies.values()];
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
    paginate([...branches.values()]);
    return;
  }
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
    collectionReads++;
    paginate([...records.values()]);
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
  const record = {
    ...base,
    ...(domain === "customers"
      ? { email: null, phone: null }
      : { year: null, status: "available", odometer: 0 }),
    ...old,
    ...input,
    id: recordId,
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
