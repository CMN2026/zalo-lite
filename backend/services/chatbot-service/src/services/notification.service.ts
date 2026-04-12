import { notificationRepository } from "../repositories/notification.repository.js";
import { publishNotification } from "../config/redis.js";

export class NotificationService {
  async sendNotification(
    title: string,
    content: string,
    type: "maintenance" | "alert" | "info",
    recipientType: "all" | "premium" | "online",
    createdBy: string,
  ) {
    const notification = await notificationRepository.create(
      title,
      content,
      type,
      recipientType,
      createdBy,
    );

    // Publish to Redis for real-time broadcasting
    const channel = `notifications:${recipientType}`;
    await publishNotification(channel, JSON.stringify(notification));

    return notification;
  }

  async markAsRead(notificationId: string, userId: string) {
    return notificationRepository.markAsRead(notificationId, userId);
  }

  async getRecentNotifications(limit: number = 10) {
    return notificationRepository.getLastNotifications(limit);
  }
}

export const notificationService = new NotificationService();
