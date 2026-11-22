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
    return /^(sanctum\/csrf-cookie|api\/v1\/(health|auth\/me|companies|companies\/[1-9]\d*\/settings|branches|customers|customers\/[1-9]\d*|vehicles|vehicles\/[1-9]\d*|vehicles\/[1-9]\d*\/summary|quotations|quotations\/[1-9]\d*|reservations|reservations\/[1-9]\d*|rentals|rentals\/[1-9]\d*|invoices|invoices\/ageing|invoices\/[1-9]\d*|payments|refunds|expenses|gl\/accounts|gl\/journal-entries|work-orders|work-orders\/[1-9]\d*|parts|stock-movements|suppliers|purchase-orders|purchase-orders\/[1-9]\d*|dashboard\/summary|messages|notifications|reports\/(financial|fleet)|audit-events|(quotations|reservations|rentals|invoices)\/[1-9]\d*\/pdf|documents|documents\/[1-9]\d*|users|roles))$/.test(
      path,
    );
  if (method === "POST")
    return /^api\/v1\/(auth\/(login|logout)|companies|branches|customers|vehicles|quotations|quotations\/[1-9]\d*\/(approve-discount|reject-discount|cancel|convert)|reservations|reservations\/[1-9]\d*\/cancel|rentals|rentals\/[1-9]\d*\/(handover|return|extend|assign-driver)|invoices|invoices\/[1-9]\d*\/(issue|void|payments|refunds)|expenses|work-orders|work-orders\/[1-9]\d*\/(start|consume-parts|complete|cancel)|parts|parts\/[1-9]\d*\/adjust|suppliers|purchase-orders|purchase-orders\/[1-9]\d*\/(submit|approve|receive|cancel)|messages|messages\/[1-9]\d*\/read|notifications\/([1-9]\d*\/read|read-all)|documents|users)$/.test(
      path,
    );
  return (
    method === "PATCH" &&
    /^api\/v1\/((customers|vehicles|users|invoices|parts|suppliers|purchase-orders)\/[1-9]\d*|companies\/[1-9]\d*\/settings)$/.test(
      path,
    )
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
      !/^api\/v1\/(customers|vehicles|quotations|reservations|rentals|invoices|invoices\/ageing|payments|refunds|expenses|gl\/accounts|gl\/journal-entries|work-orders|parts|stock-movements|suppliers|purchase-orders|dashboard\/summary|messages|notifications|reports\/(financial|fleet)|audit-events|documents|users|roles)$/.test(
        path,
      )
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

  const checkSort = (allowedSorts: readonly string[]) => {
    const sort = params.get("sort");
    const dir = params.get("dir");
    if (dir !== null && !sort) return false;
    if (dir !== null && dir !== "asc" && dir !== "desc") return false;
    if (sort !== null && !allowedSorts.includes(sort)) return false;
    return true;
  };

  if (path === "api/v1/companies") {
    return checkCommon(["q", "page"], false);
  }
  if (path === "api/v1/branches") {
    return checkCommon(["company_id", "branch_id", "q", "page"], false);
  }
  if (path === "api/v1/customers") {
    if (
      !checkCommon(
        ["company_id", "branch_id", "type", "q", "page", "sort", "dir"],
        true,
      )
    )
      return false;
    const type = params.get("type");
    return (
      (type === null || ["individual", "corporate"].includes(type)) &&
      checkSort(["name", "type", "email"])
    );
  }
  if (path === "api/v1/vehicles") {
    if (
      !checkCommon(
        ["company_id", "branch_id", "status", "q", "page", "sort", "dir"],
        true,
      )
    )
      return false;
    const status = params.get("status");
    return (
      (status === null ||
        ["available", "rented", "maintenance", "damaged"].includes(status)) &&
      checkSort(["registration", "make", "daily_rate_minor", "odometer", "status"])
    );
  }
  if (path === "api/v1/quotations") {
    if (
      !checkCommon(
        [
          "company_id",
          "branch_id",
          "status",
          "customer_id",
          "q",
          "page",
          "sort",
          "dir",
        ],
        true,
      )
    )
      return false;
    const status = params.get("status");
    const customerId = params.get("customer_id");
    if (
      status !== null &&
      ![
        "draft",
        "pending_approval",
        "approved",
        "rejected",
        "cancelled",
        "converted",
      ].includes(status)
    )
      return false;
    if (customerId !== null && !posInt(customerId)) return false;
    return checkSort(["id", "customer_name", "total_minor", "status"]);
  }
  if (/^api\/v1\/(quotations|reservations|rentals|invoices)\/[1-9]\d*\/pdf$/.test(path)) {
    for (const key of uniqueKeys) {
      if (key !== "download") return false;
    }
    const dl = params.get("download");
    return dl === null || dl === "1" || dl === "0";
  }
  if (path === "api/v1/invoices") {
    if (
      !checkCommon(
        [
          "company_id",
          "branch_id",
          "status",
          "customer_id",
          "rental_id",
          "ageing_bucket",
          "q",
          "page",
          "sort",
          "dir",
        ],
        true,
      )
    )
      return false;
    const status = params.get("status");
    const customerId = params.get("customer_id");
    const rentalId = params.get("rental_id");
    const bucket = params.get("ageing_bucket");
    if (
      status !== null &&
      !["draft", "issued", "paid", "overdue", "void"].includes(status)
    )
      return false;
    if (customerId !== null && !posInt(customerId)) return false;
    if (rentalId !== null && !posInt(rentalId)) return false;
    if (
      bucket !== null &&
      !["current", "d1_30", "d31_60", "d61_90", "d90_plus"].includes(bucket)
    )
      return false;
    return checkSort([
      "id",
      "customer_name",
      "due_at",
      "total_minor",
      "outstanding_minor",
      "status",
      "created_at",
    ]);
  }
  if (path === "api/v1/invoices/ageing") {
    return checkCommon(["company_id", "branch_id"], true);
  }
  if (path === "api/v1/payments") {
    if (
      !checkCommon(
        [
          "company_id",
          "branch_id",
          "invoice_id",
          "method",
          "q",
          "page",
          "sort",
          "dir",
        ],
        true,
      )
    )
      return false;
    const invoiceId = params.get("invoice_id");
    const methodParam = params.get("method");
    if (invoiceId !== null && !posInt(invoiceId)) return false;
    if (
      methodParam !== null &&
      !["cash", "card", "bank_transfer", "mobile_money"].includes(methodParam)
    )
      return false;
    return checkSort(["id", "paid_at", "amount_minor", "method"]);
  }
  if (path === "api/v1/refunds") {
    if (
      !checkCommon(
        ["company_id", "branch_id", "invoice_id", "q", "page", "sort", "dir"],
        true,
      )
    )
      return false;
    const invoiceId = params.get("invoice_id");
    if (invoiceId !== null && !posInt(invoiceId)) return false;
    return checkSort(["id", "refunded_at", "amount_minor"]);
  }
  if (path === "api/v1/expenses") {
    if (
      !checkCommon(
        [
          "company_id",
          "branch_id",
          "category",
          "vehicle_id",
          "q",
          "page",
          "sort",
          "dir",
        ],
        true,
      )
    )
      return false;
    const category = params.get("category");
    const vehicleId = params.get("vehicle_id");
    if (
      category !== null &&
      ![
        "maintenance",
        "fuel",
        "insurance",
        "tolls_parking",
        "general",
      ].includes(category)
    )
      return false;
    if (vehicleId !== null && !posInt(vehicleId)) return false;
    return checkSort(["id", "incurred_at", "description", "category", "amount_minor"]);
  }
  if (path === "api/v1/gl/accounts") {
    return checkCommon(["company_id", "branch_id"], true);
  }
  if (path === "api/v1/gl/journal-entries") {
    if (
      !checkCommon(
        [
          "company_id",
          "branch_id",
          "account_code",
          "source_type",
          "q",
          "page",
        ],
        true,
      )
    )
      return false;
    const accountCode = params.get("account_code");
    const sourceType = params.get("source_type");
    if (accountCode !== null && !/^[A-Za-z0-9_-]{1,20}$/.test(accountCode))
      return false;
    if (
      sourceType !== null &&
      ![
        "invoice",
        "payment",
        "refund",
        "expense",
        "work_order",
        "purchase_order",
        "stock_adjustment",
      ].includes(sourceType)
    )
      return false;
    return true;
  }
  if (path === "api/v1/work-orders") {
    if (
      !checkCommon(
        [
          "company_id",
          "branch_id",
          "status",
          "vehicle_id",
          "q",
          "page",
          "sort",
          "dir",
        ],
        true,
      )
    )
      return false;
    const status = params.get("status");
    const vehicleId = params.get("vehicle_id");
    if (
      status !== null &&
      !["open", "in_progress", "completed", "cancelled"].includes(status)
    )
      return false;
    if (vehicleId !== null && !posInt(vehicleId)) return false;
    return checkSort([
      "id",
      "vehicle_registration",
      "title",
      "due_at",
      "total_cost_minor",
      "status",
    ]);
  }
  if (path === "api/v1/parts") {
    if (
      !checkCommon(
        [
          "company_id",
          "branch_id",
          "low_stock_only",
          "q",
          "page",
          "sort",
          "dir",
        ],
        true,
      )
    )
      return false;
    const low = params.get("low_stock_only");
    if (low !== null && !["0", "1", "true", "false"].includes(low))
      return false;
    return checkSort([
      "id",
      "sku",
      "name",
      "unit_cost_minor",
      "on_hand",
      "min_stock",
    ]);
  }
  if (path === "api/v1/stock-movements") {
    if (
      !checkCommon(
        [
          "company_id",
          "branch_id",
          "part_id",
          "work_order_id",
          "purchase_order_id",
          "q",
          "page",
          "sort",
          "dir",
        ],
        true,
      )
    )
      return false;
    for (const fk of ["part_id", "work_order_id", "purchase_order_id"]) {
      const v = params.get(fk);
      if (v !== null && !posInt(v)) return false;
    }
    return checkSort([
      "id",
      "created_at",
      "part_name",
      "quantity",
      "unit_cost_minor",
    ]);
  }
  if (path === "api/v1/suppliers") {
    if (
      !checkCommon(["company_id", "is_active", "q", "page", "sort", "dir"], true)
    )
      return false;
    const isActive = params.get("is_active");
    if (isActive !== null && !["0", "1", "true", "false"].includes(isActive))
      return false;
    return checkSort(["id", "name", "email", "is_active"]);
  }
  if (path === "api/v1/purchase-orders") {
    if (
      !checkCommon(
        [
          "company_id",
          "branch_id",
          "status",
          "supplier_id",
          "q",
          "page",
          "sort",
          "dir",
        ],
        true,
      )
    )
      return false;
    const status = params.get("status");
    const supplierId = params.get("supplier_id");
    if (
      status !== null &&
      !["draft", "submitted", "approved", "received", "cancelled"].includes(
        status,
      )
    )
      return false;
    if (supplierId !== null && !posInt(supplierId)) return false;
    return checkSort([
      "id",
      "supplier_name",
      "total_minor",
      "status",
      "created_at",
    ]);
  }
  const validDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
  if (
    path === "api/v1/dashboard/summary" ||
    path === "api/v1/reports/financial" ||
    path === "api/v1/reports/fleet"
  ) {
    if (!checkCommon(["company_id", "branch_id", "from", "to"], true))
      return false;
    const from = params.get("from");
    const to = params.get("to");
    if (from !== null && !validDate(from)) return false;
    if (to !== null && !validDate(to)) return false;
    return true;
  }
  if (path === "api/v1/messages") {
    if (!checkCommon(["company_id", "branch_id", "channel", "page"], true))
      return false;
    const channel = params.get("channel");
    if (
      channel !== null &&
      !["dispatch", "drivers", "customers", "support"].includes(channel)
    )
      return false;
    return true;
  }
  if (path === "api/v1/notifications") {
    if (!checkCommon(["company_id", "branch_id", "unread_only", "page"], true))
      return false;
    const unread = params.get("unread_only");
    if (unread !== null && !["0", "1", "true", "false"].includes(unread))
      return false;
    return true;
  }
  if (path === "api/v1/audit-events") {
    if (
      !checkCommon(
        ["company_id", "action", "entity_type", "q", "page"],
        true,
      )
    )
      return false;
    const act = params.get("action");
    const et = params.get("entity_type");
    if (act !== null && !/^[a-z0-9._-]{1,64}$/i.test(act)) return false;
    if (et !== null && !/^[a-z0-9_-]{1,32}$/i.test(et)) return false;
    return true;
  }
  if (path === "api/v1/reservations") {
    if (
      !checkCommon(
        [
          "company_id",
          "branch_id",
          "status",
          "vehicle_id",
          "customer_id",
          "q",
          "page",
          "sort",
          "dir",
        ],
        true,
      )
    )
      return false;
    const status = params.get("status");
    const vehicleId = params.get("vehicle_id");
    const customerId = params.get("customer_id");
    if (
      status !== null &&
      !["confirmed", "cancelled", "completed"].includes(status)
    )
      return false;
    if (vehicleId !== null && !posInt(vehicleId)) return false;
    if (customerId !== null && !posInt(customerId)) return false;
    return checkSort([
      "id",
      "customer_name",
      "vehicle_registration",
      "starts_at",
      "status",
    ]);
  }
  if (path === "api/v1/rentals") {
    if (
      !checkCommon(
        [
          "company_id",
          "branch_id",
          "status",
          "driver_user_id",
          "vehicle_id",
          "q",
          "page",
          "sort",
          "dir",
        ],
        true,
      )
    )
      return false;
    const status = params.get("status");
    const driverId = params.get("driver_user_id");
    const vehicleId = params.get("vehicle_id");
    if (status !== null && !["draft", "active", "returned"].includes(status))
      return false;
    if (driverId !== null && !posInt(driverId)) return false;
    if (vehicleId !== null && !posInt(vehicleId)) return false;
    return checkSort([
      "id",
      "vehicle_registration",
      "customer_name",
      "driver_name",
      "status",
    ]);
  }
  if (path === "api/v1/documents") {
    if (
      !checkCommon(
        [
          "company_id",
          "branch_id",
          "entity_type",
          "entity_id",
          "q",
          "page",
          "sort",
          "dir",
        ],
        true,
      )
    )
      return false;
    const entityType = params.get("entity_type");
    const entityId = params.get("entity_id");
    if (
      entityType !== null &&
      ![
        "vehicle",
        "customer",
        "reservation",
        "rental",
        "quotation",
        "invoice",
        "work_order",
        "purchase_order",
      ].includes(entityType)
    )
      return false;
    if (entityId !== null && (!entityType || !posInt(entityId))) return false;
    return checkSort(["original_name", "size", "expires_at"]);
  }
  if (path === "api/v1/users") {
    if (
      !checkCommon(
        [
          "company_id",
          "branch_id",
          "role",
          "is_active",
          "q",
          "page",
          "sort",
          "dir",
        ],
        true,
      )
    )
      return false;
    const role = params.get("role");
    const isActive = params.get("is_active");
    if (
      role !== null &&
      !["company-admin", "operations", "finance", "viewer", "driver"].includes(
        role,
      )
    )
      return false;
    if (
      isActive !== null &&
      !["0", "1", "true", "false"].includes(isActive)
    )
      return false;
    return checkSort(["name", "email", "role", "is_active"]);
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
  const isDocumentUpload =
    request.method === "POST" && path === "api/v1/documents";
  const isDocumentDownload =
    request.method === "GET" &&
    /^api\/v1\/(documents\/[1-9]\d*|(quotations|reservations|rentals|invoices)\/[1-9]\d*\/pdf)$/.test(
      path,
    );
  const allowed = appOrigins(config);
  const requestOrigin = request.headers.get("origin");
  if (mutation && (!requestOrigin || !allowed.includes(requestOrigin)))
    return failure(403, "Invalid request origin.");
  if (mutation && !request.headers.get("x-xsrf-token"))
    return failure(419, "CSRF verification required.");
  const contentType = request.headers.get("content-type") ?? "";
  if (isDocumentUpload) {
    if (!/^multipart\/form-data;\s*boundary=/i.test(contentType))
      return failure(415, "Multipart form data is required.");
  } else if (mutation && !/^application\/json(?:;|$)/i.test(contentType)) {
    return failure(415, "JSON is required.");
  }
  const maxRequestBytes = isDocumentUpload ? 11 * 1024 * 1024 : 65536;
  if (Number(request.headers.get("content-length") ?? 0) > maxRequestBytes)
    return failure(413, "Request too large.");
  const controller = new AbortController();
  const abort = () => controller.abort();
  request.signal.addEventListener("abort", abort, { once: true });
  if (request.signal.aborted) controller.abort();
  const timer = setTimeout(abort, config.timeout);
  try {
    let body: string | Uint8Array<ArrayBuffer> | undefined;
    if (mutation) {
      try {
        const rawBytes = await limitedBody(
          request.body,
          maxRequestBytes,
          controller.signal,
        );
        if (isDocumentUpload) {
          body = rawBytes;
        } else {
          const decoded = new TextDecoder().decode(rawBytes);
          JSON.parse(decoded);
          body = decoded;
        }
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
      Accept: isDocumentDownload
        ? "application/pdf, image/jpeg, image/png, application/json"
        : "application/json",
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
      headers.set(
        "Content-Type",
        isDocumentUpload ? contentType : "application/json",
      );
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
    const upstreamType = upstream.headers.get("content-type") ?? "";
    if (isDocumentDownload && upstream.ok) {
      const mime = upstreamType.split(";")[0]?.trim().toLowerCase() ?? "";
      if (!["application/pdf", "image/jpeg", "image/png"].includes(mime))
        return failure(502, "Unexpected document content type.");
      let fileBytes: Uint8Array<ArrayBuffer>;
      try {
        fileBytes = await limitedBody(
          upstream.body,
          12 * 1024 * 1024,
          controller.signal,
        );
      } catch {
        return failure(
          controller.signal.aborted ? 504 : 502,
          "Invalid document response.",
        );
      }
      output.set("Content-Type", mime);
      const disposition = upstream.headers.get("content-disposition");
      output.set(
        "Content-Disposition",
        disposition && /^attachment\b/i.test(disposition)
          ? disposition
          : "attachment",
      );
      return new Response(fileBytes, {
        status: upstream.status,
        headers: output,
      });
    }
    if (!upstreamType.includes("application/json"))
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
