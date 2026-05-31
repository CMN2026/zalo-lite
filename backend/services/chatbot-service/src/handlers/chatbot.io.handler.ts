import type { Server as SocketIOServer, Socket } from "socket.io";
import { chatbotService } from "../services/chatbot.service.js";
import { notificationService } from "../services/notification.service.js";
import { chatbotOrchestrator } from "../orchestrator/chatbot.orchestrator.js";
import {
  conversationRepository,
  type IMessage,
} from "../repositories/conversation.repository.js";
import { v4 as uuidv4 } from "uuid";
import { learningService } from "../services/learning.service.js";
import { logger } from "../observability/logger.js";
import { recordStreamingEvent } from "../observability/metrics.js";

const activeControllers = new Map<string, AbortController>();

export class ChatbotIOHandler {
  constructor(private readonly io: SocketIOServer) {}

  setupHandlers() {
    this.io.on("connection", (socket: Socket) => {
      logger.info("socket_connected", { socketId: socket.id });

      // Handle user sending message to chatbot
      socket.on("send_message", async (data) => {
        try {
          const { userId, message, conversationId } = data;

          const result = await chatbotService.handleMessage(
            userId,
            message,
            conversationId,
          );

          socket.emit("chatbot_response", {
            conversationId: result.conversationId,
            message: result.message,
          });

          if (result.action === "escalate") {
            this.io.emit("escalation_request", {
              conversationId: result.conversationId,
              userId,
            });
          }
        } catch (error) {
          console.error("Error handling message:", error);
          socket.emit("error", { message: "Failed to process message" });
        }
      });

      // Streaming message API - emits partial chunks
      socket.on("send_message_stream", async (data) => {
        const { userId, message, conversationId } = data;
        let convId = conversationId as string | undefined;
        try {
          recordStreamingEvent("started");
          // ensure conversation exists (same logic as service)
          if (convId) {
            const current =
              await conversationRepository.getConversation(convId);
            if (!current || ["resolved", "closed"].includes(current.status)) {
              convId = await conversationRepository.create(userId);
            }
          } else {
            const latest =
              await conversationRepository.getLatestActiveConversationByUserId(
                userId,
              );
            convId =
              latest?.conversationId ||
              (await conversationRepository.create(userId));
          }

          // persist user message
          const userMessage: IMessage = {
            id: uuidv4(),
            type: "user",
            content: String(message),
            senderId: String(userId),
            createdAt: Date.now(),
          };
          await conversationRepository.addMessage(convId, userMessage);

          // Prevent duplicate streams: abort any existing stream for this socket
          if (activeControllers.has(socket.id)) {
            activeControllers.get(socket.id)?.abort();
            activeControllers.delete(socket.id);
            logger.warn("duplicate_stream_aborted", { socketId: socket.id, conversationId: convId });
          }

          // prepare controller for cancellation
          const controller = new AbortController();
          activeControllers.set(socket.id, controller);

          const chunks: string[] = [];

          try {
            const res = await chatbotOrchestrator.handleMessageStreaming(
              { prompt: message, conversationId: convId },
              (chunk: string) => {
                recordStreamingEvent("chunks");
                socket.emit("chatbot:ai:chunk", {
                  conversationId: convId,
                  chunk,
                });
                chunks.push(chunk);
              },
              { timeoutMs: 30000, signal: controller.signal },
            );

            const finalText = (res && (res as any).text) || chunks.join("");

            const botMessage: IMessage = {
              id: uuidv4(),
              type: "bot",
              content: finalText,
              senderId: "chatbot",
              createdAt: Date.now(),
            };

            await conversationRepository.addMessage(convId, botMessage);
            // learning hook (use default intent/confidence when not available)
            await learningService
              .learnFromSuccess(message, "auto", 0.8, finalText)
              .catch((error) => {
                logger.warn("learning_hook_skipped", {
                  socketId: socket.id,
                  conversationId: convId,
                  error: error instanceof Error ? error.message : String(error),
                });
              });

            recordStreamingEvent("completed");
            socket.emit("chatbot:ai:done", {
              conversationId: convId,
              message: botMessage,
            });
            // also emit compatibility event
            socket.emit("chatbot_response", {
              conversationId: convId,
              message: botMessage,
            });
          } catch (err) {
            const errMsg = (err as any)?.message || String(err);
            if (errMsg === "aborted") {
              recordStreamingEvent("cancelled");
              socket.emit("chatbot:ai:error", {
                conversationId: convId,
                message: "cancelled",
              });
            } else {
              recordStreamingEvent("failed");
              logger.error("streaming_error", {
                socketId: socket.id,
                conversationId: convId,
                error: errMsg,
              });
              socket.emit("chatbot:ai:error", {
                conversationId: convId,
                message: "Failed during streaming",
              });
            }
          } finally {
            activeControllers.delete(socket.id);
          }
        } catch (error) {
          recordStreamingEvent("failed");
          logger.error("stream_start_error", {
            socketId: socket.id,
            error: error instanceof Error ? error.message : String(error),
          });
          socket.emit("chatbot:ai:error", {
            message: "Failed to start streaming",
          });
        }
      });

      // Client can cancel an in-progress AI stream
      socket.on("chatbot:ai:cancel", () => {
        const ctrl = activeControllers.get(socket.id);
        if (ctrl) {
          ctrl.abort();
          activeControllers.delete(socket.id);
          recordStreamingEvent("cancelled");
        }
      });

      // Typing indicator — broadcast to other clients
      socket.on("typing", (data) => {
        const { conversationId } = data;
        socket.broadcast.emit("user_typing", { conversationId });
      });

      // System notification broadcast (admin only)
      socket.on("broadcast_notification", async (data) => {
        try {
          const { title, content, type, recipientType, userId } = data;

          const notification = await notificationService.sendNotification(
            title,
            content,
            type,
            recipientType,
            userId,
          );

          this.io.emit("system_notification", {
            id: notification.notificationId,
            title: notification.title,
            content: notification.content,
            type: notification.type,
            sentAt: notification.sentAt,
          });
        } catch (error) {
          console.error("Error broadcasting notification:", error);
          socket.emit("error", { message: "Failed to send notification" });
        }
      });

      socket.on("disconnect", () => {
        const ctrl = activeControllers.get(socket.id);
        if (ctrl) {
          ctrl.abort();
          activeControllers.delete(socket.id);
          recordStreamingEvent("cancelled");
          logger.info("stream_aborted_on_disconnect", { socketId: socket.id });
        }
        logger.info("socket_disconnected", { socketId: socket.id });
      });
    });
  }
}
