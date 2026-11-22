import { z } from "zod";
import { read } from "@/lib/api/client";
import {
  auditEventSchema,
  dashboardSummarySchema,
  financialReportSchema,
  fleetReportRowSchema,
  normalizePage,
  pageSchema,
  type AuditEventRecord,
  type DashboardSummary,
  type FinancialReport,
  type FleetReportRow,
} from "@/lib/api/contracts";

export async function getDashboardSummary(
  params: {
    companyId: string;
    branchId?: string;
    from?: string;
    to?: string;
  },
  signal: AbortSignal,
): Promise<DashboardSummary> {
  const query = new URLSearchParams({ company_id: params.companyId });
  if (params.branchId) query.set("branch_id", params.branchId);
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  const res = await read(
    `api/v1/dashboard/summary?${query.toString()}`,
    z.object({ data: dashboardSummarySchema }),
    signal,
  );
  return res.data;
}

export async function getFinancialReport(
  params: {
    companyId: string;
    branchId?: string;
    from?: string;
    to?: string;
  },
  signal: AbortSignal,
): Promise<FinancialReport> {
  const query = new URLSearchParams({ company_id: params.companyId });
  if (params.branchId) query.set("branch_id", params.branchId);
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  const res = await read(
    `api/v1/reports/financial?${query.toString()}`,
    z.object({ data: financialReportSchema }),
    signal,
  );
  return res.data;
}

export async function getFleetReport(
  params: {
    companyId: string;
    branchId?: string;
    from?: string;
    to?: string;
  },
  signal: AbortSignal,
): Promise<FleetReportRow[]> {
  const query = new URLSearchParams({ company_id: params.companyId });
  if (params.branchId) query.set("branch_id", params.branchId);
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  const res = await read(
    `api/v1/reports/fleet?${query.toString()}`,
    z.object({ data: z.array(fleetReportRowSchema) }),
    signal,
  );
  return res.data;
}

export async function listAuditEvents(
  params: {
    companyId: string;
    action?: string;
    entityType?: string;
    q?: string;
    page?: number;
  },
  signal: AbortSignal,
): Promise<{
  items: AuditEventRecord[];
  page: number;
  lastPage: number;
  pageSize: number;
  total: number;
}> {
  const query = new URLSearchParams({ company_id: params.companyId });
  if (params.action) query.set("action", params.action);
  if (params.entityType) query.set("entity_type", params.entityType);
  if (params.q?.trim()) query.set("q", params.q.trim());
  if (params.page && params.page > 1) query.set("page", String(params.page));
  const page = await read(
    `api/v1/audit-events?${query.toString()}`,
    pageSchema(auditEventSchema),
    signal,
  );
  return normalizePage(page);
}
