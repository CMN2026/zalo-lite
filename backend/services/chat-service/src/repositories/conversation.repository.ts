import {
  BatchGetCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
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

  async getConversationMembers(conversationId: string): Promise<ConversationMember[]> {
    const result = await dynamo.send(
      new QueryCommand({
        TableName: env.TABLE_CONVERSATION_MEMBERS,
        KeyConditionExpression: "conversation_id = :conversationId",
        ExpressionAttributeValues: { ":conversationId": conversationId },
      }),
    );

    return (result.Items as ConversationMember[] | undefined) ?? [];
  }

  async listByUserId(userId: string): Promise<Conversation[]> {
    const membership = await dynamo.send(
      new QueryCommand({
        TableName: env.TABLE_CONVERSATION_MEMBERS,
        IndexName: "user_id-index",
        KeyConditionExpression: "user_id = :userId",
        ExpressionAttributeValues: { ":userId": userId },
      }),
    );

    const conversationIds =
      (membership.Items as ConversationMember[] | undefined)?.map(
        (item) => item.conversation_id,
      ) ?? [];

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

    const rows =
      response.Responses?.[env.TABLE_CONVERSATIONS] as Conversation[] | undefined;
    return rows ?? [];
  }

  async updateLastMessageAt(conversationId: string, timestamp: string): Promise<void> {
    await dynamo.send(
      new UpdateCommand({
        TableName: env.TABLE_CONVERSATIONS,
        Key: { id: conversationId },
        UpdateExpression: "SET last_message_at = :timestamp",
        ExpressionAttributeValues: { ":timestamp": timestamp },
      }),
    );
  }
}
