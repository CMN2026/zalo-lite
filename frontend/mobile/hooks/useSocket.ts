import { useEffect, useCallback, useState } from "react";
import io, { Socket } from "socket.io-client";
import { useAuth } from "../contexts/auth";
import { getAuthToken, authStorage } from "../lib/auth";
import { DeviceEventEmitter } from "react-native";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://10.0.2.2:3004";
const CHAT_SERVICE_BASE_URL = process.env.EXPO_PUBLIC_CHAT_SERVICE_URL ?? "http://10.0.2.2:3002";

// Module-level singletons to ensure only ONE socket exists across all components
let sharedSocket: Socket | null = null;
let subscribersCount = 0;
let globalConnectErrorCount = 0;
let globalDidFallbackToChatService = false;

export const useSocket = () => {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(sharedSocket?.connected ?? false);

  useEffect(() => {
    if (!user) {
      return;
    }

    let isMounted = true;
    
    const initSocket = async () => {
      const token = await getAuthToken();
      if (!token || !isMounted) {
        return;
      }

      subscribersCount++;

      const createSocket = (baseUrl: string) =>
        io(baseUrl, {
          path: "/socket.io/",
          auth: { token },
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: Infinity,
          transports: ["polling", "websocket"],
          upgrade: true,
          rememberUpgrade: false,
          timeout: 6000,
        });

      const replaceSocket = (baseUrl: string) => {
        if (sharedSocket) {
          sharedSocket.removeAllListeners();
          sharedSocket.disconnect();
        }
        sharedSocket = createSocket(baseUrl);
        attachGlobalListeners(sharedSocket);
      };

      const attachGlobalListeners = (socket: Socket) => {
        socket.on("connect", () => {
          console.log(`✅ Socket connected as ${user.fullName}`);
          globalConnectErrorCount = 0;
        });

        socket.on("disconnect", async (reason) => {
          if (reason === "io server disconnect") {
            const latestToken = await getAuthToken();
            if (latestToken && socket.auth) {
              socket.auth = { token: latestToken };
            }
            socket.connect();
          }
        });

        socket.on("connect_error", (error: Error) => {
          console.error("Socket.io error:", error);

          const errMsg = error.message.toLowerCase();
          if (errMsg.includes("unauthorized") || errMsg.includes("invalid_token") || errMsg.includes("invalid signature")) {
            socket.disconnect();
            authStorage.removeToken().then(() => {
              DeviceEventEmitter.emit("force_logout", "Phiên đăng nhập hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.");
            });
            return;
          }

          globalConnectErrorCount += 1;
          const isGatewayTimeout =
            !globalDidFallbackToChatService &&
            (error.message.toLowerCase().includes("timeout") || globalConnectErrorCount >= 2);

          if (isGatewayTimeout) {
            globalDidFallbackToChatService = true;
            globalConnectErrorCount = 0;
            replaceSocket(CHAT_SERVICE_BASE_URL);
          }
        });

        socket.on("force_logout", async (data: { message?: string }) => {
          const message = data?.message || "Tài khoản của bạn đã được đăng nhập ở thiết bị khác. Vui lòng đăng nhập lại.";
          socket.disconnect();
          await authStorage.removeToken();
          DeviceEventEmitter.emit("force_logout", message);
        });
      };

      if (!sharedSocket) {
        sharedSocket = createSocket(API_BASE_URL);
        attachGlobalListeners(sharedSocket);
      }

      // Sync local state with sharedSocket
      if (isMounted) {
        setIsConnected(sharedSocket.connected);
      }

      const onConnect = () => isMounted && setIsConnected(true);
      const onDisconnect = () => isMounted && setIsConnected(false);

      sharedSocket.on("connect", onConnect);
      sharedSocket.on("disconnect", onDisconnect);

      // Cleanup specific to this instance
      return () => {
        if (sharedSocket) {
          sharedSocket.off("connect", onConnect);
          sharedSocket.off("disconnect", onDisconnect);
        }
      };
    };

    let cleanupListeners: (() => void) | undefined;
    
    initSocket().then((cleanupFn) => {
      cleanupListeners = cleanupFn as unknown as () => void;
    });

    return () => {
      isMounted = false;
      if (cleanupListeners) {
        cleanupListeners();
      }
      
      // We only decrement subscribers if we actually incremented them.
      // Since initSocket is async, it's possible this unmounts before initSocket finishes.
      // To keep it simple, we just assume if it was mounted, it will eventually decrement.
      // Actually, a safer way is just to check subscribersCount directly:
      setTimeout(() => {
         subscribersCount = Math.max(0, subscribersCount - 1);
         if (subscribersCount === 0 && sharedSocket) {
           sharedSocket.removeAllListeners();
           sharedSocket.disconnect();
           sharedSocket = null;
           globalConnectErrorCount = 0;
         }
      }, 0);
    };
  }, [user]);

  const emit = useCallback((event: string, data: unknown) => {
    if (sharedSocket && isConnected) {
      sharedSocket.emit(event, data);
    }
  }, [isConnected]);

  const on = useCallback((event: string, callback: (data: any) => void) => {
    if (sharedSocket) {
      sharedSocket.on(event, callback);
    }
  }, []);

  const off = useCallback((event: string, callback?: (data: any) => void) => {
    if (sharedSocket) {
      if (callback) {
        sharedSocket.off(event, callback);
      } else {
        sharedSocket.off(event);
      }
    }
  }, []);

  const join = useCallback((conversationId: string) => {
    if (sharedSocket) {
      sharedSocket.emit("join_conversation", { conversation_id: conversationId });
    }
  }, []);

  const leave = useCallback((conversationId: string) => {
    if (sharedSocket) {
      sharedSocket.emit("leave_conversation", { conversation_id: conversationId });
    }
  }, []);

  return { isConnected, emit, on, off, join, leave };
};
