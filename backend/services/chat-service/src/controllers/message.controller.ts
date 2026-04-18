import type { Request, Response, NextFunction } from "express";
import { MessageService } from "../services/message.service.js";
import { ConversationService } from "../services/conversation.service.js";
import type { MessageReactionKey } from "../repositories/message.repository.js";

const messageService = new MessageService();
const conversationService = new ConversationService();

export type AuthRequest = Request & { auth?: { userId: string } };

export class MessageController {
  // Send text message
  static async sendMessage(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const userId = req.auth?.userId ?? "";
      const {
        conversationId,
        conversation_id,
        content,
        type = "text",
        reply_to_message_id,
      } = req.body;

      const resolvedConversationId =
        (typeof conversationId === "string" && conversationId) ||
        (typeof conversation_id === "string" && conversation_id);

      if (!resolvedConversationId) {
        return res.status(400).json({ message: "conversation_id_required" });
      }

      const message = await messageService.sendMessage({
        conversation_id: resolvedConversationId,
        sender_id: userId,
        type,
        content,
        reply_to_message_id:
          typeof reply_to_message_id === "string"
            ? reply_to_message_id
            : undefined,
      });

      res.status(201).json({ data: message, message: "Message sent" });
    } catch (error) {
      next(error);
    }
  }

  // Send message with file attachment
  static async sendMessageWithFile(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const userId = req.auth?.userId ?? "";
      const { conversationId } = req.params;
      const { content = "" } = req.body;

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const fileData = {
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        path: `/uploads/${conversationId}/${req.file.filename}`,
      };

      const message = await messageService.sendMessage({
        conversation_id: conversationId,
        sender_id: userId,
        type: "file",
        content: JSON.stringify({
          text: content,
          file: fileData,
        }),
      });

      res
        .status(201)
        .json({ data: message, message: "Message with file sent" });
    } catch (error) {
      next(error);
    }
  }

  // Get messages in a conversation
  static async getMessages(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const userId = req.auth?.userId ?? "";
      const { conversationId } = req.params;
      const rawLimit = Number(req.query.limit ?? 1000);
      const limit = Number.isFinite(rawLimit)
        ? Math.min(Math.max(rawLimit, 1), 1000)
        : 1000;

      const data = await conversationService.getMessages(
        userId,
        conversationId,
        limit,
      );
      res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  }

  // Mark messages as read
  static async markAsRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.auth?.userId ?? "";
      const { conversationId } = req.params;

      await messageService.markMessagesAsRead(conversationId, userId);
      res.status(200).json({ message: "Messages marked as read" });
    } catch (error) {
      next(error);
    }
  }

  // Delete a message
  static async deleteMessage(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const userId = req.auth?.userId ?? "";
      const { messageId } = req.params;

      await messageService.deleteMessage(messageId, userId);
      res.status(200).json({ message: "message_deleted_for_user" });
    } catch (error) {
      next(error);
    }
  }

  static async recallMessage(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const userId = req.auth?.userId ?? "";
      const { messageId } = req.params;

      const data = await messageService.recallMessage(messageId, userId);
      res.status(200).json({ message: "message_recalled", data });
    } catch (error) {
      next(error);
    }
  }

  static async reactToMessage(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const userId = req.auth?.userId ?? "";
      const { messageId } = req.params;

      const reactionValue = req.body.reaction;
      const reaction: MessageReactionKey | undefined =
        reactionValue === "vui" ||
        reactionValue === "buon" ||
        reactionValue === "phan_no" ||
        reactionValue === "wow"
          ? reactionValue
          : undefined;

      const data = await messageService.reactToMessage(
        messageId,
        userId,
        reaction,
      );
      res.status(200).json({ message: "message_reaction_updated", data });
    } catch (error) {
      next(error);
    }
  }

  // Search messages in a conversation
  static async searchMessages(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const userId = req.auth?.userId ?? "";
      const { conversationId } = req.params;
      const { q } = req.query;

      if (!q || typeof q !== "string") {
        return res.status(400).json({ message: "Search query required" });
      }

      const data = await messageService.searchMessages(
        conversationId,
        userId,
        q,
      );
      res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  }
}
