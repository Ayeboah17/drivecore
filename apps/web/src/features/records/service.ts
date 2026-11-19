import { z } from "zod";
import { ApiError, read, request } from "@/lib/api/client";
import {
  customerSchema,
  normalizePage,
  pageSchema,
  vehicleSchema,
  type Domain,
  type Customer,
  type Vehicle,
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
  if (params.page > 1) query.set("page", String(params.page));

  const schema = domain === "customers" ? customerSchema : vehicleSchema;
  const payload = await read(
    `api/v1/${domain}?${query.toString()}`,
    pageSchema(schema),
    signal,
  );
  const normalized = normalizePage(payload);
  for (const item of normalized.items) {
    assertRecordScope(item, params.companyId, params.branch);
  }
  return normalized as {
    items: (Customer | Vehicle)[];
    page: number;
    lastPage: number;
    pageSize: number;
    total: number;
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
