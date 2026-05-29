"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Mic,
  MicOff,
  PhoneOff,
  Video,
  VideoOff,
  LoaderCircle,
} from "lucide-react";
import { Room, RoomEvent, Track } from "livekit-client";
import type { LiveKitTokenPayload } from "../lib/calls";

type LiveKitCallOverlayProps = {
  open: boolean;
  callId: string;
  conversationName: string;
  callType: "direct" | "group";
  status: "ringing" | "connected";
  tokenPayload: LiveKitTokenPayload | null;
  tokenError: string | null;
  currentUserId?: string;
  participantDirectory?: Record<
    string,
    {
      name?: string;
      avatarUrl?: string | null;
    }
  >;
  onRetryToken: () => void;
  onHangUp: () => void;
};

type CameraTileProps = {
  participant: any;
  participantId?: string;
  avatarUrl?: string | null;
  label: string;
  subtitle?: string;
  mirrored?: boolean;
  compact?: boolean;
};

function resolveLiveKitUrl(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl);
    const isBrowserSecure = window.location.protocol === "https:";

    // Docker internal hostname is not reachable from browser on host machine.
    if (parsed.hostname === "livekit") {
      parsed.hostname = window.location.hostname || "localhost";
    }

    if (isBrowserSecure && parsed.protocol === "ws:") {
      parsed.protocol = "wss:";
    }

    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

function CameraTile({
  participant,
  participantId,
  avatarUrl,
  label,
  subtitle,
  mirrored = false,
  compact = false,
}: CameraTileProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const publication = participant?.getTrackPublication?.(Track.Source.Camera);

  useEffect(() => {
    const track = publication?.videoTrack;
    const element = videoRef.current;

    if (!track || !element) {
      return;
    }

    track.attach(element);
    return () => {
      try {
        track.detach(element);
      } catch {
        // Ignore detach errors while the room is tearing down.
      }
    };
  }, [publication?.trackSid, publication?.videoTrack]);

  const isLive = Boolean(publication?.videoTrack);
  const isMuted = participant ? !participant.isCameraEnabled : true;

  const fallbackAvatar =
    avatarUrl ||
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(participantId || label || "user")}`;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl ${compact ? "min-h-[180px]" : "min-h-[240px]"}`}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={participant?.isLocal !== false}
        className={`h-full w-full object-cover ${mirrored ? "scale-x-[-1]" : ""}`}
      />
      {!isLive && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900 text-white">
          <div className="flex flex-col items-center gap-3 px-6 text-center">
            <img
              src={fallbackAvatar}
              alt={label}
              className={`rounded-full border-2 border-white/80 object-cover ${compact ? "h-16 w-16" : "h-24 w-24"}`}
            />
            <div>
              <p className={`${compact ? "text-sm" : "text-base"} font-semibold`}>{label}</p>
              <p className="mt-1 text-sm text-white/70">
                {subtitle ?? "Đang chờ video..."}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-gradient-to-t from-black/85 to-transparent px-3 py-2 text-white">
        <div>
          <p className={`${compact ? "text-xs" : "text-sm"} font-semibold`}>{label}</p>
          {subtitle && <p className="text-[11px] text-white/70">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-white/80">
          {isMuted ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-1">
              <VideoOff className="h-3.5 w-3.5" />
              Tắt camera
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-1 text-emerald-100">
              <Video className="h-3.5 w-3.5" />
              Camera mở
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LiveKitCallOverlay({
  open,
  callId,
  conversationName,
  callType,
  status,
  tokenPayload,
  tokenError,
  currentUserId,
  participantDirectory,
  onRetryToken,
  onHangUp,
}: Readonly<LiveKitCallOverlayProps>) {
  const roomRef = useRef<Room | null>(null);
  const remoteAudioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const [renderTick, setRenderTick] = useState(0);
  const [connecting, setConnecting] = useState(false);
  const [roomReady, setRoomReady] = useState(false);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [callSeconds, setCallSeconds] = useState(0);
  const [connectedAt, setConnectedAt] = useState<number | null>(null);
  const [groupPage, setGroupPage] = useState(0);
  const [mediaState, setMediaState] = useState({
    microphoneEnabled: true,
    cameraEnabled: true,
  });

  useEffect(() => {
    if (!open || !tokenPayload) {
      roomRef.current?.disconnect();
      roomRef.current = null;
      setRoomReady(false);
      setConnecting(false);
      setRoomError(null);
      setCallSeconds(0);
      setConnectedAt(null);
      setGroupPage(0);
      setMediaState({
        microphoneEnabled: true,
        cameraEnabled: true,
      });
      return;
    }

    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;
    if (typeof window !== "undefined") {
      (window as any).__lkRoom = room;
    }
    let cancelled = false;

    const syncMediaState = () => {
      if (cancelled) {
        return;
      }

      setMediaState({
        microphoneEnabled: room.localParticipant.isMicrophoneEnabled,
        cameraEnabled: room.localParticipant.isCameraEnabled,
      });
    };

    const refresh = () => {
      if (!cancelled) {
        setRenderTick((value) => value + 1);
      }
    };

    room.on(RoomEvent.Connected, () => {
      if (cancelled) {
        return;
      }
      setRoomReady(true);
      setConnectedAt(Date.now());
      refresh();
    });
    room.on(RoomEvent.Disconnected, () => {
      if (cancelled) {
        return;
      }
      setRoomReady(false);
      refresh();
    });
    room.on(RoomEvent.TrackSubscribed, (track, _publication, participant) => {
      if (track.kind === Track.Kind.Audio) {
        const audioKey = track.sid ?? `${participant.sid}:${track.kind}:${Date.now()}`;
        const audioEl = document.createElement("audio");
        audioEl.autoplay = true;
        audioEl.setAttribute("playsinline", "true");
        audioEl.muted = false;
        track.attach(audioEl);
        remoteAudioElementsRef.current.set(audioKey, audioEl);
        void audioEl.play().catch((error) => {
          console.warn("Remote audio autoplay blocked", {
            participant: participant.identity,
            error,
          });
        });
        console.log("LiveKit remote audio subscribed", {
          participant: participant.identity,
          trackSid: track.sid,
        });
      }
      refresh();
    });
    room.on(RoomEvent.TrackUnsubscribed, (track) => {
      if (track.kind === Track.Kind.Audio) {
        const audioEl = track.sid
          ? remoteAudioElementsRef.current.get(track.sid)
          : undefined;
        if (audioEl) {
          try {
            track.detach(audioEl);
          } catch {
            // Ignore detach errors while tearing down.
          }
          audioEl.remove();
          if (track.sid) {
            remoteAudioElementsRef.current.delete(track.sid);
          } else {
            for (const [key, value] of remoteAudioElementsRef.current.entries()) {
              if (value === audioEl) {
                remoteAudioElementsRef.current.delete(key);
                break;
              }
            }
          }
        }
      }
      refresh();
    });
    room.on(RoomEvent.ParticipantConnected, refresh);
    room.on(RoomEvent.ParticipantDisconnected, refresh);
    room.on(RoomEvent.LocalTrackPublished, () => {
      syncMediaState();
      refresh();
    });
    room.on(RoomEvent.LocalTrackUnpublished, () => {
      syncMediaState();
      refresh();
    });
    room.on(RoomEvent.TrackMuted, () => {
      syncMediaState();
      refresh();
    });
    room.on(RoomEvent.TrackUnmuted, () => {
      syncMediaState();
      refresh();
    });
    room.on(RoomEvent.MediaDevicesChanged, refresh);

    const connectRoom = async () => {
      setConnecting(true);
      setRoomError(null);

      try {
        const resolvedWsUrl = resolveLiveKitUrl(tokenPayload.ws_url);
        await room.connect(resolvedWsUrl, tokenPayload.token);

        if (cancelled) {
          return;
        }

        const results = await Promise.allSettled([
          room.localParticipant.setMicrophoneEnabled(true),
          room.localParticipant.setCameraEnabled(true),
        ]);

        if (cancelled) {
          return;
        }

        const failures = results.filter((result): result is PromiseRejectedResult => {
          return result.status === "rejected";
        });

        if (failures.length > 0) {
          const firstError = failures[0].reason;
          const message = firstError instanceof Error ? firstError.message : "media_device_error";
          setRoomError(`Không thể bật đầy đủ camera/micro: ${message}`);
        }

        syncMediaState();
        console.log("LiveKit local media state", {
          microphoneEnabled: room.localParticipant.isMicrophoneEnabled,
          cameraEnabled: room.localParticipant.isCameraEnabled,
          publications: room.localParticipant
            .getTrackPublications()
            .map((pub) => ({ source: pub.source, kind: pub.kind, muted: pub.isMuted })),
        });
        refresh();
      } catch (error) {
        if (cancelled) {
          return;
        }

        const message = error instanceof Error ? error.message : "livekit_connect_failed";
        setRoomError(`Không thể kết nối phòng gọi: ${message}`);
      } finally {
        if (!cancelled) {
          setConnecting(false);
        }
      }
    };

    void connectRoom();

    return () => {
      cancelled = true;
      room.removeAllListeners();
      remoteAudioElementsRef.current.forEach((audioEl) => {
        audioEl.remove();
      });
      remoteAudioElementsRef.current.clear();
      room.disconnect();
      if (roomRef.current === room) {
        roomRef.current = null;
      }
      if (typeof window !== "undefined" && (window as any).__lkRoom === room) {
        (window as any).__lkRoom = undefined;
      }
    };
  }, [open, tokenPayload?.token, tokenPayload?.ws_url, tokenPayload?.room_name]);

  useEffect(() => {
    if (!connectedAt) {
      return;
    }

    const timer = window.setInterval(() => {
      setCallSeconds(Math.max(0, Math.floor((Date.now() - connectedAt) / 1000)));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [connectedAt]);

  if (!open) {
    return null;
  }

  const room = roomRef.current;
  const remoteParticipants = room
    ? Array.from(room.remoteParticipants.values())
    : [];
  const localParticipant = room?.localParticipant;
  const localParticipantId =
    (typeof localParticipant?.identity === "string" && localParticipant.identity) ||
    currentUserId ||
    "local-user";

  const resolveParticipant = (participant: any, fallbackLabel: string) => {
    const participantId =
      (typeof participant?.identity === "string" && participant.identity) ||
      (typeof participant?.sid === "string" && participant.sid) ||
      fallbackLabel;
    const profile = participantDirectory?.[participantId];
    const name =
      profile?.name ||
      participant?.name ||
      participant?.identity ||
      fallbackLabel;
    const avatarUrl = profile?.avatarUrl ?? null;
    return { participantId, name, avatarUrl };
  };

  const allParticipants = [
    { kind: "local" as const, participant: localParticipant },
    ...remoteParticipants.map((participant) => ({
      kind: "remote" as const,
      participant,
    })),
  ];
  const pageSize = 6;
  const totalPages = Math.max(1, Math.ceil(allParticipants.length / pageSize));
  const safeGroupPage = Math.min(groupPage, totalPages - 1);
  const pagedParticipants = allParticipants.slice(
    safeGroupPage * pageSize,
    safeGroupPage * pageSize + pageSize,
  );

  const formatCallDuration = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };
  const localCameraPublication = room?.localParticipant.getTrackPublication(
    Track.Source.Camera,
  );
  const connectionLabel = connecting
    ? "Đang kết nối phòng LiveKit..."
    : roomReady
      ? status === "ringing"
        ? "Đang đổ chuông"
        : "Đang trong cuộc gọi"
      : "Chưa kết nối media";

  const toggleMicrophone = async () => {
    const currentRoom = roomRef.current;
    if (!currentRoom) {
      return;
    }

    try {
      const nextValue = !mediaState.microphoneEnabled;
      await currentRoom.localParticipant.setMicrophoneEnabled(nextValue);
      setMediaState((current) => ({
        ...current,
        microphoneEnabled: nextValue,
      }));
      setRoomError(null);
      setRenderTick((value) => value + 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : "mic_toggle_failed";
      setRoomError(`Không thể đổi trạng thái micro: ${message}`);
    }
  };

  const toggleCamera = async () => {
    const currentRoom = roomRef.current;
    if (!currentRoom) {
      return;
    }

    try {
      const nextValue = !mediaState.cameraEnabled;
      await currentRoom.localParticipant.setCameraEnabled(nextValue);
      setMediaState((current) => ({
        ...current,
        cameraEnabled: nextValue,
      }));
      setRoomError(null);
      setRenderTick((value) => value + 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : "camera_toggle_failed";
      setRoomError(`Không thể đổi trạng thái camera: ${message}`);
    }
  };

  const remoteMain =
    remoteParticipants[0] || localParticipant;
  const remoteMainMeta = resolveParticipant(remoteMain, conversationName || "Người tham gia");
  const localMeta = resolveParticipant(localParticipant, "Bạn");

  return (
    <div className="fixed inset-0 z-[70] bg-black">
      <div className="relative h-full w-full overflow-hidden">
        <div className="absolute left-2 top-2 z-20 rounded bg-black/45 px-2 py-1 text-[24px] font-semibold tracking-wide text-emerald-400">
          {formatCallDuration(callSeconds)}
        </div>

        {callType === "group" ? (
          <div className="grid h-full grid-cols-1 gap-2 p-2 md:grid-cols-2 lg:grid-cols-3">
            {pagedParticipants.map((entry) => {
              const meta = resolveParticipant(
                entry.participant,
                entry.kind === "local" ? "Bạn" : "Người tham gia",
              );
              return (
                <CameraTile
                  key={`${entry.kind}-${meta.participantId}`}
                  participant={entry.participant}
                  participantId={meta.participantId}
                  avatarUrl={meta.avatarUrl}
                  label={meta.name}
                  subtitle={
                    entry.kind === "local"
                      ? mediaState.cameraEnabled
                        ? "Camera đang bật"
                        : "Camera đang tắt"
                      : entry.participant?.isCameraEnabled
                        ? "Camera đang bật"
                        : "Camera đang tắt"
                  }
                  mirrored={entry.kind === "local"}
                  compact
                />
              );
            })}
          </div>
        ) : (
          <>
            <div className="h-full w-full">
              <CameraTile
                participant={remoteMain}
                participantId={remoteMainMeta.participantId}
                avatarUrl={remoteMainMeta.avatarUrl}
                label={remoteMainMeta.name}
                subtitle={connectionLabel}
              />
            </div>

            <div className="absolute right-3 top-3 z-30 w-52">
              <CameraTile
                participant={localParticipant}
                participantId={localParticipantId}
                avatarUrl={localMeta.avatarUrl}
                label="Bạn"
                subtitle={mediaState.cameraEnabled ? "Camera đang bật" : "Camera đang tắt"}
                mirrored
                compact
              />
            </div>
          </>
        )}

        <div className="absolute right-3 top-3 z-20 rounded bg-black/45 px-3 py-2 text-sm text-white">
          {conversationName || "Cuộc gọi"}
        </div>

        {callType === "group" && totalPages > 1 && (
          <div className="absolute right-4 bottom-22 z-30 flex items-center gap-2 rounded-full bg-black/55 px-2 py-1 text-white">
            <button
              type="button"
              onClick={() => setGroupPage((p) => Math.max(0, p - 1))}
              disabled={safeGroupPage === 0}
              className="rounded-full p-2 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-medium">
              {safeGroupPage + 1}/{totalPages}
            </span>
            <button
              type="button"
              onClick={() => setGroupPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={safeGroupPage >= totalPages - 1}
              className="rounded-full p-2 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="absolute inset-x-0 bottom-4 z-30 flex justify-center">
          <div className="flex items-center gap-3 rounded-full bg-black/55 px-4 py-2">
            <button
              type="button"
              onClick={() => {
                void toggleCamera();
              }}
              disabled={!roomReady}
              className="rounded-full bg-white/10 p-3 text-white disabled:opacity-40"
              title={mediaState.cameraEnabled ? "Tắt camera" : "Bật camera"}
            >
              {mediaState.cameraEnabled ? (
                <Video className="h-5 w-5" />
              ) : (
                <VideoOff className="h-5 w-5" />
              )}
            </button>

            <button
              type="button"
              onClick={onHangUp}
              className="rounded-full bg-rose-500 p-3 text-white hover:bg-rose-600"
              title="Kết thúc"
            >
              <PhoneOff className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => {
                void toggleMicrophone();
              }}
              disabled={!roomReady}
              className="rounded-full bg-white/10 p-3 text-white disabled:opacity-40"
              title={mediaState.microphoneEnabled ? "Tắt micro" : "Bật micro"}
            >
              {mediaState.microphoneEnabled ? (
                <Mic className="h-5 w-5" />
              ) : (
                <MicOff className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        {(tokenError || roomError) && (
          <div className="absolute left-1/2 top-5 z-40 w-[min(92vw,540px)] -translate-x-1/2 rounded-xl border border-rose-400/40 bg-rose-500/20 p-3 text-sm text-rose-100">
            <p className="font-semibold">Không thể kết nối media</p>
            <p className="mt-1">{tokenError ?? roomError}</p>
            <button
              type="button"
              onClick={onRetryToken}
              className="mt-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/15"
            >
              <LoaderCircle className="h-3.5 w-3.5" />
              Thử lại
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
