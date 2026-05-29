"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Mic,
  MicOff,
  PhoneOff,
  Video,
  VideoOff,
  Users,
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
  onRetryToken: () => void;
  onHangUp: () => void;
};

type CameraTileProps = {
  participant: any;
  label: string;
  subtitle?: string;
  mirrored?: boolean;
  accentClassName?: string;
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
  label,
  subtitle,
  mirrored = false,
  accentClassName = "bg-slate-800",
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

  return (
    <div className="relative min-h-[240px] overflow-hidden rounded-3xl border border-white/10 bg-slate-900 shadow-2xl">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={participant?.isLocal !== false}
        className={`h-full w-full object-cover ${mirrored ? "scale-x-[-1]" : ""}`}
      />
      {!isLive && (
        <div
          className={`absolute inset-0 flex items-center justify-center text-white ${accentClassName}`}
        >
          <div className="flex flex-col items-center gap-3 px-6 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10 text-3xl font-semibold text-white/90">
              {(label || "U").slice(0, 1).toUpperCase()}
            </div>
            <div>
              <p className="text-base font-semibold">{label}</p>
              <p className="mt-1 text-sm text-white/70">
                {subtitle ?? "Đang chờ video..."}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-gradient-to-t from-slate-950/80 to-transparent px-4 py-3 text-white">
        <div>
          <p className="text-sm font-semibold">{label}</p>
          {subtitle && <p className="text-xs text-white/70">{subtitle}</p>}
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
  onRetryToken,
  onHangUp,
}: Readonly<LiveKitCallOverlayProps>) {
  const roomRef = useRef<Room | null>(null);
  const remoteAudioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const [renderTick, setRenderTick] = useState(0);
  const [connecting, setConnecting] = useState(false);
  const [roomReady, setRoomReady] = useState(false);
  const [roomError, setRoomError] = useState<string | null>(null);
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

  if (!open) {
    return null;
  }

  const room = roomRef.current;
  const remoteParticipants = room
    ? Array.from(room.remoteParticipants.values())
    : [];
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

  return (
    <div className="fixed inset-0 z-[70] bg-slate-950/90 backdrop-blur-md">
      <div className="flex h-full w-full flex-col p-3 sm:p-4 lg:p-6">
        <div className="mb-4 flex items-center justify-between rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-white shadow-2xl shadow-black/20">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.25em] text-white/50">
              <span>{callType === "group" ? "Cuộc gọi nhóm" : "Cuộc gọi 1-1"}</span>
              <span className="h-1 w-1 rounded-full bg-white/30" />
              <span>{connectionLabel}</span>
            </div>
            <h2 className="mt-1 truncate text-lg font-semibold sm:text-xl">
              {conversationName || "Cuộc gọi"}
            </h2>
            <p className="mt-1 text-sm text-white/65">
              Call ID: {callId}
              {tokenPayload ? ` • Room: ${tokenPayload.room_name}` : ""}
            </p>
          </div>

          <button
            type="button"
            onClick={onHangUp}
            className="inline-flex items-center gap-2 rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-600"
          >
            <PhoneOff className="h-4 w-4" />
            Kết thúc
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-h-0 overflow-hidden rounded-[28px] border border-white/10 bg-white/5 p-3 shadow-2xl shadow-black/20 sm:p-4">
            <div className="mb-3 flex items-center justify-between px-1 text-sm text-white/70">
              <span>
                {remoteParticipants.length > 0
                  ? `${remoteParticipants.length} người đang trong phòng`
                  : "Đang chờ người khác tham gia"}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-xs font-medium text-white/70">
                <Users className="h-3.5 w-3.5" />
                {roomReady ? "Đã sẵn sàng" : "Đang khởi tạo"}
              </span>
            </div>

            <div className="grid max-h-[calc(100vh-210px)] grid-cols-1 gap-3 overflow-y-auto pr-1 md:grid-cols-2 xl:grid-cols-3">
              <CameraTile
                participant={room?.localParticipant}
                label="Bạn"
                subtitle={mediaState.microphoneEnabled ? "Micro đang bật" : "Micro đang tắt"}
                mirrored
                accentClassName="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700"
              />

              {remoteParticipants.map((participant: any) => (
                <CameraTile
                  key={participant.sid}
                  participant={participant}
                  label={participant.name || participant.identity || "Người tham gia"}
                  subtitle={participant.isCameraEnabled ? "Camera đang bật" : "Camera đang tắt"}
                  accentClassName="bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-800"
                />
              ))}

              {!tokenPayload && (
                <div className="flex min-h-[240px] items-center justify-center rounded-3xl border border-dashed border-white/15 bg-slate-900/60 text-center text-sm text-white/60 md:col-span-2 xl:col-span-3">
                  Đang chuẩn bị phòng gọi...
                </div>
              )}
            </div>
          </div>

          <aside className="flex min-h-0 flex-col gap-4 rounded-[28px] border border-white/10 bg-white/5 p-4 text-white shadow-2xl shadow-black/20">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-white/45">
                Trạng thái media
              </p>
              <p className="mt-2 text-lg font-semibold">{connectionLabel}</p>
              <p className="mt-1 text-sm text-white/60">
                {roomReady
                  ? "LiveKit đã kết nối và sẵn sàng truyền video."
                  : "Chờ kết nối với server LiveKit."}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  void toggleMicrophone();
                }}
                disabled={!roomReady}
                className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  mediaState.microphoneEnabled
                    ? "bg-white/10 text-white hover:bg-white/15"
                    : "bg-amber-500/20 text-amber-100 hover:bg-amber-500/30"
                }`}
              >
                {mediaState.microphoneEnabled ? (
                  <Mic className="h-4 w-4" />
                ) : (
                  <MicOff className="h-4 w-4" />
                )}
                {mediaState.microphoneEnabled ? "Tắt mic" : "Bật mic"}
              </button>

              <button
                type="button"
                onClick={() => {
                  void toggleCamera();
                }}
                disabled={!roomReady}
                className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  mediaState.cameraEnabled
                    ? "bg-white/10 text-white hover:bg-white/15"
                    : "bg-amber-500/20 text-amber-100 hover:bg-amber-500/30"
                }`}
              >
                {mediaState.cameraEnabled ? (
                  <Video className="h-4 w-4" />
                ) : (
                  <VideoOff className="h-4 w-4" />
                )}
                {mediaState.cameraEnabled ? "Tắt cam" : "Bật cam"}
              </button>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">
              <p className="font-semibold text-white/90">Bộ điều khiển</p>
              <p className="mt-2 leading-relaxed">
                Gọi này đang dùng LiveKit để truyền âm thanh và video theo thời gian thực.
                Khi tắt camera hoặc mic, track tương ứng sẽ được cập nhật ngay trên phòng.
              </p>
            </div>

            {(tokenError || roomError) && (
              <div className="rounded-2xl border border-rose-400/30 bg-rose-500/15 p-4 text-sm text-rose-100">
                <p className="font-semibold">Không thể kết nối media</p>
                <p className="mt-1 leading-relaxed">
                  {tokenError ?? roomError}
                </p>
                <button
                  type="button"
                  onClick={onRetryToken}
                  className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/15"
                >
                  <LoaderCircle className="h-3.5 w-3.5" />
                  Thử lại
                </button>
              </div>
            )}

            <div className="mt-auto rounded-2xl border border-white/10 bg-black/20 p-4 text-xs text-white/55">
              <p>
                Đang có {remoteParticipants.length} người tham gia, local video sẽ tự publish khi trình duyệt cho phép.
              </p>
            </div>
          </aside>
        </div>

        {connecting && !roomReady && (
          <div className="pointer-events-none fixed inset-x-0 bottom-4 flex justify-center px-4">
            <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/80 px-4 py-2 text-sm text-white shadow-2xl shadow-black/20">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Đang khởi tạo camera và micro...
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
