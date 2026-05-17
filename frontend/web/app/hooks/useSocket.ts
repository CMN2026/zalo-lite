"use client";

import { useEffect, useCallback, useState } from "react";
import io, { Socket } from "socket.io-client";
import { useAuth } from "../contexts/auth";
import { getAuthToken, clearAuthSession } from "../lib/auth";

// Use API Gateway for Socket.io connections (not direct service)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:3004";
const CHAT_SERVICE_BASE_URL = process.env.NEXT_PUBLIC_CHAT_SERVICE_URL ?? "http://127.0.0.1:3002";

// Module-level singletons to ensure only ONE socket exists across all components
let sharedSocket: Socket | null = null;
let subscribersCount = 0;
let globalConnectErrorCount = 0;
let globalDidFallbackToChatService = false;

export const useSocket = () => {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(sharedSocket?.connected ?? false);

  useEffect(() => {
    // Cannot connect without authenticated user
    if (!user) {
      return;
    }

    // Get auth token from localStorage (saved during login)
    const token = getAuthToken();
    if (!token) {
      console.error("No auth token found");
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
        console.log(`✅ Socket.io connected as ${user.fullName}`);
        globalConnectErrorCount = 0;
      });

      socket.on("disconnect", (reason, details) => {
        console.log("❌ Socket.io disconnected", { reason, details });

        // Socket.IO does not auto-reconnect on "io server disconnect".
        if (reason === "io server disconnect") {
          const latestToken = getAuthToken();
          if (latestToken && socket.auth) {
            socket.auth = { token: latestToken };
          }
          socket.connect();
        }
      });

      socket.on("connect_error", (error: Error) => {
        console.error("Socket.io connection error:", error);
        globalConnectErrorCount += 1;

        const isGatewayTimeout =
          !globalDidFallbackToChatService &&
          (error.message.toLowerCase().includes("timeout") ||
            globalConnectErrorCount >= 2);

        if (isGatewayTimeout) {
          globalDidFallbackToChatService = true;
          globalConnectErrorCount = 0;
          replaceSocket(CHAT_SERVICE_BASE_URL);
        }
      });

      socket.on("force_logout", (data: { message?: string }) => {
        const message = data?.message || "Tài khoản của bạn đã được đăng nhập ở thiết bị khác. Vui lòng đăng nhập lại.";
        
        // Disconnect immediately to stop reconnect loops
        socket.disconnect();
        
        // Clear session internally
        clearAuthSession();
        
        // Dispatch custom event to show modal instead of blocking alert
        window.dispatchEvent(new CustomEvent("force_logout", { detail: message }));
      });
    };

    // Only create the shared socket if it doesn't exist
    if (!sharedSocket) {
      sharedSocket = createSocket(API_BASE_URL);
      attachGlobalListeners(sharedSocket);
    }

    // Always update local state when sharedSocket changes
    setIsConnected(sharedSocket.connected);

    // Listen to connect/disconnect for local state updates
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    sharedSocket.on("connect", onConnect);
    sharedSocket.on("disconnect", onDisconnect);

    return () => {
      if (sharedSocket) {
        sharedSocket.off("connect", onConnect);
        sharedSocket.off("disconnect", onDisconnect);
      }

      subscribersCount--;
      
      // Cleanup the socket if no components are using it anymore
      if (subscribersCount <= 0) {
        if (sharedSocket) {
          sharedSocket.removeAllListeners();
          sharedSocket.disconnect();
          sharedSocket = null;
        }
        subscribersCount = 0;
        globalConnectErrorCount = 0;
      }
    };
  }, [user]);

  const emit = useCallback(
    (event: string, data: unknown) => {
      if (sharedSocket && isConnected) {
        sharedSocket.emit(event, data);
      } else {
        console.warn(`Cannot emit "${event}" - socket not connected`);
      }
    },
    [isConnected],
  );

  const on = useCallback((event: string, callback: (data: any) => void) => {
    if (sharedSocket) {
      sharedSocket.on(event, callback);
    }
  }, []);

  const off = useCallback(
    (event: string, callback?: (data: any) => void) => {
      if (sharedSocket) {
        if (callback) {
          sharedSocket.off(event, callback);
        } else {
          sharedSocket.off(event);
        }
      }
    },
    [],
  );

  const join = useCallback((conversationId: string) => {
    if (sharedSocket) {
      sharedSocket.emit("join_conversation", {
        conversation_id: conversationId,
      });
    }
  }, []);

  const leave = useCallback((conversationId: string) => {
    if (sharedSocket) {
      sharedSocket.emit("leave_conversation", {
        conversation_id: conversationId,
      });
    }
  }, []);

  return {
    isConnected,
    emit,
    on,
    off,
    join,
    leave,
  };
};
