import { z } from "zod";
import { ApiError, read, request } from "@/lib/api/client";
import {
  companyMailSettingsSchema,
  companyMailTestResultSchema,
  managedUserSchema,
  normalizePage,
  pageSchema,
  roleDefinitionSchema,
  userSchema,
  type CompanyMailSettings,
  type CompanyMailTestResult,
  type MailEncryption,
  type MailProvider,
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
    sort?: string;
    dir?: string;
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
  if (params.sort) {
    query.set("sort", params.sort);
    if (params.dir === "asc" || params.dir === "desc") {
      query.set("dir", params.dir);
    }
  }

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

export async function resetUserTwoFactor(
  userId: number,
  companyId: number,
  signal?: AbortSignal,
): Promise<ManagedUser> {
  const payload = await request(`api/v1/users/${userId}/reset-two-factor`, {
    method: "POST",
    body: { company_id: companyId },
    signal,
  });
  return z.object({ data: managedUserSchema }).parse(payload).data;
}

export async function deleteUser(
  userId: number,
  companyId: string | number,
  signal?: AbortSignal,
): Promise<{ deleted: boolean; id: number }> {
  const payload = await request(
    `api/v1/users/${userId}?company_id=${encodeURIComponent(String(companyId))}`,
    {
      method: "DELETE",
      signal,
    },
  );
  const parsed = z
    .object({ data: z.object({ deleted: z.boolean(), id: z.coerce.number().int() }) })
    .safeParse(payload);
  if (!parsed.success) {
    return { deleted: true, id: userId };
  }
  return parsed.data.data;
}

export async function updateRolePermissions(
  roleName: string,
  body: { company_id: number; permissions: string[] },
  signal?: AbortSignal,
): Promise<RoleDefinition> {
  const payload = await request(`api/v1/roles/${encodeURIComponent(roleName)}`, {
    method: "PATCH",
    body,
    signal,
  });
  const parsed = z.object({ data: roleDefinitionSchema }).safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(502, "Unexpected role permission update response.");
  }
  return parsed.data.data;
}

export async function resetRolePermissions(
  roleName: string,
  companyId: number,
  signal?: AbortSignal,
): Promise<RoleDefinition> {
  const payload = await request(
    `api/v1/roles/${encodeURIComponent(roleName)}/reset`,
    {
      method: "POST",
      body: { company_id: companyId },
      signal,
    },
  );
  const parsed = z.object({ data: roleDefinitionSchema }).safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(502, "Unexpected role permission reset response.");
  }
  return parsed.data.data;
}

export async function getCompanyMailSettings(
  companyId: string,
  signal: AbortSignal,
): Promise<CompanyMailSettings> {
  const payload = await read(
    `api/v1/companies/${encodeURIComponent(companyId)}/mail-settings`,
    z.object({ data: companyMailSettingsSchema }),
    signal,
  );
  return payload.data;
}

export async function updateCompanyMailSettings(
  companyId: string,
  body: {
    provider: MailProvider;
    host: string;
    port: number;
    encryption: MailEncryption;
    username: string | null;
    password?: string;
    from_name: string;
    from_address: string;
    is_enabled: boolean;
  },
  signal?: AbortSignal,
): Promise<CompanyMailSettings> {
  const payload = await request(
    `api/v1/companies/${encodeURIComponent(companyId)}/mail-settings`,
    {
      method: "PATCH",
      body,
      signal,
    },
  );
  const parsed = z
    .object({ data: companyMailSettingsSchema })
    .safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(502, "Unexpected mail settings response.");
  }
  return parsed.data.data;
}

export async function testCompanyMailSettings(
  companyId: string,
  toEmail: string,
  signal?: AbortSignal,
): Promise<CompanyMailTestResult> {
  const payload = await request(
    `api/v1/companies/${encodeURIComponent(companyId)}/mail-settings/test`,
    {
      method: "POST",
      body: { to_email: toEmail },
      signal,
    },
  );
  const parsed = z
    .object({ data: companyMailTestResultSchema })
    .safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(502, "Unexpected test email response.");
  }
  return parsed.data.data;
}
