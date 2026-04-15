"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import io, { Socket } from "socket.io-client";
import { useAuth } from "../contexts/auth";
import { getAuthToken } from "../lib/auth";

// Use API Gateway for Socket.io connections (not direct service)
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:3004";
const CHAT_SERVICE_BASE_URL =
  process.env.NEXT_PUBLIC_CHAT_SERVICE_URL ?? "http://127.0.0.1:3002";

export const useSocket = () => {
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

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

    let connectErrorCount = 0;
    let didFallbackToChatService = false;

    const createSocket = (baseUrl: string) =>
      io(baseUrl, {
        path: "/socket.io/",
        auth: {
          token,
        },
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
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
      }

      socketRef.current = createSocket(baseUrl);
      attachListeners(socketRef.current);
    };

    const attachListeners = (socket: Socket) => {
      socket.on("connect", () => {
        console.log(`✅ Socket.io connected as ${user.fullName}`);
        connectErrorCount = 0;
        setIsConnected(true);
      });

      socket.on("disconnect", (reason, details) => {
        console.log("❌ Socket.io disconnected", { reason, details });
        setIsConnected(false);

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
        connectErrorCount += 1;

        const isGatewayTimeout =
          !didFallbackToChatService &&
          (error.message.toLowerCase().includes("timeout") ||
            connectErrorCount >= 2);

        if (isGatewayTimeout) {
          didFallbackToChatService = true;
          connectErrorCount = 0;
          replaceSocket(CHAT_SERVICE_BASE_URL);
        }
      });
    };

    socketRef.current = createSocket(API_BASE_URL);
    attachListeners(socketRef.current);

    return () => {
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
      }
    };
  }, [user]);

  const emit = useCallback(
    (event: string, data: unknown) => {
      if (socketRef.current && isConnected) {
        socketRef.current.emit(event, data);
      } else {
        console.warn(`Cannot emit "${event}" - socket not connected`);
      }
    },
    [isConnected],
  );

  const on = useCallback((event: string, callback: (data: unknown) => void) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback);
    }
  }, []);

  const off = useCallback(
    (event: string, callback?: (data: unknown) => void) => {
      if (socketRef.current) {
        if (callback) {
          socketRef.current.off(event, callback);
        } else {
          socketRef.current.off(event);
        }
      }
    },
    [],
  );

  const join = useCallback((conversationId: string) => {
    if (socketRef.current) {
      socketRef.current.emit("join_conversation", {
        conversation_id: conversationId,
      });
    }
  }, []);

  const leave = useCallback((conversationId: string) => {
    if (socketRef.current) {
      socketRef.current.emit("leave_conversation", {
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
