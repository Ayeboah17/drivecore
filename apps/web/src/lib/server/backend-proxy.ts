// Imported only by the server Route Handler. Never exposes backend configuration to clients.
export interface ProxyConfig {
  backend: string;
  app: string;
  apps?: readonly string[];
  cookie: string;
  timeout: number;
}
function appOrigins(config: ProxyConfig): readonly string[] {
  return config.apps?.length ? config.apps : [config.app];
}
function resolvedAppOrigin(request: Request, config: ProxyConfig): string {
  const allowed = appOrigins(config);
  const requestOrigin = request.headers.get("origin");
  if (requestOrigin && allowed.includes(requestOrigin)) return requestOrigin;
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      if (allowed.includes(refererOrigin)) return refererOrigin;
    } catch {
      // Ignore malformed referer headers.
    }
  }
  const urlOrigin = new URL(request.url).origin;
  if (allowed.includes(urlOrigin)) return urlOrigin;
  return allowed[0];
}
const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie",
  "X-Content-Type-Options": "nosniff",
};
function failure(status: number, message: string) {
  return Response.json(
    { message, errors: {} },
    { status, headers: privateHeaders },
  );
}
export function allowedPath(method: string, path: string) {
  if (method === "GET")
    return /^(sanctum\/csrf-cookie|api\/v1\/(health|auth\/me|companies|branches|customers|customers\/[1-9]\d*|vehicles|vehicles\/[1-9]\d*|users|roles))$/.test(
      path,
    );
  if (method === "POST")
    return /^api\/v1\/(auth\/(login|logout)|companies|branches|customers|vehicles|users)$/.test(
      path,
    );
  return (
    method === "PATCH" &&
    /^api\/v1\/(customers|vehicles|users)\/[1-9]\d*$/.test(path)
  );
}

const posInt = (value: string) =>
  /^[1-9]\d{0,14}$/.test(value) && Number.isSafeInteger(Number(value));
const validPage = (value: string) =>
  /^[1-9]\d{0,6}$/.test(value) && Number(value) >= 1 && Number(value) <= 1000000;

export function allowedQuery(
  method: string,
  path: string,
  params: URLSearchParams,
): boolean {
  const keys = [...params.keys()];
  if (keys.length === 0) {
    return (
      method !== "GET" ||
      !/^api\/v1\/(customers|vehicles|users|roles)$/.test(path)
    );
  }
  if (method !== "GET") return false;
  const uniqueKeys = new Set(keys);
  if (uniqueKeys.size !== keys.length) return false;

  const checkCommon = (allowed: readonly string[], requireCompany: boolean) => {
    for (const key of uniqueKeys) {
      if (!allowed.includes(key)) return false;
    }
    const companyId = params.get("company_id");
    const branchId = params.get("branch_id");
    const page = params.get("page");
    const q = params.get("q");
    if (requireCompany && (!companyId || !posInt(companyId))) return false;
    if (companyId !== null && !posInt(companyId)) return false;
    if (branchId !== null && (!companyId || !posInt(branchId))) return false;
    if (page !== null && !validPage(page)) return false;
    if (q !== null && q.length > 100) return false;
    return true;
  };

  if (path === "api/v1/companies") {
    return checkCommon(["q", "page"], false);
  }
  if (path === "api/v1/branches") {
    return checkCommon(["company_id", "branch_id", "q", "page"], false);
  }
  if (path === "api/v1/customers") {
    if (!checkCommon(["company_id", "branch_id", "type", "q", "page"], true))
      return false;
    const type = params.get("type");
    return type === null || ["individual", "corporate"].includes(type);
  }
  if (path === "api/v1/vehicles") {
    if (!checkCommon(["company_id", "branch_id", "status", "q", "page"], true))
      return false;
    const status = params.get("status");
    return (
      status === null ||
      ["available", "rented", "maintenance", "damaged"].includes(status)
    );
  }
  if (path === "api/v1/users") {
    if (
      !checkCommon(
        ["company_id", "branch_id", "role", "is_active", "q", "page"],
        true,
      )
    )
      return false;
    const role = params.get("role");
    const isActive = params.get("is_active");
    if (
      role !== null &&
      !["company-admin", "operations", "viewer", "driver"].includes(role)
    )
      return false;
    if (
      isActive !== null &&
      !["0", "1", "true", "false"].includes(isActive)
    )
      return false;
    return true;
  }
  if (path === "api/v1/roles") {
    return checkCommon(["company_id"], true);
  }
  return false;
}
export function forwardedCookies(raw: string, name: string) {
  return raw
    .split(";")
    .map((p) => p.trim())
    .filter((p) => p.startsWith(`${name}=`) || p.startsWith("XSRF-TOKEN="))
    .join("; ");
}
export function browserCookie(raw: string, config: ProxyConfig): string | null {
  const parts = raw.split(";").map((p) => p.trim());
  const name = parts[0]?.split("=")[0];
  if (name !== config.cookie && name !== "XSRF-TOKEN") return null;
  const retained = parts.slice(1).filter((p) => /^(Expires|Max-Age)=/i.test(p));
  return [
    parts[0],
    ...retained,
    "Path=/",
    "SameSite=Lax",
    ...(appOrigins(config).some((item) => new URL(item).protocol === "https:")
      ? ["Secure"]
      : []),
    ...(name === config.cookie ? ["HttpOnly"] : []),
  ].join("; ");
}
async function limitedBody(
  stream: ReadableStream<Uint8Array> | null,
  limit: number,
  signal: AbortSignal,
) {
  if (!stream) return new Uint8Array();
  const reader = stream.getReader();
  const cancel = () => {
    void reader.cancel();
  };
  signal.addEventListener("abort", cancel, { once: true });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (signal.aborted) throw new Error("Request aborted");
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new RangeError("Body too large");
      }
      chunks.push(value);
    }
  } finally {
    signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
export async function proxy(
  request: Request,
  path: string,
  config: ProxyConfig,
  transport: typeof fetch = fetch,
) {
  if (
    !allowedPath(request.method, path) ||
    path.includes("%") ||
    path.includes("\\")
  )
    return failure(404, "Unsupported API operation.");
  const url = new URL(request.url);
  if (!allowedQuery(request.method, path, url.searchParams))
    return failure(400, "Unsupported query parameters.");
  const mutation = request.method !== "GET";
  const allowed = appOrigins(config);
  const requestOrigin = request.headers.get("origin");
  if (mutation && (!requestOrigin || !allowed.includes(requestOrigin)))
    return failure(403, "Invalid request origin.");
  if (mutation && !request.headers.get("x-xsrf-token"))
    return failure(419, "CSRF verification required.");
  if (
    mutation &&
    !/^application\/json(?:;|$)/i.test(
      request.headers.get("content-type") ?? "",
    )
  )
    return failure(415, "JSON is required.");
  if (Number(request.headers.get("content-length") ?? 0) > 65536)
    return failure(413, "Request too large.");
  const controller = new AbortController();
  const abort = () => controller.abort();
  request.signal.addEventListener("abort", abort, { once: true });
  if (request.signal.aborted) controller.abort();
  const timer = setTimeout(abort, config.timeout);
  try {
    let body: string | undefined;
    if (mutation) {
      try {
        body = new TextDecoder().decode(
          await limitedBody(request.body, 65536, controller.signal),
        );
        JSON.parse(body);
      } catch (error) {
        return failure(
          controller.signal.aborted
            ? 504
            : error instanceof RangeError
              ? 413
              : 400,
          "Invalid request body.",
        );
      }
    }
    const activeOrigin = resolvedAppOrigin(request, config);
    const headers = new Headers({
      Accept: "application/json",
      Origin: activeOrigin,
      Referer: `${activeOrigin}/`,
      "X-Requested-With": "XMLHttpRequest",
    });
    const cookies = forwardedCookies(
      request.headers.get("cookie") ?? "",
      config.cookie,
    );
    if (cookies) headers.set("Cookie", cookies);
    if (mutation) {
      headers.set("Content-Type", "application/json");
      headers.set("X-XSRF-TOKEN", request.headers.get("x-xsrf-token")!);
    }
    const upstream = await transport(`${config.backend}/${path}${url.search}`, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
      redirect: "manual",
      signal: controller.signal,
    });
    const output = new Headers(privateHeaders);
    for (const cookie of upstream.headers.getSetCookie()) {
      const normalized = browserCookie(cookie, config);
      if (normalized) output.append("Set-Cookie", normalized);
    }
    for (const name of [
      "retry-after",
      "x-ratelimit-limit",
      "x-ratelimit-remaining",
    ]) {
      const value = upstream.headers.get(name);
      if (value) output.set(name, value);
    }
    if (upstream.status === 204)
      return new Response(null, { status: 204, headers: output });
    if (upstream.status >= 300 && upstream.status < 400)
      return failure(502, "Unexpected API redirect.");
    if (!upstream.headers.get("content-type")?.includes("application/json"))
      return failure(502, "Unexpected API response.");
    let payload: unknown;
    try {
      payload = JSON.parse(
        new TextDecoder().decode(
          await limitedBody(upstream.body, 2 * 1024 * 1024, controller.signal),
        ),
      );
    } catch {
      return failure(
        controller.signal.aborted ? 504 : 502,
        "Invalid API response.",
      );
    }
    // Framework error details can contain internal information. Only 422 field validation is relayed.
    if (!upstream.ok && upstream.status !== 422)
      payload = { message: "API request failed.", errors: {} };
    if (!upstream.ok && upstream.status === 422) {
      const fields =
        payload && typeof payload === "object" && "errors" in payload
          ? payload.errors
          : {};
      payload = { message: "Check the submitted fields.", errors: fields };
    }
    return Response.json(payload, { status: upstream.status, headers: output });
  } catch {
    return failure(
      controller.signal.aborted ? 504 : 503,
      "API connection unavailable.",
    );
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener("abort", abort);
  }
}
