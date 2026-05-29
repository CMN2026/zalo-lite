import { PutCommand, GetCommand, QueryCommand, UpdateCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { dynamo } from "../config/dynamodb.js";
import { env } from "../config/env.js";

export type ReactionSummary = {
  like: number;
  love: number;
  haha: number;
  sad: number;
  angry: number;
};

export type Post = {
  id: string;
  user_id: string;
  content: string;
  images: string[]; // S3 keys or filenames
  visibility: "friends" | "public";
  reaction_summary: ReactionSummary;
  comment_count: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
};

const emptyReactionSummary: ReactionSummary = {
  like: 0,
  love: 0,
  haha: 0,
  sad: 0,
  angry: 0,
};

export class PostRepository {
  async create(input: {
    user_id: string;
    content: string;
    images: string[];
    visibility: "friends" | "public";
  }): Promise<Post> {
    const now = new Date().toISOString();
    const post: Post = {
      id: uuidv4(),
      user_id: input.user_id,
      content: input.content,
      images: input.images,
      visibility: input.visibility,
      reaction_summary: { ...emptyReactionSummary },
      comment_count: 0,
      created_at: now,
      updated_at: now,
    };

    await dynamo.send(
      new PutCommand({
        TableName: env.TABLE_POSTS,
        Item: post,
      }),
    );

    return post;
  }

  async getById(postId: string): Promise<Post | null> {
    const response = await dynamo.send(
      new GetCommand({
        TableName: env.TABLE_POSTS,
        Key: { id: postId },
      }),
    );

    const item = response.Item as Post | undefined;
    if (!item || item.deleted_at) {
      return null;
    }

    return item;
  }

  async listByUserId(userId: string, limit = 50): Promise<Post[]> {
    const response = await dynamo.send(
      new QueryCommand({
        TableName: env.TABLE_POSTS,
        IndexName: "user_id-index",
        KeyConditionExpression: "user_id = :userId",
        ExpressionAttributeValues: {
          ":userId": userId,
        },
        ScanIndexForward: false, // newest first
        Limit: limit,
      }),
    );

    return ((response.Items as Post[] | undefined) ?? []).filter(
      (p) => !p.deleted_at,
    );
  }

  async listFeed(friendIds: string[], userId: string, limit = 50): Promise<Post[]> {
    // Include own posts + friends' posts
    const allUserIds = [userId, ...friendIds];

    const allPosts: Post[] = [];

    for (const uid of allUserIds) {
      const posts = await this.listByUserId(uid, limit);
      allPosts.push(...posts);
    }

    // Sort by created_at descending and limit
    allPosts.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    return allPosts.slice(0, limit);
  }

  async updateReactionSummary(
    postId: string,
    summary: ReactionSummary,
  ): Promise<void> {
    await dynamo.send(
      new UpdateCommand({
        TableName: env.TABLE_POSTS,
        Key: { id: postId },
        UpdateExpression:
          "SET reaction_summary = :summary, updated_at = :now",
        ExpressionAttributeValues: {
          ":summary": summary,
          ":now": new Date().toISOString(),
        },
      }),
    );
  }

  async incrementCommentCount(postId: string): Promise<void> {
    await dynamo.send(
      new UpdateCommand({
        TableName: env.TABLE_POSTS,
        Key: { id: postId },
        UpdateExpression:
          "SET comment_count = if_not_exists(comment_count, :zero) + :one, updated_at = :now",
        ExpressionAttributeValues: {
          ":zero": 0,
          ":one": 1,
          ":now": new Date().toISOString(),
        },
      }),
    );
  }

  async decrementCommentCount(postId: string): Promise<void> {
    // Get current post to check count
    const post = await this.getById(postId);
    if (!post || post.comment_count <= 0) {
      return;
    }

    await dynamo.send(
      new UpdateCommand({
        TableName: env.TABLE_POSTS,
        Key: { id: postId },
        UpdateExpression:
          "SET comment_count = comment_count - :one, updated_at = :now",
        ExpressionAttributeValues: {
          ":one": 1,
          ":now": new Date().toISOString(),
        },
      }),
    );
  }

  async softDelete(postId: string): Promise<void> {
    await dynamo.send(
      new UpdateCommand({
        TableName: env.TABLE_POSTS,
        Key: { id: postId },
        UpdateExpression: "SET deleted_at = :now, updated_at = :now",
        ExpressionAttributeValues: {
          ":now": new Date().toISOString(),
        },
      }),
    );
  }
}
