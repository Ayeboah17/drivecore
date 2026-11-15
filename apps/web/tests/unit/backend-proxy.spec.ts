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
test("proxy allowlist excludes tokens, deletes, arbitrary URLs and unscoped collections", async () => {
  for (const path of [
    "api/v1/auth/tokens",
    "https://elsewhere.test",
    "api/v1/customers",
    "api/v1/vehicles",
    "api/v1/../users",
    "api/v1/documents/1",
  ])
    expect(allowedPath("GET", path)).toBe(false);
  expect(allowedPath("DELETE", "api/v1/customers/1")).toBe(false);
  expect(allowedPath("PATCH", "api/v1/vehicles/1")).toBe(true);
  const rejected = await proxy(
    make("api/v1/customers?company_id=1"),
    "api/v1/customers",
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

test("collection paging, search and proposed scope parameters cannot bypass the closed allowlist", async () => {
  let calls = 0;
  for (const domain of ["customers", "vehicles"]) {
    for (const query of [
      "page=2",
      "search=synthetic",
      "company_id=1&branch_id=2&page=1",
      "company_id=1&branch=all",
    ]) {
      const response = await proxy(
        make(`api/v1/${domain}?${query}`),
        `api/v1/${domain}`,
        config,
        async () => {
          calls++;
          return Response.json({ data: [] });
        },
      );
      expect(response.status).toBe(404);
      expect(response.headers.get("cache-control")).toContain("no-store");
    }
  }
  expect(calls).toBe(0);
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
