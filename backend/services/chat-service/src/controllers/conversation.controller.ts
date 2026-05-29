import type { Request, Response, NextFunction } from "express";
import { ConversationService } from "../services/conversation.service.js";
import { ConversationRepository } from "../repositories/conversation.repository.js";
import { emitToUsers } from "../realtime/socket-emitter.js";

const conversationService = new ConversationService();
const conversationRepository = new ConversationRepository();

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

      if (data.type === "group") {
        const conversationMembers =
          await conversationRepository.getConversationMembers(data.id);

        emitToUsers(
          conversationMembers.map((member) => member.userId),
          "conversation:created",
          {
            conversation_id: data.id,
            created_by: creatorId,
            type: data.type,
          },
        );
      }

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
      const membersBefore = await conversationRepository.getConversationMembers(
        req.params.id,
      );
      await conversationService.deleteGroupConversation(userId, req.params.id);

      emitToUsers(
        membersBefore.map((member) => member.userId),
        "conversation:deleted",
        {
          conversation_id: req.params.id,
          deleted_by: userId,
        },
      );

      res.status(200).json({ message: "conversation_deleted" });
    } catch (error) {
      next(error);
    }
  }

  static async leave(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.auth?.userId ?? "";
      const membersBefore = await conversationRepository.getConversationMembers(
        req.params.id,
      );
      await conversationService.leaveConversation(userId, req.params.id);

      emitToUsers(
        membersBefore.map((member) => member.userId),
        "conversation:member_left",
        {
          conversation_id: req.params.id,
          user_id: userId,
        },
      );

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
      const membersBefore = await conversationRepository.getConversationMembers(
        req.params.id,
      );
      const beforeIds = new Set(membersBefore.map((member) => member.userId));

      const data = await conversationService.addMembersToGroup(
        userId,
        req.params.id,
        memberIds,
      );

      const membersAfter = await conversationRepository.getConversationMembers(
        req.params.id,
      );
      const addedMemberIds = membersAfter
        .map((member) => member.userId)
        .filter((memberId) => !beforeIds.has(memberId));

      emitToUsers(
        membersAfter.map((member) => member.userId),
        "conversation:members_added",
        {
          conversation_id: req.params.id,
          user_id: userId,
          member_ids: addedMemberIds,
        },
      );

      res.status(200).json({ data: toCamelCase(data) });
    } catch (error) {
      next(error);
    }
  }

  static async removeMember(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.auth?.userId ?? "";
      const membersBefore = await conversationRepository.getConversationMembers(
        req.params.id,
      );

      await conversationService.removeMemberFromGroup(
        userId,
        req.params.id,
        req.params.userId,
      );

      emitToUsers(
        membersBefore.map((member) => member.userId),
        "conversation:member_removed",
        {
          conversation_id: req.params.id,
          user_id: req.params.userId,
          removed_by: userId,
        },
      );

      res.status(200).json({ message: "member_removed" });
    } catch (error) {
      next(error);
    }
  }

  static async updateMemberRole(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const userId = req.auth?.userId ?? "";
      const role = typeof req.body.role === "string" ? req.body.role : "member";

      const data = await conversationService.updateMemberRoleInGroup(
        userId,
        req.params.id,
        req.params.userId,
        role,
      );

      const members = await conversationRepository.getConversationMembers(
        req.params.id,
      );

      emitToUsers(
        members.map((member) => member.userId),
        "conversation:member_role_updated",
        {
          conversation_id: req.params.id,
          user_id: req.params.userId,
          role,
        },
      );

      res.status(200).json({ data: toCamelCase(data) });
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
