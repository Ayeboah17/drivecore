"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  FileText,
  Mic,
  MicOff,
  MonitorUp,
  PanelRightClose,
  PanelRightOpen,
  PhoneOff,
  Users,
  Video,
  VideoOff,
} from "lucide-react";
import { endMeeting } from "@/features/communications/meetings-service";
import {
  DriveCoreRtcSession,
  type RemotePeerView,
} from "@/features/communications/webrtc-client";
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
import { DriveCoreSelect } from "@/components/ui/drivecore-select";
import { Textarea } from "@/components/ui/textarea";

function initialsFor(name: string): string {
  const parts = name
    .replace(/\(.*?\)/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "DC";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function VideoElement({
  stream,
  muted,
  mirrored = false,
  label,
}: {
  stream: MediaStream | null;
  muted: boolean;
  mirrored?: boolean;
  label: string;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      aria-label={label}
      className={`size-full object-cover ${mirrored ? "-scale-x-100" : ""}`}
    />
  );
}

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
  const [stage, setStage] = useState<"lobby" | "live">("lobby");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [listenOnly, setListenOnly] = useState(false);
  const [mediaNotice, setMediaNotice] = useState("");
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioId, setSelectedAudioId] = useState("");
  const [selectedVideoId, setSelectedVideoId] = useState("");

  const [rtcStatus, setRtcStatus] = useState<"connecting" | "connected" | "error">(
    "connecting",
  );
  const [rtcError, setRtcError] = useState("");
  const [remotePeers, setRemotePeers] = useState<RemotePeerView[]>([]);
  const [maxRecommendedPeers, setMaxRecommendedPeers] = useState(6);
  const [copiedLink, setCopiedLink] = useState(false);

  const [showEndForm, setShowEndForm] = useState(false);
  const [minutes, setMinutes] = useState("");
  const [ending, setEnding] = useState(false);
  const [endError, setEndError] = useState("");

  const sessionRef = useRef<DriveCoreRtcSession | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  const stopMediaTracksOnly = useCallback(() => {
    for (const track of screenStreamRef.current?.getTracks() ?? []) {
      track.stop();
    }
    screenStreamRef.current = null;
    for (const track of localStreamRef.current?.getTracks() ?? []) {
      track.stop();
    }
    localStreamRef.current = null;
  }, []);

  const stopAllMedia = useCallback(() => {
    stopMediaTracksOnly();
    setLocalStream(null);
    setScreenStream(null);
    setScreenSharing(false);
  }, [stopMediaTracksOnly]);

  const acquirePreview = useCallback(
    async (audioId?: string, videoId?: string) => {
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        setListenOnly(true);
        setAudioEnabled(false);
        setVideoEnabled(false);
        setMediaNotice(
          "Camera and microphone APIs are unavailable in this browser context. You can still join in listen-only mode.",
        );
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: audioId ? { deviceId: { exact: audioId } } : true,
          video: videoId
            ? { deviceId: { exact: videoId }, width: { ideal: 1280 } }
            : { width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        for (const t of localStreamRef.current?.getTracks() ?? []) t.stop();
        localStreamRef.current = stream;
        setLocalStream(stream);
        setListenOnly(false);
        setMediaNotice("");
        setAudioEnabled(stream.getAudioTracks().some((t) => t.enabled));
        setVideoEnabled(stream.getVideoTracks().some((t) => t.enabled));

        if (navigator.mediaDevices.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          setAudioDevices(devices.filter((d) => d.kind === "audioinput"));
          setVideoDevices(devices.filter((d) => d.kind === "videoinput"));
        }
      } catch {
        setListenOnly(true);
        setAudioEnabled(false);
        setVideoEnabled(false);
        setMediaNotice(
          "Camera or microphone permission was denied or no device was detected. You can still join in listen-only mode.",
        );
      }
    },
    [],
  );

  // Initialize lobby preview when dialog opens; stop external tracks/connections on unmount
  useEffect(() => {
    if (!open || !meeting) {
      void sessionRef.current?.disconnect();
      sessionRef.current = null;
      stopMediaTracksOnly();
      return;
    }

    let cancelled = false;
    const init = async () => {
      if (cancelled) return;
      await acquirePreview();
    };
    void init();
    return () => {
      cancelled = true;
      void sessionRef.current?.disconnect();
      sessionRef.current = null;
      stopMediaTracksOnly();
    };
  }, [open, meeting, acquirePreview, stopMediaTracksOnly]);

  useEffect(() => {
    if (!open) return;
    const onUnload = () => {
      void sessionRef.current?.disconnect();
      stopMediaTracksOnly();
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [open, stopMediaTracksOnly]);

  if (!meeting) return null;

  const canOrganize =
    !!user &&
    (user.id === meeting.organizer_user_id || isSystemAdmin(user));

  function toggleAudio() {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !audioEnabled;
    for (const track of stream.getAudioTracks()) {
      track.enabled = next;
    }
    setAudioEnabled(next);
    sessionRef.current?.updateMediaState({ audioEnabled: next });
  }

  function toggleVideo() {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !videoEnabled;
    for (const track of stream.getVideoTracks()) {
      track.enabled = next;
    }
    setVideoEnabled(next);
    sessionRef.current?.updateMediaState({ videoEnabled: next });
  }

  async function toggleScreenShare() {
    if (screenSharing) {
      for (const t of screenStreamRef.current?.getTracks() ?? []) t.stop();
      screenStreamRef.current = null;
      setScreenStream(null);
      const camTrack = localStreamRef.current?.getVideoTracks()[0] ?? null;
      await sessionRef.current?.replaceVideoTrack(camTrack);
      setScreenSharing(false);
      sessionRef.current?.updateMediaState({ screenSharing: false });
      return;
    }

    if (!navigator.mediaDevices?.getDisplayMedia) {
      setRtcError("Screen sharing is not supported in this browser.");
      return;
    }
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      const screenTrack = displayStream.getVideoTracks()[0];
      if (!screenTrack) return;
      screenStreamRef.current = displayStream;
      setScreenStream(displayStream);
      await sessionRef.current?.replaceVideoTrack(screenTrack);
      setScreenSharing(true);
      sessionRef.current?.updateMediaState({ screenSharing: true });
      screenTrack.onended = () => {
        screenStreamRef.current = null;
        setScreenStream(null);
        const camTrack = localStreamRef.current?.getVideoTracks()[0] ?? null;
        void sessionRef.current?.replaceVideoTrack(camTrack);
        setScreenSharing(false);
        sessionRef.current?.updateMediaState({ screenSharing: false });
      };
    } catch {
      // user cancelled screen share picker
    }
  }

  async function handleJoinRoom() {
    if (!meeting) return;
    setRtcError("");
    setStage("live");
    const session = new DriveCoreRtcSession(
      meeting.id,
      localStreamRef.current,
      { audioEnabled, videoEnabled },
      {
        onPeersChange: setRemotePeers,
        onStatusChange: setRtcStatus,
        onError: setRtcError,
        onMaxPeersChange: setMaxRecommendedPeers,
      },
    );
    sessionRef.current = session;
    await session.connect();
  }

  async function handleLeaveCall() {
    await sessionRef.current?.disconnect();
    sessionRef.current = null;
    stopAllMedia();
    setStage("lobby");
    setRemotePeers([]);
    setRtcError("");
    setShowEndForm(false);
    onOpenChange(false);
  }

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
      await sessionRef.current?.disconnect();
      sessionRef.current = null;
      stopAllMedia();
      onMeetingEnded?.();
      onOpenChange(false);
    } catch (failure) {
      setEndError(errorText(failure));
    } finally {
      setEnding(false);
    }
  }

  async function handleCopyRoomLink() {
    const shareUrl = `${window.location.origin}${window.location.pathname}?meeting=${meeting?.id ?? ""}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  }

  const totalParticipants = 1 + remotePeers.length;
  const gridCols =
    totalParticipants <= 1
      ? "grid-cols-1"
      : totalParticipants === 2
        ? "grid-cols-1 md:grid-cols-2"
        : totalParticipants <= 4
          ? "grid-cols-1 sm:grid-cols-2"
          : "grid-cols-2 lg:grid-cols-3";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          void handleLeaveCall();
        }
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="flex h-[86dvh] max-w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden rounded-2xl border bg-canvas p-0 sm:max-w-5xl"
      >
        <DialogHeader className="flex flex-row flex-wrap items-center justify-between gap-2 border-b bg-surface px-4 py-3">
          <div className="min-w-0 flex-1">
            <DialogTitle className="flex items-center gap-2 text-sm font-bold sm:text-base">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Video className="size-4" aria-hidden="true" />
              </span>
              <span className="truncate">{meeting.title}</span>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                {meetingProviderLabels[meeting.provider]}
              </span>
              {stage === "live" ? (
                <span className="inline-flex items-center gap-1 rounded-full border bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  <span
                    className={`size-1.5 rounded-full ${
                      rtcStatus === "connected"
                        ? "bg-emerald-500"
                        : rtcStatus === "error"
                          ? "bg-destructive"
                          : "bg-amber-500"
                    }`}
                  />
                  {rtcStatus === "connected"
                    ? `${totalParticipants} in room`
                    : rtcStatus === "error"
                      ? "Connection issue"
                      : "Connecting…"}
                </span>
              ) : null}
            </DialogTitle>
            <DialogDescription className="truncate pl-9 text-xs">
              Host: {meeting.organizer_name} · {meeting.participants.length} invited
            </DialogDescription>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                void handleCopyRoomLink();
              }}
            >
              {copiedLink ? (
                <Check className="mr-1 size-3.5 text-emerald-600" aria-hidden="true" />
              ) : (
                <Copy className="mr-1 size-3.5" aria-hidden="true" />
              )}
              {copiedLink ? "Copied" : "Copy link"}
            </Button>

            {stage === "live" ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setSidebarOpen((v) => !v)}
                aria-label={
                  sidebarOpen ? "Hide meeting details" : "Show meeting details"
                }
              >
                {sidebarOpen ? (
                  <PanelRightClose className="size-3.5" aria-hidden="true" />
                ) : (
                  <PanelRightOpen className="size-3.5" aria-hidden="true" />
                )}
                <span className="hidden sm:inline">Details</span>
              </Button>
            ) : null}

            {canOrganize &&
            meeting.status !== "ended" &&
            meeting.status !== "cancelled" ? (
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
              onClick={() => {
                void handleLeaveCall();
              }}
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
            className="space-y-2 border-b bg-surface/90 px-4 py-3"
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

        {stage === "lobby" ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto p-6">
            <div className="grid w-full max-w-3xl gap-6 rounded-2xl border bg-surface p-6 shadow-sm md:grid-cols-[1.35fr_1fr]">
              <div className="space-y-3">
                <div className="relative aspect-video overflow-hidden rounded-2xl border bg-slate-950">
                  {localStream && videoEnabled ? (
                    <VideoElement
                      stream={localStream}
                      muted
                      mirrored
                      label="Local camera preview"
                    />
                  ) : (
                    <div className="flex size-full flex-col items-center justify-center gap-2 text-slate-300">
                      <div className="flex size-16 items-center justify-center rounded-full bg-primary/20 text-lg font-bold text-primary-foreground">
                        {initialsFor(user?.name ?? "DriveCore")}
                      </div>
                      <p className="text-xs text-slate-400">
                        {listenOnly ? "Listen-only mode" : "Camera is off"}
                      </p>
                    </div>
                  )}

                  <div className="absolute right-3 bottom-3 left-3 flex items-center justify-between">
                    <span className="rounded-lg bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-xs">
                      {user?.name ?? "You"}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        size="icon-sm"
                        variant={audioEnabled ? "secondary" : "destructive"}
                        disabled={listenOnly}
                        onClick={toggleAudio}
                        aria-label={audioEnabled ? "Mute microphone" : "Unmute microphone"}
                      >
                        {audioEnabled ? (
                          <Mic className="size-3.5" aria-hidden="true" />
                        ) : (
                          <MicOff className="size-3.5" aria-hidden="true" />
                        )}
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant={videoEnabled ? "secondary" : "destructive"}
                        disabled={listenOnly}
                        onClick={toggleVideo}
                        aria-label={videoEnabled ? "Turn camera off" : "Turn camera on"}
                      >
                        {videoEnabled ? (
                          <Video className="size-3.5" aria-hidden="true" />
                        ) : (
                          <VideoOff className="size-3.5" aria-hidden="true" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                {mediaNotice ? (
                  <p className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                    <span>{mediaNotice}</span>
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-bold text-foreground">
                      Ready to join?
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Peer-to-peer DriveCore WebRTC room (recommended up to 6
                      active participants).
                    </p>
                  </div>

                  {audioDevices.length > 0 ? (
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-muted-foreground">
                        Microphone
                      </label>
                      <DriveCoreSelect
                        ariaLabel="Select microphone"
                        value={selectedAudioId || audioDevices[0]?.deviceId || ""}
                        onValueChange={(id) => {
                          setSelectedAudioId(id);
                          void acquirePreview(id, selectedVideoId || undefined);
                        }}
                        options={audioDevices.map((d, idx) => ({
                          value: d.deviceId || `mic-${idx}`,
                          label: d.label || `Microphone ${idx + 1}`,
                        }))}
                      />
                    </div>
                  ) : null}

                  {videoDevices.length > 0 ? (
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-muted-foreground">
                        Camera
                      </label>
                      <DriveCoreSelect
                        ariaLabel="Select camera"
                        value={selectedVideoId || videoDevices[0]?.deviceId || ""}
                        onValueChange={(id) => {
                          setSelectedVideoId(id);
                          void acquirePreview(selectedAudioId || undefined, id);
                        }}
                        options={videoDevices.map((d, idx) => ({
                          value: d.deviceId || `cam-${idx}`,
                          label: d.label || `Camera ${idx + 1}`,
                        }))}
                      />
                    </div>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Button
                    type="button"
                    className="w-full"
                    onClick={() => {
                      void handleJoinRoom();
                    }}
                  >
                    <Video className="mr-1.5 size-4" aria-hidden="true" />
                    Join DriveCore Room
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      void handleLeaveCall();
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col md:flex-row">
            <div className="flex min-h-0 flex-1 flex-col bg-slate-950/95">
              {totalParticipants > maxRecommendedPeers ? (
                <div className="flex items-center gap-2 border-b border-amber-500/30 bg-amber-500/15 px-4 py-2 text-xs text-amber-200">
                  <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    {totalParticipants} participants active — P2P WebRTC works
                    best with up to {maxRecommendedPeers} people. For larger
                    all-hands calls, use a Zoom or Teams link.
                  </span>
                </div>
              ) : null}

              {rtcError ? (
                <div
                  role="alert"
                  className="border-b border-destructive/40 bg-destructive/15 px-4 py-2 text-xs text-red-200"
                >
                  {rtcError}
                </div>
              ) : null}

              <div
                className={`grid min-h-0 flex-1 gap-3 overflow-y-auto p-4 ${gridCols}`}
              >
                {/* Local participant tile */}
                <div
                  data-testid="webrtc-local-tile"
                  className="relative flex min-h-[200px] items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-slate-900"
                >
                  {localStream && (videoEnabled || screenSharing) ? (
                    <VideoElement
                      stream={
                        screenSharing && screenStream
                          ? screenStream
                          : localStream
                      }
                      muted
                      mirrored={!screenSharing}
                      label="Your video feed"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-slate-300">
                      <div className="flex size-16 items-center justify-center rounded-full bg-primary/25 text-lg font-bold text-white">
                        {initialsFor(user?.name ?? "You")}
                      </div>
                      <span className="text-xs text-slate-400">
                        {listenOnly ? "Listen-only" : "Camera off"}
                      </span>
                    </div>
                  )}

                  <div className="absolute right-3 bottom-3 left-3 flex items-center justify-between gap-2">
                    <span className="truncate rounded-lg bg-black/65 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-xs">
                      {user?.name ?? "You"} (You)
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-lg bg-black/65 px-2 py-1 text-[11px] text-slate-200 backdrop-blur-xs">
                      {audioEnabled ? (
                        <Mic className="size-3 text-emerald-400" aria-hidden="true" />
                      ) : (
                        <MicOff className="size-3 text-red-400" aria-hidden="true" />
                      )}
                      {screenSharing ? "Presenting" : null}
                    </span>
                  </div>
                </div>

                {/* Remote peer tiles */}
                {remotePeers.map(({ peer, stream, connectionState }) => (
                  <div
                    key={peer.peer_id}
                    data-testid={`webrtc-remote-tile-${peer.user_id}`}
                    className="relative flex min-h-[200px] items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-slate-900"
                  >
                    {stream && peer.video_enabled ? (
                      <VideoElement
                        stream={stream}
                        muted={false}
                        label={`${peer.name} video feed`}
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-slate-300">
                        <div className="flex size-16 items-center justify-center rounded-full bg-slate-700 text-lg font-bold text-white">
                          {initialsFor(peer.name)}
                        </div>
                        <span className="text-xs text-slate-400">
                          {connectionState === "connected"
                            ? "Camera off"
                            : "Connecting media…"}
                        </span>
                      </div>
                    )}

                    <div className="absolute right-3 bottom-3 left-3 flex items-center justify-between gap-2">
                      <span className="truncate rounded-lg bg-black/65 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-xs">
                        {peer.name}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-lg bg-black/65 px-2 py-1 text-[11px] text-slate-200 backdrop-blur-xs">
                        {peer.audio_enabled ? (
                          <Mic className="size-3 text-emerald-400" aria-hidden="true" />
                        ) : (
                          <MicOff className="size-3 text-red-400" aria-hidden="true" />
                        )}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Floating DriveCore control dock */}
              <div className="flex flex-wrap items-center justify-center gap-2 border-t border-white/10 bg-slate-900/95 px-4 py-3">
                <Button
                  type="button"
                  size="sm"
                  variant={audioEnabled ? "secondary" : "destructive"}
                  disabled={listenOnly}
                  onClick={toggleAudio}
                >
                  {audioEnabled ? (
                    <Mic className="mr-1.5 size-3.5" aria-hidden="true" />
                  ) : (
                    <MicOff className="mr-1.5 size-3.5" aria-hidden="true" />
                  )}
                  {audioEnabled ? "Mute" : "Unmute"}
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant={videoEnabled ? "secondary" : "destructive"}
                  disabled={listenOnly}
                  onClick={toggleVideo}
                >
                  {videoEnabled ? (
                    <Video className="mr-1.5 size-3.5" aria-hidden="true" />
                  ) : (
                    <VideoOff className="mr-1.5 size-3.5" aria-hidden="true" />
                  )}
                  {videoEnabled ? "Stop video" : "Start video"}
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant={screenSharing ? "default" : "secondary"}
                  onClick={() => {
                    void toggleScreenShare();
                  }}
                >
                  <MonitorUp className="mr-1.5 size-3.5" aria-hidden="true" />
                  {screenSharing ? "Stop sharing" : "Share screen"}
                </Button>
              </div>
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
                    In room ({totalParticipants})
                  </h3>
                  <ul className="space-y-1.5">
                    <li className="flex items-center justify-between gap-2 rounded-lg border bg-primary/5 px-2.5 py-1.5">
                      <span className="truncate font-medium text-foreground">
                        {user?.name ?? "You"} (You)
                      </span>
                      <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                        Live
                      </span>
                    </li>
                    {remotePeers.map(({ peer }) => (
                      <li
                        key={peer.peer_id}
                        className="flex items-center justify-between gap-2 rounded-lg border bg-muted/20 px-2.5 py-1.5"
                      >
                        <span className="truncate font-medium text-foreground">
                          {peer.name}
                        </span>
                        <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                          Live
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="space-y-2">
                  <h3 className="font-semibold text-foreground">
                    Invited ({meeting.participants.length})
                  </h3>
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
                </section>
              </aside>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
