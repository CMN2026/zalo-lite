import "dotenv/config";
import http from "node:http";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { Server } from "socket.io";
import { env } from "./config/env.js";
import { ensureTables } from "./config/dynamodb.js";
import { connectRedis, redisSubscriber } from "./config/redis.js";
import { authMiddleware } from "./middlewares/auth.middleware.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import { setupFileServer } from "./middlewares/upload.middleware.js";
import { friendRoutes } from "./routes/friend.routes.js";
import { conversationRoutes } from "./routes/conversation.routes.js";
import { messageRoutes } from "./routes/message.routes.js";
import { verifyToken } from "./utils/jwt.js";
import { MessageService } from "./services/message.service.js";
import { ConversationRepository } from "./repositories/conversation.repository.js";
import { initUserClientService } from "./services/user-client.service.js";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:3003", "*"],
    credentials: true,
  },
});

const messageService = new MessageService();
const conversationRepository = new ConversationRepository();

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

  // TYPING EVENT
  socket.on("message:typing", (payload) => {
    socket
      .to(`conversation_${payload.conversation_id}`)
      .emit("message:typing", {
        conversation_id: payload.conversation_id,
        user_id: userId,
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

  await redisSubscriber.subscribe(env.REDIS_MESSAGE_CHANNEL, (messageText) => {
    const message = JSON.parse(messageText) as {
      conversation_id: string;
      created_at: string;
      id: string;
      sender_id: string;
      type: string;
      content: string;
    };

    void messageService
      .persistIncomingMessage(message)
      .catch((error) => {
        console.error("Failed to persist broadcasted message", error);
      });

    io.to(`conversation_${message.conversation_id}`).emit("receive_message", message);
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

  server.listen(env.PORT, () => {
    console.log(`chat-service listening on ${env.PORT}`);
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start chat-service", error);
  process.exit(1);
});
