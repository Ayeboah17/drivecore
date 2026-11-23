import { z } from "zod";
import { ApiError, read, request } from "@/lib/api/client";
import {
  normalizePage,
  pageSchema,
  partSchema,
  stockMovementSchema,
  type PartRecord,
  type StockMovementRecord,
} from "@/lib/api/contracts";
import type { SortDirection } from "@/lib/table-sort";

export async function listParts(
  params: {
    companyId: string;
    branchId?: string;
    lowStockOnly?: boolean;
    q?: string;
    page?: number;
    sort?: string;
    dir?: SortDirection | "";
  },
  signal: AbortSignal,
): Promise<{
  items: PartRecord[];
  page: number;
  lastPage: number;
  pageSize: number;
  total: number;
}> {
  const query = new URLSearchParams({ company_id: params.companyId });
  if (params.branchId) query.set("branch_id", params.branchId);
  if (params.lowStockOnly) query.set("low_stock_only", "1");
  if (params.q?.trim()) query.set("q", params.q.trim());
  if (params.page && params.page > 1) query.set("page", String(params.page));
  if (params.sort) {
    query.set("sort", params.sort);
    if (params.dir) query.set("dir", params.dir);
  }
  const page = await read(
    `api/v1/parts?${query.toString()}`,
    pageSchema(partSchema),
    signal,
  );
  return normalizePage(page);
}

export async function createPart(
  body: {
    company_id: number;
    branch_id: number;
    sku: string;
    name: string;
    unit_cost_minor: number;
    min_stock: number;
  },
  signal: AbortSignal,
): Promise<PartRecord> {
  const payload = await request("api/v1/parts", {
    method: "POST",
    body,
    signal,
  });
  const parsed = z.object({ data: partSchema }).safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(502, "Unexpected part creation response.");
  }
  return parsed.data.data;
}

export async function updatePart(
  partId: number,
  body: {
    sku: string;
    name: string;
    unit_cost_minor: number;
    min_stock: number;
  },
  signal: AbortSignal,
): Promise<PartRecord> {
  const payload = await request(`api/v1/parts/${partId}`, {
    method: "PATCH",
    body,
    signal,
  });
  const parsed = z.object({ data: partSchema }).safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(502, "Unexpected part update response.");
  }
  return parsed.data.data;
}

export async function adjustPartStock(
  partId: number,
  body: { quantity: number; reason: string },
  signal: AbortSignal,
): Promise<PartRecord> {
  const payload = await request(`api/v1/parts/${partId}/adjust`, {
    method: "POST",
    body,
    signal,
  });
  const parsed = z.object({ data: partSchema }).safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(502, "Unexpected stock adjustment response.");
  }
  return parsed.data.data;
}

export async function listStockMovements(
  params: {
    companyId: string;
    branchId?: string;
    partId?: string;
    q?: string;
    page?: number;
    sort?: string;
    dir?: SortDirection | "";
  },
  signal: AbortSignal,
): Promise<{
  items: StockMovementRecord[];
  page: number;
  lastPage: number;
  pageSize: number;
  total: number;
}> {
  const query = new URLSearchParams({ company_id: params.companyId });
  if (params.branchId) query.set("branch_id", params.branchId);
  if (params.partId) query.set("part_id", params.partId);
  if (params.q?.trim()) query.set("q", params.q.trim());
  if (params.page && params.page > 1) query.set("page", String(params.page));
  if (params.sort) {
    query.set("sort", params.sort);
    if (params.dir) query.set("dir", params.dir);
  }
  const page = await read(
    `api/v1/stock-movements?${query.toString()}`,
    pageSchema(stockMovementSchema),
    signal,
  );
  return normalizePage(page);
}
