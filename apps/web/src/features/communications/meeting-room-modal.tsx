"use client";

import { useState } from "react";
import {
  ExternalLink,
  FileText,
  PanelRightClose,
  PanelRightOpen,
  PhoneOff,
  Users,
  Video,
} from "lucide-react";
import {
  buildJitsiEmbedUrl,
  endMeeting,
  sanitizeExternalMeetingUrl,
} from "@/features/communications/meetings-service";
import { errorText } from "@/lib/api/client";
import {
  isSystemAdmin,
  meetingProviderLabels,
  type LiveMeeting,
  type User,
} from "@/lib/api/contracts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export function MeetingRoomModal({
  meeting,
  user,
  open,
  onOpenChange,
  onMeetingEnded,
}: {
  meeting: LiveMeeting | null;
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMeetingEnded?: () => void;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [ending, setEnding] = useState(false);
  const [showEndForm, setShowEndForm] = useState(false);
  const [minutes, setMinutes] = useState("");
  const [endError, setEndError] = useState("");

  if (!meeting) return null;

  const canOrganize =
    !!user &&
    (user.id === meeting.organizer_user_id || isSystemAdmin(user));
  const embedUrl = buildJitsiEmbedUrl(meeting, user?.name);
  const externalUrl = sanitizeExternalMeetingUrl(meeting.join_url) ?? embedUrl;

  async function handleEndMeeting(e: React.FormEvent) {
    e.preventDefault();
    if (!meeting || ending) return;
    setEnding(true);
    setEndError("");
    const ac = new AbortController();
    try {
      await endMeeting(meeting.id, minutes.trim() || null, ac.signal);
      setShowEndForm(false);
      setMinutes("");
      onMeetingEnded?.();
      onOpenChange(false);
    } catch (failure) {
      setEndError(errorText(failure));
    } finally {
      setEnding(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[84dvh] max-w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-5xl"
      >
        <DialogHeader className="flex flex-row flex-wrap items-center justify-between gap-2 border-b bg-surface px-4 py-3">
          <div className="min-w-0 flex-1">
            <DialogTitle className="flex items-center gap-2 text-sm font-bold sm:text-base">
              <Video className="size-4 shrink-0 text-primary" aria-hidden="true" />
              <span className="truncate">{meeting.title}</span>
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                {meetingProviderLabels[meeting.provider]}
              </span>
            </DialogTitle>
            <DialogDescription className="truncate text-xs">
              Organized by {meeting.organizer_name} ·{" "}
              {meeting.participants.length} invited
            </DialogDescription>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setSidebarOpen((v) => !v)}
              aria-label={sidebarOpen ? "Hide meeting details" : "Show meeting details"}
            >
              {sidebarOpen ? (
                <PanelRightClose className="size-3.5" aria-hidden="true" />
              ) : (
                <PanelRightOpen className="size-3.5" aria-hidden="true" />
              )}
              <span className="hidden sm:inline">Details</span>
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                window.open(externalUrl, "_blank", "noopener,noreferrer");
              }}
            >
              <ExternalLink className="mr-1 size-3.5" aria-hidden="true" />
              Open in new tab
            </Button>

            {canOrganize && meeting.status !== "ended" && meeting.status !== "cancelled" ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShowEndForm((v) => !v)}
              >
                <FileText className="mr-1 size-3.5" aria-hidden="true" />
                End &amp; save minutes
              </Button>
            ) : null}

            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => onOpenChange(false)}
            >
              <PhoneOff className="mr-1 size-3.5" aria-hidden="true" />
              Leave call
            </Button>
          </div>
        </DialogHeader>

        {showEndForm ? (
          <form
            onSubmit={(e) => {
              void handleEndMeeting(e);
            }}
            className="space-y-2 border-b bg-muted/30 px-4 py-3"
          >
            <label
              htmlFor="meeting-room-minutes"
              className="block text-xs font-semibold text-foreground"
            >
              Meeting minutes &amp; action items (optional)
            </label>
            <Textarea
              id="meeting-room-minutes"
              rows={3}
              maxLength={5000}
              placeholder="Summarize key decisions, owners, and next steps…"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
            />
            {endError ? (
              <p role="alert" className="text-xs text-danger-foreground">
                {endError}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setShowEndForm(false)}
              >
                Keep call open
              </Button>
              <Button type="submit" size="sm" disabled={ending}>
                {ending ? "Ending…" : "End meeting for everyone"}
              </Button>
            </div>
          </form>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <div className="relative min-h-[260px] flex-1 bg-slate-950">
            <iframe
              title={`Virtual meeting room: ${meeting.title}`}
              src={embedUrl}
              className="size-full border-0"
              allow="camera; microphone; fullscreen; display-capture; autoplay"
              referrerPolicy="no-referrer"
            />
          </div>

          {sidebarOpen ? (
            <aside className="flex w-full shrink-0 flex-col gap-4 overflow-y-auto border-t bg-surface p-4 text-xs md:w-72 md:border-t-0 md:border-l">
              <section className="space-y-1.5">
                <h3 className="font-semibold text-foreground">Agenda</h3>
                <p className="whitespace-pre-wrap text-muted-foreground">
                  {meeting.agenda?.trim() || "No agenda provided."}
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="flex items-center gap-1.5 font-semibold text-foreground">
                  <Users className="size-3.5" aria-hidden="true" />
                  Participants ({meeting.participants.length})
                </h3>
                {meeting.participants.length === 0 ? (
                  <p className="text-muted-foreground">
                    Open to all invited team members.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {meeting.participants.map((p) => (
                      <li
                        key={p.user_id}
                        className="flex items-center justify-between gap-2 rounded-lg border bg-muted/20 px-2.5 py-1.5"
                      >
                        <span className="truncate font-medium text-foreground">
                          {p.name}
                        </span>
                        <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] capitalize text-muted-foreground">
                          {p.rsvp_status}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </aside>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
