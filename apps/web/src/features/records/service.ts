import { z } from "zod";
import { ApiError, read, request } from "@/lib/api/client";
import {
  customerSchema,
  customerStatsSummaryMetaSchema,
  normalizePage,
  pageSchema,
  vehicleSchema,
  vehicleStatsSummaryMetaSchema,
  type CustomerStatsSummaryMeta,
  type Domain,
  type Customer,
  type Vehicle,
  type VehicleStatsSummaryMeta,
} from "@/lib/api/contracts";
export function assertRecordScope(
  record: Customer | Vehicle,
  company: string,
  branch: string,
  expectedId?: string,
) {
  if (
    String(record.company_id) !== company ||
    (branch !== "all" && String(record.branch_id) !== branch) ||
    (expectedId !== undefined && String(record.id) !== expectedId)
  )
    throw new ApiError(
      404,
      "This record is unavailable in the selected context.",
    );
  return record;
}
export async function listRecords(
  domain: Domain,
  params: {
    companyId: string;
    branch: string;
    q: string;
    filter: string;
    page: number;
    sort?: string;
    dir?: string;
    includeStats?: boolean;
    from?: string;
    to?: string;
    minSpendMinor?: number;
    maxSpendMinor?: number;
    hasOpenAr?: boolean;
    minRateMinor?: number;
    maxRateMinor?: number;
    functions?: string;
    idleDaysMin?: number;
    unpricedOnly?: boolean;
  },
  signal: AbortSignal,
) {
  const query = new URLSearchParams({ company_id: params.companyId });
  if (params.branch !== "all") query.set("branch_id", params.branch);
  const trimmedQ = params.q.trim().slice(0, 100);
  if (trimmedQ) query.set("q", trimmedQ);
  if (params.filter) {
    query.set(domain === "customers" ? "type" : "status", params.filter);
  }
  if (params.includeStats) query.set("include_stats", "1");
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  if (domain === "customers") {
    if (params.minSpendMinor !== undefined)
      query.set("min_spend_minor", String(params.minSpendMinor));
    if (params.maxSpendMinor !== undefined)
      query.set("max_spend_minor", String(params.maxSpendMinor));
    if (params.hasOpenAr) query.set("has_open_ar", "1");
  } else {
    if (params.minRateMinor !== undefined)
      query.set("min_rate_minor", String(params.minRateMinor));
    if (params.maxRateMinor !== undefined)
      query.set("max_rate_minor", String(params.maxRateMinor));
    if (params.functions?.trim()) query.set("functions", params.functions.trim());
    if (params.idleDaysMin !== undefined)
      query.set("idle_days_min", String(params.idleDaysMin));
    if (params.unpricedOnly) query.set("unpriced_only", "1");
  }
  if (params.page > 1) query.set("page", String(params.page));
  if (params.sort) {
    query.set("sort", params.sort);
    if (params.dir === "asc" || params.dir === "desc") {
      query.set("dir", params.dir);
    }
  }

  const schema = domain === "customers" ? customerSchema : vehicleSchema;
  const extendedSchema = pageSchema(schema).extend({
    meta: pageSchema(schema).shape.meta.extend({
      summary: (domain === "customers"
        ? customerStatsSummaryMetaSchema
        : vehicleStatsSummaryMetaSchema
      )
        .nullable()
        .optional(),
    }),
  });
  const payload = await read(
    `api/v1/${domain}?${query.toString()}`,
    extendedSchema,
    signal,
  );
  const normalized = normalizePage(payload);
  for (const item of normalized.items) {
    assertRecordScope(item, params.companyId, params.branch);
  }
  return {
    ...normalized,
    summary: payload.meta.summary ?? null,
  } as {
    items: (Customer | Vehicle)[];
    page: number;
    lastPage: number;
    pageSize: number;
    total: number;
    summary: CustomerStatsSummaryMeta | VehicleStatsSummaryMeta | null;
  };
}
export async function getRecord(
  domain: Domain,
  id: string,
  company: string,
  branch: string,
  signal: AbortSignal,
) {
  const schema = domain === "customers" ? customerSchema : vehicleSchema;
  const payload = await read(
    `api/v1/${domain}/${id}`,
    z.object({ data: schema }),
    signal,
  );
  return assertRecordScope(payload.data, company, branch, id);
}
export async function saveRecord(
  domain: Domain,
  id: string | undefined,
  body: unknown,
  company: string,
  branch: string,
  signal: AbortSignal,
) {
  const payload = await request(`api/v1/${domain}${id ? `/${id}` : ""}`, {
    method: id ? "PATCH" : "POST",
    body,
    signal,
  });
  const schema = domain === "customers" ? customerSchema : vehicleSchema;
  const parsed = z.object({ data: schema }).safeParse(payload);
  if (!parsed.success)
    throw new ApiError(
      502,
      "Unexpected save response. Refresh before submitting again.",
    );
  return assertRecordScope(parsed.data.data, company, branch, id);
}
