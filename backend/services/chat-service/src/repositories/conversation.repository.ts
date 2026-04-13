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
  created_by: string;
  last_message_at: string | null;
  created_at: string;
};

export type ConversationMember = {
  conversation_id: string;
  user_id: string;
  role: string;
  joined_at: string;
};

export class ConversationRepository {
  async createConversation(
    payload: Pick<Conversation, "type" | "name" | "created_by">,
    memberIds: string[],
  ): Promise<Conversation> {
    const conversation: Conversation = {
      id: uuidv4(),
      type: payload.type,
      name: payload.name,
      created_by: payload.created_by,
      last_message_at: null,
      created_at: new Date().toISOString(),
    };

    await dynamo.send(
      new PutCommand({
        TableName: env.TABLE_CONVERSATIONS,
        Item: conversation,
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
              role: userId === payload.created_by ? "owner" : "member",
              joined_at: new Date().toISOString(),
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

    return (result.Item as Conversation | undefined) ?? null;
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

    return (result.Items as ConversationMember[] | undefined) ?? [];
  }

  async listByUserId(userId: string): Promise<Conversation[]> {
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

      membershipItems =
        (membership.Items as ConversationMember[] | undefined) ?? [];
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

      membershipItems =
        (fallback.Items as ConversationMember[] | undefined) ?? [];
    }

    const conversationIds =
      membershipItems.map((item) => item.conversation_id) ?? [];

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

    const rows = response.Responses?.[env.TABLE_CONVERSATIONS] as
      | Conversation[]
      | undefined;
    return rows ?? [];
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
              user_id: member.user_id,
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
