import {
  BatchGetCommand,
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { dynamo } from "../config/dynamodb.js";
import { env } from "../config/env.js";

export type Conversation = {
  id: string;
  type: "direct" | "group";
  name: string | null;
  createdBy: string;
  lastMessageAt: string | null;
  createdAt: string;
};

export type ConversationMember = {
  conversationId: string;
  userId: string;
  role: string;
  joinedAt: string;
  hiddenAt?: string | null;
  clearedAt?: string | null;
};

// Helper mapper functions to centralise formatting
const mapConversation = (item: any): Conversation => ({
  id: item.id,
  type: item.type,
  name: item.name,
  createdBy: item.created_by,
  lastMessageAt: item.last_message_at,
  createdAt: item.created_at,
});

const mapMember = (item: any): ConversationMember => ({
  conversationId: item.conversation_id,
  userId: item.user_id,
  role: item.role,
  joinedAt: item.joined_at,
  hiddenAt: item.hidden_at ?? null,
  clearedAt: item.cleared_at ?? null,
});

export class ConversationRepository {
  async createConversation(
    payload: Pick<Conversation, "type" | "name" | "createdBy">,
    memberIds: string[],
  ): Promise<Conversation> {
    const conversation: Conversation = {
      id: uuidv4(),
      type: payload.type,
      name: payload.name,
      createdBy: payload.createdBy,
      lastMessageAt: null,
      createdAt: new Date().toISOString(),
    };

    const dbItem = {
      id: conversation.id,
      type: conversation.type,
      name: conversation.name,
      created_by: conversation.createdBy,
      last_message_at: conversation.lastMessageAt,
      created_at: conversation.createdAt,
    };

    await dynamo.send(
      new PutCommand({
        TableName: env.TABLE_CONVERSATIONS,
        Item: dbItem,
      }),
    );

    await Promise.all(
      memberIds.map((userId) =>
        dynamo.send(
          new PutCommand({
            TableName: env.TABLE_CONVERSATION_MEMBERS,
            Item: {
              conversation_id: conversation.id,
              user_id: userId,
              role: userId === payload.createdBy ? "owner" : "member",
              joined_at: new Date().toISOString(),
              hidden_at: null,
              cleared_at: null,
            },
          }),
        ),
      ),
    );

    return conversation;
  }

  async getConversationById(id: string): Promise<Conversation | null> {
    const result = await dynamo.send(
      new GetCommand({
        TableName: env.TABLE_CONVERSATIONS,
        Key: { id },
      }),
    );

    return result.Item ? mapConversation(result.Item) : null;
  }

  async getConversationMembers(
    conversationId: string,
  ): Promise<ConversationMember[]> {
    const normalizedConversationId = conversationId?.trim();
    if (!normalizedConversationId) {
      console.warn(
        "⚠️ getConversationMembers called with empty conversationId",
      );
      return [];
    }

    const result = await dynamo.send(
      new QueryCommand({
        TableName: env.TABLE_CONVERSATION_MEMBERS,
        KeyConditionExpression: "conversation_id = :conversationId",
        ExpressionAttributeValues: {
          ":conversationId": normalizedConversationId,
        },
      }),
    );

    return (result.Items || []).map(mapMember);
  }

  async listByUserId(
    userId: string,
    includeHidden = false,
  ): Promise<Conversation[]> {
    // Strict validation - must be non-empty string
    const normalizedUserId = String(userId ?? "").trim();
    if (!normalizedUserId || normalizedUserId.length === 0) {
      console.warn("⚠️ listByUserId called with empty userId");
      return [];
    }

    // Ensure ExpressionAttributeValues is never empty
    if (!normalizedUserId) {
      return [];
    }

    let membershipItems: ConversationMember[] = [];

    try {
      const membership = await dynamo.send(
        new QueryCommand({
          TableName: env.TABLE_CONVERSATION_MEMBERS,
          IndexName: "user_id-index",
          KeyConditionExpression: "user_id = :userId",
          ExpressionAttributeValues: {
            ":userId": normalizedUserId,
          },
        }),
      );

      membershipItems = (membership.Items || []).map(mapMember);
    } catch (error) {
      const message =
        error instanceof Error
          ? `${error.name}: ${error.message}`
          : String(error);
      const canFallback =
        message.includes("ExpressionAttributeValues must not be empty") ||
        message.includes("The table does not have the specified index") ||
        message.includes("Cannot do operations on a non-existent table/index");

      if (!canFallback) {
        throw error;
      }

      console.warn(`[Conversation] Query fallback due to: ${message}`);

      // Fallback for local/dev environments when GSI is not ready or unavailable.
      if (!normalizedUserId || normalizedUserId.length === 0) {
        return [];
      }

      const fallback = await dynamo.send(
        new ScanCommand({
          TableName: env.TABLE_CONVERSATION_MEMBERS,
          FilterExpression: "user_id = :userId",
          ExpressionAttributeValues: {
            ":userId": normalizedUserId,
          },
        }),
      );

      membershipItems = (fallback.Items || []).map(mapMember);
    }

    const visibleMembershipItems = includeHidden
      ? membershipItems
      : membershipItems.filter((item) => !item.hiddenAt);

    const conversationIds =
      visibleMembershipItems.map((item) => item.conversationId) ?? [];

    if (conversationIds.length === 0) {
      return [];
    }

    const response = await dynamo.send(
      new BatchGetCommand({
        RequestItems: {
          [env.TABLE_CONVERSATIONS]: {
            Keys: conversationIds.map((id) => ({ id })),
          },
        },
      }),
    );

    const rows = response.Responses?.[env.TABLE_CONVERSATIONS] || [];
    return rows.map(mapConversation);
  }

  async updateLastMessageAt(
    conversationId: string,
    timestamp: string,
  ): Promise<void> {
    await dynamo.send(
      new UpdateCommand({
        TableName: env.TABLE_CONVERSATIONS,
        Key: { id: conversationId },
        UpdateExpression: "SET last_message_at = :timestamp",
        ExpressionAttributeValues: { ":timestamp": timestamp },
      }),
    );
  }

  async updateConversationName(
    conversationId: string,
    name: string,
  ): Promise<void> {
    await dynamo.send(
      new UpdateCommand({
        TableName: env.TABLE_CONVERSATIONS,
        Key: { id: conversationId },
        UpdateExpression: "SET #n = :name",
        ExpressionAttributeNames: { "#n": "name" },
        ExpressionAttributeValues: { ":name": name },
      }),
    );
  }

  async deleteConversation(conversationId: string): Promise<void> {
    const members = await this.getConversationMembers(conversationId);

    await Promise.all(
      members.map((member) =>
        dynamo.send(
          new DeleteCommand({
            TableName: env.TABLE_CONVERSATION_MEMBERS,
            Key: {
              conversation_id: conversationId,
              user_id: member.userId,
            },
          }),
        ),
      ),
    );

    await dynamo.send(
      new DeleteCommand({
        TableName: env.TABLE_CONVERSATIONS,
        Key: { id: conversationId },
      }),
    );
  }

  async removeMember(conversationId: string, userId: string): Promise<void> {
    await dynamo.send(
      new DeleteCommand({
        TableName: env.TABLE_CONVERSATION_MEMBERS,
        Key: {
          conversation_id: conversationId,
          user_id: userId,
        },
      }),
    );
  }

  async getMember(
    conversationId: string,
    userId: string,
  ): Promise<ConversationMember | null> {
    const result = await dynamo.send(
      new GetCommand({
        TableName: env.TABLE_CONVERSATION_MEMBERS,
        Key: {
          conversation_id: conversationId,
          user_id: userId,
        },
      }),
    );

    return result.Item ? mapMember(result.Item) : null;
  }

  async hideConversationForUser(
    conversationId: string,
    userId: string,
    clearedAt?: string,
  ): Promise<void> {
    const hiddenAt = new Date().toISOString();

    if (clearedAt) {
      await dynamo.send(
        new UpdateCommand({
          TableName: env.TABLE_CONVERSATION_MEMBERS,
          Key: {
            conversation_id: conversationId,
            user_id: userId,
          },
          UpdateExpression:
            "SET hidden_at = :hiddenAt, cleared_at = :clearedAt",
          ExpressionAttributeValues: {
            ":hiddenAt": hiddenAt,
            ":clearedAt": clearedAt,
          },
        }),
      );
      return;
    }

    await dynamo.send(
      new UpdateCommand({
        TableName: env.TABLE_CONVERSATION_MEMBERS,
        Key: {
          conversation_id: conversationId,
          user_id: userId,
        },
        UpdateExpression: "SET hidden_at = :hiddenAt",
        ExpressionAttributeValues: {
          ":hiddenAt": hiddenAt,
        },
      }),
    );
  }

  async restoreConversationForUser(
    conversationId: string,
    userId: string,
  ): Promise<void> {
    await dynamo.send(
      new UpdateCommand({
        TableName: env.TABLE_CONVERSATION_MEMBERS,
        Key: {
          conversation_id: conversationId,
          user_id: userId,
        },
        UpdateExpression: "REMOVE hidden_at",
      }),
    );
  }

  async restoreConversationForMembers(conversationId: string): Promise<void> {
    const members = await this.getConversationMembers(conversationId);

    await Promise.all(
      members.map((member) =>
        dynamo.send(
          new UpdateCommand({
            TableName: env.TABLE_CONVERSATION_MEMBERS,
            Key: {
              conversation_id: conversationId,
              user_id: member.userId,
            },
            UpdateExpression: "REMOVE hidden_at",
          }),
        ),
      ),
    );
  }

  async addMembers(
    conversationId: string,
    userIds: string[],
    role = "member",
  ): Promise<void> {
    const now = new Date().toISOString();
    await Promise.all(
      userIds.map((userId) =>
        dynamo.send(
          new PutCommand({
            TableName: env.TABLE_CONVERSATION_MEMBERS,
            Item: {
              conversation_id: conversationId,
              user_id: userId,
              role,
              joined_at: now,
              hidden_at: null,
              cleared_at: null,
            },
          }),
        ),
      ),
    );
  }

  async updateMemberRole(
    conversationId: string,
    userId: string,
    role: string,
  ): Promise<void> {
    await dynamo.send(
      new UpdateCommand({
        TableName: env.TABLE_CONVERSATION_MEMBERS,
        Key: {
          conversation_id: conversationId,
          user_id: userId,
        },
        UpdateExpression: "SET #r = :role",
        ExpressionAttributeNames: { "#r": "role" },
        ExpressionAttributeValues: { ":role": role },
      }),
    );
  }
}
