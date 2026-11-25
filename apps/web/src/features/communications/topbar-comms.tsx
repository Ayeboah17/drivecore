"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, MessageSquare, Send, Video } from "lucide-react";
import { useSession } from "@/features/auth/session-provider";
import { useLiveContext } from "@/features/live/context";
import {
  listMessages,
  listNotifications,
  markAllNotificationsRead,
  markMessageRead,
  markNotificationRead,
  sendMessage,
} from "@/features/communications/service";
import {
  getMeeting,
  isInAppMeetingProvider,
  listMeetings,
  sanitizeExternalMeetingUrl,
} from "@/features/communications/meetings-service";
import { MeetingRoomModal } from "@/features/communications/meeting-room-modal";
import { MeetingsTab } from "@/features/communications/meetings-tab";
import { errorText } from "@/lib/api/client";
import {
  canAccessMeetings,
  canAccessMessages,
  canSendMessages,
  isDriverRole,
  type LiveMeeting,
  type MessageChannel,
} from "@/lib/api/contracts";
import { Button } from "@/components/ui/button";
import { DriveCoreSelect } from "@/components/ui/drivecore-select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

const ALL_CHANNELS: { value: MessageChannel; label: string }[] = [
  { value: "dispatch", label: "Dispatch" },
  { value: "drivers", label: "Drivers" },
  { value: "customers", label: "Customers" },
  { value: "support", label: "Support" },
];

const DRIVER_CHANNELS: { value: MessageChannel; label: string }[] = [
  { value: "drivers", label: "Drivers" },
  { value: "dispatch", label: "Dispatch" },
];

function fmtTime(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export function LiveNotificationsBell() {
  const { user } = useSession();
  const scope = useLiveContext();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busyAll, setBusyAll] = useState(false);

  const branchId = scope.branch !== "all" ? scope.branch : undefined;

  const query = useQuery({
    queryKey: [...scope.key, "notifications", branchId ?? "all"],
    queryFn: ({ signal }) =>
      listNotifications({ companyId: scope.companyId, branchId }, signal),
    enabled: !!user && !!scope.companyId,
    refetchInterval: 30_000,
    retry: false,
  });

  const unreadCount = query.data?.unreadCount ?? 0;

  async function handleReadOne(id: number) {
    const ac = new AbortController();
    try {
      await markNotificationRead(id, ac.signal);
      await client.invalidateQueries({
        queryKey: [...scope.key, "notifications"],
      });
    } catch {
      // ignore transient error
    }
  }

  async function handleReadAll() {
    if (busyAll) return;
    setBusyAll(true);
    const ac = new AbortController();
    try {
      await markAllNotificationsRead(
        {
          company_id: Number(scope.companyId),
          branch_id: branchId ? Number(branchId) : null,
        },
        ac.signal,
      );
      await client.invalidateQueries({
        queryKey: [...scope.key, "notifications"],
      });
    } finally {
      setBusyAll(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="relative size-9 rounded-xl bg-surface/90"
            aria-label={`Notifications (${unreadCount} unread)`}
          />
        }
      >
        <Bell className="size-4" aria-hidden="true" />
        {unreadCount > 0 ? (
          <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-primary font-mono text-[10px] font-bold text-primary-foreground">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-md">
        <div className="flex items-center justify-between border-b px-5 py-4 pr-12">
          <div>
            <SheetTitle className="text-base font-bold">Notifications</SheetTitle>
            <SheetDescription className="text-xs">
              Scoped operational and financial alerts.
            </SheetDescription>
          </div>
          {unreadCount > 0 ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busyAll}
              onClick={() => {
                void handleReadAll();
              }}
            >
              <CheckCheck className="mr-1.5 size-3.5" aria-hidden="true" />
              Mark all read
            </Button>
          ) : null}
        </div>

        <div className="flex-1 space-y-2.5 overflow-y-auto p-4">
          {query.error ? (
            <p className="rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
              Live notifications are not available on this API server yet.
            </p>
          ) : !query.data || query.data.items.length === 0 ? (
            <p className="rounded-xl border bg-muted/30 p-4 text-center text-xs text-muted-foreground">
              You&apos;re all caught up — no notifications in this scope.
            </p>
          ) : (
            query.data.items.map((item) => {
              const unread = !item.read_at;
              return (
                <article
                  key={item.id}
                  className={`space-y-1.5 rounded-xl border p-3.5 text-xs ${
                    unread ? "border-primary/40 bg-primary/5" : "bg-surface"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-foreground">{item.title}</p>
                    {unread ? (
                      <button
                        type="button"
                        onClick={() => {
                          void handleReadOne(item.id);
                        }}
                        className="shrink-0 font-semibold text-link hover:underline"
                      >
                        Mark read
                      </button>
                    ) : null}
                  </div>
                  <p className="text-muted-foreground">{item.body}</p>
                  <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground">
                    <span className="font-mono">{fmtTime(item.created_at)}</span>
                    {item.href ? (
                      <Link
                        href={item.href}
                        onClick={() => {
                          if (unread) void handleReadOne(item.id);
                          setOpen(false);
                        }}
                        className="font-semibold text-link hover:underline"
                      >
                        Inspect
                      </Link>
                    ) : null}
                  </div>
                </article>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function LiveChatDrawer() {
  const { user } = useSession();
  const scope = useLiveContext();
  const client = useQueryClient();

  const canViewMessages = !!user && canAccessMessages(user);
  const canViewMeetings = !!user && canAccessMeetings(user);
  const canView = canViewMessages || canViewMeetings;
  const canSend = !!user && canSendMessages(user);
  const driverOnly = !!user && isDriverRole(user);
  const availableChannels = driverOnly ? DRIVER_CHANNELS : ALL_CHANNELS;

  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "meetings">(
    canViewMessages ? "chat" : "meetings",
  );
  const [activeRoom, setActiveRoom] = useState<LiveMeeting | null>(null);
  const [channelFilter, setChannelFilter] = useState<"" | MessageChannel>("");
  const [composerChannel, setComposerChannel] = useState<MessageChannel>(
    driverOnly ? "drivers" : "dispatch",
  );
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");

  const branchId = scope.branch !== "all" ? scope.branch : undefined;

  const query = useQuery({
    queryKey: [...scope.key, "messages", branchId ?? "all", channelFilter],
    queryFn: ({ signal }) =>
      listMessages(
        {
          companyId: scope.companyId,
          branchId,
          channel: channelFilter,
        },
        signal,
      ),
    enabled: canViewMessages && !!scope.companyId,
    refetchInterval: 30_000,
    retry: false,
  });

  const liveMeetingsQuery = useQuery({
    queryKey: [...scope.key, "meetings", branchId ?? "all", "live-badge"],
    queryFn: ({ signal }) =>
      listMeetings(
        {
          companyId: scope.companyId,
          branchId,
          status: "live",
          scope: "upcoming",
        },
        signal,
      ),
    enabled: canViewMeetings && !!scope.companyId,
    refetchInterval: 30_000,
    retry: false,
  });

  if (!canView) return null;

  const unreadCount = query.data?.unreadCount ?? 0;
  const liveMeetingsCount = liveMeetingsQuery.data?.liveCount ?? 0;
  const badgeCount = unreadCount + liveMeetingsCount;

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || sending) return;
    setSending(true);
    setSendError("");
    const ac = new AbortController();
    try {
      await sendMessage(
        {
          company_id: Number(scope.companyId),
          branch_id: branchId ? Number(branchId) : null,
          channel: composerChannel,
          body: body.trim(),
        },
        ac.signal,
      );
      setBody("");
      await client.invalidateQueries({ queryKey: [...scope.key, "messages"] });
    } catch (failure) {
      setSendError(errorText(failure));
    } finally {
      setSending(false);
    }
  }

  async function handleMarkRead(id: number) {
    const ac = new AbortController();
    try {
      await markMessageRead(id, ac.signal);
      await client.invalidateQueries({ queryKey: [...scope.key, "messages"] });
    } catch {
      // ignore transient error
    }
  }

  async function handleJoinFromChatCard(meetingId: number) {
    const ac = new AbortController();
    try {
      const meeting = await getMeeting(meetingId, ac.signal);
      if (isInAppMeetingProvider(meeting.provider)) {
        setActiveRoom(meeting);
      } else {
        const safe = sanitizeExternalMeetingUrl(meeting.join_url);
        if (safe) window.open(safe, "_blank", "noopener,noreferrer");
      }
    } catch {
      setActiveTab("meetings");
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="relative size-9 rounded-xl bg-surface/90"
              aria-label={`Messaging & Chat Center (${unreadCount} unread${
                liveMeetingsCount > 0 ? `, ${liveMeetingsCount} live` : ""
              })`}
            />
          }
        >
          <MessageSquare className="size-4" aria-hidden="true" />
          {badgeCount > 0 ? (
            <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-structural font-mono text-[10px] font-bold text-structural-foreground">
              {badgeCount > 99 ? "99+" : badgeCount}
            </span>
          ) : null}
        </SheetTrigger>
        <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-md">
          <div className="space-y-3 border-b px-5 py-4 pr-12">
            <div>
              <SheetTitle className="text-base font-bold">
                Messaging &amp; Chat Center
              </SheetTitle>
              <SheetDescription className="text-xs">
                {driverOnly
                  ? "Drivers & Dispatch channels and invited virtual meetings."
                  : "Branch-scoped chat channels and internal virtual meetings."}
              </SheetDescription>
            </div>

            {canViewMessages && canViewMeetings ? (
              <div
                role="tablist"
                aria-label="Communications mode"
                className="grid grid-cols-2 gap-1 rounded-xl bg-muted/60 p-1 text-xs"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "chat"}
                  onClick={() => setActiveTab("chat")}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition-colors ${
                    activeTab === "chat"
                      ? "bg-surface text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <MessageSquare className="size-3.5" aria-hidden="true" />
                  Chat
                  {unreadCount > 0 ? (
                    <span className="rounded-full bg-primary/15 px-1.5 py-0.2 text-[10px] font-bold text-primary">
                      {unreadCount}
                    </span>
                  ) : null}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "meetings"}
                  onClick={() => setActiveTab("meetings")}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition-colors ${
                    activeTab === "meetings"
                      ? "bg-surface text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Video className="size-3.5" aria-hidden="true" />
                  Meetings
                  {liveMeetingsCount > 0 ? (
                    <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.2 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                      {liveMeetingsCount} live
                    </span>
                  ) : null}
                </button>
              </div>
            ) : null}

            {activeTab === "chat" && canViewMessages ? (
              <DriveCoreSelect
                ariaLabel="Filter messages by channel"
                value={channelFilter}
                onValueChange={(v) => setChannelFilter(v as "" | MessageChannel)}
                options={[
                  { value: "", label: "All accessible channels" },
                  ...availableChannels,
                ]}
              />
            ) : null}
          </div>

          {activeTab === "meetings" && canViewMeetings ? (
            <MeetingsTab
              onJoinInApp={(meeting) => {
                setActiveRoom(meeting);
              }}
              onCloseDrawer={() => setOpen(false)}
            />
          ) : (
            <>
              <div className="flex-1 space-y-2.5 overflow-y-auto p-4">
                {query.error ? (
                  <p className="rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
                    Live messaging is not available on this API server yet.
                  </p>
                ) : !query.data || query.data.items.length === 0 ? (
                  <p className="rounded-xl border bg-muted/30 p-4 text-center text-xs text-muted-foreground">
                    No messages in this channel yet.
                  </p>
                ) : (
                  query.data.items.map((msg) => (
                    <article
                      key={msg.id}
                      className={`space-y-1.5 rounded-xl border p-3.5 text-xs ${
                        !msg.is_read
                          ? "border-primary/40 bg-primary/5"
                          : "bg-surface"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-foreground">
                            {msg.sender_name}
                          </span>
                          <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
                            {msg.channel}
                          </span>
                        </div>
                        {!msg.is_read ? (
                          <button
                            type="button"
                            onClick={() => {
                              void handleMarkRead(msg.id);
                            }}
                            className="font-semibold text-link hover:underline"
                          >
                            Mark read
                          </button>
                        ) : null}
                      </div>
                      <p className="whitespace-pre-wrap text-foreground">
                        {msg.body}
                      </p>
                      {msg.related_entity_type === "meeting" &&
                      msg.related_entity_id ? (
                        <div className="pt-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              void handleJoinFromChatCard(
                                msg.related_entity_id as number,
                              );
                            }}
                            className="h-7 gap-1.5 rounded-lg text-xs"
                          >
                            <Video className="size-3 text-primary" aria-hidden="true" />
                            Join meeting
                          </Button>
                        </div>
                      ) : null}
                      <p className="font-mono text-[10px] text-muted-foreground">
                        {fmtTime(msg.created_at)}
                      </p>
                    </article>
                  ))
                )}
              </div>

              {canSend ? (
                <form
                  onSubmit={(e) => {
                    void handleSend(e);
                  }}
                  className="space-y-2.5 border-t bg-muted/20 p-4"
                >
                  <DriveCoreSelect
                    ariaLabel="Message channel"
                    value={composerChannel}
                    onValueChange={(v) => setComposerChannel(v as MessageChannel)}
                    options={availableChannels}
                  />
                  <Textarea
                    aria-label="Message text"
                    rows={2}
                    maxLength={1000}
                    placeholder="Write a message to your team…"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                  />
                  {sendError ? (
                    <p role="alert" className="text-xs text-danger-foreground">
                      {sendError}
                    </p>
                  ) : null}
                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      size="sm"
                      disabled={sending || !body.trim()}
                    >
                      <Send className="mr-1.5 size-3.5" aria-hidden="true" />
                      {sending ? "Sending…" : "Send message"}
                    </Button>
                  </div>
                </form>
              ) : null}
            </>
          )}
        </SheetContent>
      </Sheet>

      <MeetingRoomModal
        meeting={activeRoom}
        user={user}
        open={!!activeRoom}
        onOpenChange={(next) => {
          if (!next) setActiveRoom(null);
        }}
        onMeetingEnded={() => {
          void client.invalidateQueries({ queryKey: [...scope.key, "meetings"] });
        }}
      />
    </>
  );
}
