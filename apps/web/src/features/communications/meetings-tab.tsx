"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarPlus,
  Check,
  Clock,
  Download,
  ExternalLink,
  FileText,
  HelpCircle,
  Link2,
  Pencil,
  Play,
  Square,
  Users,
  Video,
  X,
} from "lucide-react";
import { useSession } from "@/features/auth/session-provider";
import { useLiveContext } from "@/features/live/context";
import {
  cancelMeeting,
  createMeeting,
  downloadMeetingIcs,
  endMeeting,
  isInAppMeetingProvider,
  listMeetings,
  relatedEntityHref,
  rsvpMeeting,
  sanitizeExternalMeetingUrl,
  startMeeting,
  updateMeeting,
} from "@/features/communications/meetings-service";
import { listUsers } from "@/features/users/service";
import { ApiError, errorText } from "@/lib/api/client";
import {
  canManageMeetings,
  isDriverRole,
  isSystemAdmin,
  meetingProviderLabels,
  meetingRelatedEntityTypes,
  selectableMeetingProviders,
  type LiveMeeting,
  type MeetingProvider,
  type MeetingRelatedEntityType,
  type MeetingRsvpStatus,
  type MessageChannel,
} from "@/lib/api/contracts";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DriveCoreDateTimeField } from "@/components/ui/drivecore-calendar";
import { DriveCoreSelect } from "@/components/ui/drivecore-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const DURATION_OPTIONS = [
  { value: "15", label: "15 minutes" },
  { value: "30", label: "30 minutes" },
  { value: "45", label: "45 minutes" },
  { value: "60", label: "1 hour" },
  { value: "90", label: "1.5 hours" },
  { value: "120", label: "2 hours" },
];

const CHANNEL_OPTIONS: { value: MessageChannel; label: string }[] = [
  { value: "dispatch", label: "Dispatch" },
  { value: "drivers", label: "Drivers" },
  { value: "customers", label: "Customers" },
  { value: "support", label: "Support" },
];

const ENTITY_OPTIONS: { value: "" | MeetingRelatedEntityType; label: string }[] =
  [
    { value: "", label: "None" },
    ...meetingRelatedEntityTypes.map((t) => ({
      value: t,
      label: t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    })),
  ];

function defaultStartLocal(): string {
  const next = new Date(Date.now() + 30 * 60_000);
  const yyyy = next.getFullYear();
  const mm = String(next.getMonth() + 1).padStart(2, "0");
  const dd = String(next.getDate()).padStart(2, "0");
  const hh = String(next.getHours()).padStart(2, "0");
  const min = next.getMinutes() < 30 ? "30" : "00";
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function toLocalDateTimeInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return defaultStartLocal();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function fmtMeetingWindow(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime())) return startsAt;
  const datePart = start.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const startTime = start.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const endTime = Number.isNaN(end.getTime())
    ? ""
    : ` – ${end.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
  return `${datePart}, ${startTime}${endTime}`;
}

function statusBadgeClass(status: LiveMeeting["status"]): string {
  switch (status) {
    case "live":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    case "scheduled":
      return "bg-primary/10 text-primary";
    case "ended":
      return "bg-muted text-muted-foreground";
    case "cancelled":
      return "bg-destructive/10 text-destructive";
  }
}

export function MeetingsTab({
  onJoinInApp,
  onCloseDrawer,
}: {
  onJoinInApp: (meeting: LiveMeeting) => void;
  onCloseDrawer: () => void;
}) {
  const { user } = useSession();
  const scope = useLiveContext();
  const client = useQueryClient();

  const canManage = !!user && canManageMeetings(user);
  const driverOnly = !!user && isDriverRole(user);
  const branchId = scope.branch !== "all" ? scope.branch : undefined;

  const [filterScope, setFilterScope] = useState<"upcoming" | "past" | "cancelled">(
    "upcoming",
  );
  const [actionError, setActionError] = useState("");
  const [busyInstant, setBusyInstant] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  // Schedule / Edit dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LiveMeeting | null>(null);
  const [title, setTitle] = useState("");
  const [agenda, setAgenda] = useState("");
  const [startsAtLocal, setStartsAtLocal] = useState(defaultStartLocal);
  const [durationMinutes, setDurationMinutes] = useState("30");
  const [provider, setProvider] = useState<MeetingProvider>("webrtc_native");
  const [externalUrl, setExternalUrl] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [relatedType, setRelatedType] = useState<"" | MeetingRelatedEntityType>(
    "",
  );
  const [relatedId, setRelatedId] = useState("");
  const [postToChannel, setPostToChannel] = useState(true);
  const [channel, setChannel] = useState<MessageChannel>("dispatch");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // Minutes dialog state
  const [minutesTarget, setMinutesTarget] = useState<LiveMeeting | null>(null);
  const [minutesDraft, setMinutesDraft] = useState("");
  const [savingMinutes, setSavingMinutes] = useState(false);

  const meetingsQuery = useQuery({
    queryKey: [...scope.key, "meetings", branchId ?? "all", filterScope],
    queryFn: ({ signal }) =>
      listMeetings(
        {
          companyId: scope.companyId,
          branchId,
          status: filterScope === "cancelled" ? "cancelled" : "",
          scope: filterScope === "cancelled" ? "all" : filterScope,
        },
        signal,
      ),
    enabled: !!user && !!scope.companyId,
    refetchInterval: 30_000,
    retry: false,
  });

  const canFetchUsers =
    !!user &&
    canManage &&
    (user.is_platform_admin || user.permissions.includes("users.view"));

  const usersQuery = useQuery({
    queryKey: [...scope.key, "meeting-invitees", branchId ?? "all"],
    queryFn: ({ signal }) =>
      listUsers(
        {
          companyId: scope.companyId,
          branch: "all",
          q: "",
          role: "",
          isActive: "1",
          page: 1,
        },
        signal,
      ),
    enabled: formOpen && canFetchUsers && !!scope.companyId,
    retry: false,
  });

  const isEndpointMissing =
    meetingsQuery.error instanceof ApiError && meetingsQuery.error.status === 404;

  const visibleMeetings = useMemo(() => {
    const items = meetingsQuery.data?.items ?? [];
    if (filterScope === "cancelled") {
      return items.filter((m) => m.status === "cancelled");
    }
    if (filterScope === "past") {
      return items.filter((m) => m.status === "ended");
    }
    return items.filter((m) => m.status === "live" || m.status === "scheduled");
  }, [meetingsQuery.data?.items, filterScope]);

  async function refreshAll() {
    await Promise.all([
      client.invalidateQueries({ queryKey: [...scope.key, "meetings"] }),
      client.invalidateQueries({ queryKey: [...scope.key, "messages"] }),
      client.invalidateQueries({ queryKey: [...scope.key, "notifications"] }),
    ]);
  }

  function openCreateDialog() {
    setEditing(null);
    setTitle("");
    setAgenda("");
    setStartsAtLocal(defaultStartLocal());
    setDurationMinutes("30");
    setProvider("webrtc_native");
    setExternalUrl("");
    setSelectedUserIds([]);
    setRelatedType("");
    setRelatedId("");
    setPostToChannel(true);
    setChannel("dispatch");
    setFormError("");
    setFormOpen(true);
  }

  function openEditDialog(meeting: LiveMeeting) {
    setEditing(meeting);
    setTitle(meeting.title);
    setAgenda(meeting.agenda ?? "");
    setStartsAtLocal(toLocalDateTimeInput(meeting.starts_at));
    const diffMin = Math.max(
      15,
      Math.round(
        (new Date(meeting.ends_at).getTime() -
          new Date(meeting.starts_at).getTime()) /
          60_000,
      ),
    );
    setDurationMinutes(
      DURATION_OPTIONS.some((o) => o.value === String(diffMin))
        ? String(diffMin)
        : "30",
    );
    setProvider(
      isInAppMeetingProvider(meeting.provider)
        ? "webrtc_native"
        : meeting.provider,
    );
    setExternalUrl(isInAppMeetingProvider(meeting.provider) ? "" : meeting.join_url);
    setSelectedUserIds(meeting.participants.map((p) => p.user_id));
    setRelatedType(meeting.related_entity_type ?? "");
    setRelatedId(meeting.related_entity_id ? String(meeting.related_entity_id) : "");
    setPostToChannel(false);
    setChannel(meeting.channel ?? "dispatch");
    setFormError("");
    setFormOpen(true);
  }

  async function handleMeetNow() {
    if (busyInstant || !scope.companyId) return;
    setBusyInstant(true);
    setActionError("");
    const ac = new AbortController();
    try {
      const created = await createMeeting(
        {
          company_id: Number(scope.companyId),
          branch_id: branchId ? Number(branchId) : null,
          title: `Quick Team Huddle (${new Date().toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
          })})`,
          agenda: "Instant internal virtual meeting.",
          provider: "webrtc_native",
          starts_at: new Date().toISOString(),
          duration_minutes: 30,
          start_now: true,
          post_to_channel: true,
          channel: "dispatch",
        },
        ac.signal,
      );
      await refreshAll();
      onJoinInApp(created);
    } catch (failure) {
      setActionError(errorText(failure));
    } finally {
      setBusyInstant(false);
    }
  }

  async function handleSubmitForm(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setFormError("Meeting title is required.");
      return;
    }

    let safeExternal: string | null = null;
    if (!isInAppMeetingProvider(provider)) {
      safeExternal = sanitizeExternalMeetingUrl(externalUrl);
      if (!safeExternal) {
        setFormError(
          `Enter a valid https:// join URL for ${meetingProviderLabels[provider]}.`,
        );
        return;
      }
    }

    const startDate = new Date(startsAtLocal);
    if (Number.isNaN(startDate.getTime())) {
      setFormError("Select a valid start date and time.");
      return;
    }

    setSaving(true);
    setFormError("");
    const ac = new AbortController();
    try {
      if (editing) {
        await updateMeeting(
          editing.id,
          {
            title: cleanTitle,
            agenda: agenda.trim() || null,
            provider,
            external_join_url: safeExternal,
            starts_at: startDate.toISOString(),
            duration_minutes: Number(durationMinutes),
            participant_user_ids: selectedUserIds,
          },
          ac.signal,
        );
      } else {
        await createMeeting(
          {
            company_id: Number(scope.companyId),
            branch_id: branchId ? Number(branchId) : null,
            title: cleanTitle,
            agenda: agenda.trim() || null,
            provider,
            external_join_url: safeExternal,
            starts_at: startDate.toISOString(),
            duration_minutes: Number(durationMinutes),
            start_now: false,
            participant_user_ids: selectedUserIds,
            related_entity_type: relatedType || null,
            related_entity_id:
              relatedType && Number(relatedId) > 0 ? Number(relatedId) : null,
            post_to_channel: postToChannel,
            channel: postToChannel ? channel : null,
          },
          ac.signal,
        );
      }
      await refreshAll();
      setFormOpen(false);
    } catch (failure) {
      setFormError(errorText(failure));
    } finally {
      setSaving(false);
    }
  }

  async function handleRsvp(
    meetingId: number,
    status: Exclude<MeetingRsvpStatus, "pending">,
  ) {
    setBusyId(meetingId);
    setActionError("");
    const ac = new AbortController();
    try {
      await rsvpMeeting(meetingId, status, ac.signal);
      await refreshAll();
    } catch (failure) {
      setActionError(errorText(failure));
    } finally {
      setBusyId(null);
    }
  }

  async function handleStart(meeting: LiveMeeting) {
    setBusyId(meeting.id);
    setActionError("");
    const ac = new AbortController();
    try {
      const started = await startMeeting(meeting.id, ac.signal);
      await refreshAll();
      handleJoin(started);
    } catch (failure) {
      setActionError(errorText(failure));
    } finally {
      setBusyId(null);
    }
  }

  async function handleCancel(meetingId: number) {
    setBusyId(meetingId);
    setActionError("");
    const ac = new AbortController();
    try {
      await cancelMeeting(meetingId, ac.signal);
      await refreshAll();
    } catch (failure) {
      setActionError(errorText(failure));
    } finally {
      setBusyId(null);
    }
  }

  function handleJoin(meeting: LiveMeeting) {
    if (isInAppMeetingProvider(meeting.provider)) {
      onJoinInApp(meeting);
      return;
    }
    const safeUrl = sanitizeExternalMeetingUrl(meeting.join_url);
    if (!safeUrl) {
      setActionError("This external meeting link is invalid or not HTTPS.");
      return;
    }
    window.open(safeUrl, "_blank", "noopener,noreferrer");
  }

  async function handleSaveMinutes(e: React.FormEvent) {
    e.preventDefault();
    if (!minutesTarget || savingMinutes) return;
    setSavingMinutes(true);
    setActionError("");
    const ac = new AbortController();
    try {
      if (minutesTarget.status === "ended") {
        await updateMeeting(
          minutesTarget.id,
          { minutes: minutesDraft.trim() || null },
          ac.signal,
        );
      } else {
        await endMeeting(
          minutesTarget.id,
          minutesDraft.trim() || null,
          ac.signal,
        );
      }
      await refreshAll();
      setMinutesTarget(null);
      setMinutesDraft("");
    } catch (failure) {
      setActionError(errorText(failure));
    } finally {
      setSavingMinutes(false);
    }
  }

  function toggleParticipant(userId: number) {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-2.5 border-b px-4 py-3">
        {canManage ? (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={busyInstant || isEndpointMissing}
              onClick={() => {
                void handleMeetNow();
              }}
              className="flex-1"
            >
              <Video className="mr-1.5 size-3.5" aria-hidden="true" />
              {busyInstant ? "Starting room…" : "Meet now"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isEndpointMissing}
              onClick={openCreateDialog}
              className="flex-1"
            >
              <CalendarPlus className="mr-1.5 size-3.5" aria-hidden="true" />
              Schedule meeting
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {driverOnly
              ? "Meetings you have been invited to appear below."
              : "View, RSVP, and join scheduled company meetings."}
          </p>
        )}

        <div className="flex items-center gap-1 rounded-xl bg-muted/50 p-1 text-xs">
          {(
            [
              { id: "upcoming", label: "Upcoming & Live" },
              { id: "past", label: "Past" },
              { id: "cancelled", label: "Cancelled" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterScope(tab.id)}
              className={`flex-1 rounded-lg px-2 py-1 font-medium transition-colors ${
                filterScope === tab.id
                  ? "bg-surface text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {actionError ? (
          <p role="alert" className="text-xs text-danger-foreground">
            {actionError}
          </p>
        ) : null}
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto p-4">
        {isEndpointMissing ? (
          <p className="rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
            Internal meetings are not enabled on this API server yet.
          </p>
        ) : meetingsQuery.error ? (
          <p className="rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
            {errorText(meetingsQuery.error)}
          </p>
        ) : visibleMeetings.length === 0 ? (
          <p className="rounded-xl border bg-muted/30 p-4 text-center text-xs text-muted-foreground">
            No {filterScope} meetings in this scope.
          </p>
        ) : (
          visibleMeetings.map((meeting) => {
            const myParticipant = meeting.participants.find(
              (p) => p.user_id === user?.id,
            );
            const canOrganize =
              !!user &&
              (user.id === meeting.organizer_user_id || isSystemAdmin(user));
            const entityLink = relatedEntityHref(
              scope.companyId,
              meeting.related_entity_type,
              meeting.related_entity_id,
            );
            const isBusy = busyId === meeting.id;

            return (
              <article
                key={meeting.id}
                className={`space-y-2 rounded-xl border p-3.5 text-xs ${
                  meeting.status === "live"
                    ? "border-emerald-500/40 bg-emerald-500/5"
                    : "bg-surface"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-0.5">
                    <h4 className="truncate font-semibold text-foreground">
                      {meeting.title}
                    </h4>
                    <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Clock className="size-3 shrink-0" aria-hidden="true" />
                      <span>
                        {fmtMeetingWindow(meeting.starts_at, meeting.ends_at)}
                      </span>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${statusBadgeClass(
                        meeting.status,
                      )}`}
                    >
                      {meeting.status}
                    </span>
                  </div>
                </div>

                {meeting.agenda ? (
                  <p className="line-clamp-2 text-muted-foreground">
                    {meeting.agenda}
                  </p>
                ) : null}

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <span>{meetingProviderLabels[meeting.provider]}</span>
                  <span>Host: {meeting.organizer_name}</span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="size-3" aria-hidden="true" />
                    {meeting.participants.length}
                  </span>
                  {entityLink && meeting.related_entity_type ? (
                    <Link
                      href={entityLink}
                      onClick={onCloseDrawer}
                      className="inline-flex items-center gap-1 font-medium text-link hover:underline"
                    >
                      <Link2 className="size-3" aria-hidden="true" />
                      {meeting.related_entity_type.replace(/_/g, " ")} #
                      {meeting.related_entity_id}
                    </Link>
                  ) : null}
                </div>

                {meeting.status !== "cancelled" && meeting.status !== "ended" ? (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <Button
                      type="button"
                      size="sm"
                      disabled={isBusy}
                      onClick={() => handleJoin(meeting)}
                      className="h-7 px-2.5 text-xs"
                    >
                      {isInAppMeetingProvider(meeting.provider) ? (
                        <Video className="mr-1 size-3" aria-hidden="true" />
                      ) : (
                        <ExternalLink className="mr-1 size-3" aria-hidden="true" />
                      )}
                      Join
                    </Button>

                    {canOrganize && meeting.status === "scheduled" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isBusy}
                        onClick={() => {
                          void handleStart(meeting);
                        }}
                        className="h-7 px-2 text-xs"
                      >
                        <Play className="mr-1 size-3" aria-hidden="true" />
                        Start
                      </Button>
                    ) : null}

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => downloadMeetingIcs(meeting)}
                      className="h-7 px-2 text-xs"
                      aria-label={`Download calendar invite for ${meeting.title}`}
                    >
                      <Download className="mr-1 size-3" aria-hidden="true" />
                      .ics
                    </Button>

                    {canOrganize ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={isBusy}
                          onClick={() => openEditDialog(meeting)}
                          className="h-7 px-2 text-xs"
                          aria-label={`Edit ${meeting.title}`}
                        >
                          <Pencil className="size-3" aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={isBusy}
                          onClick={() => {
                            setMinutesTarget(meeting);
                            setMinutesDraft(meeting.minutes ?? "");
                          }}
                          className="h-7 px-2 text-xs"
                          aria-label={`End ${meeting.title}`}
                        >
                          <Square className="mr-1 size-3" aria-hidden="true" />
                          End
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={isBusy}
                          onClick={() => {
                            void handleCancel(meeting.id);
                          }}
                          className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                          aria-label={`Cancel ${meeting.title}`}
                        >
                          <X className="size-3" aria-hidden="true" />
                        </Button>
                      </>
                    ) : null}
                  </div>
                ) : null}

                {meeting.status === "scheduled" || meeting.status === "live" ? (
                  <div className="flex items-center justify-between gap-2 border-t pt-2">
                    <span className="text-[11px] text-muted-foreground">
                      RSVP:{" "}
                      <strong className="capitalize text-foreground">
                        {myParticipant?.rsvp_status ?? "pending"}
                      </strong>
                    </span>
                    <div className="flex items-center gap-1">
                      {(
                        [
                          { id: "accepted", label: "Accept", icon: Check },
                          {
                            id: "tentative",
                            label: "Maybe",
                            icon: HelpCircle,
                          },
                          { id: "declined", label: "Decline", icon: X },
                        ] as const
                      ).map((opt) => {
                        const Icon = opt.icon;
                        const active = myParticipant?.rsvp_status === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            disabled={isBusy}
                            onClick={() => {
                              void handleRsvp(meeting.id, opt.id);
                            }}
                            className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                              active
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border bg-surface text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <Icon className="size-3" aria-hidden="true" />
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {meeting.status === "ended" ? (
                  <div className="space-y-1.5 border-t pt-2">
                    {meeting.minutes ? (
                      <p className="whitespace-pre-wrap rounded-lg bg-muted/40 p-2 text-[11px] text-foreground">
                        {meeting.minutes}
                      </p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">
                        No meeting minutes recorded yet.
                      </p>
                    )}
                    {canOrganize ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setMinutesTarget(meeting);
                          setMinutesDraft(meeting.minutes ?? "");
                        }}
                        className="h-7 px-2 text-xs"
                      >
                        <FileText className="mr-1 size-3" aria-hidden="true" />
                        {meeting.minutes ? "Edit minutes" : "Add minutes"}
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })
        )}
      </div>

      {/* Schedule / Edit Meeting Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Meeting" : "Schedule Internal Meeting"}
            </DialogTitle>
            <DialogDescription>
              Host an instant in-app DriveCore WebRTC room or link an external
              Zoom, Microsoft Teams, or Google Meet session.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              void handleSubmitForm(e);
            }}
            className="space-y-3"
          >
            <div className="space-y-1.5">
              <Label htmlFor="meeting-title">Title</Label>
              <Input
                id="meeting-title"
                required
                maxLength={160}
                placeholder="e.g. Daily Fleet Dispatch Standup"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="meeting-agenda">Agenda (optional)</Label>
              <Textarea
                id="meeting-agenda"
                rows={2}
                maxLength={2000}
                placeholder="Key topics, vehicles, or accounts to review…"
                value={agenda}
                onChange={(e) => setAgenda(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="meeting-starts-at">Start date &amp; time</Label>
                <DriveCoreDateTimeField
                  id="meeting-starts-at"
                  label="Meeting start date & time"
                  value={startsAtLocal}
                  onChange={setStartsAtLocal}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Duration</Label>
                <DriveCoreSelect
                  ariaLabel="Meeting duration"
                  value={durationMinutes}
                  onValueChange={setDurationMinutes}
                  options={DURATION_OPTIONS}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Call provider</Label>
              <DriveCoreSelect
                ariaLabel="Meeting provider"
                value={provider}
                onValueChange={(v) => setProvider(v as MeetingProvider)}
                options={selectableMeetingProviders.map((p) => ({
                  value: p,
                  label: meetingProviderLabels[p],
                }))}
              />
            </div>

            {!isInAppMeetingProvider(provider) ? (
              <div className="space-y-1.5">
                <Label htmlFor="meeting-external-url">
                  {meetingProviderLabels[provider]} Join URL (HTTPS)
                </Label>
                <Input
                  id="meeting-external-url"
                  type="url"
                  required
                  placeholder="https://teams.microsoft.com/l/meetup-join/..."
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                />
              </div>
            ) : null}

            {canFetchUsers && (usersQuery.data?.items.length ?? 0) > 0 ? (
              <div className="space-y-1.5">
                <Label>
                  Invite participants ({selectedUserIds.length} selected)
                </Label>
                <div className="max-h-32 space-y-1.5 overflow-y-auto rounded-xl border bg-muted/20 p-2.5">
                  {usersQuery.data?.items.map((member) => (
                    <label
                      key={member.id}
                      className="flex cursor-pointer items-center gap-2 text-xs"
                    >
                      <Checkbox
                        checked={selectedUserIds.includes(member.id)}
                        onCheckedChange={() => toggleParticipant(member.id)}
                      />
                      <span className="font-medium text-foreground">
                        {member.name}
                      </span>
                      <span className="truncate text-muted-foreground">
                        ({member.email})
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            {!editing ? (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Link DriveCore record (optional)</Label>
                    <DriveCoreSelect
                      ariaLabel="Linked record type"
                      value={relatedType}
                      onValueChange={(v) =>
                        setRelatedType(v as "" | MeetingRelatedEntityType)
                      }
                      options={ENTITY_OPTIONS}
                    />
                  </div>
                  {relatedType ? (
                    <div className="space-y-1.5">
                      <Label htmlFor="meeting-related-id">Record ID</Label>
                      <Input
                        id="meeting-related-id"
                        type="number"
                        min={1}
                        placeholder="e.g. 12"
                        value={relatedId}
                        onChange={(e) => setRelatedId(e.target.value)}
                      />
                    </div>
                  ) : null}
                </div>

                <div className="space-y-2 rounded-xl border bg-muted/20 p-3">
                  <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
                    <Checkbox
                      checked={postToChannel}
                      onCheckedChange={(checked) =>
                        setPostToChannel(Boolean(checked))
                      }
                    />
                    Post meeting join card to Chat channel
                  </label>
                  {postToChannel ? (
                    <DriveCoreSelect
                      ariaLabel="Broadcast chat channel"
                      value={channel}
                      onValueChange={(v) => setChannel(v as MessageChannel)}
                      options={CHANNEL_OPTIONS}
                    />
                  ) : null}
                </div>
              </>
            ) : null}

            {formError ? (
              <p role="alert" className="text-xs text-danger-foreground">
                {formError}
              </p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving
                  ? "Saving…"
                  : editing
                    ? "Save changes"
                    : "Schedule meeting"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* End / Edit Minutes Dialog */}
      <Dialog
        open={!!minutesTarget}
        onOpenChange={(next) => {
          if (!next) setMinutesTarget(null);
        }}
      >
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {minutesTarget?.status === "ended"
                ? "Meeting Minutes"
                : "End Meeting & Save Minutes"}
            </DialogTitle>
            <DialogDescription>{minutesTarget?.title}</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              void handleSaveMinutes(e);
            }}
            className="space-y-3"
          >
            <Textarea
              aria-label="Meeting minutes"
              rows={5}
              maxLength={5000}
              placeholder="Record decisions, follow-ups, and responsible owners…"
              value={minutesDraft}
              onChange={(e) => setMinutesDraft(e.target.value)}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setMinutesTarget(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={savingMinutes}>
                {savingMinutes
                  ? "Saving…"
                  : minutesTarget?.status === "ended"
                    ? "Save minutes"
                    : "End meeting"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
