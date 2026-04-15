import type { Request, Response, NextFunction } from "express";
import { ConversationService } from "../services/conversation.service.js";

const conversationService = new ConversationService();

function toCamelCase(data: unknown): unknown {
  if (Array.isArray(data)) return data.map(toCamelCase);
  if (data !== null && typeof data === "object") {
    // Check if it's already a complex instance like Date, but data from service is plain JSON.
    return Object.fromEntries(
      Object.entries(data).map(([key, value]) => {
        const camelKey = key.replace(/_([a-z])/g, (_, letter) =>
          letter.toUpperCase(),
        );
        return [camelKey, toCamelCase(value)];
      }),
    );
  }
  return data;
}

export class ConversationController {
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const creatorId = req.auth?.userId ?? "";
      const memberIds = Array.isArray(req.body.memberIds)
        ? req.body.memberIds
        : req.body.member_ids;
      const data = await conversationService.createConversation(creatorId, {
        ...req.body,
        memberIds,
      });
      res.status(201).json({ data: toCamelCase(data) });
    } catch (error) {
      next(error);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.auth?.userId ?? "";
      const data = await conversationService.getConversations(userId);

      res.status(200).json({ data: toCamelCase(data) });
    } catch (error) {
      next(error);
    }
  }

  static async detail(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.auth?.userId ?? "";
      const data = await conversationService.getConversationDetail(
        userId,
        req.params.id,
      );
      res.status(200).json({ data: toCamelCase(data) });
    } catch (error) {
      next(error);
    }
  }

  static async listMessages(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.auth?.userId ?? "";
      const conversationId = req.params.id;
      const limit = Number(req.query.limit ?? 50);
      const data = await conversationService.getMessages(
        userId,
        conversationId,
        limit,
      );
      res.status(200).json({ data: toCamelCase(data) });
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.auth?.userId ?? "";
      const data = await conversationService.updateGroupConversation(
        userId,
        req.params.id,
        req.body,
      );
      res.status(200).json({ data: toCamelCase(data) });
    } catch (error) {
      next(error);
    }
  }

  static async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.auth?.userId ?? "";
      await conversationService.deleteGroupConversation(userId, req.params.id);
      res.status(200).json({ message: "conversation_deleted" });
    } catch (error) {
      next(error);
    }
  }

  static async leave(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.auth?.userId ?? "";
      await conversationService.leaveConversation(userId, req.params.id);
      res.status(200).json({ message: "left_conversation" });
    } catch (error) {
      next(error);
    }
  }

  static async hideForMe(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.auth?.userId ?? "";
      await conversationService.hideConversationForUser(userId, req.params.id);
      res.status(200).json({ message: "conversation_hidden_for_user" });
    } catch (error) {
      next(error);
    }
  }

  static async addMembers(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.auth?.userId ?? "";
      const memberIds = Array.isArray(req.body.memberIds)
        ? req.body.memberIds
        : req.body.member_ids;
      const data = await conversationService.addMembersToGroup(
        userId,
        req.params.id,
        memberIds,
      );
      res.status(200).json({ data: toCamelCase(data) });
    } catch (error) {
      next(error);
    }
  }

  static async removeMember(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.auth?.userId ?? "";
      await conversationService.removeMemberFromGroup(
        userId,
        req.params.id,
        req.params.userId,
      );
      res.status(200).json({ message: "member_removed" });
    } catch (error) {
      next(error);
    }
  }

  static async getOrCreateDirect(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const userId = req.auth?.userId ?? "";
      const otherUserId =
        (typeof req.body.userId === "string" && req.body.userId) ||
        (typeof req.body.user_id === "string" && req.body.user_id);

      if (!otherUserId) {
        return res.status(400).json({ error: "userId is required" });
      }

      if (userId === otherUserId) {
        return res
          .status(400)
          .json({ error: "Cannot create conversation with yourself" });
      }

      const conversation =
        await conversationService.getOrCreateDirectConversation(
          userId,
          otherUserId,
        );
      res.status(200).json({ data: toCamelCase(conversation) });
    } catch (error) {
      next(error);
    }
  }
}
