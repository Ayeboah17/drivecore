import { z } from "zod";
import { request } from "@/lib/api/client";
import {
  approvalThresholdSchema,
  normalizePage,
  pageSchema,
  purchaseOrderSchema,
  purchaseRequisitionSchema,
  quotationSchema,
  rentalSchema,
  supplierStatementSchema,
  vatReturnSchema,
  vehicleHistorySchema,
  vehicleIncidentSchema,
  workOrderSchema,
  type ApprovalThreshold,
  type IncidentSeverity,
  type IncidentStatus,
  type IncidentType,
  type PurchaseOrder,
  type PurchaseRequisition,
  type Quotation,
  type Rental,
  type SupplierStatement,
  type VatReturn,
  type VehicleHistory,
  type VehicleIncident,
  type WorkOrder,
} from "@/lib/api/contracts";

function unwrap<T extends z.ZodType>(schema: T, payload: unknown): z.infer<T> {
  const data =
    payload && typeof payload === "object" && "data" in payload
      ? (payload as { data: unknown }).data
      : payload;
  return schema.parse(data);
}

// ---------- Digital Vehicle File History ----------

export async function getVehicleHistory(
  vehicleId: number | string,
  companyId: string,
  signal?: AbortSignal,
): Promise<VehicleHistory> {
  const payload = await request(
    `api/v1/vehicles/${vehicleId}/history?company_id=${encodeURIComponent(companyId)}`,
    { signal },
  );
  return unwrap(vehicleHistorySchema, payload);
}

// ---------- Accidents, Breakdowns & Incidents ----------

export async function listIncidents(
  params: {
    companyId: string;
    branchId?: string;
    vehicleId?: string;
    incidentType?: string;
    severity?: string;
    status?: string;
    q?: string;
    page?: number;
  },
  signal?: AbortSignal,
) {
  const qs = new URLSearchParams({ company_id: params.companyId });
  if (params.branchId) qs.set("branch_id", params.branchId);
  if (params.vehicleId) qs.set("vehicle_id", params.vehicleId);
  if (params.incidentType) qs.set("incident_type", params.incidentType);
  if (params.severity) qs.set("severity", params.severity);
  if (params.status) qs.set("status", params.status);
  if (params.q?.trim()) qs.set("q", params.q.trim());
  if (params.page && params.page > 1) qs.set("page", String(params.page));
  const payload = await request(`api/v1/incidents?${qs.toString()}`, { signal });
  return normalizePage(pageSchema(vehicleIncidentSchema).parse(payload));
}

export async function createIncident(input: {
  company_id: number;
  branch_id: number;
  vehicle_id: number;
  rental_id?: number | null;
  incident_type: IncidentType;
  severity: IncidentSeverity;
  occurred_at: string;
  location?: string | null;
  driver_name?: string | null;
  insurance_claim_number?: string | null;
  estimated_cost_minor?: number | null;
  description: string;
  mark_vehicle_unsafe?: boolean;
}): Promise<VehicleIncident> {
  const payload = await request("api/v1/incidents", {
    method: "POST",
    body: input,
  });
  return unwrap(vehicleIncidentSchema, payload);
}

export async function updateIncident(
  incidentId: number | string,
  input: { status?: IncidentStatus; insurance_claim_number?: string | null },
): Promise<VehicleIncident> {
  const payload = await request(`api/v1/incidents/${incidentId}`, {
    method: "PATCH",
    body: input,
  });
  return unwrap(vehicleIncidentSchema, payload);
}

export async function createWorkOrderFromIncident(
  incidentId: number | string,
): Promise<{ incident: VehicleIncident; work_order: WorkOrder }> {
  const payload = await request(
    `api/v1/incidents/${incidentId}/create-work-order`,
    { method: "POST", body: {} },
  );
  return unwrap(
    z.object({
      incident: vehicleIncidentSchema,
      work_order: workOrderSchema,
    }),
    payload,
  );
}

// ---------- Quotation Customer Acceptance & Rental Amendment ----------

export async function acceptQuotation(
  quotationId: number | string,
  reference: string,
): Promise<Quotation> {
  const payload = await request(`api/v1/quotations/${quotationId}/accept`, {
    method: "POST",
    body: { customer_acceptance_ref: reference },
  });
  return unwrap(quotationSchema, payload);
}

export async function amendRental(
  rentalId: number | string,
  input: {
    amendment_type: "early_return" | "rate_change" | "terms_variation";
    new_ends_at?: string | null;
    security_deposit_minor?: number | null;
    deposit_status?: "none" | "held" | "refunded" | "retained";
    reason: string;
  },
): Promise<Rental> {
  const payload = await request(`api/v1/rentals/${rentalId}/amend`, {
    method: "POST",
    body: input,
  });
  return unwrap(rentalSchema, payload);
}

// ---------- Purchase Requisitions ----------

export async function listPurchaseRequisitions(
  params: {
    companyId: string;
    branchId?: string;
    status?: string;
    q?: string;
    page?: number;
  },
  signal?: AbortSignal,
) {
  const qs = new URLSearchParams({ company_id: params.companyId });
  if (params.branchId) qs.set("branch_id", params.branchId);
  if (params.status) qs.set("status", params.status);
  if (params.q?.trim()) qs.set("q", params.q.trim());
  if (params.page && params.page > 1) qs.set("page", String(params.page));
  const payload = await request(`api/v1/purchase-requisitions?${qs.toString()}`, {
    signal,
  });
  return normalizePage(pageSchema(purchaseRequisitionSchema).parse(payload));
}

export async function createPurchaseRequisition(input: {
  company_id: number;
  branch_id: number;
  supplier_id?: number | null;
  department: string;
  needed_by: string;
  justification: string;
  items: Array<{
    description: string;
    quantity: number;
    estimated_unit_minor: number;
  }>;
}): Promise<PurchaseRequisition> {
  const payload = await request("api/v1/purchase-requisitions", {
    method: "POST",
    body: input,
  });
  return unwrap(purchaseRequisitionSchema, payload);
}

export async function decidePurchaseRequisition(
  reqId: number | string,
  decision: "approve" | "reject",
): Promise<PurchaseRequisition> {
  const payload = await request(
    `api/v1/purchase-requisitions/${reqId}/${decision}`,
    { method: "POST", body: {} },
  );
  return unwrap(purchaseRequisitionSchema, payload);
}

export async function convertRequisitionToPo(
  reqId: number | string,
): Promise<{ requisition: PurchaseRequisition; purchase_order: PurchaseOrder }> {
  const payload = await request(
    `api/v1/purchase-requisitions/${reqId}/convert-to-po`,
    { method: "POST", body: {} },
  );
  return unwrap(
    z.object({
      requisition: purchaseRequisitionSchema,
      purchase_order: purchaseOrderSchema,
    }),
    payload,
  );
}

// ---------- Supplier Statement & VAT Return ----------

export async function getSupplierStatement(
  supplierId: number | string,
  params?: { from?: string; to?: string },
  signal?: AbortSignal,
): Promise<SupplierStatement> {
  const qs = new URLSearchParams();
  if (params?.from) qs.set("from", params.from);
  if (params?.to) qs.set("to", params.to);
  const q = qs.toString();
  const payload = await request(
    `api/v1/suppliers/${supplierId}/statement${q ? `?${q}` : ""}`,
    { signal },
  );
  return unwrap(supplierStatementSchema, payload);
}

export async function getVatReturn(
  params: { companyId: string; branchId?: string; from?: string; to?: string },
  signal?: AbortSignal,
): Promise<VatReturn> {
  const qs = new URLSearchParams({ company_id: params.companyId });
  if (params.branchId) qs.set("branch_id", params.branchId);
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  const payload = await request(
    `api/v1/reports/statements/vat-return?${qs.toString()}`,
    { signal },
  );
  return unwrap(vatReturnSchema, payload);
}

// ---------- Configurable 7-Type Approval Thresholds ----------

export async function getApprovalThresholds(
  companyId: string,
  signal?: AbortSignal,
): Promise<ApprovalThreshold[]> {
  const payload = await request(
    `api/v1/companies/${companyId}/approval-thresholds`,
    { signal },
  );
  return unwrap(z.array(approvalThresholdSchema), payload);
}

export async function updateApprovalThresholds(
  companyId: string,
  thresholds: ApprovalThreshold[],
): Promise<ApprovalThreshold[]> {
  const payload = await request(
    `api/v1/companies/${companyId}/approval-thresholds`,
    { method: "PATCH", body: { thresholds } },
  );
  return unwrap(z.array(approvalThresholdSchema), payload);
}
