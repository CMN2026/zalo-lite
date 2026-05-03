import "dotenv/config";
import http from "node:http";
import { randomUUID } from "node:crypto";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { Server } from "socket.io";
import { env } from "./config/env.js";
import { ensureTables } from "./config/dynamodb.js";
import { connectRedis, redisPublisher, redisSubscriber } from "./config/redis.js";
import { authMiddleware } from "./middlewares/auth.middleware.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import { setupFileServer } from "./middlewares/upload.middleware.js";
import { friendRoutes } from "./routes/friend.routes.js";
import { conversationRoutes } from "./routes/conversation.routes.js";
import { messageRoutes } from "./routes/message.routes.js";
import { callRoutes } from "./routes/call.routes.js";
import { verifyToken } from "./utils/jwt.js";
import { MessageService } from "./services/message.service.js";
import { CallService } from "./services/call.service.js";
import { ConversationRepository } from "./repositories/conversation.repository.js";
import { initUserClientService } from "./services/user-client.service.js";
import { setRealtimeServer } from "./realtime/socket-emitter.js";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: env.CORS_ORIGINS.length > 0 ? env.CORS_ORIGINS : "*",
    credentials: true,
  },
});
setRealtimeServer(io);

const messageService = new MessageService();
const callService = new CallService();
const conversationRepository = new ConversationRepository();
const callSignalingInstanceId = randomUUID();

type CallSignalEventName =
  | "call:initiate"
  | "call:accept"
  | "call:decline"
  | "call:offer"
  | "call:answer"
  | "call:ice_candidate"
  | "call:participant_update"
  | "call:end"
  | "call:missed";

type CallSignalTarget = {
  conversation_id?: string;
  user_ids?: string[];
};

type CallSignalEnvelope = {
  source_instance_id: string;
  event_name: CallSignalEventName;
  target: CallSignalTarget;
  payload: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function getConversationId(payload: unknown): string | undefined {
  if (!isRecord(payload)) {
    return undefined;
  }
  return asString(payload.conversation_id);
}

function getCallId(payload: unknown): string | undefined {
  if (!isRecord(payload)) {
    return undefined;
  }
  return asString(payload.call_id);
}

async function ensureConversationMember(
  conversationId: string,
  userId: string,
): Promise<boolean> {
  const members = await conversationRepository.getConversationMembers(
    conversationId,
  );
  return members.some((member) => member.userId === userId);
}

function emitCallSignal(
  eventName: CallSignalEventName,
  target: CallSignalTarget,
  payload: Record<string, unknown>,
): void {
  if (target.conversation_id) {
    io.to(`conversation_${target.conversation_id}`).emit(eventName, payload);
  }

  target.user_ids?.forEach((userId) => {
    io.to(`user_${userId}`).emit(eventName, payload);
  });
}

async function publishCallSignal(
  eventName: CallSignalEventName,
  target: CallSignalTarget,
  payload: Record<string, unknown>,
): Promise<void> {
  const envelope: CallSignalEnvelope = {
    source_instance_id: callSignalingInstanceId,
    event_name: eventName,
    target,
    payload,
  };

  await redisPublisher.publish(
    env.REDIS_CALL_SIGNAL_CHANNEL,
    JSON.stringify(envelope),
  );
}

app.disable("x-powered-by");
app.use(
  cors({
    origin: env.CORS_ORIGINS,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
app.use(
  rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);
app.use(express.json({ limit: "1mb" }));

// Health check
app.get("/health", (_req, res) => {
  res.status(200).json({ service: "chat-service", status: "ok" });
});

// Setup file server before auth middleware
setupFileServer(app);

app.use(authMiddleware);
app.use("/friends", friendRoutes);
app.use("/conversations", conversationRoutes);
app.use("/messages", messageRoutes);
app.use("/calls", callRoutes);
app.use(errorHandler);

// Initialize user client service
initUserClientService(env.USER_SERVICE_BASE_URL);

io.use((socket, next) => {
  const headerToken = socket.handshake.headers.authorization;
  const authToken = socket.handshake.auth.token;
  const bearer =
    typeof headerToken === "string" && headerToken.startsWith("Bearer ")
      ? headerToken.slice(7)
      : undefined;
  const token = bearer ?? authToken;

  if (!token || typeof token !== "string") {
    return next(new Error("unauthorized"));
  }

  try {
    socket.data.auth = verifyToken(token);
    return next();
  } catch {
    return next(new Error("unauthorized"));
  }
});

io.on("connection", async (socket) => {
  const authData = socket.data.auth as
    | { user_id?: string; userId?: string }
    | undefined;
  let userId = authData?.user_id ?? authData?.userId;
  if (!userId) {
    console.error("❌ Connection failed: No user_id in auth data");
    socket.disconnect();
    return;
  }

  try {
    socket.join(`user_${userId}`);

    // Emit online event
    socket.broadcast.emit("user:online", { user_id: userId, online: true });

    try {
      const conversations = await conversationRepository.listByUserId(userId);
      conversations.forEach((conversation) => {
        socket.join(`conversation_${conversation.id}`);
      });
    } catch (error) {
      console.error(`⚠️ Failed to load conversations for ${userId}:`, error);
      // Don't disconnect - user can still send messages
    }
  } catch (error) {
    console.error("❌ Connection error:", error);
    socket.disconnect();
  }

  // SEND MESSAGE EVENT
  socket.on("message:send", async (payload) => {
    try {
      const message = await messageService.sendMessage({
        conversation_id: payload.conversation_id,
        sender_id: userId,
        type: payload.type ?? "text",
        content: payload.content,
        reply_to_message_id:
          typeof payload.reply_to_message_id === "string"
            ? payload.reply_to_message_id
            : undefined,
      });

      const members = await conversationRepository.getConversationMembers(
        payload.conversation_id,
      );
      const receiverIds = members
        .map((member) => member.userId)
        .filter((memberId) => memberId !== userId);

      socket.emit("message:send_ack", {
        ok: true,
        message_id: message.id,
        conversation_id: payload.conversation_id,
        client_temp_id:
          typeof payload.client_temp_id === "string"
            ? payload.client_temp_id
            : undefined,
      });

      // Emit notification to other users in conversation
      socket
        .to(`conversation_${payload.conversation_id}`)
        .emit("notification:new_message", {
          conversation_id: payload.conversation_id,
          sender_id: userId,
          message_id: message.id,
          type: message.type,
        });

      receiverIds.forEach((receiverId) => {
        io.to(`user_${receiverId}`).emit("notification:new_message", {
          conversation_id: payload.conversation_id,
          sender_id: userId,
          message_id: message.id,
          type: message.type,
        });
      });

      if (message.reply_to_message_id) {
        const repliedMessage = await messageService.getMessageById(
          message.reply_to_message_id,
        );

        if (
          repliedMessage &&
          repliedMessage.sender_id &&
          repliedMessage.sender_id !== userId
        ) {
          io.to(`user_${repliedMessage.sender_id}`).emit("notification:reply", {
            conversation_id: payload.conversation_id,
            message_id: message.id,
            reply_to_message_id: message.reply_to_message_id,
            sender_id: userId,
          });
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "message_send_failed";

      socket.emit("message:send_ack", {
        ok: false,
        error: errorMessage,
        conversation_id:
          typeof payload?.conversation_id === "string"
            ? payload.conversation_id
            : undefined,
      });
    }
  });

  socket.on("join_conversation", async (payload) => {
    const conversationId =
      payload && typeof payload.conversation_id === "string"
        ? payload.conversation_id.trim()
        : "";

    if (!conversationId) {
      socket.emit("join_conversation_error", {
        message: "invalid_conversation_id",
      });
      return;
    }

    try {
      const members =
        await conversationRepository.getConversationMembers(conversationId);
      const canJoin = members.some((member) => member.userId === userId);

      if (!canJoin) {
        socket.emit("join_conversation_error", {
          conversation_id: conversationId,
          message: "not_a_member",
        });
        return;
      }

      socket.join(`conversation_${conversationId}`);
      socket.emit("join_conversation_ack", {
        conversation_id: conversationId,
        ok: true,
      });
    } catch (error) {
      socket.emit("join_conversation_error", {
        conversation_id: conversationId,
        message: error instanceof Error ? error.message : "join_failed",
      });
    }
  });

  socket.on("leave_conversation", (payload) => {
    const conversationId =
      payload && typeof payload.conversation_id === "string"
        ? payload.conversation_id.trim()
        : "";

    if (!conversationId) {
      socket.emit("leave_conversation_error", {
        message: "invalid_conversation_id",
      });
      return;
    }

    socket.leave(`conversation_${conversationId}`);
    socket.emit("leave_conversation_ack", {
      conversation_id: conversationId,
      ok: true,
    });
  });

  // TYPING EVENT
  socket.on("message:typing", (payload) => {
    const conversationId =
      payload && typeof payload.conversation_id === "string"
        ? payload.conversation_id.trim()
        : "";
    if (!conversationId) {
      return;
    }

    const isTyping = payload?.is_typing !== false;

    socket.to(`conversation_${conversationId}`).emit("message:typing", {
      conversation_id: conversationId,
      user_id: userId,
      is_typing: isTyping,
      timestamp: Date.now(),
    });
  });

  // READ RECEIPT EVENT
  socket.on("message:read", async (payload) => {
    try {
      await messageService.markMessagesAsRead(payload.conversation_id, userId);

      socket
        .to(`conversation_${payload.conversation_id}`)
        .emit("message:read_receipt", {
          conversation_id: payload.conversation_id,
          user_id: userId,
          timestamp: Date.now(),
        });
    } catch (error) {
      socket.emit("message:read_error", { error: String(error) });
    }
  });

  // DELETE MESSAGE EVENT
  socket.on("message:delete", async (payload) => {
    try {
      const deleted = await messageService.deleteMessage(
        payload.message_id,
        userId,
      );

      socket.emit("message:delete_ack", {
        ok: true,
        message_id: deleted.id,
        conversation_id: deleted.conversation_id,
      });
    } catch (error) {
      socket.emit("message:delete_error", { error: String(error) });
    }
  });

  socket.on("message:recall", async (payload) => {
    try {
      const recalled = await messageService.recallMessage(
        payload.message_id,
        userId,
      );
      socket.emit("message:recall_ack", {
        ok: true,
        message_id: recalled.id,
        conversation_id: recalled.conversation_id,
      });
    } catch (error) {
      socket.emit("message:recall_error", { error: String(error) });
    }
  });

  socket.on("message:react", async (payload) => {
    try {
      const updated = await messageService.reactToMessage(
        payload.message_id,
        userId,
        payload.reaction,
      );
      socket.emit("message:reaction_ack", {
        ok: true,
        message_id: updated.id,
        conversation_id: updated.conversation_id,
      });
    } catch (error) {
      socket.emit("message:reaction_error", { error: String(error) });
    }
  });

  socket.on("call:initiate", async (payload: unknown) => {
    try {
      const conversationId = getConversationId(payload);
      if (!conversationId) {
        socket.emit("call:error", {
          event: "call:initiate",
          message: "invalid_conversation_id",
        });
        return;
      }

      const isMember = await ensureConversationMember(conversationId, userId);
      if (!isMember) {
        socket.emit("call:error", {
          event: "call:initiate",
          conversation_id: conversationId,
          message: "not_a_member",
        });
        return;
      }

      const sourcePayload = isRecord(payload) ? payload : {};
      const callId = getCallId(payload) ?? randomUUID();
      const callType =
        asString(sourcePayload.call_type) ??
        (conversationId.includes("grp") ? "group" : "direct");
      const relayPayload: Record<string, unknown> = {
        ...sourcePayload,
        call_id: callId,
        conversation_id: conversationId,
        call_type: callType,
        initiator_id: userId,
        created_at: new Date().toISOString(),
      };

      await callService.startCall({
        call_id: callId,
        conversation_id: conversationId,
        initiator_id: userId,
        call_type: callType === "group" ? "group" : "direct",
        started_at:
          typeof relayPayload.created_at === "string"
            ? relayPayload.created_at
            : undefined,
      });

      socket.to(`conversation_${conversationId}`).emit("call:initiate", relayPayload);
      socket.emit("call:initiate_ack", {
        ok: true,
        call_id: callId,
        conversation_id: conversationId,
      });

      await publishCallSignal(
        "call:initiate",
        { conversation_id: conversationId },
        relayPayload,
      );
    } catch (error) {
      socket.emit("call:error", {
        event: "call:initiate",
        message: error instanceof Error ? error.message : "call_initiate_failed",
      });
    }
  });

  const relayCallEvent = (eventName: CallSignalEventName) => {
    socket.on(eventName, async (payload: unknown) => {
      try {
        const conversationId = getConversationId(payload);
        if (!conversationId) {
          socket.emit("call:error", {
            event: eventName,
            message: "invalid_conversation_id",
          });
          return;
        }

        const callId = getCallId(payload);
        if (!callId) {
          socket.emit("call:error", {
            event: eventName,
            conversation_id: conversationId,
            message: "invalid_call_id",
          });
          return;
        }

        const isMember = await ensureConversationMember(conversationId, userId);
        if (!isMember) {
          socket.emit("call:error", {
            event: eventName,
            conversation_id: conversationId,
            message: "not_a_member",
          });
          return;
        }

        const sourcePayload = isRecord(payload) ? payload : {};
        const relayPayload: Record<string, unknown> = {
          ...sourcePayload,
          call_id: callId,
          conversation_id: conversationId,
          sender_id: userId,
          timestamp: Date.now(),
        };

        if (eventName === "call:accept") {
          await callService.markParticipantState(
            callId,
            userId,
            conversationId,
            "connected",
          );
        }

        if (eventName === "call:decline") {
          await callService.markParticipantState(
            callId,
            userId,
            conversationId,
            "declined",
          );

          await callService.autoEndDeclinedDirectCall(
            callId,
            conversationId,
          );
        }

        if (eventName === "call:end") {
          const endReason =
            typeof sourcePayload.reason === "string" && sourcePayload.reason
              ? sourcePayload.reason
              : "ended_by_user";
          await callService.endCall(callId, userId, conversationId, endReason);
        }

        socket.to(`conversation_${conversationId}`).emit(eventName, relayPayload);
        socket.emit("call:signal_ack", {
          ok: true,
          event: eventName,
          call_id: callId,
          conversation_id: conversationId,
        });

        await publishCallSignal(
          eventName,
          { conversation_id: conversationId },
          relayPayload,
        );
      } catch (error) {
        socket.emit("call:error", {
          event: eventName,
          message: error instanceof Error ? error.message : "call_signal_failed",
        });
      }
    });
  };

  relayCallEvent("call:accept");
  relayCallEvent("call:decline");
  relayCallEvent("call:offer");
  relayCallEvent("call:answer");
  relayCallEvent("call:ice_candidate");
  relayCallEvent("call:participant_update");
  relayCallEvent("call:end");

  // JOIN CONVERSATION EVENT - Dynamic room joining
  socket.on(
    "join_conversation",
    async (payload: { conversation_id?: string }) => {
      if (!payload.conversation_id) {
        socket.emit("join_conversation_error", {
          error: "conversation_id is required",
        });
        return;
      }

      try {
        // Verify user is a member of the conversation
        const members = await conversationRepository.getConversationMembers(
          payload.conversation_id,
        );
        const isMember = members.some((m) => m.userId === userId);

        if (!isMember) {
          socket.emit("join_conversation_error", {
            error: "Not a member of this conversation",
          });
          return;
        }

        socket.join(`conversation_${payload.conversation_id}`);
        console.log(
          `✅ User ${userId} joined conversation ${payload.conversation_id}`,
        );

        // Notify others that user joined
        socket
          .to(`conversation_${payload.conversation_id}`)
          .emit("user:joined_conversation", {
            conversation_id: payload.conversation_id,
            user_id: userId,
          });

        socket.emit("join_conversation_ack", { ok: true });
      } catch (error) {
        console.error("Error joining conversation:", error);
        socket.emit("join_conversation_error", { error: String(error) });
      }
    },
  );

  // LEAVE CONVERSATION EVENT
  socket.on("leave_conversation", (payload: { conversation_id?: string }) => {
    if (!payload.conversation_id) {
      socket.emit("leave_conversation_error", {
        error: "conversation_id is required",
      });
      return;
    }

    socket.leave(`conversation_${payload.conversation_id}`);
    console.log(
      `❌ User ${userId} left conversation ${payload.conversation_id}`,
    );

    // Notify others that user left
    socket
      .to(`conversation_${payload.conversation_id}`)
      .emit("user:left_conversation", {
        conversation_id: payload.conversation_id,
        user_id: userId,
      });

    socket.emit("leave_conversation_ack", { ok: true });
  });

  socket.on("disconnect", () => {
    socket.broadcast.emit("user:online", { user_id: userId, online: false });
  });
});

async function bootstrap() {
  await ensureTables();
  await connectRedis();

  let timeoutSweepRunning = false;
  const timeoutSweepInterval = setInterval(() => {
    if (timeoutSweepRunning) {
      return;
    }

    timeoutSweepRunning = true;
    void callService
      .expireUnansweredCalls(env.CALL_INVITE_TIMEOUT_SECONDS)
      .then((expiredSessions) => {
        if (expiredSessions.length > 0) {
          expiredSessions.forEach((session) => {
            const missedPayload = {
              call_id: session.id,
              conversation_id: session.conversation_id,
              reason: "missed_timeout",
              ended_at: session.ended_at,
            };

            emitCallSignal(
              "call:missed",
              { conversation_id: session.conversation_id },
              missedPayload,
            );
            emitCallSignal(
              "call:end",
              { conversation_id: session.conversation_id },
              missedPayload,
            );

            void publishCallSignal(
              "call:missed",
              { conversation_id: session.conversation_id },
              missedPayload,
            );
            void publishCallSignal(
              "call:end",
              { conversation_id: session.conversation_id },
              missedPayload,
            );
          });

          console.log(
            `[Call Timeout] Auto-ended ${expiredSessions.length} unanswered call(s)`,
          );
        }
      })
      .catch((error) => {
        console.error("Failed to sweep unanswered calls", error);
      })
      .finally(() => {
        timeoutSweepRunning = false;
      });
  }, 10_000);
  timeoutSweepInterval.unref();

  await redisSubscriber.subscribe(env.REDIS_MESSAGE_CHANNEL, (messageText) => {
    const message = JSON.parse(messageText) as {
      conversation_id: string;
      created_at: string;
      id: string;
      sender_id: string;
      type: string;
      content: string;
    };

    void messageService.persistIncomingMessage(message).catch((error) => {
      console.error("Failed to persist broadcasted message", error);
    });

    // Keep backward compatibility while standardizing on message:receive.
    io.to(`conversation_${message.conversation_id}`).emit(
      "receive_message",
      message,
    );
    io.to(`conversation_${message.conversation_id}`).emit(
      "message:receive",
      message,
    );
  });

  // Subscribe to message read events
  await redisSubscriber.subscribe(
    `${env.REDIS_MESSAGE_CHANNEL}:read`,
    (text) => {
      const data = JSON.parse(text) as {
        conversationId: string;
        userId: string;
      };
      io.to(`conversation_${data.conversationId}`).emit(
        "message:read_receipt",
        data,
      );
    },
  );

  // Subscribe to message delete events
  await redisSubscriber.subscribe(
    `${env.REDIS_MESSAGE_CHANNEL}:delete_for_user`,
    (text) => {
      const data = JSON.parse(text) as {
        messageId: string;
        conversationId: string;
        userId: string;
      };
      io.to(`user_${data.userId}`).emit("message:deleted", {
        message_id: data.messageId,
        conversation_id: data.conversationId,
        user_id: data.userId,
      });
    },
  );

  await redisSubscriber.subscribe(
    `${env.REDIS_MESSAGE_CHANNEL}:recall`,
    async (text) => {
      const data = JSON.parse(text) as {
        messageId: string;
        conversationId: string;
        recalledAt?: string;
        recalledBy?: string;
      };
      const payload = {
        message_id: data.messageId,
        conversation_id: data.conversationId,
        recalled_at: data.recalledAt,
        recalled_by: data.recalledBy,
      };

      io.to(`conversation_${data.conversationId}`).emit(
        "message:recalled",
        payload,
      );

      try {
        const members = await conversationRepository.getConversationMembers(
          data.conversationId,
        );
        members.forEach((member) => {
          io.to(`user_${member.userId}`).emit("message:recalled", payload);
        });
      } catch (error) {
        console.error("Failed to fan-out recalled event to user rooms", error);
      }
    },
  );

  await redisSubscriber.subscribe(
    `${env.REDIS_MESSAGE_CHANNEL}:reaction`,
    async (text) => {
      const data = JSON.parse(text) as {
        messageId: string;
        conversationId: string;
        reactions: Array<{
          user_id: string;
          reaction: string;
          created_at: string;
        }>;
      };

      const payload = {
        message_id: data.messageId,
        conversation_id: data.conversationId,
        reactions: data.reactions,
      };

      io.to(`conversation_${data.conversationId}`).emit(
        "message:reaction_updated",
        payload,
      );

      try {
        const members = await conversationRepository.getConversationMembers(
          data.conversationId,
        );
        members.forEach((member) => {
          io.to(`user_${member.userId}`).emit(
            "message:reaction_updated",
            payload,
          );
        });
      } catch (error) {
        console.error("Failed to fan-out reaction event to user rooms", error);
      }
    },
  );

  await redisSubscriber.subscribe(env.REDIS_CALL_SIGNAL_CHANNEL, (text) => {
    try {
      const envelope = JSON.parse(text) as CallSignalEnvelope;
      if (envelope.source_instance_id === callSignalingInstanceId) {
        return;
      }
      emitCallSignal(envelope.event_name, envelope.target, envelope.payload);
    } catch (error) {
      console.error("Failed to process call signaling message", error);
    }
  });

  server.listen(env.PORT, () => {
    console.log(`chat-service listening on ${env.PORT}`);
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start chat-service", error);
  process.exit(1);
});
