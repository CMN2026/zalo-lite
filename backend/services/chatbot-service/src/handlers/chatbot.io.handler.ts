import type { Server as SocketIOServer, Socket } from "socket.io";
import { chatbotService } from "../services/chatbot.service.js";
import { notificationService } from "../services/notification.service.js";

export class ChatbotIOHandler {
  constructor(private io: SocketIOServer) {}

  setupHandlers() {
    this.io.on("connection", (socket: Socket) => {
      console.log(`User connected: ${socket.id}`);

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
        console.log(`User disconnected: ${socket.id}`);
      });
    });
  }
}
