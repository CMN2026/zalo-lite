import { CommentRepository, type Comment } from "../repositories/comment.repository.js";
import { PostRepository } from "../repositories/post.repository.js";
import { HttpError } from "../utils/http-error.js";

export class CommentService {
  private readonly commentRepository = new CommentRepository();
  private readonly postRepository = new PostRepository();

  async addComment(input: {
    post_id: string;
    user_id: string;
    content: string;
  }): Promise<Comment> {
    if (!input.content.trim()) {
      throw new HttpError(400, "comment_content_required");
    }

    // Verify post exists
    const post = await this.postRepository.getById(input.post_id);
    if (!post) {
      throw new HttpError(404, "post_not_found");
    }

    const comment = await this.commentRepository.create(input);

    // Increment comment count on post
    await this.postRepository.incrementCommentCount(input.post_id);

    return comment;
  }

  async getComments(postId: string, limit = 100): Promise<Comment[]> {
    // Verify post exists
    const post = await this.postRepository.getById(postId);
    if (!post) {
      throw new HttpError(404, "post_not_found");
    }

    return this.commentRepository.listByPostId(postId, limit);
  }

  async deleteComment(commentId: string, userId: string): Promise<void> {
    const comment = await this.commentRepository.getById(commentId);
    if (!comment) {
      throw new HttpError(404, "comment_not_found");
    }

    // Only comment author can delete
    if (comment.user_id !== userId) {
      // Also allow post owner to delete comments on their post
      const post = await this.postRepository.getById(comment.post_id);
      if (!post || post.user_id !== userId) {
        throw new HttpError(403, "not_authorized_to_delete_comment");
      }
    }

    await this.commentRepository.softDelete(comment);

    // Decrement comment count on post
    await this.postRepository.decrementCommentCount(comment.post_id);
  }
}
