import { z } from "zod";
import { ApiError, read, request } from "@/lib/api/client";
import {
  arAgeingSummarySchema,
  expenseRecordSchema,
  glTrialBalanceSchema,
  invoiceSchema,
  journalEntrySchema,
  normalizePage,
  pageSchema,
  paymentRecordSchema,
  refundRecordSchema,
  type ArAgeingBucketKey,
  type ArAgeingSummary,
  type ExpenseCategory,
  type ExpenseRecord,
  type GlTrialBalance,
  type Invoice,
  type JournalEntry,
  type PaymentMethod,
  type PaymentRecord,
  type RefundRecord,
} from "@/lib/api/contracts";
import type { SortDirection } from "@/lib/table-sort";

export interface InvoiceLinePayload {
  description: string;
  quantity: number;
  unit_price_minor: number;
}

export async function listInvoices(
  params: {
    companyId: string;
    branchId?: string;
    status?: string;
    customerId?: string;
    rentalId?: string;
    ageingBucket?: ArAgeingBucketKey | "";
    q?: string;
    page?: number;
    sort?: string;
    dir?: SortDirection | "";
  },
  signal: AbortSignal,
): Promise<{
  items: Invoice[];
  page: number;
  lastPage: number;
  pageSize: number;
  total: number;
}> {
  const query = new URLSearchParams({ company_id: params.companyId });
  if (params.branchId) query.set("branch_id", params.branchId);
  if (params.status) query.set("status", params.status);
  if (params.customerId) query.set("customer_id", params.customerId);
  if (params.rentalId) query.set("rental_id", params.rentalId);
  if (params.ageingBucket) query.set("ageing_bucket", params.ageingBucket);
  if (params.q?.trim()) query.set("q", params.q.trim());
  if (params.page && params.page > 1) query.set("page", String(params.page));
  if (params.sort) {
    query.set("sort", params.sort);
    if (params.dir) query.set("dir", params.dir);
  }
  const page = await read(
    `api/v1/invoices?${query.toString()}`,
    pageSchema(invoiceSchema),
    signal,
  );
  return normalizePage(page);
}

export async function getInvoice(
  invoiceId: string,
  signal: AbortSignal,
): Promise<Invoice> {
  const response = await read(
    `api/v1/invoices/${invoiceId}`,
    z.object({ data: invoiceSchema }),
    signal,
  );
  return response.data;
}

export async function getArAgeing(
  params: { companyId: string; branchId?: string },
  signal: AbortSignal,
): Promise<ArAgeingSummary> {
  const query = new URLSearchParams({ company_id: params.companyId });
  if (params.branchId) query.set("branch_id", params.branchId);
  const response = await read(
    `api/v1/invoices/ageing?${query.toString()}`,
    z.object({ data: arAgeingSummarySchema }),
    signal,
  );
  return response.data;
}

export async function createInvoice(
  body: {
    company_id: number;
    branch_id: number;
    customer_id?: number | null;
    custom_customer_name?: string | null;
    custom_customer_email?: string | null;
    custom_customer_phone?: string | null;
    due_at: string;
    discount_pct: number;
    notes?: string;
    lines: InvoiceLinePayload[];
  },
  signal: AbortSignal,
): Promise<Invoice> {
  const payload = await request("api/v1/invoices", {
    method: "POST",
    body,
    signal,
  });
  const parsed = z.object({ data: invoiceSchema }).safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(502, "Unexpected invoice creation response.");
  }
  return parsed.data.data;
}

export async function updateInvoice(
  invoiceId: number,
  body: {
    due_at: string;
    discount_pct: number;
    notes?: string;
    custom_customer_name?: string | null;
    custom_customer_email?: string | null;
    custom_customer_phone?: string | null;
    lines: InvoiceLinePayload[];
  },
  signal: AbortSignal,
): Promise<Invoice> {
  const payload = await request(`api/v1/invoices/${invoiceId}`, {
    method: "PATCH",
    body,
    signal,
  });
  const parsed = z.object({ data: invoiceSchema }).safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(502, "Unexpected invoice update response.");
  }
  return parsed.data.data;
}

export async function issueInvoice(
  invoiceId: number,
  signal: AbortSignal,
): Promise<Invoice> {
  const payload = await request(`api/v1/invoices/${invoiceId}/issue`, {
    method: "POST",
    body: {},
    signal,
  });
  const parsed = z.object({ data: invoiceSchema }).safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(502, "Unexpected invoice issue response.");
  }
  return parsed.data.data;
}

export async function voidInvoice(
  invoiceId: number,
  signal: AbortSignal,
): Promise<Invoice> {
  const payload = await request(`api/v1/invoices/${invoiceId}/void`, {
    method: "POST",
    body: {},
    signal,
  });
  const parsed = z.object({ data: invoiceSchema }).safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(502, "Unexpected invoice void response.");
  }
  return parsed.data.data;
}

export async function listPayments(
  params: {
    companyId: string;
    branchId?: string;
    invoiceId?: string;
    method?: string;
    q?: string;
    page?: number;
    sort?: string;
    dir?: SortDirection | "";
  },
  signal: AbortSignal,
): Promise<{
  items: PaymentRecord[];
  page: number;
  lastPage: number;
  pageSize: number;
  total: number;
}> {
  const query = new URLSearchParams({ company_id: params.companyId });
  if (params.branchId) query.set("branch_id", params.branchId);
  if (params.invoiceId) query.set("invoice_id", params.invoiceId);
  if (params.method) query.set("method", params.method);
  if (params.q?.trim()) query.set("q", params.q.trim());
  if (params.page && params.page > 1) query.set("page", String(params.page));
  if (params.sort) {
    query.set("sort", params.sort);
    if (params.dir) query.set("dir", params.dir);
  }
  const page = await read(
    `api/v1/payments?${query.toString()}`,
    pageSchema(paymentRecordSchema),
    signal,
  );
  return normalizePage(page);
}

export async function recordPayment(
  invoiceId: number,
  body: {
    amount_minor: number;
    method: PaymentMethod;
    reference: string;
    paid_at?: string;
  },
  signal: AbortSignal,
): Promise<PaymentRecord> {
  const payload = await request(`api/v1/invoices/${invoiceId}/payments`, {
    method: "POST",
    body,
    signal,
  });
  const parsed = z.object({ data: paymentRecordSchema }).safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(502, "Unexpected payment response.");
  }
  return parsed.data.data;
}

export async function listRefunds(
  params: {
    companyId: string;
    branchId?: string;
    invoiceId?: string;
    q?: string;
    page?: number;
    sort?: string;
    dir?: SortDirection | "";
  },
  signal: AbortSignal,
): Promise<{
  items: RefundRecord[];
  page: number;
  lastPage: number;
  pageSize: number;
  total: number;
}> {
  const query = new URLSearchParams({ company_id: params.companyId });
  if (params.branchId) query.set("branch_id", params.branchId);
  if (params.invoiceId) query.set("invoice_id", params.invoiceId);
  if (params.q?.trim()) query.set("q", params.q.trim());
  if (params.page && params.page > 1) query.set("page", String(params.page));
  if (params.sort) {
    query.set("sort", params.sort);
    if (params.dir) query.set("dir", params.dir);
  }
  const page = await read(
    `api/v1/refunds?${query.toString()}`,
    pageSchema(refundRecordSchema),
    signal,
  );
  return normalizePage(page);
}

export async function recordRefund(
  invoiceId: number,
  body: {
    amount_minor: number;
    reason: string;
    refunded_at?: string;
  },
  signal: AbortSignal,
): Promise<RefundRecord> {
  const payload = await request(`api/v1/invoices/${invoiceId}/refunds`, {
    method: "POST",
    body,
    signal,
  });
  const parsed = z.object({ data: refundRecordSchema }).safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(502, "Unexpected refund response.");
  }
  return parsed.data.data;
}

export async function listExpenses(
  params: {
    companyId: string;
    branchId?: string;
    category?: string;
    vehicleId?: string;
    q?: string;
    page?: number;
    sort?: string;
    dir?: SortDirection | "";
  },
  signal: AbortSignal,
): Promise<{
  items: ExpenseRecord[];
  page: number;
  lastPage: number;
  pageSize: number;
  total: number;
}> {
  const query = new URLSearchParams({ company_id: params.companyId });
  if (params.branchId) query.set("branch_id", params.branchId);
  if (params.category) query.set("category", params.category);
  if (params.vehicleId) query.set("vehicle_id", params.vehicleId);
  if (params.q?.trim()) query.set("q", params.q.trim());
  if (params.page && params.page > 1) query.set("page", String(params.page));
  if (params.sort) {
    query.set("sort", params.sort);
    if (params.dir) query.set("dir", params.dir);
  }
  const page = await read(
    `api/v1/expenses?${query.toString()}`,
    pageSchema(expenseRecordSchema),
    signal,
  );
  return normalizePage(page);
}

export async function createExpense(
  body: {
    company_id: number;
    branch_id: number;
    vehicle_id?: number | null;
    category: ExpenseCategory;
    description: string;
    amount_minor: number;
    incurred_at: string;
  },
  signal: AbortSignal,
): Promise<ExpenseRecord> {
  const payload = await request("api/v1/expenses", {
    method: "POST",
    body,
    signal,
  });
  const parsed = z.object({ data: expenseRecordSchema }).safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(502, "Unexpected expense response.");
  }
  return parsed.data.data;
}

export async function getGlAccounts(
  params: { companyId: string; branchId?: string },
  signal: AbortSignal,
): Promise<GlTrialBalance> {
  const query = new URLSearchParams({ company_id: params.companyId });
  if (params.branchId) query.set("branch_id", params.branchId);
  const response = await read(
    `api/v1/gl/accounts?${query.toString()}`,
    z.object({ data: glTrialBalanceSchema }),
    signal,
  );
  return response.data;
}

export async function listJournalEntries(
  params: {
    companyId: string;
    branchId?: string;
    accountCode?: string;
    sourceType?: string;
    q?: string;
    page?: number;
  },
  signal: AbortSignal,
): Promise<{
  items: JournalEntry[];
  page: number;
  lastPage: number;
  pageSize: number;
  total: number;
}> {
  const query = new URLSearchParams({ company_id: params.companyId });
  if (params.branchId) query.set("branch_id", params.branchId);
  if (params.accountCode) query.set("account_code", params.accountCode);
  if (params.sourceType) query.set("source_type", params.sourceType);
  if (params.q?.trim()) query.set("q", params.q.trim());
  if (params.page && params.page > 1) query.set("page", String(params.page));
  const page = await read(
    `api/v1/gl/journal-entries?${query.toString()}`,
    pageSchema(journalEntrySchema),
    signal,
  );
  return normalizePage(page);
}
