import {
  joinMeetingRtc,
  leaveMeetingRtc,
  pollMeetingRtcSignals,
  sendMeetingRtcSignal,
} from "@/features/communications/meetings-service";
import type { RtcIceServer, RtcPeer, RtcSignal } from "@/lib/api/contracts";

export interface RemotePeerView {
  peer: RtcPeer;
  stream: MediaStream | null;
  connectionState: RTCPeerConnectionState | "signaling";
}

export interface RtcSessionCallbacks {
  onPeersChange: (peers: RemotePeerView[]) => void;
  onStatusChange: (status: "connecting" | "connected" | "error") => void;
  onError: (message: string) => void;
  onMaxPeersChange: (maxPeers: number) => void;
}

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];

export class DriveCoreRtcSession {
  private readonly meetingId: number;
  private readonly callbacks: RtcSessionCallbacks;
  private localStream: MediaStream | null;
  private peerId: string | null = null;
  private iceServers: RTCIceServer[] = DEFAULT_ICE_SERVERS;
  private afterId = 0;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private polling = false;
  private closed = false;
  private audioEnabled = true;
  private videoEnabled = true;
  private screenSharing = false;
  private readonly connections = new Map<string, RTCPeerConnection>();
  private readonly remoteStreams = new Map<string, MediaStream>();
  private readonly remotePeers = new Map<string, RtcPeer>();
  private readonly activeControllers = new Set<AbortController>();

  constructor(
    meetingId: number,
    localStream: MediaStream | null,
    initialMedia: { audioEnabled: boolean; videoEnabled: boolean },
    callbacks: RtcSessionCallbacks,
  ) {
    this.meetingId = meetingId;
    this.localStream = localStream;
    this.audioEnabled = initialMedia.audioEnabled;
    this.videoEnabled = initialMedia.videoEnabled;
    this.callbacks = callbacks;
  }

  private trackedAbort(): AbortController {
    const ac = new AbortController();
    this.activeControllers.add(ac);
    return ac;
  }

  async connect(): Promise<void> {
    this.callbacks.onStatusChange("connecting");
    const ac = this.trackedAbort();
    try {
      const joined = await joinMeetingRtc(
        this.meetingId,
        {
          audio_enabled: this.audioEnabled,
          video_enabled: this.videoEnabled,
        },
        ac.signal,
      );
      if (this.closed) return;

      this.peerId = joined.peer_id;
      this.callbacks.onMaxPeersChange(joined.max_recommended_peers);
      if (joined.ice_servers.length > 0) {
        this.iceServers = joined.ice_servers.map((s: RtcIceServer) => ({
          urls: s.urls,
          ...(s.username ? { username: s.username } : {}),
          ...(s.credential ? { credential: s.credential } : {}),
        }));
      }

      this.syncPeers(joined.peers);
      this.callbacks.onStatusChange("connected");

      this.pollTimer = setInterval(() => {
        void this.pollOnce();
      }, 1250);
    } catch (err) {
      if (!this.closed) {
        this.callbacks.onStatusChange("error");
        this.callbacks.onError(
          err instanceof Error ? err.message : "Could not join WebRTC room.",
        );
      }
    } finally {
      this.activeControllers.delete(ac);
    }
  }

  updateMediaState(next: {
    audioEnabled?: boolean;
    videoEnabled?: boolean;
    screenSharing?: boolean;
  }): void {
    if (typeof next.audioEnabled === "boolean")
      this.audioEnabled = next.audioEnabled;
    if (typeof next.videoEnabled === "boolean")
      this.videoEnabled = next.videoEnabled;
    if (typeof next.screenSharing === "boolean")
      this.screenSharing = next.screenSharing;
  }

  async replaceVideoTrack(track: MediaStreamTrack | null): Promise<void> {
    for (const pc of this.connections.values()) {
      const sender = pc
        .getSenders()
        .find((s) => s.track?.kind === "video" || s.track === null);
      if (sender) {
        try {
          await sender.replaceTrack(track);
        } catch {
          // ignore if peer already closed
        }
      } else if (track && this.localStream) {
        try {
          pc.addTrack(track, this.localStream);
        } catch {
          // ignore
        }
      }
    }
  }

  private emitPeers(): void {
    const list: RemotePeerView[] = [];
    for (const [id, peer] of this.remotePeers.entries()) {
      const pc = this.connections.get(id);
      list.push({
        peer,
        stream: this.remoteStreams.get(id) ?? null,
        connectionState: pc ? pc.connectionState : "signaling",
      });
    }
    this.callbacks.onPeersChange(list);
  }

  private syncPeers(peers: RtcPeer[]): void {
    if (!this.peerId) return;
    const seen = new Set<string>();
    for (const peer of peers) {
      if (peer.peer_id === this.peerId) continue;
      seen.add(peer.peer_id);
      this.remotePeers.set(peer.peer_id, peer);
      if (!this.connections.has(peer.peer_id) && typeof RTCPeerConnection !== "undefined") {
        // Deterministic glare avoidance: lexicographically higher peer_id sends offer
        const shouldInitiate = this.peerId > peer.peer_id;
        void this.ensurePeerConnection(peer.peer_id, shouldInitiate);
      }
    }
    for (const existingId of [...this.remotePeers.keys()]) {
      if (!seen.has(existingId)) {
        this.removePeer(existingId);
      }
    }
    this.emitPeers();
  }

  private removePeer(remotePeerId: string): void {
    const pc = this.connections.get(remotePeerId);
    if (pc) {
      try {
        pc.close();
      } catch {
        // ignore
      }
      this.connections.delete(remotePeerId);
    }
    this.remoteStreams.delete(remotePeerId);
    this.remotePeers.delete(remotePeerId);
  }

  private async ensurePeerConnection(
    remotePeerId: string,
    createOffer: boolean,
  ): Promise<RTCPeerConnection | null> {
    if (this.closed || !this.peerId || typeof RTCPeerConnection === "undefined") {
      return null;
    }
    let pc = this.connections.get(remotePeerId);
    if (!pc) {
      pc = new RTCPeerConnection({ iceServers: this.iceServers });
      this.connections.set(remotePeerId, pc);

      if (this.localStream) {
        for (const track of this.localStream.getTracks()) {
          pc.addTrack(track, this.localStream);
        }
      } else {
        // Receive-only transceivers for listen-only participants
        try {
          pc.addTransceiver("audio", { direction: "recvonly" });
          pc.addTransceiver("video", { direction: "recvonly" });
        } catch {
          // ignore browser quirks
        }
      }

      pc.ontrack = (event) => {
        const stream = event.streams[0] ?? new MediaStream([event.track]);
        this.remoteStreams.set(remotePeerId, stream);
        this.emitPeers();
      };

      pc.onicecandidate = (event) => {
        if (!event.candidate || !this.peerId || this.closed) return;
        const ac = this.trackedAbort();
        void sendMeetingRtcSignal(
          this.meetingId,
          {
            from_peer_id: this.peerId,
            to_peer_id: remotePeerId,
            type: "ice",
            payload: event.candidate.toJSON() as Record<string, unknown>,
          },
          ac.signal,
        )
          .catch(() => {})
          .finally(() => this.activeControllers.delete(ac));
      };

      pc.onconnectionstatechange = () => {
        this.emitPeers();
      };
    }

    if (createOffer) {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        const ac = this.trackedAbort();
        await sendMeetingRtcSignal(
          this.meetingId,
          {
            from_peer_id: this.peerId,
            to_peer_id: remotePeerId,
            type: "offer",
            payload: { type: offer.type, sdp: offer.sdp ?? "" },
          },
          ac.signal,
        ).finally(() => this.activeControllers.delete(ac));
      } catch {
        // ignore transient negotiation errors
      }
    }

    return pc;
  }

  private async handleSignal(sig: RtcSignal): Promise<void> {
    if (this.closed || !this.peerId) return;
    const pc = await this.ensurePeerConnection(sig.from_peer_id, false);
    if (!pc) return;

    try {
      if (sig.type === "offer") {
        const desc = sig.payload as unknown as RTCSessionDescriptionInit;
        await pc.setRemoteDescription(new RTCSessionDescription(desc));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        const ac = this.trackedAbort();
        await sendMeetingRtcSignal(
          this.meetingId,
          {
            from_peer_id: this.peerId,
            to_peer_id: sig.from_peer_id,
            type: "answer",
            payload: { type: answer.type, sdp: answer.sdp ?? "" },
          },
          ac.signal,
        ).finally(() => this.activeControllers.delete(ac));
      } else if (sig.type === "answer") {
        const desc = sig.payload as unknown as RTCSessionDescriptionInit;
        if (pc.signalingState === "have-local-offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(desc));
        }
      } else if (sig.type === "ice") {
        const candidate = sig.payload as unknown as RTCIceCandidateInit;
        if (pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
      }
    } catch {
      // ignore stale/out-of-order signaling payloads
    }
  }

  private async pollOnce(): Promise<void> {
    if (this.closed || this.polling || !this.peerId) return;
    this.polling = true;
    const ac = this.trackedAbort();
    try {
      const res = await pollMeetingRtcSignals(
        this.meetingId,
        {
          peerId: this.peerId,
          afterId: this.afterId,
          audioEnabled: this.audioEnabled,
          videoEnabled: this.videoEnabled,
          screenSharing: this.screenSharing,
        },
        ac.signal,
      );
      if (this.closed) return;
      this.syncPeers(res.peers);
      for (const sig of res.signals) {
        if (sig.id > this.afterId) this.afterId = sig.id;
        await this.handleSignal(sig);
      }
    } catch {
      // keep polling on transient network blips
    } finally {
      this.polling = false;
      this.activeControllers.delete(ac);
    }
  }

  async disconnect(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    for (const ac of this.activeControllers) {
      ac.abort();
    }
    this.activeControllers.clear();
    for (const pc of this.connections.values()) {
      try {
        pc.close();
      } catch {
        // ignore
      }
    }
    this.connections.clear();
    this.remoteStreams.clear();
    this.remotePeers.clear();

    if (this.peerId) {
      const leavingId = this.peerId;
      this.peerId = null;
      try {
        await leaveMeetingRtc(this.meetingId, leavingId);
      } catch {
        // best-effort leave
      }
    }
  }
}
