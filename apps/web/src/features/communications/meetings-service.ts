import { z } from "zod";
import { ApiError, read, request } from "@/lib/api/client";
import {
  meetingSchema,
  rtcJoinResponseSchema,
  rtcSignalsResponseSchema,
  type LiveMeeting,
  type MeetingProvider,
  type MeetingRelatedEntityType,
  type MeetingRsvpStatus,
  type MeetingStatus,
  type MessageChannel,
  type RtcJoinResponse,
  type RtcSignalsResponse,
} from "@/lib/api/contracts";

export function isInAppMeetingProvider(provider: MeetingProvider): boolean {
  return provider === "webrtc_native" || provider === "jitsi_embedded";
}

const meetingPageMeta = z.object({
  current_page: z.number().int().positive(),
  last_page: z.number().int().positive(),
  per_page: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  live_count: z.number().int().nonnegative().optional().default(0),
});

export function sanitizeExternalMeetingUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 512) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:") return null;
    if (!parsed.hostname || parsed.hostname.includes(" ")) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function getJitsiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_DRIVECORE_JITSI_DOMAIN?.trim();
  if (configured) {
    const normalized = configured.startsWith("https://")
      ? configured
      : `https://${configured}`;
    const safe = sanitizeExternalMeetingUrl(normalized);
    if (safe) return safe.replace(/\/+$/, "");
  }
  return "https://meet.jit.si";
}

export function buildJitsiEmbedUrl(
  meeting: LiveMeeting,
  displayName?: string,
): string {
  const safeDirect = sanitizeExternalMeetingUrl(meeting.join_url);
  const baseUrl = safeDirect
    ? safeDirect.split("#")[0]
    : `${getJitsiBaseUrl()}/${encodeURIComponent(
        meeting.room_slug || `drivecore-meeting-${meeting.id}`,
      )}`;

  const hashParts = [
    "config.prejoinPageEnabled=true",
    "config.disableDeepLinking=true",
  ];
  if (displayName?.trim()) {
    hashParts.push(
      `userInfo.displayName=${encodeURIComponent(JSON.stringify(displayName.trim()))}`,
    );
  }
  return `${baseUrl}#${hashParts.join("&")}`;
}

function escapeIcsText(input: string): string {
  return input
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function toIcsUtc(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  }
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function buildMeetingIcs(meeting: LiveMeeting): string {
  const nowUtc = toIcsUtc(new Date().toISOString());
  const startUtc = toIcsUtc(meeting.starts_at);
  const endUtc = toIcsUtc(meeting.ends_at);
  const descriptionParts = [
    meeting.agenda?.trim() ? `Agenda: ${meeting.agenda.trim()}` : null,
    `Join URL: ${meeting.join_url}`,
    `Organizer: ${meeting.organizer_name}`,
  ].filter(Boolean);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//DriveCore ERP//Internal Virtual Meetings//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:drivecore-meeting-${meeting.id}@drivecore.app`,
    `DTSTAMP:${nowUtc}`,
    `DTSTART:${startUtc}`,
    `DTEND:${endUtc}`,
    `SUMMARY:${escapeIcsText(meeting.title)}`,
    `DESCRIPTION:${escapeIcsText(descriptionParts.join("\n"))}`,
    `LOCATION:${escapeIcsText(meeting.join_url)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${lines.join("\r\n")}\r\n`;
}

export function downloadMeetingIcs(meeting: LiveMeeting): void {
  const ics = buildMeetingIcs(meeting);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const slug = meeting.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${slug || `meeting-${meeting.id}`}.ics`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function relatedEntityHref(
  companyId: string,
  entityType: MeetingRelatedEntityType | null | undefined,
  entityId: number | null | undefined,
): string | null {
  if (!entityType || !entityId) return null;
  const base = `/companies/${companyId}`;
  switch (entityType) {
    case "rental":
      return `${base}/rentals/${entityId}`;
    case "work_order":
      return `${base}/maintenance/${entityId}`;
    case "incident":
      return `${base}/incidents`;
    case "customer":
      return `${base}/customers/${entityId}`;
    case "vehicle":
      return `${base}/vehicles/${entityId}`;
    case "quotation":
      return `${base}/quotations/${entityId}`;
    case "invoice":
      return `${base}/invoices/${entityId}`;
    default:
      return null;
  }
}

export async function listMeetings(
  params: {
    companyId: string;
    branchId?: string;
    status?: MeetingStatus | "";
    scope?: "upcoming" | "past" | "all";
    page?: number;
  },
  signal: AbortSignal,
): Promise<{
  items: LiveMeeting[];
  total: number;
  liveCount: number;
}> {
  const query = new URLSearchParams({ company_id: params.companyId });
  if (params.branchId) query.set("branch_id", params.branchId);
  if (params.status) query.set("status", params.status);
  if (params.scope) query.set("scope", params.scope);
  if (params.page && params.page > 1) query.set("page", String(params.page));

  const res = await read(
    `api/v1/meetings?${query.toString()}`,
    z.object({ data: z.array(meetingSchema), meta: meetingPageMeta }),
    signal,
  );
  return {
    items: res.data,
    total: res.meta.total,
    liveCount: res.meta.live_count,
  };
}

export async function getMeeting(
  meetingId: number,
  signal: AbortSignal,
): Promise<LiveMeeting> {
  const res = await read(
    `api/v1/meetings/${meetingId}`,
    z.object({ data: meetingSchema }),
    signal,
  );
  return res.data;
}

export async function createMeeting(
  body: {
    company_id: number;
    branch_id?: number | null;
    title: string;
    agenda?: string | null;
    provider: MeetingProvider;
    external_join_url?: string | null;
    starts_at: string;
    duration_minutes: number;
    start_now?: boolean;
    participant_user_ids?: number[];
    related_entity_type?: MeetingRelatedEntityType | null;
    related_entity_id?: number | null;
    post_to_channel?: boolean;
    channel?: MessageChannel | null;
  },
  signal: AbortSignal,
): Promise<LiveMeeting> {
  const payload = await request("api/v1/meetings", {
    method: "POST",
    body,
    signal,
  });
  const parsed = z.object({ data: meetingSchema }).safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(502, "Unexpected meeting response.");
  }
  return parsed.data.data;
}

export async function updateMeeting(
  meetingId: number,
  body: {
    title?: string;
    agenda?: string | null;
    provider?: MeetingProvider;
    external_join_url?: string | null;
    starts_at?: string;
    duration_minutes?: number;
    participant_user_ids?: number[];
    minutes?: string | null;
  },
  signal: AbortSignal,
): Promise<LiveMeeting> {
  const payload = await request(`api/v1/meetings/${meetingId}`, {
    method: "PATCH",
    body,
    signal,
  });
  const parsed = z.object({ data: meetingSchema }).safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(502, "Unexpected meeting update response.");
  }
  return parsed.data.data;
}

export async function rsvpMeeting(
  meetingId: number,
  rsvpStatus: Exclude<MeetingRsvpStatus, "pending">,
  signal: AbortSignal,
): Promise<LiveMeeting> {
  const payload = await request(`api/v1/meetings/${meetingId}/rsvp`, {
    method: "POST",
    body: { rsvp_status: rsvpStatus },
    signal,
  });
  const parsed = z.object({ data: meetingSchema }).safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(502, "Unexpected RSVP response.");
  }
  return parsed.data.data;
}

export async function startMeeting(
  meetingId: number,
  signal: AbortSignal,
): Promise<LiveMeeting> {
  const payload = await request(`api/v1/meetings/${meetingId}/start`, {
    method: "POST",
    body: {},
    signal,
  });
  const parsed = z.object({ data: meetingSchema }).safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(502, "Unexpected start meeting response.");
  }
  return parsed.data.data;
}

export async function endMeeting(
  meetingId: number,
  minutes: string | null,
  signal: AbortSignal,
): Promise<LiveMeeting> {
  const payload = await request(`api/v1/meetings/${meetingId}/end`, {
    method: "POST",
    body: minutes !== null ? { minutes } : {},
    signal,
  });
  const parsed = z.object({ data: meetingSchema }).safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(502, "Unexpected end meeting response.");
  }
  return parsed.data.data;
}

export async function cancelMeeting(
  meetingId: number,
  signal: AbortSignal,
): Promise<LiveMeeting> {
  const payload = await request(`api/v1/meetings/${meetingId}/cancel`, {
    method: "POST",
    body: {},
    signal,
  });
  const parsed = z.object({ data: meetingSchema }).safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(502, "Unexpected cancel meeting response.");
  }
  return parsed.data.data;
}

export async function joinMeetingRtc(
  meetingId: number,
  body: { audio_enabled: boolean; video_enabled: boolean },
  signal: AbortSignal,
): Promise<RtcJoinResponse> {
  const payload = await request(`api/v1/meetings/${meetingId}/rtc/join`, {
    method: "POST",
    body,
    signal,
  });
  const parsed = z.object({ data: rtcJoinResponseSchema }).safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(502, "Unexpected WebRTC join response.");
  }
  return parsed.data.data;
}

export async function pollMeetingRtcSignals(
  meetingId: number,
  params: {
    peerId: string;
    afterId: number;
    audioEnabled: boolean;
    videoEnabled: boolean;
    screenSharing: boolean;
  },
  signal: AbortSignal,
): Promise<RtcSignalsResponse> {
  const query = new URLSearchParams({
    peer_id: params.peerId,
    after_id: String(params.afterId),
    audio_enabled: params.audioEnabled ? "1" : "0",
    video_enabled: params.videoEnabled ? "1" : "0",
    screen_sharing: params.screenSharing ? "1" : "0",
  });
  const res = await read(
    `api/v1/meetings/${meetingId}/rtc/signals?${query.toString()}`,
    z.object({ data: rtcSignalsResponseSchema }),
    signal,
  );
  return res.data;
}

export async function sendMeetingRtcSignal(
  meetingId: number,
  body: {
    from_peer_id: string;
    to_peer_id: string;
    type: "offer" | "answer" | "ice";
    payload: Record<string, unknown>;
  },
  signal: AbortSignal,
): Promise<void> {
  await request(`api/v1/meetings/${meetingId}/rtc/signals`, {
    method: "POST",
    body,
    signal,
  });
}

export async function leaveMeetingRtc(
  meetingId: number,
  peerId: string,
  signal?: AbortSignal,
): Promise<void> {
  await request(`api/v1/meetings/${meetingId}/rtc/leave`, {
    method: "POST",
    body: { peer_id: peerId },
    signal,
  });
}
