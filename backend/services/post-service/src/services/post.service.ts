import { PostRepository, type Post } from "../repositories/post.repository.js";
import { ReactionRepository, type ReactionType } from "../repositories/reaction.repository.js";
import { getUserClientService } from "./user-client.service.js";
import { HttpError } from "../utils/http-error.js";

type PostWithViewerReaction = Post & {
  my_reaction: ReactionType | null;
};

export class PostService {
  private readonly postRepository = new PostRepository();
  private readonly reactionRepository = new ReactionRepository();

  private async attachViewerReaction(
    posts: Post[],
    userId: string,
  ): Promise<PostWithViewerReaction[]> {
    const enriched = await Promise.all(
      posts.map(async (post) => {
        const userReaction = await this.reactionRepository.getByPostIdAndUserId(
          post.id,
          userId,
        );
        return {
          ...post,
          my_reaction: userReaction?.reaction ?? null,
        };
      }),
    );

    return enriched;
  }

  async createPost(input: {
    user_id: string;
    content: string;
    images: string[];
    visibility?: "friends" | "public";
  }): Promise<Post> {
    if (!input.content.trim() && input.images.length === 0) {
      throw new HttpError(400, "post_content_required");
    }

    const post = await this.postRepository.create({
      user_id: input.user_id,
      content: input.content,
      images: input.images,
      visibility: input.visibility ?? "friends",
    });

    return post;
  }

  async getPost(
    postId: string,
    viewerId: string,
    token?: string,
  ): Promise<PostWithViewerReaction> {
    const post = await this.postRepository.getById(postId);
    if (!post) {
      throw new HttpError(404, "post_not_found");
    }

    // Check visibility: only friends can view (unless it's their own post)
    if (post.visibility === "friends" && post.user_id !== viewerId) {
      const userClient = getUserClientService();
      const friendIds = await userClient.getFriendIds(viewerId, token);
      if (!friendIds.includes(post.user_id)) {
        throw new HttpError(403, "not_authorized_to_view_post");
      }
    }

    const userReaction = await this.reactionRepository.getByPostIdAndUserId(
      post.id,
      viewerId,
    );
    return {
      ...post,
      my_reaction: userReaction?.reaction ?? null,
    };
  }

  async getFeed(
    userId: string,
    token?: string,
    limit = 50,
  ): Promise<PostWithViewerReaction[]> {
    const userClient = getUserClientService();
    const friendIds = await userClient.getFriendIds(userId, token);

    const posts = await this.postRepository.listFeed(friendIds, userId, limit);
    return this.attachViewerReaction(posts, userId);
  }

  async getMyPosts(userId: string, limit = 50): Promise<PostWithViewerReaction[]> {
    const posts = await this.postRepository.listByUserId(userId, limit);
    return this.attachViewerReaction(posts, userId);
  }

  async getUserPosts(
    targetUserId: string,
    viewerId: string,
    token?: string,
    limit = 50,
  ): Promise<PostWithViewerReaction[]> {
    // If viewing own posts, no access check needed
    if (targetUserId === viewerId) {
      const ownPosts = await this.postRepository.listByUserId(targetUserId, limit);
      return this.attachViewerReaction(ownPosts, viewerId);
    }

    // Check if viewer is friend of target user
    const userClient = getUserClientService();
    const friendIds = await userClient.getFriendIds(viewerId, token);
    if (!friendIds.includes(targetUserId)) {
      throw new HttpError(403, "not_authorized_to_view_posts");
    }

    const posts = await this.postRepository.listByUserId(targetUserId, limit);
    return this.attachViewerReaction(posts, viewerId);
  }

  async deletePost(postId: string, userId: string): Promise<void> {
    const post = await this.postRepository.getById(postId);
    if (!post) {
      throw new HttpError(404, "post_not_found");
    }

    if (post.user_id !== userId) {
      throw new HttpError(403, "not_authorized_to_delete_post");
    }

    await this.postRepository.softDelete(postId);
  }
}
