import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
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
    };

    await dynamo.send(
      new PutCommand({
        TableName: env.TABLE_MESSAGES,
        Item: message,
      }),
    );

    return message;
  }

  async listByConversationId(conversationId: string, limit = 50): Promise<Message[]> {
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

    return ((response.Items as Message[] | undefined) ?? []).reverse();
  }
}
