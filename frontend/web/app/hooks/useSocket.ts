"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import io, { Socket } from "socket.io-client";
import { useAuth } from "../contexts/auth";
import { getAuthToken } from "../lib/auth";

const rawChatServiceUrl = process.env.NEXT_PUBLIC_CHAT_SERVICE_URL;
const CHAT_SERVICE_URL =
  rawChatServiceUrl && /^https?:\/\//i.test(rawChatServiceUrl)
    ? rawChatServiceUrl
    : "http://localhost:3002";

export const useSocket = () => {
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Nếu user chưa đăng nhập, không kết nối
    if (!user) {
      return;
    }

    // Lấy auth token từ localStorage (được lưu khi login)
    const token = getAuthToken();
    if (!token) {
      console.error("No auth token found");
      return;
    }

    // Kết nối tới Chat Service (port 3002) với authentication
    socketRef.current = io(CHAT_SERVICE_URL, {
      auth: {
        token: token,
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      transports: ["polling", "websocket"],
      upgrade: true,
      rememberUpgrade: false,
    });

    const socket = socketRef.current;

    socket.on("connect", () => {
      console.log(`✅ Socket.io connected as ${user.fullName}`);
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
    });

    return () => {
      socket.disconnect();
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
