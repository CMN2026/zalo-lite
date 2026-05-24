import { ReactionRepository, type Reaction, type ReactionType } from "../repositories/reaction.repository.js";
import { PostRepository } from "../repositories/post.repository.js";
import { HttpError } from "../utils/http-error.js";

export class ReactionService {
  private readonly reactionRepository = new ReactionRepository();
  private readonly postRepository = new PostRepository();

  /**
   * Toggle reaction on a post.
   * - If user has no reaction → add reaction
   * - If user has same reaction → remove it (un-react)
   * - If user has different reaction → change it
   * - If reaction is null → remove existing reaction
   */
  async toggleReaction(
    postId: string,
    userId: string,
    reaction: ReactionType | null,
  ): Promise<{ action: "added" | "changed" | "removed"; reaction: Reaction | null }> {
    // Verify post exists
    const post = await this.postRepository.getById(postId);
    if (!post) {
      throw new HttpError(404, "post_not_found");
    }

    const existing = await this.reactionRepository.getByPostIdAndUserId(
      postId,
      userId,
    );

    let action: "added" | "changed" | "removed";
    let resultReaction: Reaction | null = null;

    if (reaction === null) {
      // Explicitly remove reaction
      if (existing) {
        await this.reactionRepository.remove(postId, userId);
        action = "removed";
      } else {
        action = "removed";
      }
    } else if (!existing) {
      // No existing reaction → add new
      resultReaction = await this.reactionRepository.upsert(postId, userId, reaction);
      action = "added";
    } else if (existing.reaction === reaction) {
      // Same reaction → toggle off (un-react)
      await this.reactionRepository.remove(postId, userId);
      action = "removed";
    } else {
      // Different reaction → change
      resultReaction = await this.reactionRepository.upsert(postId, userId, reaction);
      action = "changed";
    }

    // Recalculate and update reaction summary on the post
    const summary = await this.reactionRepository.countByPostId(postId);
    await this.postRepository.updateReactionSummary(postId, summary);

    return { action, reaction: resultReaction };
  }

  async getReactions(postId: string): Promise<Reaction[]> {
    const post = await this.postRepository.getById(postId);
    if (!post) {
      throw new HttpError(404, "post_not_found");
    }

    return this.reactionRepository.listByPostId(postId);
  }

  async getUserReaction(
    postId: string,
    userId: string,
  ): Promise<Reaction | null> {
    return this.reactionRepository.getByPostIdAndUserId(postId, userId);
  }
}
