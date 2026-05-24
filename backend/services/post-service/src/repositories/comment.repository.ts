import { PutCommand, QueryCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { dynamo } from "../config/dynamodb.js";
import { env } from "../config/env.js";

export type Comment = {
  post_id: string;
  created_at: string;
  id: string;
  user_id: string;
  content: string;
  deleted_at?: string;
};

export class CommentRepository {
  async create(input: {
    post_id: string;
    user_id: string;
    content: string;
  }): Promise<Comment> {
    const comment: Comment = {
      post_id: input.post_id,
      created_at: new Date().toISOString(),
      id: uuidv4(),
      user_id: input.user_id,
      content: input.content,
    };

    await dynamo.send(
      new PutCommand({
        TableName: env.TABLE_POST_COMMENTS,
        Item: comment,
      }),
    );

    return comment;
  }

  async listByPostId(postId: string, limit = 100): Promise<Comment[]> {
    const response = await dynamo.send(
      new QueryCommand({
        TableName: env.TABLE_POST_COMMENTS,
        KeyConditionExpression: "post_id = :postId",
        ExpressionAttributeValues: {
          ":postId": postId,
        },
        ScanIndexForward: true, // oldest first (chronological)
        Limit: limit,
      }),
    );

    return ((response.Items as Comment[] | undefined) ?? []).filter(
      (c) => !c.deleted_at,
    );
  }

  async getById(commentId: string): Promise<Comment | null> {
    // Comments use composite key (post_id, created_at), so we need to scan by id
    let exclusiveStartKey: Record<string, unknown> | undefined;

    do {
      const response = await dynamo.send(
        new ScanCommand({
          TableName: env.TABLE_POST_COMMENTS,
          FilterExpression: "id = :id",
          ExpressionAttributeValues: {
            ":id": commentId,
          },
          ExclusiveStartKey: exclusiveStartKey,
        }),
      );

      const item = (response.Items?.[0] as Comment | undefined) ?? null;
      if (item && !item.deleted_at) {
        return item;
      }

      exclusiveStartKey = response.LastEvaluatedKey as
        | Record<string, unknown>
        | undefined;
    } while (exclusiveStartKey);

    return null;
  }

  async softDelete(comment: Comment): Promise<void> {
    await dynamo.send(
      new PutCommand({
        TableName: env.TABLE_POST_COMMENTS,
        Item: {
          ...comment,
          deleted_at: new Date().toISOString(),
        },
      }),
    );
  }
}
