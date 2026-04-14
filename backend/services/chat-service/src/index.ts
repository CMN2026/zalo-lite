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
    } catch (error) {
      socket.emit("message:send_ack", { ok: false, error: String(error) });
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
      await messageService.deleteMessage(payload.message_id, userId);

      socket
        .to(`conversation_${payload.conversation_id}`)
        .emit("message:deleted", {
          message_id: payload.message_id,
          conversation_id: payload.conversation_id,
          timestamp: Date.now(),
        });
    } catch (error) {
      socket.emit("message:delete_error", { error: String(error) });
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

  // Subscribe to message channel for real-time broadcasting
  await redisSubscriber.subscribe(
    env.REDIS_MESSAGE_CHANNEL,
    async (messageText) => {
      const message = JSON.parse(messageText) as { conversation_id: string };
      io.to(`conversation_${message.conversation_id}`).emit(
        "message:receive",
        message,
      );

      try {
        const members = await conversationRepository.getConversationMembers(
          message.conversation_id,
        );
        members.forEach((member) => {
          io.to(`user_${member.userId}`).emit("message:receive", message);
        });
      } catch (error) {
        console.error("Failed to fan-out message to user rooms", error);
      }
    },
  );

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
    `${env.REDIS_MESSAGE_CHANNEL}:delete`,
    (text) => {
      const data = JSON.parse(text) as {
        messageId: string;
        conversationId: string;
      };
      io.to(`conversation_${data.conversationId}`).emit(
        "message:deleted",
        data,
      );
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
