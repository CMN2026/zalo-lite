import { v4 as uuidv4 } from "uuid";
import { dynamoDB } from "../config/dynamodb.js";
import { env } from "../config/env.js";
import {
  QueryCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";

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
  status: "active" | "closed" | "waiting_response" | "needs_staff" | "resolved";
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
      status: "waiting_response",
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
    const nextStatus: IConversation["status"] = conversation.escalatedToAdmin
      ? "needs_staff"
      : "waiting_response";
    const nextLastMessageAt = Date.now();

    await dynamoDB.send(
      new UpdateCommand({
        TableName: env.TABLE_CONVERSATIONS,
        Key: {
          conversationId,
          createdAt: conversation.createdAt,
        },
        UpdateExpression:
          "SET messages = :messages, lastMessageAt = :lastMessageAt, #status = :status",
        ExpressionAttributeNames: {
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":messages": messages,
          ":lastMessageAt": nextLastMessageAt,
          ":status": nextStatus,
        },
      }),
    );

    return {
      ...conversation,
      messages,
      lastMessageAt: nextLastMessageAt,
      status: nextStatus,
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

    const conversations = ((result.Items as IConversation[]) || []).map(
      (item) => this.normalizeStatus(item),
    );

    await this.autoCloseInactiveConversations(conversations);

    return conversations;
  }

  async getLatestActiveConversationByUserId(
    userId: string,
  ): Promise<IConversation | null> {
    const conversations = await this.listByUserId(userId, 20);
    const activeConversation = conversations.find((conversation) =>
      ["waiting_response", "needs_staff", "active"].includes(
        conversation.status,
      ),
    );

    return activeConversation || null;
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

    await this.updateStatus(conversation, "resolved");
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
          "SET escalatedToAdmin = :escalated, adminId = :adminId, #status = :status",
        ExpressionAttributeNames: {
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":escalated": true,
          ":adminId": adminId,
          ":status": "needs_staff",
        },
      }),
    );
  }

  async deleteConversationForUser(
    conversationId: string,
    userId: string,
  ): Promise<void> {
    try {
      // First get the conversation to get createdAt (composite key)
      const conversation = await this.getConversation(conversationId);
      if (!conversation) {
        throw new Error("Conversation not found");
      }

      if (conversation.userId !== userId) {
        throw new Error("Forbidden to delete this conversation");
      }

      // Delete using composite key
      await dynamoDB.send(
        new DeleteCommand({
          TableName: env.TABLE_CONVERSATIONS,
          Key: {
            conversationId,
            createdAt: conversation.createdAt,
          },
        }),
      );
    } catch (error) {
      console.error(`Error deleting conversation ${conversationId}:`, error);
      throw error;
    }
  }

  private normalizeStatus(conversation: IConversation): IConversation {
    if (conversation.status === "closed") {
      return { ...conversation, status: "resolved" };
    }

    if (conversation.status === "active") {
      return {
        ...conversation,
        status: conversation.escalatedToAdmin
          ? "needs_staff"
          : "waiting_response",
      };
    }

    return conversation;
  }

  private async autoCloseInactiveConversations(
    conversations: IConversation[],
  ): Promise<void> {
    const cutoffMs = env.AUTO_CLOSE_INACTIVE_HOURS * 60 * 60 * 1000;
    const now = Date.now();

    const staleConversations = conversations.filter((conversation) => {
      const isOpen = ["waiting_response", "needs_staff", "active"].includes(
        conversation.status,
      );
      return isOpen && now - conversation.lastMessageAt >= cutoffMs;
    });

    if (staleConversations.length === 0) {
      return;
    }

    await Promise.all(
      staleConversations.map((conversation) =>
        this.updateStatus(conversation, "resolved"),
      ),
    );

    staleConversations.forEach((conversation) => {
      conversation.status = "resolved";
    });
  }

  private async updateStatus(
    conversation: IConversation,
    status: IConversation["status"],
  ): Promise<void> {
    await dynamoDB.send(
      new UpdateCommand({
        TableName: env.TABLE_CONVERSATIONS,
        Key: {
          conversationId: conversation.conversationId,
          createdAt: conversation.createdAt,
        },
        UpdateExpression: "SET #status = :status",
        ExpressionAttributeNames: {
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":status": status,
        },
      }),
    );
  }
}

export const conversationRepository = new ConversationRepository();
