import { v4 as uuidv4 } from "uuid";
import { dynamoDB } from "../config/dynamodb.js";
import { env } from "../config/env.js";
import { QueryCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

export interface IMessage {
  id: string;
  type: "user" | "bot" | "system";
  content: string;
  senderId: string;
  intent?: string;
  confidence?: number;
  createdAt: number; // Unix timestamp
}

export interface IConversation {
  conversationId: string;
  userId: string;
  messages: IMessage[];
  createdAt: number;
  startedAt: number;
  lastMessageAt: number;
  status: "active" | "closed";
  escalatedToAdmin: boolean;
  adminId?: string;
}

export class ConversationRepository {
  async create(userId: string): Promise<string> {
    const conversationId = uuidv4();
    const now = Date.now();

    const conversation: IConversation = {
      conversationId,
      userId,
      messages: [],
      createdAt: now,
      startedAt: now,
      lastMessageAt: now,
      status: "active",
      escalatedToAdmin: false,
    };

    await dynamoDB.send(
      new PutCommand({
        TableName: env.TABLE_CONVERSATIONS,
        Item: conversation,
      }),
    );

    return conversationId;
  }

  async getConversation(conversationId: string): Promise<IConversation | null> {
    // Get latest item (most recent createdAt)
    const result = await dynamoDB.send(
      new QueryCommand({
        TableName: env.TABLE_CONVERSATIONS,
        KeyConditionExpression: "conversationId = :id",
        ExpressionAttributeValues: {
          ":id": conversationId,
        },
        ScanIndexForward: false,
        Limit: 1,
      }),
    );

    return (result.Items?.[0] as IConversation) || null;
  }

  async addMessage(
    conversationId: string,
    message: IMessage,
  ): Promise<IConversation | null> {
    const conversation = await this.getConversation(conversationId);
    if (!conversation) return null;

    // Update existing item with new message
    const messages = [...(conversation.messages || []), message];

    await dynamoDB.send(
      new UpdateCommand({
        TableName: env.TABLE_CONVERSATIONS,
        Key: {
          conversationId,
          createdAt: conversation.createdAt,
        },
        UpdateExpression:
          "SET messages = :messages, lastMessageAt = :lastMessageAt",
        ExpressionAttributeValues: {
          ":messages": messages,
          ":lastMessageAt": Date.now(),
        },
      }),
    );

    return {
      ...conversation,
      messages,
      lastMessageAt: Date.now(),
    };
  }

  async listByUserId(
    userId: string,
    limit: number = 10,
  ): Promise<IConversation[]> {
    const result = await dynamoDB.send(
      new QueryCommand({
        TableName: env.TABLE_CONVERSATIONS,
        IndexName: "userId-lastMessageAt-index",
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: {
          ":userId": userId,
        },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );

    return (result.Items as IConversation[]) || [];
  }

  async getHistory(
    conversationId: string,
    limit: number = 50,
  ): Promise<IMessage[]> {
    const conversation = await this.getConversation(conversationId);
    if (!conversation) return [];

    return conversation.messages.slice(-limit);
  }

  async close(conversationId: string): Promise<void> {
    const conversation = await this.getConversation(conversationId);
    if (!conversation) return;

    await dynamoDB.send(
      new UpdateCommand({
        TableName: env.TABLE_CONVERSATIONS,
        Key: {
          conversationId,
          createdAt: conversation.createdAt,
        },
        UpdateExpression: "SET #status = :status",
        ExpressionAttributeNames: {
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":status": "closed",
        },
      }),
    );
  }

  async escalateToAdmin(
    conversationId: string,
    adminId: string,
  ): Promise<void> {
    const conversation = await this.getConversation(conversationId);
    if (!conversation) return;

    await dynamoDB.send(
      new UpdateCommand({
        TableName: env.TABLE_CONVERSATIONS,
        Key: {
          conversationId,
          createdAt: conversation.createdAt,
        },
        UpdateExpression:
          "SET escalatedToAdmin = :escalated, adminId = :adminId",
        ExpressionAttributeValues: {
          ":escalated": true,
          ":adminId": adminId,
        },
      }),
    );
  }
}

export const conversationRepository = new ConversationRepository();
