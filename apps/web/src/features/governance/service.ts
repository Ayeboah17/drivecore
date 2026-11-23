import { z } from "zod";
import { ApiError, read, request } from "@/lib/api/client";
import {
  approvalRequestSchema,
  collectionNoteSchema,
  complianceExpiryRowSchema,
  complianceSummarySchema,
  creditAccountSchema,
  customerStatementSchema,
  pageSchema,
  type ApprovalRequest,
  type CollectionNote,
  type ComplianceExpiryRow,
  type ComplianceSummary,
  type CreditAccount,
  type CustomerStatement,
} from "@/lib/api/contracts";

export async function listCreditAccounts(
  params: { companyId: string; branchId?: string; holdOnly?: boolean; q?: string },
  signal?: AbortSignal,
): Promise<{ supported: boolean; items: CreditAccount[] }> {
  const sp = new URLSearchParams({ company_id: params.companyId });
  if (params.branchId) sp.set("branch_id", params.branchId);
  if (params.holdOnly) sp.set("hold_only", "1");
  if (params.q?.trim()) sp.set("q", params.q.trim().slice(0, 100));
  try {
    const payload = await read(
      `api/v1/credit/accounts?${sp.toString()}`,
      pageSchema(creditAccountSchema),
      signal,
    );
    return { supported: true, items: payload.data };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return { supported: false, items: [] };
    }
    throw err;
  }
}

export async function updateCreditAccount(
  customerId: number,
  body: {
    credit_limit_minor?: number | null;
    payment_terms_days?: number;
    is_on_credit_hold?: boolean;
    credit_hold_reason?: string | null;
  },
  signal?: AbortSignal,
): Promise<CreditAccount> {
  const payload = await request(`api/v1/credit/accounts/${customerId}`, {
    method: "PATCH",
    body,
    signal,
  });
  return z.object({ data: creditAccountSchema }).parse(payload).data;
}

export async function listCollectionNotes(
  params: { companyId: string; branchId?: string; customerId?: number; status?: string },
  signal?: AbortSignal,
): Promise<{ supported: boolean; items: CollectionNote[] }> {
  const sp = new URLSearchParams({ company_id: params.companyId });
  if (params.branchId) sp.set("branch_id", params.branchId);
  if (params.customerId) sp.set("customer_id", String(params.customerId));
  if (params.status) sp.set("status", params.status);
  try {
    const payload = await read(
      `api/v1/credit/collections?${sp.toString()}`,
      pageSchema(collectionNoteSchema),
      signal,
    );
    return { supported: true, items: payload.data };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return { supported: false, items: [] };
    }
    throw err;
  }
}

export async function createCollectionNote(
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<CollectionNote> {
  const payload = await request("api/v1/credit/collections", {
    method: "POST",
    body,
    signal,
  });
  return z.object({ data: collectionNoteSchema }).parse(payload).data;
}

export async function updateCollectionNote(
  id: number,
  body: { status: string; notes?: string },
  signal?: AbortSignal,
): Promise<CollectionNote> {
  const payload = await request(`api/v1/credit/collections/${id}`, {
    method: "PATCH",
    body,
    signal,
  });
  return z.object({ data: collectionNoteSchema }).parse(payload).data;
}

export async function getCustomerStatement(
  customerId: number | string,
  params: { from?: string; to?: string },
  signal?: AbortSignal,
): Promise<CustomerStatement> {
  const sp = new URLSearchParams();
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  const qs = sp.toString();
  const payload = await read(
    `api/v1/customers/${customerId}/statement${qs ? `?${qs}` : ""}`,
    z.object({ data: customerStatementSchema }),
    signal,
  );
  return payload.data;
}

export async function listApprovalRequests(
  params: { companyId: string; branchId?: string; type?: string; status?: string },
  signal?: AbortSignal,
): Promise<{ supported: boolean; items: ApprovalRequest[] }> {
  const sp = new URLSearchParams({ company_id: params.companyId });
  if (params.branchId) sp.set("branch_id", params.branchId);
  if (params.type) sp.set("type", params.type);
  if (params.status) sp.set("status", params.status);
  try {
    const payload = await read(
      `api/v1/approvals?${sp.toString()}`,
      pageSchema(approvalRequestSchema),
      signal,
    );
    return { supported: true, items: payload.data };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return { supported: false, items: [] };
    }
    throw err;
  }
}

export async function createApprovalRequest(
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<ApprovalRequest> {
  const payload = await request("api/v1/approvals", {
    method: "POST",
    body,
    signal,
  });
  return z.object({ data: approvalRequestSchema }).parse(payload).data;
}

export async function decideApprovalRequest(
  id: number,
  decision: "approve" | "reject",
  body: { approved_value?: string; decision_notes?: string },
  signal?: AbortSignal,
): Promise<ApprovalRequest> {
  const payload = await request(`api/v1/approvals/${id}/${decision}`, {
    method: "POST",
    body,
    signal,
  });
  return z.object({ data: approvalRequestSchema }).parse(payload).data;
}

const complianceResponseSchema = pageSchema(complianceExpiryRowSchema).extend({
  meta: pageSchema(complianceExpiryRowSchema).shape.meta.extend({
    summary: complianceSummarySchema.optional(),
  }),
});

export async function listComplianceExpiries(
  params: { companyId: string; branchId?: string; bucket?: string; category?: string },
  signal?: AbortSignal,
): Promise<{
  supported: boolean;
  items: ComplianceExpiryRow[];
  summary: ComplianceSummary | null;
}> {
  const sp = new URLSearchParams({ company_id: params.companyId });
  if (params.branchId) sp.set("branch_id", params.branchId);
  if (params.bucket) sp.set("bucket", params.bucket);
  if (params.category) sp.set("category", params.category);
  try {
    const payload = await read(
      `api/v1/compliance/expiries?${sp.toString()}`,
      complianceResponseSchema,
      signal,
    );
    return {
      supported: true,
      items: payload.data,
      summary: payload.meta.summary ?? null,
    };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return { supported: false, items: [], summary: null };
    }
    throw err;
  }
}
