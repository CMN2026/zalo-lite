import {
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { dynamo } from "../config/dynamodb.js";
import { env } from "../config/env.js";

export type FriendRequest = {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
};

export type Friendship = {
  user_id: string;
  friend_id: string;
  nickname?: string;
  is_favorite?: boolean;
  created_at: string;
};

export class FriendRepository {
  async createRequest(senderId: string, receiverId: string): Promise<FriendRequest> {
    const item: FriendRequest = {
      id: uuidv4(),
      sender_id: senderId,
      receiver_id: receiverId,
      status: "pending",
      created_at: new Date().toISOString(),
    };

    await dynamo.send(
      new PutCommand({
        TableName: env.TABLE_FRIEND_REQUESTS,
        Item: item,
      }),
    );

    return item;
  }

  async getRequestById(requestId: string): Promise<FriendRequest | null> {
    const result = await dynamo.send(
      new GetCommand({
        TableName: env.TABLE_FRIEND_REQUESTS,
        Key: { id: requestId },
      }),
    );

    return (result.Item as FriendRequest | undefined) ?? null;
  }

  async hasPendingRequest(senderId: string, receiverId: string): Promise<boolean> {
    const result = await dynamo.send(
      new ScanCommand({
        TableName: env.TABLE_FRIEND_REQUESTS,
        FilterExpression:
          "sender_id = :sender AND receiver_id = :receiver AND #st = :status",
        ExpressionAttributeNames: { "#st": "status" },
        ExpressionAttributeValues: {
          ":sender": senderId,
          ":receiver": receiverId,
          ":status": "pending",
        },
        Limit: 1,
      }),
    );

    return (result.Items?.length ?? 0) > 0;
  }

  async markRequestAccepted(requestId: string): Promise<void> {
    await dynamo.send(
      new UpdateCommand({
        TableName: env.TABLE_FRIEND_REQUESTS,
        Key: { id: requestId },
        UpdateExpression: "SET #st = :status",
        ExpressionAttributeNames: { "#st": "status" },
        ExpressionAttributeValues: { ":status": "accepted" },
      }),
    );
  }

  async createFriendship(userId: string, friendId: string): Promise<void> {
    await dynamo.send(
      new PutCommand({
        TableName: env.TABLE_FRIENDSHIPS,
        Item: {
          user_id: userId,
          friend_id: friendId,
          nickname: null,
          is_favorite: false,
          created_at: new Date().toISOString(),
        },
      }),
    );
  }

  async isFriend(userId: string, friendId: string): Promise<boolean> {
    const result = await dynamo.send(
      new GetCommand({
        TableName: env.TABLE_FRIENDSHIPS,
        Key: {
          user_id: userId,
          friend_id: friendId,
        },
      }),
    );

    return Boolean(result.Item);
  }

  async getFriendsByUserId(userId: string): Promise<Friendship[]> {
    const result = await dynamo.send(
      new QueryCommand({
        TableName: env.TABLE_FRIENDSHIPS,
        KeyConditionExpression: "user_id = :userId",
        ExpressionAttributeValues: {
          ":userId": userId,
        },
      }),
    );

    return (result.Items as Friendship[] | undefined) ?? [];
  }
}
