import type { Request, Response, NextFunction } from "express";
import { ReactionService } from "../services/reaction.service.js";
import type { ReactionType } from "../repositories/reaction.repository.js";

export type AuthRequest = Request & { auth?: { userId: string } };

const reactionService = new ReactionService();

const VALID_REACTIONS: ReactionType[] = ["like", "love", "haha", "sad", "angry"];

export class ReactionController {
  // Toggle reaction on a post
  static async toggleReaction(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.auth?.userId ?? "";
      const { postId } = req.params;
      const { reaction } = req.body;

      // Validate reaction value
      const reactionValue: ReactionType | null =
        reaction === null || reaction === undefined
          ? null
          : VALID_REACTIONS.includes(reaction)
            ? reaction
            : null;

      const result = await reactionService.toggleReaction(
        postId,
        userId,
        reactionValue,
      );

      res.status(200).json({
        data: result,
        message: `reaction_${result.action}`,
      });
    } catch (error) {
      next(error);
    }
  }

  // Get all reactions for a post
  static async getReactions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { postId } = req.params;

      const reactions = await reactionService.getReactions(postId);
      res.status(200).json({ data: reactions });
    } catch (error) {
      next(error);
    }
  }
}
