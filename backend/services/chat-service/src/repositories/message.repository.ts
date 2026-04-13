import {
  PutCommand,
  QueryCommand,
  DeleteCommand,
  GetCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { dynamo } from "../config/dynamodb.js";
import { env } from "../config/env.js";

export type Message = {
  conversation_id: string;
  created_at: string;
  id: string;
  sender_id: string;
  type: string;
  content: string;
  read_by?: string[];
  deleted_at?: string;
};

export class MessageRepository {
  async create(input: {
    conversation_id: string;
    sender_id: string;
    type: string;
    content: string;
  }): Promise<Message> {
    const message: Message = {
      conversation_id: input.conversation_id,
      created_at: new Date().toISOString(),
      id: uuidv4(),
      sender_id: input.sender_id,
      type: input.type,
      content: input.content,
      read_by: [input.sender_id], // Sender has read their own message
    };

    await dynamo.send(
      new PutCommand({
        TableName: env.TABLE_MESSAGES,
        Item: message,
      }),
    );

    return message;
  }

  async getById(messageId: string): Promise<Message | null> {
    try {
      const response = await dynamo.send(
        new QueryCommand({
          TableName: env.TABLE_MESSAGES,
          IndexName: "id-index", // Assuming there's an index on id
          KeyConditionExpression: "id = :id",
          ExpressionAttributeValues: {
            ":id": messageId,
          },
        }),
      );

      const item = (response.Items?.[0] as Message | undefined) ?? null;
      return item && !item.deleted_at ? item : null;
    } catch {
      return null;
    }
  }

  async listByConversationId(
    conversationId: string,
    limit = 50,
  ): Promise<Message[]> {
    const response = await dynamo.send(
      new QueryCommand({
        TableName: env.TABLE_MESSAGES,
        KeyConditionExpression: "conversation_id = :conversationId",
        ExpressionAttributeValues: {
          ":conversationId": conversationId,
        },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );

    const messages = ((response.Items as Message[] | undefined) ?? [])
      .filter((m) => !m.deleted_at)
      .reverse();

    return messages;
  }

  async markAsRead(conversationId: string, userId: string): Promise<void> {
    // Get all messages in conversation
    const messages = await this.listByConversationId(conversationId, 1000);

    // Update each message to include userId in read_by array
    for (const message of messages) {
      if (!message.read_by?.includes(userId)) {
        const readBy = [...(message.read_by ?? []), userId];
        await dynamo.send(
          new PutCommand({
            TableName: env.TABLE_MESSAGES,
            Item: {
              ...message,
              read_by: readBy,
            },
          }),
        );
      }
    }
  }

  async delete(messageId: string): Promise<void> {
    // Soft delete - mark with deleted_at timestamp
    const message = await this.getById(messageId);
    if (message) {
      await dynamo.send(
        new PutCommand({
          TableName: env.TABLE_MESSAGES,
          Item: {
            ...message,
            deleted_at: new Date().toISOString(),
          },
        }),
      );
    }
  }

  async search(conversationId: string, query: string): Promise<Message[]> {
    // DynamoDB doesn't support full-text search, so we scan and filter
    const response = await dynamo.send(
      new QueryCommand({
        TableName: env.TABLE_MESSAGES,
        KeyConditionExpression: "conversation_id = :conversationId",
        ExpressionAttributeValues: {
          ":conversationId": conversationId,
        },
        Limit: 1000,
      }),
    );

    const queryLower = query.toLowerCase();
    const messages = ((response.Items as Message[] | undefined) ?? [])
      .filter(
        (m) => !m.deleted_at && m.content.toLowerCase().includes(queryLower),
      )
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );

    return messages;
  }

  async getStats(conversationId: string): Promise<{
    total: number;
    byType: Record<string, number>;
  }> {
    const messages = await this.listByConversationId(conversationId, 1000);

    const byType: Record<string, number> = {};
    for (const msg of messages) {
      if (!msg.deleted_at) {
        byType[msg.type] = (byType[msg.type] ?? 0) + 1;
      }
    }

    return {
      total: messages.length,
      byType,
    };
  }
}
