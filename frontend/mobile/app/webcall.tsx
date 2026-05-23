import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, LogBox, PermissionsAndroid, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSocket } from '../hooks/useSocket';
import { endCall, getActiveCallForConversation, getLiveKitToken, leaveCall, startCall } from '../lib/calls';

type CallParams = {
  conversationId?: string | string[];
  conversationName?: string | string[];
  callType?: string | string[];
  callId?: string | string[];
  incoming?: string | string[];
};

type LiveKitConnection = {
  callId: string;
  conversationId: string;
  roomName: string;
  serverUrl: string;
  token: string;
  conversationName: string;
};

type LiveKitModule = {
  AudioSession: {
    startAudioSession: () => Promise<void>;
    stopAudioSession: () => Promise<void>;
  };
  LiveKitRoom: React.ComponentType<{
    serverUrl: string;
    token: string;
    connect: boolean;
    audio: boolean;
    video: boolean;
    onDisconnected?: () => void;
    onError?: (error: Error) => void;
    children: React.ReactNode;
  }>;
  VideoTrack: React.ComponentType<{
    trackRef: any;
    style: any;
    objectFit?: string;
    mirror?: boolean;
  }>;
  useTracks: (sources: unknown[]) => any[];
};

let liveKit: LiveKitModule | null = null;
try {
  liveKit = require('@livekit/react-native') as LiveKitModule;
} catch {
  liveKit = null;
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const LIVEKIT_URL_OVERRIDE = process.env.EXPO_PUBLIC_LIVEKIT_URL?.trim();

function resolveMobileLiveKitUrl(rawUrl: string): string {
  if (LIVEKIT_URL_OVERRIDE) {
    return LIVEKIT_URL_OVERRIDE;
  }

  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();
    const isAndroid = Platform.OS === 'android';

    // Android emulator cannot reach host machine via localhost/127.0.0.1.
    if (isAndroid && (host === 'localhost' || host === '127.0.0.1' || host === 'livekit')) {
      parsed.hostname = '10.0.2.2';
    }

    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

async function ensureMediaPermissions(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  const result = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.CAMERA,
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
  ]);

  const cameraGranted = result[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED;
  const micGranted = result[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED;
  if (!cameraGranted || !micGranted) {
    throw new Error('media_permission_denied');
  }
}

function CallStage() {
  if (!liveKit) {
    return (
      <View style={styles.emptyStage}>
        <Ionicons name="warning-outline" size={42} color="#F97316" />
        <Text style={styles.emptyTitle}>Thiếu WebRTC native module</Text>
        <Text style={styles.emptyText}>
          Hãy chạy bằng dev build (`expo run:android`) thay vì Expo Go để dùng gọi video.
        </Text>
      </View>
    );
  }

  const tracks = liveKit.useTracks([{ source: 'camera' }]);
  const VideoTrack = liveKit.VideoTrack;

  if (!tracks.length) {
    return (
      <View style={styles.emptyStage}>
        <Ionicons name="videocam" size={42} color="#9FB3C8" />
        <Text style={styles.emptyTitle}>Đang chờ kết nối</Text>
        <Text style={styles.emptyText}>
          Camera và microphone sẽ được bật khi vào phòng gọi.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.grid}>
      {tracks.map((trackRef, index) => (
        <View
          key={trackRef.publication.trackSid}
          style={[styles.tile, tracks.length === 1 && styles.singleTile]}
        >
          <VideoTrack
            trackRef={trackRef}
            style={styles.videoTrack}
            objectFit="cover"
            mirror={index === 0}
          />
        </View>
      ))}
    </View>
  );
}

export default function WebCallScreen() {
  const params = useLocalSearchParams<CallParams>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const connectionRef = useRef<LiveKitConnection | null>(null);
  const endedRef = useRef(false);
  const [connection, setConnection] = useState<LiveKitConnection | null>(null);
  const [shouldConnectRoom, setShouldConnectRoom] = useState(true);
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState('');
  const { emit, on, off } = useSocket();

  useEffect(() => {
    LogBox.ignoreLogs([
      'NegotiationError: PC manager is closed',
      'Uncaught (in promise, id:',
    ]);
  }, []);

  useEffect(() => {
    const globalScope = globalThis as {
      onunhandledrejection?: ((event: { reason?: unknown; preventDefault?: () => void }) => void) | null;
    };
    const previousHandler = globalScope.onunhandledrejection ?? null;

    globalScope.onunhandledrejection = (event) => {
      const reasonText =
        typeof event?.reason === 'string'
          ? event.reason
          : event?.reason instanceof Error
            ? event.reason.message
            : String(event?.reason ?? '');
      const normalized = reasonText.toLowerCase();
      const isLiveKitCloseRace =
        normalized.includes('pc manager is closed') ||
        normalized.includes('negotiationerror');

      if (isLiveKitCloseRace) {
        event?.preventDefault?.();
        return;
      }

      previousHandler?.(event);
    };

    return () => {
      globalScope.onunhandledrejection = previousHandler;
    };
  }, []);

  const conversationId = useMemo(() => firstValue(params.conversationId), [params.conversationId]);
  const conversationName = useMemo(
    () => firstValue(params.conversationName) ?? 'Cuộc gọi',
    [params.conversationName],
  );
  const callType = useMemo(() => {
    return firstValue(params.callType) === 'group' ? 'group' : 'direct';
  }, [params.callType]);
  const initialCallId = useMemo(() => firstValue(params.callId), [params.callId]);
  const incoming = useMemo(() => firstValue(params.incoming) === '1', [params.incoming]);

  useEffect(() => {
    connectionRef.current = connection;
  }, [connection]);

  const terminateCall = useCallback(async (reason: string, notifyServer = true) => {
    if (endedRef.current) {
      return;
    }

    endedRef.current = true;
    setShouldConnectRoom(false);
    const current = connectionRef.current;

    try {
      if (current && notifyServer) {
        if (callType === 'group') {
          emit('call:leave', {
            call_id: current.callId,
            conversation_id: current.conversationId,
            reason,
          });
          await leaveCall({
            call_id: current.callId,
            conversation_id: current.conversationId,
          });
        } else {
          emit('call:end', {
            call_id: current.callId,
            conversation_id: current.conversationId,
            reason,
          });
          await endCall({
            call_id: current.callId,
            conversation_id: current.conversationId,
            reason,
          });
        }
      }
    } catch {
      // End-call cleanup is best-effort; the room should still close locally.
    }

    try {
      if (liveKit) {
        await liveKit.AudioSession.stopAudioSession();
      }
    } catch {
      // Ignore audio-session shutdown failures during cleanup.
    }
  }, [callType, emit]);

  useEffect(() => {
    let cancelled = false;

    const bootstrapCall = async () => {
      if (!conversationId) {
        setError('Thiếu conversationId để bắt đầu cuộc gọi.');
        setLoading(false);
        return;
      }

      try {
        if (!liveKit) {
          throw new Error('webrtc_native_module_missing');
        }

        await ensureMediaPermissions();
        await liveKit.AudioSession.startAudioSession();

        let callId = initialCallId;

        // For outgoing calls, always persist/start the call session here as source of truth.
        // This removes race conditions where socket signaling arrives before call session exists.
        if (!incoming) {
          try {
            const startedCall = await startCall({
              conversation_id: conversationId,
              call_type: callType,
              call_id: callId,
            });
            callId = startedCall.data.id;
          } catch (startError) {
            const startMessage =
              startError instanceof Error ? startError.message : String(startError);
            if (startMessage.includes('call_already_active')) {
              const active = await getActiveCallForConversation(conversationId);
              const activeCallId = active.data?.id;
              if (!activeCallId) {
                throw startError;
              }
              callId = activeCallId;
            } else {
              throw startError;
            }
          }
        }

        if (!callId) {
          throw new Error('missing_call_id');
        }

        let livekitToken: Awaited<ReturnType<typeof getLiveKitToken>> | null = null;
        let lastError: unknown = null;
        for (let attempt = 0; attempt < 4; attempt += 1) {
          try {
            livekitToken = await getLiveKitToken({
              call_id: callId,
              conversation_id: conversationId,
            });
            break;
          } catch (tokenError) {
            lastError = tokenError;
            await new Promise((resolve) => {
              setTimeout(resolve, 350);
            });
          }
        }

        if (!livekitToken) {
          throw lastError ?? new Error('livekit_token_failed');
        }

        if (cancelled) {
          return;
        }

        setConnection({
          callId,
          conversationId,
          roomName: livekitToken.data.room_name,
          serverUrl: resolveMobileLiveKitUrl(livekitToken.data.ws_url),
          token: livekitToken.data.token,
          conversationName,
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        const rawMessage = error instanceof Error ? error.message : String(error);
        console.error('[webcall] bootstrapCall failed', {
          message: rawMessage,
          callType,
          conversationId,
          initialCallId,
          incoming,
        });

        if (rawMessage.includes('media_permission_denied')) {
          setError('Bạn cần cấp quyền Camera và Micro để thực hiện cuộc gọi.');
        } else if (rawMessage.includes('webrtc_native_module_missing')) {
          setError('Thiếu WebRTC native module trên build hiện tại.');
        } else if (rawMessage.includes('call_not_found') || rawMessage.includes('call_not_active')) {
          setError('Cuộc gọi chưa sẵn sàng. Vui lòng thử gọi lại.');
        } else if (rawMessage.includes('livekit_not_configured')) {
          setError('LiveKit chưa được cấu hình trên server.');
        } else {
          setError(`Không thể khởi tạo cuộc gọi: ${rawMessage}`);
        }

        try {
          if (liveKit) {
            await liveKit.AudioSession.stopAudioSession();
          }
        } catch {
          // Ignore best-effort cleanup errors.
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void bootstrapCall();

    return () => {
      cancelled = true;
      void terminateCall('screen_closed');
    };
  }, [callType, conversationId, conversationName, emit, incoming, initialCallId, terminateCall]);

  useEffect(() => {
    const handleCallEnd = (payload: unknown) => {
      const data = payload as { call_id?: string };
      if (!connectionRef.current?.callId || data.call_id !== connectionRef.current.callId) {
        return;
      }

      void (async () => {
        await terminateCall('remote_hangup', false);
        await new Promise((resolve) => setTimeout(resolve, 180));
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/');
        }
      })();
    };

    on('call:end', handleCallEnd);
    return () => {
      off('call:end', handleCallEnd);
    };
  }, [off, on, router, terminateCall]);

  const handleHangup = useCallback(async () => {
    setEnding(true);
    await terminateCall('user_hangup');
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }, [router, terminateCall]);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.loadingText}>Đang mở phòng gọi...</Text>
      </View>
    );
  }

  if (error || !connection) {
    return (
      <SafeAreaView style={[styles.errorScreen, { paddingTop: insets.top + 12 }]}> 
        <Stack.Screen options={{ headerShown: false }} />
        <Ionicons name="alert-circle-outline" size={42} color="#F97316" />
        <Text style={styles.errorTitle}>Không thể vào cuộc gọi</Text>
        <Text style={styles.errorText}>{error || 'Đã xảy ra lỗi không xác định.'}</Text>
        <Pressable style={styles.errorButton} onPress={() => router.back()}>
          <Text style={styles.errorButtonText}>Quay lại</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (!liveKit) {
    return (
      <SafeAreaView style={[styles.errorScreen, { paddingTop: insets.top + 12 }]}> 
        <Stack.Screen options={{ headerShown: false }} />
        <Ionicons name="warning-outline" size={42} color="#F97316" />
        <Text style={styles.errorTitle}>Thiếu WebRTC native module</Text>
        <Text style={styles.errorText}>Hãy chạy dev build Android (`expo run:android`) để dùng gọi video.</Text>
        <Pressable style={styles.errorButton} onPress={() => router.back()}>
          <Text style={styles.errorButtonText}>Quay lại</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const LiveKitRoom = liveKit.LiveKitRoom;

  return (
    <LiveKitRoom
      serverUrl={connection.serverUrl}
      token={connection.token}
      connect={shouldConnectRoom}
      audio
      video
      onDisconnected={() => {
        if (endedRef.current) {
          return;
        }
      }}
      onError={(error) => {
        const message = (error?.message ?? "").toLowerCase();
        const isTeardownRace =
          endedRef.current &&
          (message.includes("pc manager is closed") ||
            message.includes("negotiationerror") ||
            message.includes("negotiation"));

        if (isTeardownRace) {
          return;
        }

        console.error("[webcall] LiveKitRoom error", error);
      }}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.screen}>
        <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}> 
          <View>
            <Text style={styles.roomTitle}>{connection.conversationName}</Text>
            <Text style={styles.roomSubtitle}>{connection.roomName}</Text>
          </View>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>

        <View style={styles.stageWrap}>
          <CallStage />
        </View>

        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}> 
          <Pressable
            style={[styles.hangupButton, ending && styles.hangupButtonDisabled]}
            onPress={() => {
              void handleHangup();
            }}
            disabled={ending}
          >
            <Ionicons name="call" size={22} color="#FFFFFF" />
            <Text style={styles.hangupText}>{ending ? 'Đang rời...' : 'Kết thúc'}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </LiveKitRoom>
  );
}

const styles = StyleSheet.create({
  loadingWrap: {
    flex: 1,
    backgroundColor: '#08111F',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  loadingText: {
    color: '#D7E3F1',
    fontSize: 15,
    fontWeight: '500',
  },
  screen: {
    flex: 1,
    backgroundColor: '#08111F',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  roomTitle: {
    color: '#F8FBFF',
    fontSize: 18,
    fontWeight: '700',
  },
  roomSubtitle: {
    marginTop: 4,
    color: '#8DA0B5',
    fontSize: 12,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#22C55E',
  },
  liveText: {
    color: '#D7E3F1',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  stageWrap: {
    flex: 1,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  emptyStage: {
    flex: 1,
    borderRadius: 28,
    backgroundColor: '#0F1C2E',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 10,
  },
  emptyTitle: {
    color: '#F8FBFF',
    fontSize: 18,
    fontWeight: '700',
  },
  emptyText: {
    color: '#98A9BA',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  grid: {
    flex: 1,
    gap: 12,
  },
  tile: {
    flex: 1,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#0F1C2E',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    minHeight: 220,
  },
  singleTile: {
    minHeight: 360,
  },
  videoTrack: {
    flex: 1,
  },
  bottomBar: {
    paddingHorizontal: 18,
    paddingTop: 6,
    alignItems: 'center',
  },
  hangupButton: {
    minWidth: 160,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#EF4444',
    borderRadius: 999,
    paddingVertical: 15,
    paddingHorizontal: 22,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  hangupButtonDisabled: {
    opacity: 0.75,
  },
  hangupText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  errorScreen: {
    flex: 1,
    backgroundColor: '#08111F',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  errorTitle: {
    color: '#F8FBFF',
    fontSize: 20,
    fontWeight: '700',
  },
  errorText: {
    color: '#A8B8C8',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorButton: {
    marginTop: 8,
    backgroundColor: '#14243A',
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  errorButtonText: {
    color: '#F8FBFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
