import { z } from "zod";
import { ApiError, read, request } from "@/lib/api/client";
import {
  normalizePage,
  pageSchema,
  purchaseOrderSchema,
  supplierSchema,
  type PurchaseOrder,
  type SupplierRecord,
} from "@/lib/api/contracts";
import type { SortDirection } from "@/lib/table-sort";

export interface PurchaseOrderLinePayload {
  part_id: number;
  quantity: number;
  unit_cost_minor: number;
}

export async function listSuppliers(
  params: {
    companyId: string;
    isActive?: string;
    q?: string;
    page?: number;
    sort?: string;
    dir?: SortDirection | "";
  },
  signal: AbortSignal,
): Promise<{
  items: SupplierRecord[];
  page: number;
  lastPage: number;
  pageSize: number;
  total: number;
}> {
  const query = new URLSearchParams({ company_id: params.companyId });
  if (params.isActive) query.set("is_active", params.isActive);
  if (params.q?.trim()) query.set("q", params.q.trim());
  if (params.page && params.page > 1) query.set("page", String(params.page));
  if (params.sort) {
    query.set("sort", params.sort);
    if (params.dir) query.set("dir", params.dir);
  }
  const page = await read(
    `api/v1/suppliers?${query.toString()}`,
    pageSchema(supplierSchema),
    signal,
  );
  return normalizePage(page);
}

export async function createSupplier(
  body: {
    company_id: number;
    name: string;
    email?: string | null;
    phone?: string | null;
    is_active?: boolean;
  },
  signal: AbortSignal,
): Promise<SupplierRecord> {
  const payload = await request("api/v1/suppliers", {
    method: "POST",
    body,
    signal,
  });
  const parsed = z.object({ data: supplierSchema }).safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(502, "Unexpected supplier creation response.");
  }
  return parsed.data.data;
}

export async function updateSupplier(
  supplierId: number,
  body: {
    name: string;
    email?: string | null;
    phone?: string | null;
    is_active?: boolean;
  },
  signal: AbortSignal,
): Promise<SupplierRecord> {
  const payload = await request(`api/v1/suppliers/${supplierId}`, {
    method: "PATCH",
    body,
    signal,
  });
  const parsed = z.object({ data: supplierSchema }).safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(502, "Unexpected supplier update response.");
  }
  return parsed.data.data;
}

export async function listPurchaseOrders(
  params: {
    companyId: string;
    branchId?: string;
    status?: string;
    supplierId?: string;
    q?: string;
    page?: number;
    sort?: string;
    dir?: SortDirection | "";
  },
  signal: AbortSignal,
): Promise<{
  items: PurchaseOrder[];
  page: number;
  lastPage: number;
  pageSize: number;
  total: number;
}> {
  const query = new URLSearchParams({ company_id: params.companyId });
  if (params.branchId) query.set("branch_id", params.branchId);
  if (params.status) query.set("status", params.status);
  if (params.supplierId) query.set("supplier_id", params.supplierId);
  if (params.q?.trim()) query.set("q", params.q.trim());
  if (params.page && params.page > 1) query.set("page", String(params.page));
  if (params.sort) {
    query.set("sort", params.sort);
    if (params.dir) query.set("dir", params.dir);
  }
  const page = await read(
    `api/v1/purchase-orders?${query.toString()}`,
    pageSchema(purchaseOrderSchema),
    signal,
  );
  return normalizePage(page);
}

export async function getPurchaseOrder(
  purchaseOrderId: string,
  signal: AbortSignal,
): Promise<PurchaseOrder> {
  const res = await read(
    `api/v1/purchase-orders/${purchaseOrderId}`,
    z.object({ data: purchaseOrderSchema }),
    signal,
  );
  return res.data;
}

export async function createPurchaseOrder(
  body: {
    company_id: number;
    branch_id: number;
    supplier_id: number;
    notes?: string;
    lines: PurchaseOrderLinePayload[];
  },
  signal: AbortSignal,
): Promise<PurchaseOrder> {
  const payload = await request("api/v1/purchase-orders", {
    method: "POST",
    body,
    signal,
  });
  const parsed = z.object({ data: purchaseOrderSchema }).safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(502, "Unexpected purchase order creation response.");
  }
  return parsed.data.data;
}

export async function transitionPurchaseOrder(
  purchaseOrderId: number,
  action: "submit" | "approve" | "receive" | "cancel",
  signal: AbortSignal,
): Promise<PurchaseOrder> {
  const payload = await request(
    `api/v1/purchase-orders/${purchaseOrderId}/${action}`,
    { method: "POST", body: {}, signal },
  );
  const parsed = z.object({ data: purchaseOrderSchema }).safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(502, "Unexpected purchase order transition response.");
  }
  return parsed.data.data;
}
