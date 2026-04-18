import { v4 as uuidv4 } from "uuid";
import { dynamoDB } from "../config/dynamodb.js";
import { env } from "../config/env.js";
import { PutCommand, UpdateCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

export interface INotification {
  notificationId: string;
  title: string;
  content: string;
  type: "maintenance" | "alert" | "info";
  recipientType: "all" | "premium" | "online";
  sentAt: number;
  sentTo: number;
  readBy: string[];
  createdBy: string;
  ttl?: number;
}

export class NotificationRepository {
  async create(
    title: string,
    content: string,
    type: "maintenance" | "alert" | "info",
    recipientType: "all" | "premium" | "online",
    createdBy: string,
  ): Promise<INotification> {
    const notificationId = uuidv4();
    const sentAt = Date.now();
    const ttl = Math.floor(sentAt / 1000) + 30 * 24 * 60 * 60; // 30 days

    const notification: INotification = {
      notificationId,
      title,
      content,
      type,
      recipientType,
      sentAt,
      sentTo: 0,
      readBy: [],
      createdBy,
      ttl,
    };

    await dynamoDB.send(
      new PutCommand({
        TableName: env.TABLE_NOTIFICATIONS,
        Item: notification,
      }),
    );

    return notification;
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    // Get notification first to get sentAt (range key)
    const result = await dynamoDB.send(
      new QueryCommand({
        TableName: env.TABLE_NOTIFICATIONS,
        KeyConditionExpression: "notificationId = :id",
        ExpressionAttributeValues: {
          ":id": notificationId,
        },
        Limit: 1,
      }),
    );

    if (result.Items && result.Items.length > 0) {
      const notification = result.Items[0] as INotification;

      await dynamoDB.send(
        new UpdateCommand({
          TableName: env.TABLE_NOTIFICATIONS,
          Key: {
            notificationId,
            sentAt: notification.sentAt,
          },
          UpdateExpression: "ADD readBy :userId",
          ExpressionAttributeValues: {
            ":userId": new Set([userId]),
          },
        }),
      );
    }
  }

  async getLastNotifications(limit: number = 10): Promise<INotification[]> {
    const result = await dynamoDB.send(
      new QueryCommand({
        TableName: env.TABLE_NOTIFICATIONS,
        IndexName: "type-sentAt-index",
        KeyConditionExpression: "#type = :type",
        ExpressionAttributeNames: {
          "#type": "type",
        },
        ExpressionAttributeValues: {
          ":type": "info",
        },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );

    return (result.Items as INotification[]) || [];
  }
}

export const notificationRepository = new NotificationRepository();
