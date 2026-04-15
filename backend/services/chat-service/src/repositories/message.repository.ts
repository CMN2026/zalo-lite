import { PutCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { dynamo } from "../config/dynamodb.js";
import { env } from "../config/env.js";

export type MessageReactionKey = "vui" | "buon" | "phan_no" | "wow";

export type MessageReaction = {
  user_id: string;
  reaction: MessageReactionKey;
  created_at: string;
};

export type Message = {
  conversation_id: string;
  created_at: string;
  id: string;
  sender_id: string;
  type: string;
  content: string;
  read_by?: string[];
  deleted_at?: string;
  reply_to_message_id?: string;
  recalled_at?: string;
  recalled_by?: string;
  reactions?: MessageReaction[];
  deleted_for_user_ids?: string[];
};

export class MessageRepository {
  async create(input: {
    conversation_id: string;
    sender_id: string;
    type: string;
    content: string;
    reply_to_message_id?: string;
  }): Promise<Message> {
    const message: Message = {
      conversation_id: input.conversation_id,
      created_at: new Date().toISOString(),
      id: uuidv4(),
      sender_id: input.sender_id,
      type: input.type,
      content: input.content,
      read_by: [input.sender_id], // Sender has read their own message
      reply_to_message_id: input.reply_to_message_id,
      reactions: [],
      deleted_for_user_ids: [],
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
      let exclusiveStartKey: Record<string, unknown> | undefined;

      do {
        const response = await dynamo.send(
          new ScanCommand({
            TableName: env.TABLE_MESSAGES,
            FilterExpression: "id = :id",
            ExpressionAttributeValues: {
              ":id": messageId,
            },
            ExclusiveStartKey: exclusiveStartKey,
          }),
        );

        const item = (response.Items?.[0] as Message | undefined) ?? null;
        if (item && !item.deleted_at) {
          return item;
        }

        exclusiveStartKey = response.LastEvaluatedKey as
          | Record<string, unknown>
          | undefined;
      } while (exclusiveStartKey);

      return null;
    } catch {
      return null;
    }
  }

  async listByConversationId(
    conversationId: string,
    limit = 50,
    viewerUserId?: string,
    clearedAt?: string | null,
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

    const clearedAtMs = clearedAt ? new Date(clearedAt).getTime() : null;

    const messages = ((response.Items as Message[] | undefined) ?? [])
      .filter((m) => {
        if (m.deleted_at) {
          return false;
        }

        if (
          viewerUserId &&
          (m.deleted_for_user_ids ?? []).includes(viewerUserId)
        ) {
          return false;
        }

        if (clearedAtMs !== null) {
          return new Date(m.created_at).getTime() > clearedAtMs;
        }

        return true;
      })
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
        await this.updateMessage({
          ...message,
          read_by: readBy,
        });
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

  async recall(messageId: string, userId: string): Promise<Message | null> {
    const message = await this.getById(messageId);
    if (!message) {
      return null;
    }

    const recalled: Message = {
      ...message,
      type: "text",
      content: "Tin nhan da duoc thu hoi",
      recalled_at: new Date().toISOString(),
      recalled_by: userId,
      reactions: [],
      reply_to_message_id: undefined,
      deleted_for_user_ids: [],
    };

    await this.updateMessage(recalled);
    return recalled;
  }

  async setReaction(
    messageId: string,
    userId: string,
    reaction?: MessageReactionKey,
  ): Promise<Message | null> {
    const message = await this.getById(messageId);
    if (!message) {
      return null;
    }

    const kept = (message.reactions ?? []).filter(
      (item) => item.user_id !== userId,
    );

    const nextReactions = reaction
      ? [
          ...kept,
          {
            user_id: userId,
            reaction,
            created_at: new Date().toISOString(),
          },
        ]
      : kept;

    const updated: Message = {
      ...message,
      reactions: nextReactions,
    };

    await this.updateMessage(updated);
    return updated;
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

  async deleteForUser(
    messageId: string,
    userId: string,
  ): Promise<Message | null> {
    const message = await this.getById(messageId);
    if (!message) {
      return null;
    }

    const deletedForUserIds = Array.from(
      new Set([...(message.deleted_for_user_ids ?? []), userId]),
    );

    const updated: Message = {
      ...message,
      deleted_for_user_ids: deletedForUserIds,
    };

    await this.updateMessage(updated);
    return updated;
  }

  private async updateMessage(message: Message): Promise<void> {
    await dynamo.send(
      new PutCommand({
        TableName: env.TABLE_MESSAGES,
        Item: message,
      }),
    );
  }
}
