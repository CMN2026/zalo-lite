import { useEffect, useRef, useCallback, useState } from "react";
import io, { Socket } from "socket.io-client";
import { useAuth } from "../contexts/auth";
import { getAuthToken } from "../lib/auth";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://10.0.2.2:3004";
const CHAT_SERVICE_BASE_URL = process.env.EXPO_PUBLIC_CHAT_SERVICE_URL ?? "http://10.0.2.2:3002";

export const useSocket = () => {
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      return;
    }

    let isMounted = true;
    let connectErrorCount = 0;
    let didFallbackToChatService = false;

    const initSocket = async () => {
      const token = await getAuthToken();
      if (!token || !isMounted) {
        return;
      }

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
        if (socketRef.current) {
          socketRef.current.removeAllListeners();
          socketRef.current.disconnect();
        }
        socketRef.current = createSocket(baseUrl);
        attachListeners(socketRef.current);
      };

      const attachListeners = (socket: Socket) => {
        socket.on("connect", () => {
          console.log(`✅ Socket connected as ${user.fullName}`);
          connectErrorCount = 0;
          setIsConnected(true);
        });

        socket.on("disconnect", async (reason) => {
          setIsConnected(false);
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
          connectErrorCount += 1;
          const isGatewayTimeout =
            !didFallbackToChatService &&
            (error.message.toLowerCase().includes("timeout") || connectErrorCount >= 2);

          if (isGatewayTimeout) {
            didFallbackToChatService = true;
            connectErrorCount = 0;
            replaceSocket(CHAT_SERVICE_BASE_URL);
          }
        });
      };

      socketRef.current = createSocket(API_BASE_URL);
      attachListeners(socketRef.current);
    };

    initSocket();

    return () => {
      isMounted = false;
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
      }
    };
  }, [user]);

  const emit = useCallback((event: string, data: unknown) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit(event, data);
    }
  }, [isConnected]);

  const on = useCallback((event: string, callback: (data: any) => void) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback);
    }
  }, []);

  const off = useCallback((event: string, callback?: (data: any) => void) => {
    if (socketRef.current) {
      if (callback) {
        socketRef.current.off(event, callback);
      } else {
        socketRef.current.off(event);
      }
    }
  }, []);

  const join = useCallback((conversationId: string) => {
    if (socketRef.current) {
      socketRef.current.emit("join_conversation", { conversation_id: conversationId });
    }
  }, []);

  const leave = useCallback((conversationId: string) => {
    if (socketRef.current) {
      socketRef.current.emit("leave_conversation", { conversation_id: conversationId });
    }
  }, []);

  return { isConnected, emit, on, off, join, leave };
};
