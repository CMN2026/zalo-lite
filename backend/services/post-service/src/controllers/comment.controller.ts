import type { Request, Response, NextFunction } from "express";
import { CommentService } from "../services/comment.service.js";

export type AuthRequest = Request & { auth?: { userId: string } };

const commentService = new CommentService();

export class CommentController {
  // Add a comment to a post
  static async addComment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.auth?.userId ?? "";
      const { postId } = req.params;
      const { content } = req.body;

      const comment = await commentService.addComment({
        post_id: postId,
        user_id: userId,
        content,
      });

      res.status(201).json({ data: comment, message: "comment_added" });
    } catch (error) {
      next(error);
    }
  }

  // Get comments for a post
  static async getComments(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { postId } = req.params;
      const rawLimit = Number(req.query.limit ?? 100);
      const limit = Number.isFinite(rawLimit)
        ? Math.min(Math.max(rawLimit, 1), 500)
        : 100;

      const comments = await commentService.getComments(postId, limit);
      res.status(200).json({ data: comments });
    } catch (error) {
      next(error);
    }
  }

  // Delete a comment
  static async deleteComment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.auth?.userId ?? "";
      const { commentId } = req.params;

      await commentService.deleteComment(commentId, userId);
      res.status(200).json({ message: "comment_deleted" });
    } catch (error) {
      next(error);
    }
  }
}
