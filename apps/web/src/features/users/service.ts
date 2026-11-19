import { z } from "zod";
import { ApiError, read, request } from "@/lib/api/client";
import {
  managedUserSchema,
  normalizePage,
  pageSchema,
  roleDefinitionSchema,
  userSchema,
  type ManagedUser,
  type RoleDefinition,
} from "@/lib/api/contracts";

export async function listUsers(
  params: {
    companyId: string;
    branch: string;
    q: string;
    role: string;
    isActive: string;
    page: number;
  },
  signal: AbortSignal,
) {
  const query = new URLSearchParams({ company_id: params.companyId });
  if (params.branch !== "all") query.set("branch_id", params.branch);
  const trimmedQ = params.q.trim().slice(0, 100);
  if (trimmedQ) query.set("q", trimmedQ);
  if (params.role) query.set("role", params.role);
  if (params.isActive === "1" || params.isActive === "0") {
    query.set("is_active", params.isActive);
  }
  if (params.page > 1) query.set("page", String(params.page));

  const payload = await read(
    `api/v1/users?${query.toString()}`,
    pageSchema(managedUserSchema),
    signal,
  );
  const normalized = normalizePage(payload);
  for (const item of normalized.items) {
    if (
      String(item.company_id) !== params.companyId ||
      (params.branch !== "all" && String(item.branch_id) !== params.branch)
    ) {
      throw new ApiError(
        502,
        "Unexpected user scope returned by the API. Refresh and try again.",
      );
    }
  }
  return normalized as {
    items: ManagedUser[];
    page: number;
    lastPage: number;
    pageSize: number;
    total: number;
  };
}

export async function listRoles(
  companyId: string,
  signal: AbortSignal,
): Promise<RoleDefinition[]> {
  const payload = await read(
    `api/v1/roles?company_id=${encodeURIComponent(companyId)}`,
    z.object({ data: z.array(roleDefinitionSchema) }),
    signal,
  );
  return payload.data;
}

export async function createUser(
  body: {
    company_id: number;
    branch_id: number | null;
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
    role: string;
  },
  signal: AbortSignal,
) {
  const payload = await request("api/v1/users", {
    method: "POST",
    body,
    signal,
  });
  const parsed = z.object({ data: userSchema }).safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(
      502,
      "Unexpected user creation response. Refresh before submitting again.",
    );
  }
  return parsed.data.data;
}

export async function updateUser(
  userId: number,
  body: {
    company_id: number;
    branch_id?: number | null;
    role?: string;
    is_active?: boolean;
  },
  signal: AbortSignal,
) {
  const payload = await request(`api/v1/users/${userId}`, {
    method: "PATCH",
    body,
    signal,
  });
  const parsed = z.object({ data: managedUserSchema }).safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(
      502,
      "Unexpected user update response. Refresh before submitting again.",
    );
  }
  return parsed.data.data;
}
