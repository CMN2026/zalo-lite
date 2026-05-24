import type { Request, Response, NextFunction } from "express";
import { PostService } from "../services/post.service.js";

export type AuthRequest = Request & { auth?: { userId: string } };

const postService = new PostService();

export class PostController {
  // Create a new post (with optional images)
  static async createPost(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.auth?.userId ?? "";
      const { content = "", visibility = "friends" } = req.body;

      // Get uploaded image filenames
      const files = req.files as Express.Multer.File[] | undefined;
      const images = (files ?? []).map((f) => f.filename);

      const post = await postService.createPost({
        user_id: userId,
        content,
        images,
        visibility: visibility === "public" ? "public" : "friends",
      });

      res.status(201).json({ data: post, message: "post_created" });
    } catch (error) {
      next(error);
    }
  }

  // Get newsfeed (own posts + friends' posts)
  static async getFeed(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.auth?.userId ?? "";
      const rawLimit = Number(req.query.limit ?? 50);
      const limit = Number.isFinite(rawLimit)
        ? Math.min(Math.max(rawLimit, 1), 100)
        : 50;

      // Extract token to pass to user-client
      const token = req.headers.authorization?.replace("Bearer ", "");

      const posts = await postService.getFeed(userId, token, limit);
      res.status(200).json({ data: posts });
    } catch (error) {
      next(error);
    }
  }

  // Get current user's posts
  static async getMyPosts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.auth?.userId ?? "";
      const rawLimit = Number(req.query.limit ?? 50);
      const limit = Number.isFinite(rawLimit)
        ? Math.min(Math.max(rawLimit, 1), 100)
        : 50;

      const posts = await postService.getMyPosts(userId, limit);
      res.status(200).json({ data: posts });
    } catch (error) {
      next(error);
    }
  }

  // Get a specific user's posts
  static async getUserPosts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.auth?.userId ?? "";
      const { targetUserId } = req.params;
      const rawLimit = Number(req.query.limit ?? 50);
      const limit = Number.isFinite(rawLimit)
        ? Math.min(Math.max(rawLimit, 1), 100)
        : 50;

      const token = req.headers.authorization?.replace("Bearer ", "");

      const posts = await postService.getUserPosts(
        targetUserId,
        userId,
        token,
        limit,
      );
      res.status(200).json({ data: posts });
    } catch (error) {
      next(error);
    }
  }

  // Get a single post
  static async getPost(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.auth?.userId ?? "";
      const { postId } = req.params;
      const token = req.headers.authorization?.replace("Bearer ", "");

      const post = await postService.getPost(postId, userId, token);
      res.status(200).json({ data: post });
    } catch (error) {
      next(error);
    }
  }

  // Delete a post
  static async deletePost(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.auth?.userId ?? "";
      const { postId } = req.params;

      await postService.deletePost(postId, userId);
      res.status(200).json({ message: "post_deleted" });
    } catch (error) {
      next(error);
    }
  }
}
