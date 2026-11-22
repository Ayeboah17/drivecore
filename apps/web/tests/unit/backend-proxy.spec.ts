import { test, expect } from "@playwright/test";
import {
  allowedPath,
  proxy,
  browserCookie,
  forwardedCookies,
  type ProxyConfig,
} from "../../src/lib/server/backend-proxy";
const config: ProxyConfig = {
  backend: "https://api.example.test",
  app: "https://app.example.test",
  cookie: "test_session",
  timeout: 100,
};
const make = (
  path: string,
  method = "GET",
  headers: Record<string, string> = {},
) =>
  new Request(`https://app.example.test/api/backend/${path}`, {
    method,
    headers: {
      origin: config.app,
      "content-type": "application/json",
      "x-xsrf-token": "synthetic",
      ...headers,
    },
    ...(method === "GET" ? {} : { body: "{}" }),
  });
test("proxy allowlist excludes tokens, deletes, arbitrary URLs and unsupported domains", async () => {
  for (const path of [
    "api/v1/auth/tokens",
    "https://elsewhere.test",
    "api/v1/../users",
    "api/v1/gps-trackers",
    "api/v1/telematics",
  ])
    expect(allowedPath("GET", path)).toBe(false);
  expect(allowedPath("DELETE", "api/v1/customers/1")).toBe(false);
  expect(allowedPath("DELETE", "api/v1/documents/1")).toBe(false);
  expect(allowedPath("GET", "api/v1/customers")).toBe(true);
  expect(allowedPath("GET", "api/v1/vehicles")).toBe(true);
  expect(allowedPath("GET", "api/v1/reservations")).toBe(true);
  expect(allowedPath("POST", "api/v1/reservations/1/cancel")).toBe(true);
  expect(allowedPath("GET", "api/v1/rentals")).toBe(true);
  expect(allowedPath("POST", "api/v1/rentals/1/handover")).toBe(true);
  expect(allowedPath("POST", "api/v1/rentals/1/extend")).toBe(true);
  expect(allowedPath("POST", "api/v1/rentals/1/return")).toBe(true);
  expect(allowedPath("POST", "api/v1/rentals/1/assign-driver")).toBe(true);
  expect(allowedPath("GET", "api/v1/documents")).toBe(true);
  expect(allowedPath("GET", "api/v1/documents/1")).toBe(true);
  expect(allowedPath("POST", "api/v1/documents")).toBe(true);
  expect(allowedPath("GET", "api/v1/users")).toBe(true);
  expect(allowedPath("GET", "api/v1/roles")).toBe(true);
  expect(allowedPath("POST", "api/v1/users")).toBe(true);
  expect(allowedPath("PATCH", "api/v1/users/1")).toBe(true);
  expect(allowedPath("PATCH", "api/v1/vehicles/1")).toBe(true);
  const rejected = await proxy(
    make("api/v1/gps-trackers"),
    "api/v1/gps-trackers",
    config,
    async () => {
      throw new Error("Must not call upstream");
    },
  );
  expect(rejected.status).toBe(404);
});
test("mutations require exact Origin, XSRF header, JSON and bounded body", async () => {
  expect(
    (
      await proxy(
        make("api/v1/auth/login", "POST", { origin: "https://evil.test" }),
        "api/v1/auth/login",
        config,
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await proxy(
        make("api/v1/auth/login", "POST", { "x-xsrf-token": "" }),
        "api/v1/auth/login",
        config,
      )
    ).status,
  ).toBe(419);
  expect(
    (
      await proxy(
        make("api/v1/auth/login", "POST", { "content-type": "text/plain" }),
        "api/v1/auth/login",
        config,
      )
    ).status,
  ).toBe(415);
  expect(
    (
      await proxy(
        make("api/v1/auth/login", "POST", { "content-length": "65537" }),
        "api/v1/auth/login",
        config,
      )
    ).status,
  ).toBe(413);
});
test("only page is accepted for directory queries", async () => {
  expect(
    (
      await proxy(
        make("api/v1/branches?page=1&page=2"),
        "api/v1/branches",
        config,
      )
    ).status,
  ).toBe(400);
  expect(
    (await proxy(make("api/v1/branches?search=x"), "api/v1/branches", config))
      .status,
  ).toBe(400);
});
test("only Laravel cookies and trusted headers reach fixed upstream; two cookies survive", async () => {
  const response = await proxy(
    make("api/v1/auth/login", "POST", {
      cookie: "test_session=synthetic; XSRF-TOKEN=synthetic; unrelated=omit",
      authorization: "must-not-forward",
      "x-forwarded-for": "untrusted",
    }),
    "api/v1/auth/login",
    config,
    async (url, init) => {
      expect(String(url)).toBe("https://api.example.test/api/v1/auth/login");
      const headers = new Headers(init?.headers);
      expect(headers.get("authorization")).toBeNull();
      expect(headers.get("x-forwarded-for")).toBeNull();
      expect(headers.get("origin")).toBe(config.app);
      expect(headers.get("cookie")).toBe(
        "test_session=synthetic; XSRF-TOKEN=synthetic",
      );
      expect(init?.redirect).toBe("manual");
      expect(init?.cache).toBe("no-store");
      const output = new Headers({ "Content-Type": "application/json" });
      output.append(
        "Set-Cookie",
        "test_session=rotated; Domain=api.example.test; Path=/; SameSite=None",
      );
      output.append("Set-Cookie", "XSRF-TOKEN=rotated; Path=/");
      return new Response('{"data":{}}', { headers: output });
    },
  );
  expect(response.headers.getSetCookie()).toHaveLength(2);
  expect(response.headers.getSetCookie()[0]).toContain("HttpOnly");
  expect(response.headers.getSetCookie()[0]).not.toContain("Domain=");
  expect(response.headers.getSetCookie()[1]).not.toContain("HttpOnly");
  expect(response.headers.get("cache-control")).toContain("private, no-store");
});
test("HTML, malformed JSON and redirects never relay upstream contents", async () => {
  for (const upstream of [
    new Response("internal details", {
      headers: { "Content-Type": "text/html" },
    }),
    new Response("broken", { headers: { "Content-Type": "application/json" } }),
    new Response(null, {
      status: 302,
      headers: { location: "https://evil.test" },
    }),
  ]) {
    const result = await proxy(
      make("api/v1/auth/me"),
      "api/v1/auth/me",
      config,
      async () => upstream,
    );
    expect(result.status).toBe(502);
    expect(await result.text()).not.toContain("internal details");
  }
});
test("timeout is bounded and failed requests are never retried", async () => {
  let attempts = 0;
  const result = await proxy(
    make("api/v1/auth/login", "POST"),
    "api/v1/auth/login",
    config,
    async (_url, init) => {
      attempts++;
      return new Promise<Response>((_resolve, reject) =>
        init?.signal?.addEventListener("abort", () =>
          reject(new Error("aborted")),
        ),
      );
    },
  );
  expect(result.status).toBe(504);
  expect(attempts).toBe(1);
});
test("upstream CSRF errors, validation and throttling preserve status without internal details", async () => {
  for (const status of [401, 403, 419, 422, 426, 429, 500]) {
    const result = await proxy(
      make("api/v1/auth/login", "POST"),
      "api/v1/auth/login",
      config,
      async () =>
        Response.json(
          {
            message: "internal diagnostics",
            errors: { email: ["Invalid email."] },
          },
          { status, headers: { "Retry-After": "30" } },
        ),
    );
    expect(result.status).toBe(status);
    expect(result.headers.get("retry-after")).toBe("30");
    expect(await result.text()).not.toContain("internal diagnostics");
  }
});
test("cookie policy strips domain and enforces host-only Secure/HttpOnly/SameSite", () => {
  expect(browserCookie("unknown=x", config)).toBeNull();
  expect(
    browserCookie(
      "test_session=x; Domain=.example.test; SameSite=None",
      config,
    ),
  ).toBe("test_session=x; Path=/; SameSite=Lax; Secure; HttpOnly");
  expect(
    forwardedCookies(
      "other=x; test_session=synthetic; XSRF-TOKEN=synthetic",
      config.cookie,
    ),
  ).not.toContain("other");
});

test("scoped collections require company_id and validate filters while rejecting unknown query params", async () => {
  let calls = 0;
  for (const invalid of [
    { path: "api/v1/customers", query: "" },
    { path: "api/v1/customers", query: "page=2" },
    { path: "api/v1/customers", query: "company_id=1&search=synthetic" },
    { path: "api/v1/customers", query: "company_id=1&type=invalid" },
    { path: "api/v1/vehicles", query: "company_id=1&branch=all" },
    { path: "api/v1/vehicles", query: "company_id=1&status=unknown" },
    { path: "api/v1/users", query: "role=driver" },
    { path: "api/v1/users", query: "company_id=1&role=platform-admin" },
    { path: "api/v1/users", query: "company_id=1&is_active=maybe" },
    { path: "api/v1/roles", query: "" },
    { path: "api/v1/branches", query: "branch_id=2" },
  ]) {
    const suffix = invalid.query ? `?${invalid.query}` : "";
    const response = await proxy(
      make(`${invalid.path}${suffix}`),
      invalid.path,
      config,
      async () => {
        calls++;
        return Response.json({ data: [] });
      },
    );
    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toContain("no-store");
  }
  expect(calls).toBe(0);

  for (const valid of [
    "api/v1/customers?company_id=1&branch_id=2&type=corporate&q=apex&page=1",
    "api/v1/vehicles?company_id=1&status=maintenance&q=toyota&page=2",
    "api/v1/users?company_id=1&role=driver&is_active=1&q=fleet",
    "api/v1/roles?company_id=1",
    "api/v1/branches?company_id=1&q=main",
  ]) {
    const [path] = valid.split("?");
    const response = await proxy(make(valid), path, config, async (url) => {
      expect(String(url)).toBe(`https://api.example.test/${valid}`);
      return Response.json({ data: [] });
    });
    expect(response.status).toBe(200);
  }
  for (const postPath of ["api/v1/customers", "api/v1/vehicles", "api/v1/users"]) {
    const okPost = await proxy(
      make(postPath, "POST"),
      postPath,
      config,
      async () => Response.json({ data: {} }, { status: 201 }),
    );
    expect(okPost.status).toBe(201);
    const badPost = await proxy(
      make(`${postPath}?company_id=1`, "POST"),
      postPath,
      config,
      async () => Response.json({ data: {} }, { status: 201 }),
    );
    expect(badPost.status).toBe(400);
  }
});

test("multi-origin config accepts all allowlisted origins on mutations and rejects others", async () => {
  const multiConfig: ProxyConfig = {
    backend: "https://api.example.test",
    app: "https://www.example.test",
    apps: ["https://www.example.test", "https://example.test"],
    cookie: "drivecore-session",
    timeout: 100,
  };
  let seenHeaders: Headers | null = null;
  const ok = await proxy(
    new Request("https://example.test/api/backend/api/v1/auth/login", {
      method: "POST",
      headers: {
        origin: "https://example.test",
        "content-type": "application/json",
        "x-xsrf-token": "synthetic",
      },
      body: "{}",
    }),
    "api/v1/auth/login",
    multiConfig,
    async (_url, init) => {
      seenHeaders = new Headers(init?.headers);
      return Response.json({ data: { ok: true } });
    },
  );
  expect(ok.status).toBe(200);
  expect(seenHeaders!.get("origin")).toBe("https://example.test");
  expect(seenHeaders!.get("referer")).toBe("https://example.test/");

  const rejected = await proxy(
    make("api/v1/auth/login", "POST", { origin: "https://evil.example.test" }),
    "api/v1/auth/login",
    multiConfig,
  );
  expect(rejected.status).toBe(403);
});

test("session reads without Origin or Referer use their trusted request host", async () => {
  const production = "https://drivecore.innovize-tech.com";
  const multiOrigin = {
    ...config,
    app: "https://drivecore-zeta.vercel.app",
    apps: ["https://drivecore-zeta.vercel.app", production],
  };
  const response = await proxy(
    new Request(`${production}/api/backend/api/v1/auth/me`, {
      headers: { cookie: "test_session=rotated" },
    }),
    "api/v1/auth/me",
    multiOrigin,
    async (_url, init) => {
      const headers = new Headers(init?.headers);
      expect(headers.get("origin")).toBe(production);
      expect(headers.get("referer")).toBe(`${production}/`);
      expect(headers.get("cookie")).toBe("test_session=rotated");
      return Response.json({ data: {} });
    },
  );
  expect(response.status).toBe(200);
});

test("M6 reservations, rentals, and documents validate scoped queries, multipart upload, and binary download", async () => {
  for (const invalid of [
    "api/v1/reservations",
    "api/v1/reservations?company_id=1&status=invalid",
    "api/v1/rentals",
    "api/v1/rentals?company_id=1&status=unknown",
    "api/v1/documents",
    "api/v1/documents?company_id=1&entity_id=5",
    "api/v1/documents?company_id=1&entity_type=unknown",
  ]) {
    const [path] = invalid.split("?");
    const res = await proxy(make(invalid), path, config, async () => {
      throw new Error("Must not reach upstream");
    });
    expect(res.status).toBe(400);
  }

  for (const valid of [
    "api/v1/reservations?company_id=1&status=confirmed&page=1",
    "api/v1/rentals?company_id=1&status=active&driver_user_id=2",
    "api/v1/documents?company_id=1&entity_type=vehicle&entity_id=10",
  ]) {
    const [path] = valid.split("?");
    const res = await proxy(make(valid), path, config, async () =>
      Response.json({ data: [] }),
    );
    expect(res.status).toBe(200);
  }

  // Document upload requires multipart/form-data
  const jsonDoc = await proxy(
    make("api/v1/documents", "POST"),
    "api/v1/documents",
    config,
  );
  expect(jsonDoc.status).toBe(415);

  const multipartReq = new Request(
    "https://app.example.test/api/backend/api/v1/documents",
    {
      method: "POST",
      headers: {
        origin: config.app,
        "content-type": "multipart/form-data; boundary=----dc-boundary",
        "x-xsrf-token": "synthetic",
      },
      body: "------dc-boundary--",
    },
  );
  const uploadOk = await proxy(
    multipartReq,
    "api/v1/documents",
    config,
    async (_url, init) => {
      const h = new Headers(init?.headers);
      expect(h.get("content-type")).toContain("multipart/form-data");
      return Response.json({ data: { id: 1 } }, { status: 201 });
    },
  );
  expect(uploadOk.status).toBe(201);

  // Binary PDF download streams safely with nosniff + attachment; HTML is rejected 502
  const pdfDownload = await proxy(
    make("api/v1/documents/1"),
    "api/v1/documents/1",
    config,
    async () =>
      new Response("%PDF-1.4\n%%EOF", {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": 'attachment; filename="document-1.pdf"',
        },
      }),
  );
  expect(pdfDownload.status).toBe(200);
  expect(pdfDownload.headers.get("content-type")).toBe("application/pdf");
  expect(pdfDownload.headers.get("x-content-type-options")).toBe("nosniff");
  expect(pdfDownload.headers.get("cache-control")).toContain("no-store");
  expect(await pdfDownload.text()).toContain("%PDF-1.4");

  const htmlDownload = await proxy(
    make("api/v1/documents/1"),
    "api/v1/documents/1",
    config,
    async () =>
      new Response("<script>alert(1)</script>", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      }),
  );
  expect(htmlDownload.status).toBe(502);
});

test("M7 quotations, company settings, and PDF exports enforce scoped queries and binary streaming", async () => {
  for (const invalid of [
    "api/v1/quotations",
    "api/v1/quotations?company_id=1&status=invalid",
    "api/v1/quotations/1/pdf?foo=bar",
  ]) {
    const [path] = invalid.split("?");
    const res = await proxy(make(invalid), path, config, async () => {
      throw new Error("Must not reach upstream");
    });
    expect(res.status).toBe(400);
  }

  for (const valid of [
    "api/v1/companies/1/settings",
    "api/v1/quotations?company_id=1&status=pending_approval&page=1",
    "api/v1/quotations/5",
  ]) {
    const [path] = valid.split("?");
    const res = await proxy(make(valid), path, config, async () =>
      Response.json({ data: {} }),
    );
    expect(res.status).toBe(200);
  }

  const pdfRes = await proxy(
    make("api/v1/quotations/5/pdf?download=1"),
    "api/v1/quotations/5/pdf",
    config,
    async () =>
      new Response("%PDF-1.4\n%%EOF", {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": 'attachment; filename="quotation-5.pdf"',
        },
      }),
  );
  expect(pdfRes.status).toBe(200);
  expect(pdfRes.headers.get("content-type")).toBe("application/pdf");
  expect(pdfRes.headers.get("x-content-type-options")).toBe("nosniff");
  expect(await pdfRes.text()).toContain("%PDF-1.4");
});

test("collection sorting enforces per-endpoint allowlists and valid direction pairs", async () => {
  for (const invalid of [
    "api/v1/customers?company_id=1&sort=password&dir=asc",
    "api/v1/customers?company_id=1&dir=asc",
    "api/v1/customers?company_id=1&sort=name&dir=sideways",
    "api/v1/vehicles?company_id=1&sort=email&dir=asc",
    "api/v1/quotations?company_id=1&sort=unknown&dir=desc",
    "api/v1/reservations?company_id=1&sort=total_minor&dir=asc",
    "api/v1/rentals?company_id=1&sort=email&dir=desc",
    "api/v1/documents?company_id=1&sort=status&dir=asc",
    "api/v1/users?company_id=1&sort=registration&dir=asc",
  ]) {
    const [path] = invalid.split("?");
    const res = await proxy(make(invalid), path, config, async () => {
      throw new Error("Must not reach upstream");
    });
    expect(res.status).toBe(400);
  }

  for (const valid of [
    "api/v1/customers?company_id=1&sort=name&dir=asc",
    "api/v1/vehicles?company_id=1&sort=daily_rate_minor&dir=desc",
    "api/v1/quotations?company_id=1&sort=total_minor&dir=desc",
    "api/v1/reservations?company_id=1&sort=starts_at&dir=asc",
    "api/v1/rentals?company_id=1&sort=driver_name&dir=asc",
    "api/v1/documents?company_id=1&sort=expires_at&dir=desc",
    "api/v1/users?company_id=1&sort=is_active&dir=desc",
    "api/v1/invoices?company_id=1&sort=total_minor&dir=desc",
    "api/v1/payments?company_id=1&sort=paid_at&dir=desc",
    "api/v1/refunds?company_id=1&sort=refunded_at&dir=desc",
    "api/v1/expenses?company_id=1&sort=amount_minor&dir=desc",
  ]) {
    const [path] = valid.split("?");
    const res = await proxy(make(valid), path, config, async (url) => {
      expect(String(url)).toBe(`https://api.example.test/${valid}`);
      return Response.json({ data: [] });
    });
    expect(res.status).toBe(200);
  }
});

test("M8 finance, AR ageing, GL, and invoice PDF routes enforce scoped queries and binary streaming", async () => {
  for (const invalid of [
    "api/v1/invoices",
    "api/v1/invoices?company_id=1&status=bogus",
    "api/v1/invoices?company_id=1&ageing_bucket=bad",
    "api/v1/invoices/ageing",
    "api/v1/payments?company_id=1&method=crypto",
    "api/v1/expenses?company_id=1&category=yacht",
    "api/v1/gl/accounts",
    "api/v1/gl/journal-entries?company_id=1&source_type=unknown",
    "api/v1/invoices/5/pdf?bad=1",
  ]) {
    const [path] = invalid.split("?");
    const res = await proxy(make(invalid), path, config, async () => {
      throw new Error("Must not reach upstream");
    });
    expect(res.status).toBe(400);
  }

  for (const valid of [
    "api/v1/invoices?company_id=1&status=overdue&ageing_bucket=d31_60&page=1",
    "api/v1/invoices/ageing?company_id=1&branch_id=2",
    "api/v1/payments?company_id=1&method=mobile_money",
    "api/v1/refunds?company_id=1",
    "api/v1/expenses?company_id=1&category=fuel",
    "api/v1/gl/accounts?company_id=1",
    "api/v1/gl/journal-entries?company_id=1&source_type=invoice&account_code=1100",
  ]) {
    const [path] = valid.split("?");
    const res = await proxy(make(valid), path, config, async () =>
      Response.json({ data: {} }),
    );
    expect(res.status).toBe(200);
  }

  const pdfRes = await proxy(
    make("api/v1/invoices/12/pdf?download=1"),
    "api/v1/invoices/12/pdf",
    config,
    async () =>
      new Response("%PDF-1.4\n%%EOF", {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": 'attachment; filename="invoice-12.pdf"',
        },
      }),
  );
  expect(pdfRes.status).toBe(200);
  expect(pdfRes.headers.get("content-type")).toBe("application/pdf");
  expect(pdfRes.headers.get("x-content-type-options")).toBe("nosniff");
  expect(await pdfRes.text()).toContain("%PDF-1.4");
});

test("M9 maintenance, inventory, procurement, and vehicle 360 routes enforce scoped queries and allowlists", async () => {
  for (const invalid of [
    "api/v1/work-orders",
    "api/v1/work-orders?company_id=1&status=bogus",
    "api/v1/parts",
    "api/v1/parts?company_id=1&low_stock_only=maybe",
    "api/v1/stock-movements",
    "api/v1/suppliers",
    "api/v1/purchase-orders",
    "api/v1/purchase-orders?company_id=1&status=shipped",
  ]) {
    const [path] = invalid.split("?");
    const res = await proxy(make(invalid), path, config, async () => {
      throw new Error("Must not reach upstream");
    });
    expect(res.status).toBe(400);
  }

  for (const valid of [
    "api/v1/work-orders?company_id=1&status=in_progress&sort=due_at&dir=asc",
    "api/v1/parts?company_id=1&low_stock_only=1&sort=on_hand&dir=asc",
    "api/v1/stock-movements?company_id=1&sort=created_at&dir=desc",
    "api/v1/suppliers?company_id=1&is_active=1&sort=name&dir=asc",
    "api/v1/purchase-orders?company_id=1&status=approved&sort=total_minor&dir=desc",
    "api/v1/vehicles/10/summary",
  ]) {
    const [path] = valid.split("?");
    const res = await proxy(make(valid), path, config, async () =>
      Response.json({ data: {} }),
    );
    expect(res.status).toBe(200);
  }
});

test("M10 dashboard summary, messages, notifications, reports and audit routes enforce scoped queries", async () => {
  for (const invalid of [
    "api/v1/dashboard/summary",
    "api/v1/dashboard/summary?company_id=1&from=bad-date",
    "api/v1/messages",
    "api/v1/messages?company_id=1&channel=secret",
    "api/v1/notifications",
    "api/v1/reports/financial",
    "api/v1/reports/fleet?company_id=1&to=not-a-date",
    "api/v1/audit-events",
  ]) {
    const [path] = invalid.split("?");
    const res = await proxy(make(invalid), path, config, async () => {
      throw new Error("Must not reach upstream");
    });
    expect(res.status).toBe(400);
  }

  for (const valid of [
    "api/v1/dashboard/summary?company_id=1&from=2026-10-01&to=2026-11-22",
    "api/v1/messages?company_id=1&channel=drivers",
    "api/v1/notifications?company_id=1&unread_only=1",
    "api/v1/reports/financial?company_id=1&branch_id=2",
    "api/v1/reports/fleet?company_id=1",
    "api/v1/audit-events?company_id=1&action=rental.handed_over",
  ]) {
    const [path] = valid.split("?");
    const res = await proxy(make(valid), path, config, async () =>
      Response.json({ data: {} }),
    );
    expect(res.status).toBe(200);
  }
});

test("M11 detailed stats, customer 360, and saved-filters routes enforce allowlists and strict DELETE scoping", async () => {
  for (const invalid of [
    "api/v1/stats/customers",
    "api/v1/stats/customers?company_id=1&min_spend_minor=-5",
    "api/v1/stats/customers?company_id=1&sort=bogus&dir=desc",
    "api/v1/stats/vehicles?company_id=1&idle_days_min=abc",
    "api/v1/stats/branches",
    "api/v1/saved-filters?company_id=1&module=unknown",
  ]) {
    const [path] = invalid.split("?");
    const res = await proxy(make(invalid), path, config, async () => {
      throw new Error("Must not reach upstream");
    });
    expect(res.status).toBe(400);
  }

  for (const valid of [
    "api/v1/stats/customers?company_id=1&from=2026-10-01&to=2026-11-22&min_spend_minor=50000&has_open_ar=1&sort=total_spent_minor&dir=desc",
    "api/v1/stats/vehicles?company_id=1&idle_days_min=14&unpriced_only=1&sort=net_roi_minor&dir=desc",
    "api/v1/stats/branches?company_id=1&from=2026-10-01&to=2026-11-22",
    "api/v1/customers/10/summary",
    "api/v1/saved-filters?company_id=1&module=stats_customers",
  ]) {
    const [path] = valid.split("?");
    const res = await proxy(make(valid), path, config, async () =>
      Response.json({ data: {} }),
    );
    expect(res.status).toBe(200);
  }

  // DELETE allowed ONLY on saved-filters/{id}, rejected on customers/{id}
  const delAllowed = await proxy(
    make("api/v1/saved-filters/5", "DELETE"),
    "api/v1/saved-filters/5",
    config,
    async () => new Response(null, { status: 204 }),
  );
  expect(delAllowed.status).toBe(204);

  const delBlocked = await proxy(
    make("api/v1/customers/10", "DELETE"),
    "api/v1/customers/10",
    config,
    async () => {
      throw new Error("Must not reach upstream");
    },
  );
  expect(delBlocked.status).toBe(404);
});

test("M12 invitations, password reset, and account profile/security routes enforce allowlists and token validation", async () => {
  for (const invalid of [
    "api/v1/invitations",
    "api/v1/invitations?company_id=1&status=bogus",
    "api/v1/invitations/preview",
    "api/v1/invitations/preview?token=short",
    "api/v1/invitations/preview?token=bad!token$chars1234567890",
  ]) {
    const [path] = invalid.split("?");
    const res = await proxy(make(invalid), path, config, async () => {
      throw new Error("Must not reach upstream");
    });
    expect(res.status).toBe(400);
  }

  for (const valid of [
    "api/v1/invitations?company_id=1&status=pending",
    "api/v1/invitations/preview?token=abcdef1234567890abcdef1234567890",
  ]) {
    const [path] = valid.split("?");
    const res = await proxy(make(valid), path, config, async () =>
      Response.json({ data: {} }),
    );
    expect(res.status).toBe(200);
  }

  for (const [method, path] of [
    ["POST", "api/v1/invitations"],
    ["POST", "api/v1/invitations/accept"],
    ["POST", "api/v1/invitations/7/resend"],
    ["POST", "api/v1/invitations/7/revoke"],
    ["POST", "api/v1/auth/forgot-password"],
    ["POST", "api/v1/auth/reset-password"],
    ["POST", "api/v1/auth/change-password"],
    ["PATCH", "api/v1/auth/profile"],
  ] as const) {
    const res = await proxy(make(path, method), path, config, async () =>
      Response.json({ data: {} }),
    );
    expect(res.status).toBe(200);
  }
});
