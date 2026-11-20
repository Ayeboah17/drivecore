import { z } from "zod";
import { ApiError, read, request } from "@/lib/api/client";
import {
  companySettingsSchema,
  normalizePage,
  pageSchema,
  quotationSchema,
  type CompanySettings,
  type Quotation,
} from "@/lib/api/contracts";

function assertQuotationScope(
  record: Quotation,
  companyId: string,
  branch: string,
  expectedId?: string,
) {
  if (
    String(record.company_id) !== companyId ||
    (branch !== "all" && String(record.branch_id) !== branch) ||
    (expectedId !== undefined && String(record.id) !== expectedId)
  ) {
    throw new ApiError(
      404,
      "This quotation is unavailable in the selected context.",
    );
  }
  return record;
}

export async function getCompanySettings(
  companyId: string,
  signal: AbortSignal,
): Promise<CompanySettings> {
  const payload = await read(
    `api/v1/companies/${companyId}/settings`,
    z.object({ data: companySettingsSchema }),
    signal,
  );
  if (String(payload.data.company_id) !== companyId) {
    throw new ApiError(502, "Unexpected company settings scope.");
  }
  return payload.data;
}

export async function updateCompanySettings(
  companyId: string,
  body: {
    vat_rate_pct: number;
    discount_approval_threshold_pct: number;
  },
  signal: AbortSignal,
): Promise<CompanySettings> {
  const payload = await request(`api/v1/companies/${companyId}/settings`, {
    method: "PATCH",
    body,
    signal,
  });
  const parsed = z.object({ data: companySettingsSchema }).safeParse(payload);
  if (!parsed.success || String(parsed.data.data.company_id) !== companyId) {
    throw new ApiError(502, "Unexpected settings response.");
  }
  return parsed.data.data;
}

export async function listQuotations(
  params: {
    companyId: string;
    branch: string;
    q?: string;
    status?: string;
    page?: number;
    sort?: string;
    dir?: string;
  },
  signal: AbortSignal,
) {
  const query = new URLSearchParams({ company_id: params.companyId });
  if (params.branch !== "all") query.set("branch_id", params.branch);
  const trimmedQ = (params.q ?? "").trim().slice(0, 100);
  if (trimmedQ) query.set("q", trimmedQ);
  if (params.status) query.set("status", params.status);
  if (params.page && params.page > 1) query.set("page", String(params.page));
  if (params.sort) {
    query.set("sort", params.sort);
    if (params.dir === "asc" || params.dir === "desc") {
      query.set("dir", params.dir);
    }
  }

  const payload = await read(
    `api/v1/quotations?${query.toString()}`,
    pageSchema(quotationSchema),
    signal,
  );
  const normalized = normalizePage(payload);
  for (const item of normalized.items) {
    assertQuotationScope(item, params.companyId, params.branch);
  }
  return normalized;
}

export async function getQuotation(
  id: string,
  companyId: string,
  branch: string,
  signal: AbortSignal,
): Promise<Quotation> {
  const payload = await read(
    `api/v1/quotations/${id}`,
    z.object({ data: quotationSchema }),
    signal,
  );
  return assertQuotationScope(payload.data, companyId, branch, id);
}

export async function createQuotation(
  body: {
    company_id: number;
    branch_id: number;
    customer_id: number;
    vehicle_ids: number[];
    starts_at: string;
    ends_at: string;
    discount_pct: number;
    notes?: string;
  },
  signal: AbortSignal,
): Promise<Quotation> {
  const payload = await request("api/v1/quotations", {
    method: "POST",
    body,
    signal,
  });
  const parsed = z.object({ data: quotationSchema }).safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(
      502,
      "Unexpected quotation creation response. Refresh before submitting again.",
    );
  }
  return parsed.data.data;
}

export async function decideQuotationDiscount(
  quotationId: number,
  decision: "approve-discount" | "reject-discount",
  notes: string,
  signal: AbortSignal,
): Promise<Quotation> {
  const payload = await request(`api/v1/quotations/${quotationId}/${decision}`, {
    method: "POST",
    body: notes.trim() ? { notes: notes.trim() } : {},
    signal,
  });
  const parsed = z.object({ data: quotationSchema }).safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(502, "Unexpected discount decision response.");
  }
  return parsed.data.data;
}

export async function cancelQuotation(
  quotationId: number,
  signal: AbortSignal,
): Promise<Quotation> {
  const payload = await request(`api/v1/quotations/${quotationId}/cancel`, {
    method: "POST",
    body: {},
    signal,
  });
  const parsed = z.object({ data: quotationSchema }).safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(502, "Unexpected cancellation response.");
  }
  return parsed.data.data;
}

export async function convertQuotation(
  quotationId: number,
  signal: AbortSignal,
): Promise<Quotation> {
  const payload = await request(`api/v1/quotations/${quotationId}/convert`, {
    method: "POST",
    body: {},
    signal,
  });
  const parsed = z.object({ data: quotationSchema }).safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(502, "Unexpected conversion response.");
  }
  return parsed.data.data;
}
