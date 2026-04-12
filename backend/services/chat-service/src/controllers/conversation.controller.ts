import type { Request, Response, NextFunction } from "express";
import { ConversationService } from "../services/conversation.service.js";

const conversationService = new ConversationService();

export class ConversationController {
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const creatorId = req.auth?.user_id ?? "";
      const data = await conversationService.createConversation(creatorId, req.body);
      res.status(201).json({ data });
    } catch (error) {
      next(error);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.auth?.user_id ?? "";
      const data = await conversationService.getConversations(userId);
      res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  }

  static async detail(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.auth?.user_id ?? "";
      const data = await conversationService.getConversationDetail(userId, req.params.id);
      res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  }

  static async listMessages(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.auth?.user_id ?? "";
      const conversationId = req.params.id;
      const limit = Number(req.query.limit ?? 50);
      const data = await conversationService.getMessages(userId, conversationId, limit);
      res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.auth?.user_id ?? "";
      const data = await conversationService.updateGroupConversation(
        userId,
        req.params.id,
        req.body,
      );
      res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  }

  static async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.auth?.user_id ?? "";
      await conversationService.deleteGroupConversation(userId, req.params.id);
      res.status(200).json({ message: "conversation_deleted" });
    } catch (error) {
      next(error);
    }
  }

  static async leave(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.auth?.user_id ?? "";
      await conversationService.leaveConversation(userId, req.params.id);
      res.status(200).json({ message: "left_conversation" });
    } catch (error) {
      next(error);
    }
  }

  static async addMembers(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.auth?.user_id ?? "";
      const data = await conversationService.addMembersToGroup(
        userId,
        req.params.id,
        req.body.member_ids,
      );
      res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  }

  static async removeMember(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.auth?.user_id ?? "";
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
}

