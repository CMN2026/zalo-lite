import {
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { dynamo } from "../config/dynamodb.js";
import { env } from "../config/env.js";

export type CallParticipantState =
  | "initiated"
  | "invited"
  | "connected"
  | "declined"
  | "left"
  | "missed";

export type CallSessionStatus = "active" | "ended";

export type CallSessionParticipant = {
  user_id: string;
  state: CallParticipantState;
  joined_at?: string;
  left_at?: string;
};

export type CallSession = {
  id: string;
  conversation_id: string;
  call_type: "direct" | "group";
  initiator_id: string;
  participants: CallSessionParticipant[];
  participant_user_ids: string[];
  status: CallSessionStatus;
  started_at: string;
  ended_at?: string;
  duration_seconds?: number;
  end_reason?: string;
};

export type CallHistoryStatus = "answered" | "declined" | "missed";

export type CallHistoryItem = {
  user_id: string;
  created_at_call_id: string;
  call_id: string;
  conversation_id: string;
  call_type: "direct" | "group";
  initiator_id: string;
  status: CallHistoryStatus;
  started_at: string;
  ended_at?: string;
  duration_seconds?: number;
  end_reason?: string;
  participant_user_ids: string[];
};

export class CallRepository {
  async createSession(session: CallSession): Promise<CallSession> {
    await dynamo.send(
      new PutCommand({
        TableName: env.TABLE_CALL_SESSIONS,
        Item: session,
      }),
    );
    return session;
  }

  async getSessionById(callId: string): Promise<CallSession | null> {
    const result = await dynamo.send(
      new GetCommand({
        TableName: env.TABLE_CALL_SESSIONS,
        Key: { id: callId },
      }),
    );
    return (result.Item as CallSession | undefined) ?? null;
  }

  async saveSession(session: CallSession): Promise<CallSession> {
    await dynamo.send(
      new PutCommand({
        TableName: env.TABLE_CALL_SESSIONS,
        Item: session,
      }),
    );
    return session;
  }

  async listActiveByUserId(userId: string): Promise<CallSession[]> {
    const response = await dynamo.send(
      new ScanCommand({
        TableName: env.TABLE_CALL_SESSIONS,
        FilterExpression:
          "#status = :active AND contains(participant_user_ids, :userId)",
        ExpressionAttributeNames: {
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":active": "active",
          ":userId": userId,
        },
      }),
    );

    return (response.Items as CallSession[] | undefined) ?? [];
  }

  async listAllActive(): Promise<CallSession[]> {
    const response = await dynamo.send(
      new ScanCommand({
        TableName: env.TABLE_CALL_SESSIONS,
        FilterExpression: "#status = :active",
        ExpressionAttributeNames: {
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":active": "active",
        },
      }),
    );

    return (response.Items as CallSession[] | undefined) ?? [];
  }

  async getActiveByConversationId(
    conversationId: string,
  ): Promise<CallSession | null> {
    const response = await dynamo.send(
      new ScanCommand({
        TableName: env.TABLE_CALL_SESSIONS,
        FilterExpression:
          "#status = :active AND conversation_id = :cid",
        ExpressionAttributeNames: {
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":active": "active",
          ":cid": conversationId,
        },
      }),
    );

    const items = (response.Items as CallSession[] | undefined) ?? [];
    return items[0] ?? null;
  }

  async appendHistory(items: CallHistoryItem[]): Promise<void> {
    for (const item of items) {
      await dynamo.send(
        new PutCommand({
          TableName: env.TABLE_CALL_HISTORY,
          Item: item,
        }),
      );
    }
  }

  async listHistoryByUserId(
    userId: string,
    limit: number,
  ): Promise<CallHistoryItem[]> {
    const response = await dynamo.send(
      new QueryCommand({
        TableName: env.TABLE_CALL_HISTORY,
        KeyConditionExpression: "user_id = :userId",
        ExpressionAttributeValues: {
          ":userId": userId,
        },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );

    return (response.Items as CallHistoryItem[] | undefined) ?? [];
  }
}
