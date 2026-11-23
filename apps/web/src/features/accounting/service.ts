import { z } from "zod";
import { request } from "@/lib/api/client";

function apiRequest(
  path: string,
  options?: {
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    body?: unknown;
    signal?: AbortSignal;
  },
) {
  return request(path.replace(/^\/+/, ""), options);
}
import {
  apAgeingSchema,
  balanceSheetSchema,
  bankAccountSchema,
  bankReconciliationSchema,
  bankTransactionSchema,
  cashFlowStatementSchema,
  creditNoteSchema,
  depreciationRunResultSchema,
  fixedAssetSchema,
  normalizePage,
  pageSchema,
  pnlStatementSchema,
  supplierInvoiceSchema,
  type ApAgeing,
  type BalanceSheet,
  type BankAccount,
  type BankReconciliation,
  type BankTransaction,
  type CashFlowStatement,
  type CreditNote,
  type DepreciationMethod,
  type DepreciationRunResult,
  type FixedAsset,
  type FixedAssetCategory,
  type PnlStatement,
  type SupplierInvoice,
} from "@/lib/api/contracts";

function unwrap<T extends z.ZodType>(schema: T, payload: unknown): z.infer<T> {
  const data =
    payload && typeof payload === "object" && "data" in payload
      ? (payload as { data: unknown }).data
      : payload;
  return schema.parse(data);
}

// ---------- Accounts Payable (AP) ----------

export async function listSupplierInvoices(
  params: {
    companyId: string;
    branchId?: string;
    supplierId?: string;
    purchaseOrderId?: string;
    status?: string;
    matchStatus?: string;
    ageingBucket?: string;
    q?: string;
    page?: number;
  },
  signal?: AbortSignal,
) {
  const qs = new URLSearchParams({ company_id: params.companyId });
  if (params.branchId) qs.set("branch_id", params.branchId);
  if (params.supplierId) qs.set("supplier_id", params.supplierId);
  if (params.purchaseOrderId) qs.set("purchase_order_id", params.purchaseOrderId);
  if (params.status) qs.set("status", params.status);
  if (params.matchStatus) qs.set("match_status", params.matchStatus);
  if (params.ageingBucket) qs.set("ageing_bucket", params.ageingBucket);
  if (params.q?.trim()) qs.set("q", params.q.trim());
  if (params.page && params.page > 1) qs.set("page", String(params.page));

  const payload = await apiRequest(`/api/v1/ap/invoices?${qs.toString()}`, {
    signal,
  });
  return normalizePage(pageSchema(supplierInvoiceSchema).parse(payload));
}

export async function getApAgeing(
  params: { companyId: string; branchId?: string },
  signal?: AbortSignal,
): Promise<ApAgeing> {
  const qs = new URLSearchParams({ company_id: params.companyId });
  if (params.branchId) qs.set("branch_id", params.branchId);
  const payload = await apiRequest(`/api/v1/ap/ageing?${qs.toString()}`, {
    signal,
  });
  return unwrap(apAgeingSchema, payload);
}

export async function createSupplierInvoice(input: {
  company_id: number;
  branch_id: number;
  supplier_id: number;
  purchase_order_id?: number | null;
  invoice_number: string;
  invoice_date: string;
  due_at: string;
  subtotal_minor: number;
  vat_minor?: number;
  expense_account_code?: string | null;
  notes?: string | null;
}): Promise<SupplierInvoice> {
  const payload = await apiRequest("/api/v1/ap/invoices", {
    method: "POST",
    body: input,
  });
  return unwrap(supplierInvoiceSchema, payload);
}

export async function recordSupplierPayment(
  supplierInvoiceId: number | string,
  input: {
    amount_minor: number;
    method: "bank_transfer" | "cash" | "card" | "mobile_money";
    bank_account_id?: number | null;
    reference?: string | null;
    paid_at: string;
  },
): Promise<SupplierInvoice> {
  const payload = await apiRequest(
    `/api/v1/ap/invoices/${supplierInvoiceId}/payments`,
    {
      method: "POST",
      body: input,
    },
  );
  return unwrap(supplierInvoiceSchema, payload);
}

// ---------- Customer Credit Notes ----------

export async function listCreditNotes(
  params: {
    companyId: string;
    branchId?: string;
    invoiceId?: string;
    customerId?: string;
    status?: string;
    q?: string;
    page?: number;
  },
  signal?: AbortSignal,
) {
  const qs = new URLSearchParams({ company_id: params.companyId });
  if (params.branchId) qs.set("branch_id", params.branchId);
  if (params.invoiceId) qs.set("invoice_id", params.invoiceId);
  if (params.customerId) qs.set("customer_id", params.customerId);
  if (params.status) qs.set("status", params.status);
  if (params.q?.trim()) qs.set("q", params.q.trim());
  if (params.page && params.page > 1) qs.set("page", String(params.page));

  const payload = await apiRequest(`/api/v1/credit-notes?${qs.toString()}`, {
    signal,
  });
  return normalizePage(pageSchema(creditNoteSchema).parse(payload));
}

export async function issueCreditNote(
  invoiceId: number | string,
  input: {
    subtotal_minor: number;
    vat_minor?: number;
    reason: string;
    require_approval?: boolean;
  },
): Promise<CreditNote> {
  const payload = await apiRequest(`/api/v1/invoices/${invoiceId}/credit-notes`, {
    method: "POST",
    body: input,
  });
  return unwrap(creditNoteSchema, payload);
}

// ---------- Cash & Bank Accounts + Reconciliation ----------

export async function listBankAccounts(
  params: { companyId: string; branchId?: string },
  signal?: AbortSignal,
): Promise<BankAccount[]> {
  const qs = new URLSearchParams({ company_id: params.companyId });
  if (params.branchId) qs.set("branch_id", params.branchId);
  const payload = await apiRequest(`/api/v1/bank-accounts?${qs.toString()}`, {
    signal,
  });
  return unwrap(z.array(bankAccountSchema), payload);
}

export async function createBankAccount(input: {
  company_id: number;
  branch_id?: number | null;
  name: string;
  bank_name: string;
  account_number_masked: string;
  currency: string;
  gl_account_code: string;
  opening_balance_minor: number;
}): Promise<BankAccount> {
  const payload = await apiRequest("/api/v1/bank-accounts", {
    method: "POST",
    body: input,
  });
  return unwrap(bankAccountSchema, payload);
}

export async function listBankTransactions(
  bankAccountId: number | string,
  params?: { matchStatus?: string; from?: string; to?: string; page?: number },
  signal?: AbortSignal,
) {
  const qs = new URLSearchParams();
  if (params?.matchStatus) qs.set("match_status", params.matchStatus);
  if (params?.from) qs.set("from", params.from);
  if (params?.to) qs.set("to", params.to);
  if (params?.page && params.page > 1) qs.set("page", String(params.page));
  const query = qs.toString();
  const payload = await apiRequest(
    `/api/v1/bank-accounts/${bankAccountId}/transactions${query ? `?${query}` : ""}`,
    { signal },
  );
  return normalizePage(pageSchema(bankTransactionSchema).parse(payload));
}

export async function importBankTransactions(
  bankAccountId: number | string,
  lines: Array<{
    transaction_date: string;
    description: string;
    reference?: string | null;
    amount_minor: number;
  }>,
): Promise<BankTransaction[]> {
  const payload = await apiRequest(
    `/api/v1/bank-accounts/${bankAccountId}/transactions`,
    {
      method: "POST",
      body: { lines },
    },
  );
  return unwrap(z.array(bankTransactionSchema), payload);
}

export async function matchBankTransaction(
  transactionId: number | string,
  input:
    | {
        mode: "match";
        entity_type:
          | "payment"
          | "supplier_payment"
          | "refund"
          | "expense"
          | "journal_entry";
        entity_id: number;
      }
    | {
        mode: "adjustment";
        gl_account_code: string;
        notes?: string;
      },
): Promise<BankTransaction> {
  const payload = await apiRequest(
    `/api/v1/bank-transactions/${transactionId}/match`,
    {
      method: "POST",
      body: input,
    },
  );
  return unwrap(bankTransactionSchema, payload);
}

export async function unmatchBankTransaction(
  transactionId: number | string,
): Promise<BankTransaction> {
  const payload = await apiRequest(
    `/api/v1/bank-transactions/${transactionId}/unmatch`,
    {
      method: "POST",
      body: {},
    },
  );
  return unwrap(bankTransactionSchema, payload);
}

export async function closeBankReconciliation(
  bankAccountId: number | string,
  input: {
    statement_date: string;
    statement_closing_balance_minor: number;
  },
): Promise<BankReconciliation> {
  const payload = await apiRequest(
    `/api/v1/bank-accounts/${bankAccountId}/reconciliations`,
    {
      method: "POST",
      body: input,
    },
  );
  return unwrap(bankReconciliationSchema, payload);
}

// ---------- Fixed Assets, Monthly Depreciation & Vehicle Disposal ----------

export async function listFixedAssets(
  params: {
    companyId: string;
    branchId?: string;
    vehicleId?: string;
    status?: string;
    category?: string;
    q?: string;
    page?: number;
  },
  signal?: AbortSignal,
) {
  const qs = new URLSearchParams({ company_id: params.companyId });
  if (params.branchId) qs.set("branch_id", params.branchId);
  if (params.vehicleId) qs.set("vehicle_id", params.vehicleId);
  if (params.status) qs.set("status", params.status);
  if (params.category) qs.set("category", params.category);
  if (params.q?.trim()) qs.set("q", params.q.trim());
  if (params.page && params.page > 1) qs.set("page", String(params.page));
  const payload = await apiRequest(`/api/v1/fixed-assets?${qs.toString()}`, {
    signal,
  });
  return normalizePage(pageSchema(fixedAssetSchema).parse(payload));
}

export async function createFixedAsset(input: {
  company_id: number;
  branch_id: number;
  vehicle_id?: number | null;
  asset_code: string;
  name: string;
  category: FixedAssetCategory;
  acquisition_cost_minor: number;
  residual_value_minor: number;
  capitalisation_date: string;
  useful_life_months: number;
  depreciation_method: DepreciationMethod;
}): Promise<FixedAsset> {
  const payload = await apiRequest("/api/v1/fixed-assets", {
    method: "POST",
    body: input,
  });
  return unwrap(fixedAssetSchema, payload);
}

export async function runMonthlyDepreciation(input: {
  company_id: number;
  period_month: string;
}): Promise<DepreciationRunResult> {
  const payload = await apiRequest("/api/v1/fixed-assets/depreciate", {
    method: "POST",
    body: input,
  });
  return unwrap(depreciationRunResultSchema, payload);
}

export async function requestAssetDisposal(
  assetId: number | string,
  input: {
    disposal_type: "sold" | "decommissioned";
    disposal_date: string;
    disposal_proceeds_minor: number;
    reason: string;
  },
): Promise<FixedAsset> {
  const payload = await apiRequest(
    `/api/v1/fixed-assets/${assetId}/request-disposal`,
    {
      method: "POST",
      body: input,
    },
  );
  return unwrap(fixedAssetSchema, payload);
}

export async function completeAssetDisposal(
  assetId: number | string,
  input?: {
    disposal_proceeds_minor?: number;
    disposal_date?: string;
  },
): Promise<FixedAsset> {
  const payload = await apiRequest(`/api/v1/fixed-assets/${assetId}/dispose`, {
    method: "POST",
    body: input ?? {},
  });
  return unwrap(fixedAssetSchema, payload);
}

// ---------- Formal Financial Statements ----------

export async function getPnlStatement(
  params: { companyId: string; branchId?: string; from?: string; to?: string },
  signal?: AbortSignal,
): Promise<PnlStatement> {
  const qs = new URLSearchParams({ company_id: params.companyId });
  if (params.branchId) qs.set("branch_id", params.branchId);
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  const payload = await apiRequest(
    `/api/v1/reports/statements/pnl?${qs.toString()}`,
    { signal },
  );
  return unwrap(pnlStatementSchema, payload);
}

export async function getBalanceSheet(
  params: { companyId: string; branchId?: string; asOf?: string },
  signal?: AbortSignal,
): Promise<BalanceSheet> {
  const qs = new URLSearchParams({ company_id: params.companyId });
  if (params.branchId) qs.set("branch_id", params.branchId);
  if (params.asOf) qs.set("as_of", params.asOf);
  const payload = await apiRequest(
    `/api/v1/reports/statements/balance-sheet?${qs.toString()}`,
    { signal },
  );
  return unwrap(balanceSheetSchema, payload);
}

export async function getCashFlowStatement(
  params: { companyId: string; branchId?: string; from?: string; to?: string },
  signal?: AbortSignal,
): Promise<CashFlowStatement> {
  const qs = new URLSearchParams({ company_id: params.companyId });
  if (params.branchId) qs.set("branch_id", params.branchId);
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  const payload = await apiRequest(
    `/api/v1/reports/statements/cash-flow?${qs.toString()}`,
    { signal },
  );
  return unwrap(cashFlowStatementSchema, payload);
}
