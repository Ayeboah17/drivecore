import { z } from "zod";
import { request } from "@/lib/api/client";
import {
  customerSchema,
  leadSchema,
  normalizePage,
  pageSchema,
  type Customer,
  type Lead,
  type LeadSource,
  type LeadStage,
} from "@/lib/api/contracts";

function unwrap<T extends z.ZodType>(schema: T, payload: unknown): z.infer<T> {
  const data =
    payload && typeof payload === "object" && "data" in payload
      ? (payload as { data: unknown }).data
      : payload;
  return schema.parse(data);
}

export async function listLeads(
  params: {
    companyId: string;
    branchId?: string;
    stage?: string;
    source?: string;
    q?: string;
    page?: number;
  },
  signal?: AbortSignal,
) {
  const qs = new URLSearchParams({ company_id: params.companyId });
  if (params.branchId) qs.set("branch_id", params.branchId);
  if (params.stage) qs.set("stage", params.stage);
  if (params.source) qs.set("source", params.source);
  if (params.q?.trim()) qs.set("q", params.q.trim());
  if (params.page && params.page > 1) qs.set("page", String(params.page));
  const payload = await request(`api/v1/leads?${qs.toString()}`, { signal });
  return normalizePage(pageSchema(leadSchema).parse(payload));
}

export async function createLead(input: {
  company_id: number;
  branch_id: number;
  contact_name: string;
  company_name?: string | null;
  customer_type: "individual" | "corporate";
  email?: string | null;
  phone?: string | null;
  source: LeadSource;
  vehicle_requirements?: string | null;
  expected_start_date?: string | null;
  expected_days?: number | null;
  estimated_value_minor?: number | null;
  next_follow_up_at?: string | null;
  notes?: string | null;
}): Promise<Lead> {
  const payload = await request("api/v1/leads", {
    method: "POST",
    body: input,
  });
  return unwrap(leadSchema, payload);
}

export async function updateLead(
  leadId: number | string,
  input: {
    stage?: LeadStage;
    lost_reason?: string | null;
    next_follow_up_at?: string | null;
    notes?: string | null;
    contact_name?: string;
    company_name?: string | null;
    estimated_value_minor?: number | null;
  },
): Promise<Lead> {
  const payload = await request(`api/v1/leads/${leadId}`, {
    method: "PATCH",
    body: input,
  });
  return unwrap(leadSchema, payload);
}

export async function convertLeadToCustomer(
  leadId: number | string,
): Promise<{ lead: Lead; customer: Customer }> {
  const payload = await request(`api/v1/leads/${leadId}/convert`, {
    method: "POST",
    body: {},
  });
  return unwrap(
    z.object({
      lead: leadSchema,
      customer: customerSchema,
    }),
    payload,
  );
}
