import { z } from "zod";
import { ApiError, read, request } from "@/lib/api/client";
import {
  normalizePage,
  pageSchema,
  vehicleSummarySchema,
  workOrderSchema,
  type VehicleSummary,
  type WorkOrder,
} from "@/lib/api/contracts";
import type { SortDirection } from "@/lib/table-sort";

export async function listWorkOrders(
  params: {
    companyId: string;
    branchId?: string;
    status?: string;
    vehicleId?: string;
    q?: string;
    page?: number;
    sort?: string;
    dir?: SortDirection | "";
  },
  signal: AbortSignal,
): Promise<{
  items: WorkOrder[];
  page: number;
  lastPage: number;
  pageSize: number;
  total: number;
}> {
  const query = new URLSearchParams({ company_id: params.companyId });
  if (params.branchId) query.set("branch_id", params.branchId);
  if (params.status) query.set("status", params.status);
  if (params.vehicleId) query.set("vehicle_id", params.vehicleId);
  if (params.q?.trim()) query.set("q", params.q.trim());
  if (params.page && params.page > 1) query.set("page", String(params.page));
  if (params.sort) {
    query.set("sort", params.sort);
    if (params.dir) query.set("dir", params.dir);
  }
  const page = await read(
    `api/v1/work-orders?${query.toString()}`,
    pageSchema(workOrderSchema),
    signal,
  );
  return normalizePage(page);
}

export async function getWorkOrder(
  workOrderId: string,
  signal: AbortSignal,
): Promise<WorkOrder> {
  const res = await read(
    `api/v1/work-orders/${workOrderId}`,
    z.object({ data: workOrderSchema }),
    signal,
  );
  return res.data;
}

export async function createWorkOrder(
  body: {
    company_id: number;
    branch_id: number;
    vehicle_id: number;
    title: string;
    due_at: string;
    labour_cost_minor: number;
    notes?: string;
  },
  signal: AbortSignal,
): Promise<WorkOrder> {
  const payload = await request("api/v1/work-orders", {
    method: "POST",
    body,
    signal,
  });
  const parsed = z.object({ data: workOrderSchema }).safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(502, "Unexpected work order creation response.");
  }
  return parsed.data.data;
}

export async function startWorkOrder(
  workOrderId: number,
  signal: AbortSignal,
): Promise<WorkOrder> {
  const payload = await request(`api/v1/work-orders/${workOrderId}/start`, {
    method: "POST",
    body: {},
    signal,
  });
  const parsed = z.object({ data: workOrderSchema }).safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(502, "Unexpected work order start response.");
  }
  return parsed.data.data;
}

export async function consumeWorkOrderParts(
  workOrderId: number,
  body: { part_id: number; quantity: number },
  signal: AbortSignal,
): Promise<WorkOrder> {
  const payload = await request(
    `api/v1/work-orders/${workOrderId}/consume-parts`,
    { method: "POST", body, signal },
  );
  const parsed = z.object({ data: workOrderSchema }).safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(502, "Unexpected part consumption response.");
  }
  return parsed.data.data;
}

export async function completeWorkOrder(
  workOrderId: number,
  body: { labour_cost_minor?: number; completion_notes?: string },
  signal: AbortSignal,
): Promise<WorkOrder> {
  const payload = await request(`api/v1/work-orders/${workOrderId}/complete`, {
    method: "POST",
    body,
    signal,
  });
  const parsed = z.object({ data: workOrderSchema }).safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(502, "Unexpected work order completion response.");
  }
  return parsed.data.data;
}

export async function cancelWorkOrder(
  workOrderId: number,
  signal: AbortSignal,
): Promise<WorkOrder> {
  const payload = await request(`api/v1/work-orders/${workOrderId}/cancel`, {
    method: "POST",
    body: {},
    signal,
  });
  const parsed = z.object({ data: workOrderSchema }).safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(502, "Unexpected work order cancellation response.");
  }
  return parsed.data.data;
}

export async function getVehicleSummary(
  vehicleId: number,
  signal: AbortSignal,
): Promise<VehicleSummary> {
  const res = await read(
    `api/v1/vehicles/${vehicleId}/summary`,
    z.object({ data: vehicleSummarySchema }),
    signal,
  );
  return res.data;
}
