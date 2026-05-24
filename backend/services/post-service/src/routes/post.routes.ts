import { Router } from "express";
import { body, param, query } from "express-validator";
import { PostController } from "../controllers/post.controller.js";
import { CommentController } from "../controllers/comment.controller.js";
import { ReactionController } from "../controllers/reaction.controller.js";
import { upload } from "../middlewares/upload.middleware.js";
import { validateRequest } from "../middlewares/validate.middleware.js";

export const postRoutes = Router();

// ─── Post CRUD ───────────────────────────────────────────────────────────────

// Create a new post (multipart: content + images[])
postRoutes.post(
  "/",
  upload.array("images", 10),
  [
    body("content")
      .optional()
      .isString()
      .withMessage("Content must be a string"),
    body("visibility")
      .optional()
      .isIn(["friends", "public"])
      .withMessage("Visibility must be friends or public"),
    validateRequest,
  ],
  PostController.createPost,
);

// Get newsfeed (own posts + friends' posts)
postRoutes.get(
  "/feed",
  [
    query("limit").optional().isInt({ min: 1, max: 100 }),
    validateRequest,
  ],
  PostController.getFeed,
);

// Get current user's posts
postRoutes.get(
  "/me",
  [
    query("limit").optional().isInt({ min: 1, max: 100 }),
    validateRequest,
  ],
  PostController.getMyPosts,
);

// Get a specific user's posts
postRoutes.get(
  "/user/:targetUserId",
  [
    param("targetUserId").isString().withMessage("Invalid user ID"),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    validateRequest,
  ],
  PostController.getUserPosts,
);

// Get a single post
postRoutes.get(
  "/:postId",
  [
    param("postId").isString().withMessage("Invalid post ID"),
    validateRequest,
  ],
  PostController.getPost,
);

// Delete a post
postRoutes.delete(
  "/:postId",
  [
    param("postId").isString().withMessage("Invalid post ID"),
    validateRequest,
  ],
  PostController.deletePost,
);

// ─── Comments ────────────────────────────────────────────────────────────────

// Add a comment to a post
postRoutes.post(
  "/:postId/comments",
  [
    param("postId").isString().withMessage("Invalid post ID"),
    body("content")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("Comment content is required"),
    validateRequest,
  ],
  CommentController.addComment,
);

// Get comments for a post
postRoutes.get(
  "/:postId/comments",
  [
    param("postId").isString().withMessage("Invalid post ID"),
    query("limit").optional().isInt({ min: 1, max: 500 }),
    validateRequest,
  ],
  CommentController.getComments,
);

// Delete a comment
postRoutes.delete(
  "/:postId/comments/:commentId",
  [
    param("postId").isString().withMessage("Invalid post ID"),
    param("commentId").isString().withMessage("Invalid comment ID"),
    validateRequest,
  ],
  CommentController.deleteComment,
);

// ─── Reactions ───────────────────────────────────────────────────────────────

// Toggle reaction on a post
postRoutes.put(
  "/:postId/reactions",
  [
    param("postId").isString().withMessage("Invalid post ID"),
    body("reaction")
      .optional({ nullable: true })
      .isIn(["like", "love", "haha", "sad", "angry"]),
    validateRequest,
  ],
  ReactionController.toggleReaction,
);

// Get all reactions for a post
postRoutes.get(
  "/:postId/reactions",
  [
    param("postId").isString().withMessage("Invalid post ID"),
    validateRequest,
  ],
  ReactionController.getReactions,
);
