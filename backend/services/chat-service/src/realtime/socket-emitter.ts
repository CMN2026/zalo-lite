import type { Server } from "socket.io";

let ioServer: Server | null = null;

export function setRealtimeServer(io: Server) {
  ioServer = io;
}

export function emitToUsers(
  userIds: string[],
  event: string,
  payload: Record<string, unknown>,
) {
  if (!ioServer) {
    return;
  }

  const uniqueUserIds = Array.from(
    new Set(
      userIds
        .map((id) => (typeof id === "string" ? id.trim() : ""))
        .filter(Boolean),
    ),
  );

  uniqueUserIds.forEach((userId) => {
    ioServer?.to(`user_${userId}`).emit(event, payload);
  });
}
