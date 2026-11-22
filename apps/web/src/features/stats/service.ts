import { z } from "zod";
import { ApiError, request } from "@/lib/api/client";
import {
  branchStatsRowSchema,
  customerSchema,
  customerStatsSummaryMetaSchema,
  customerSummarySchema,
  savedFilterSchema,
  vehicleSchema,
  vehicleStatsSummaryMetaSchema,
  type BranchStatsRow,
  type Customer,
  type CustomerStatsSummaryMeta,
  type CustomerSummary,
  type SavedFilter,
  type SavedFilterModule,
  type Vehicle,
  type VehicleStatsSummaryMeta,
} from "@/lib/api/contracts";
import type { SortDirection } from "@/lib/table-sort";

const paginatedMeta = z.object({
  current_page: z.number().int().positive(),
  last_page: z.number().int().positive(),
  per_page: z.number().int().positive(),
  total: z.number().int().nonnegative(),
});

const customerStatsPageSchema = z.object({
  data: z.array(customerSchema),
  meta: paginatedMeta.extend({
    summary: customerStatsSummaryMetaSchema.nullable().optional(),
  }),
});

const vehicleStatsPageSchema = z.object({
  data: z.array(vehicleSchema),
  meta: paginatedMeta.extend({
    summary: vehicleStatsSummaryMetaSchema.nullable().optional(),
  }),
});

const branchStatsListSchema = z.object({
  data: z.array(branchStatsRowSchema),
});

const savedFilterListSchema = z.object({
  data: z.array(savedFilterSchema),
});

export interface CustomerStatsQuery {
  companyId: string;
  branchId?: string;
  type?: string;
  from?: string;
  to?: string;
  minSpendMinor?: number;
  maxSpendMinor?: number;
  hasOpenAr?: boolean;
  q?: string;
  page?: number;
  sort?: string;
  dir?: SortDirection | "";
}

export interface VehicleStatsQuery {
  companyId: string;
  branchId?: string;
  status?: string;
  from?: string;
  to?: string;
  minRateMinor?: number;
  maxRateMinor?: number;
  functions?: string[];
  idleDaysMin?: number;
  unpricedOnly?: boolean;
  q?: string;
  page?: number;
  sort?: string;
  dir?: SortDirection | "";
}

export async function getCustomerSummary(
  customerId: string | number,
  signal?: AbortSignal,
): Promise<CustomerSummary> {
  const payload = await request(`api/v1/customers/${customerId}/summary`, {
    signal,
  });
  return z.object({ data: customerSummarySchema }).parse(payload).data;
}

export async function listCustomerStats(
  params: CustomerStatsQuery,
  signal?: AbortSignal,
): Promise<{
  items: Customer[];
  page: number;
  lastPage: number;
  total: number;
  summary: CustomerStatsSummaryMeta | null;
}> {
  const sp = new URLSearchParams({ company_id: params.companyId });
  if (params.branchId) sp.set("branch_id", params.branchId);
  if (params.type) sp.set("type", params.type);
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  if (params.minSpendMinor !== undefined)
    sp.set("min_spend_minor", String(params.minSpendMinor));
  if (params.maxSpendMinor !== undefined)
    sp.set("max_spend_minor", String(params.maxSpendMinor));
  if (params.hasOpenAr) sp.set("has_open_ar", "1");
  if (params.q?.trim()) sp.set("q", params.q.trim().slice(0, 100));
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  if (params.sort && params.dir) {
    sp.set("sort", params.sort);
    sp.set("dir", params.dir);
  }
  const payload = await request(`api/v1/stats/customers?${sp.toString()}`, {
    signal,
  });
  const parsed = customerStatsPageSchema.parse(payload);
  return {
    items: parsed.data,
    page: parsed.meta.current_page,
    lastPage: parsed.meta.last_page,
    total: parsed.meta.total,
    summary: parsed.meta.summary ?? null,
  };
}

export async function listVehicleStats(
  params: VehicleStatsQuery,
  signal?: AbortSignal,
): Promise<{
  items: Vehicle[];
  page: number;
  lastPage: number;
  total: number;
  summary: VehicleStatsSummaryMeta | null;
}> {
  const sp = new URLSearchParams({ company_id: params.companyId });
  if (params.branchId) sp.set("branch_id", params.branchId);
  if (params.status) sp.set("status", params.status);
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  if (params.minRateMinor !== undefined)
    sp.set("min_rate_minor", String(params.minRateMinor));
  if (params.maxRateMinor !== undefined)
    sp.set("max_rate_minor", String(params.maxRateMinor));
  if (params.functions?.length)
    sp.set("functions", params.functions.join(","));
  if (params.idleDaysMin !== undefined)
    sp.set("idle_days_min", String(params.idleDaysMin));
  if (params.unpricedOnly) sp.set("unpriced_only", "1");
  if (params.q?.trim()) sp.set("q", params.q.trim().slice(0, 100));
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  if (params.sort && params.dir) {
    sp.set("sort", params.sort);
    sp.set("dir", params.dir);
  }
  const payload = await request(`api/v1/stats/vehicles?${sp.toString()}`, {
    signal,
  });
  const parsed = vehicleStatsPageSchema.parse(payload);
  return {
    items: parsed.data,
    page: parsed.meta.current_page,
    lastPage: parsed.meta.last_page,
    total: parsed.meta.total,
    summary: parsed.meta.summary ?? null,
  };
}

export async function listBranchStats(
  params: {
    companyId: string;
    branchId?: string;
    from?: string;
    to?: string;
  },
  signal?: AbortSignal,
): Promise<BranchStatsRow[]> {
  const sp = new URLSearchParams({ company_id: params.companyId });
  if (params.branchId) sp.set("branch_id", params.branchId);
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  const payload = await request(`api/v1/stats/branches?${sp.toString()}`, {
    signal,
  });
  return branchStatsListSchema.parse(payload).data;
}

export async function listSavedFilters(
  companyId: string,
  module: SavedFilterModule,
  signal?: AbortSignal,
): Promise<{ supported: boolean; items: SavedFilter[] }> {
  const sp = new URLSearchParams({ company_id: companyId, module });
  try {
    const payload = await request(`api/v1/saved-filters?${sp.toString()}`, {
      signal,
    });
    return {
      supported: true,
      items: savedFilterListSchema.parse(payload).data,
    };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return { supported: false, items: [] };
    }
    throw err;
  }
}

export async function createSavedFilter(
  body: {
    company_id: number;
    module: SavedFilterModule;
    name: string;
    filters: Record<string, string>;
    is_shared: boolean;
  },
  signal?: AbortSignal,
): Promise<SavedFilter> {
  const payload = await request("api/v1/saved-filters", {
    method: "POST",
    body,
    signal,
  });
  return z.object({ data: savedFilterSchema }).parse(payload).data;
}

export async function deleteSavedFilter(
  id: number,
  signal?: AbortSignal,
): Promise<void> {
  await request(`api/v1/saved-filters/${id}`, {
    method: "DELETE",
    body: {},
    signal,
  });
}
