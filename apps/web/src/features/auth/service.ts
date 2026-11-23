import { z } from "zod";
import { ApiError, initializeCsrf, read, request } from "@/lib/api/client";
import {
  invitationPreviewSchema,
  invitationSchema,
  normalizePage,
  pageSchema,
  twoFactorConfirmSchema,
  twoFactorSetupSchema,
  userSchema,
  type Invitation,
  type InvitationPreview,
  type TwoFactorConfirm,
  type TwoFactorSetup,
  type User,
} from "@/lib/api/contracts";

export async function previewInvitation(
  token: string,
  signal?: AbortSignal,
): Promise<InvitationPreview> {
  const sp = new URLSearchParams({ token });
  const payload = await read(
    `api/v1/invitations/preview?${sp.toString()}`,
    z.object({ data: invitationPreviewSchema }),
    signal,
  );
  return payload.data;
}

export async function acceptInvitation(
  body: {
    token: string;
    name?: string;
    password: string;
    password_confirmation?: string;
  },
  signal?: AbortSignal,
): Promise<{ user: User; companyId: number }> {
  await initializeCsrf();
  const payload = await request("api/v1/invitations/accept", {
    method: "POST",
    body,
    signal,
  });
  const parsed = z
    .object({
      data: userSchema,
      company_id: z.number().int().positive(),
    })
    .safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(
      502,
      "Unexpected invitation acceptance response. Refresh and try signing in.",
    );
  }
  return { user: parsed.data.data, companyId: parsed.data.company_id };
}

export async function requestPasswordReset(
  email: string,
  signal?: AbortSignal,
): Promise<string> {
  await initializeCsrf();
  const payload = await request("api/v1/auth/forgot-password", {
    method: "POST",
    body: { email },
    signal,
  });
  const parsed = z.object({ message: z.string() }).safeParse(payload);
  return parsed.success
    ? parsed.data.message
    : "If an account matches that email, a reset link has been sent.";
}

export async function resetPassword(
  body: {
    token: string;
    email: string;
    password: string;
    password_confirmation: string;
  },
  signal?: AbortSignal,
): Promise<void> {
  await initializeCsrf();
  await request("api/v1/auth/reset-password", {
    method: "POST",
    body,
    signal,
  });
}

export async function updateProfile(
  name: string,
  signal?: AbortSignal,
): Promise<User> {
  const payload = await request("api/v1/auth/profile", {
    method: "PATCH",
    body: { name },
    signal,
  });
  return z.object({ data: userSchema }).parse(payload).data;
}

export async function changePassword(
  body: {
    current_password: string;
    password: string;
    password_confirmation: string;
    revoke_other_sessions?: boolean;
  },
  signal?: AbortSignal,
): Promise<User> {
  const payload = await request("api/v1/auth/change-password", {
    method: "POST",
    body,
    signal,
  });
  return z.object({ data: userSchema }).parse(payload).data;
}

export async function setupTwoFactor(
  signal?: AbortSignal,
): Promise<TwoFactorSetup> {
  const payload = await request("api/v1/auth/two-factor/setup", {
    method: "POST",
    body: {},
    signal,
  });
  return z.object({ data: twoFactorSetupSchema }).parse(payload).data;
}

export async function confirmTwoFactor(
  code: string,
  signal?: AbortSignal,
): Promise<TwoFactorConfirm> {
  const payload = await request("api/v1/auth/two-factor/confirm", {
    method: "POST",
    body: { code },
    signal,
  });
  return z.object({ data: twoFactorConfirmSchema }).parse(payload).data;
}

export async function disableTwoFactor(
  body: { current_password: string; code: string },
  signal?: AbortSignal,
): Promise<User> {
  const payload = await request("api/v1/auth/two-factor/disable", {
    method: "POST",
    body,
    signal,
  });
  return z.object({ data: userSchema }).parse(payload).data;
}

export async function regenerateRecoveryCodes(
  currentPassword: string,
  signal?: AbortSignal,
): Promise<string[]> {
  const payload = await request("api/v1/auth/two-factor/recovery-codes", {
    method: "POST",
    body: { current_password: currentPassword },
    signal,
  });
  return z
    .object({ data: z.object({ recovery_codes: z.array(z.string()) }) })
    .parse(payload).data.recovery_codes;
}

export async function listInvitations(
  params: {
    companyId: string;
    status?: string;
    q?: string;
    page?: number;
  },
  signal?: AbortSignal,
): Promise<{
  supported: boolean;
  items: Invitation[];
  page: number;
  lastPage: number;
  total: number;
}> {
  const sp = new URLSearchParams({ company_id: params.companyId });
  if (params.status) sp.set("status", params.status);
  if (params.q?.trim()) sp.set("q", params.q.trim().slice(0, 100));
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  try {
    const payload = await read(
      `api/v1/invitations?${sp.toString()}`,
      pageSchema(invitationSchema),
      signal,
    );
    const normalized = normalizePage(payload);
    return {
      supported: true,
      items: normalized.items,
      page: normalized.page,
      lastPage: normalized.lastPage,
      total: normalized.total,
    };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return { supported: false, items: [], page: 1, lastPage: 1, total: 0 };
    }
    throw err;
  }
}

export async function createInvitation(
  body: {
    company_id: number;
    branch_id: number | null;
    email: string;
    role: string;
  },
  signal?: AbortSignal,
): Promise<Invitation> {
  const payload = await request("api/v1/invitations", {
    method: "POST",
    body,
    signal,
  });
  return z.object({ data: invitationSchema }).parse(payload).data;
}

export async function resendInvitation(
  id: number,
  signal?: AbortSignal,
): Promise<Invitation> {
  const payload = await request(`api/v1/invitations/${id}/resend`, {
    method: "POST",
    body: {},
    signal,
  });
  return z.object({ data: invitationSchema }).parse(payload).data;
}

export async function revokeInvitation(
  id: number,
  signal?: AbortSignal,
): Promise<Invitation> {
  const payload = await request(`api/v1/invitations/${id}/revoke`, {
    method: "POST",
    body: {},
    signal,
  });
  return z.object({ data: invitationSchema }).parse(payload).data;
}
