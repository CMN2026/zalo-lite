import { PutCommand, GetCommand, QueryCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo } from "../config/dynamodb.js";
import { env } from "../config/env.js";
import type { ReactionSummary } from "./post.repository.js";

export type ReactionType = "like" | "love" | "haha" | "sad" | "angry";

export type Reaction = {
  post_id: string;
  user_id: string;
  reaction: ReactionType;
  created_at: string;
};

export class ReactionRepository {
  async upsert(
    postId: string,
    userId: string,
    reaction: ReactionType,
  ): Promise<Reaction> {
    const item: Reaction = {
      post_id: postId,
      user_id: userId,
      reaction,
      created_at: new Date().toISOString(),
    };

    await dynamo.send(
      new PutCommand({
        TableName: env.TABLE_POST_REACTIONS,
        Item: item,
      }),
    );

    return item;
  }

  async remove(postId: string, userId: string): Promise<void> {
    await dynamo.send(
      new DeleteCommand({
        TableName: env.TABLE_POST_REACTIONS,
        Key: {
          post_id: postId,
          user_id: userId,
        },
      }),
    );
  }

  async getByPostIdAndUserId(
    postId: string,
    userId: string,
  ): Promise<Reaction | null> {
    const response = await dynamo.send(
      new GetCommand({
        TableName: env.TABLE_POST_REACTIONS,
        Key: {
          post_id: postId,
          user_id: userId,
        },
      }),
    );

    return (response.Item as Reaction | undefined) ?? null;
  }

  async listByPostId(postId: string): Promise<Reaction[]> {
    const response = await dynamo.send(
      new QueryCommand({
        TableName: env.TABLE_POST_REACTIONS,
        KeyConditionExpression: "post_id = :postId",
        ExpressionAttributeValues: {
          ":postId": postId,
        },
      }),
    );

    return (response.Items as Reaction[] | undefined) ?? [];
  }

  async countByPostId(postId: string): Promise<ReactionSummary> {
    const reactions = await this.listByPostId(postId);

    const summary: ReactionSummary = {
      like: 0,
      love: 0,
      haha: 0,
      sad: 0,
      angry: 0,
    };

    for (const r of reactions) {
      if (r.reaction in summary) {
        summary[r.reaction as keyof ReactionSummary] += 1;
      }
    }

    return summary;
  }
}
