import { z } from "zod";
import { ApiError, read, request } from "@/lib/api/client";
import {
  liveMessageSchema,
  liveNotificationSchema,
  type LiveMessage,
  type LiveNotification,
  type MessageChannel,
} from "@/lib/api/contracts";

const unreadPageMeta = z.object({
  current_page: z.number().int().positive(),
  last_page: z.number().int().positive(),
  per_page: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  unread_count: z.number().int().nonnegative().optional().default(0),
});

export async function listMessages(
  params: {
    companyId: string;
    branchId?: string;
    channel?: MessageChannel | "";
    page?: number;
  },
  signal: AbortSignal,
): Promise<{
  items: LiveMessage[];
  unreadCount: number;
  total: number;
}> {
  const query = new URLSearchParams({ company_id: params.companyId });
  if (params.branchId) query.set("branch_id", params.branchId);
  if (params.channel) query.set("channel", params.channel);
  if (params.page && params.page > 1) query.set("page", String(params.page));
  const res = await read(
    `api/v1/messages?${query.toString()}`,
    z.object({ data: z.array(liveMessageSchema), meta: unreadPageMeta }),
    signal,
  );
  return {
    items: res.data,
    unreadCount: res.meta.unread_count,
    total: res.meta.total,
  };
}

export async function sendMessage(
  body: {
    company_id: number;
    branch_id?: number | null;
    channel: MessageChannel;
    body: string;
    related_entity_type?: string | null;
    related_entity_id?: number | null;
  },
  signal: AbortSignal,
): Promise<LiveMessage> {
  const payload = await request("api/v1/messages", {
    method: "POST",
    body,
    signal,
  });
  const parsed = z.object({ data: liveMessageSchema }).safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(502, "Unexpected message response.");
  }
  return parsed.data.data;
}

export async function markMessageRead(
  messageId: number,
  signal: AbortSignal,
): Promise<void> {
  await request(`api/v1/messages/${messageId}/read`, {
    method: "POST",
    body: {},
    signal,
  });
}

export async function listNotifications(
  params: {
    companyId: string;
    branchId?: string;
    unreadOnly?: boolean;
    page?: number;
  },
  signal: AbortSignal,
): Promise<{
  items: LiveNotification[];
  unreadCount: number;
  total: number;
}> {
  const query = new URLSearchParams({ company_id: params.companyId });
  if (params.branchId) query.set("branch_id", params.branchId);
  if (params.unreadOnly) query.set("unread_only", "1");
  if (params.page && params.page > 1) query.set("page", String(params.page));
  const res = await read(
    `api/v1/notifications?${query.toString()}`,
    z.object({ data: z.array(liveNotificationSchema), meta: unreadPageMeta }),
    signal,
  );
  return {
    items: res.data,
    unreadCount: res.meta.unread_count,
    total: res.meta.total,
  };
}

export async function markNotificationRead(
  notificationId: number,
  signal: AbortSignal,
): Promise<void> {
  await request(`api/v1/notifications/${notificationId}/read`, {
    method: "POST",
    body: {},
    signal,
  });
}

export async function markAllNotificationsRead(
  body: { company_id: number; branch_id?: number | null },
  signal: AbortSignal,
): Promise<void> {
  await request("api/v1/notifications/read-all", {
    method: "POST",
    body,
    signal,
  });
}
