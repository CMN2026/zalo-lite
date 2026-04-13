import { redisPublisher } from "../config/redis.js";
import { env } from "../config/env.js";
import { retry } from "../utils/retry.js";
import { MessageRepository } from "../repositories/message.repository.js";
import { ConversationRepository } from "../repositories/conversation.repository.js";
import { ConversationService } from "./conversation.service.js";
import { HttpError } from "../utils/http-error.js";

export class MessageService {
  private readonly messageRepository = new MessageRepository();
  private readonly conversationService = new ConversationService();
  private readonly conversationRepository = new ConversationRepository();

  async sendMessage(input: {
    conversation_id: string;
    sender_id: string;
    type: string;
    content: string;
  }) {
    await this.conversationService.assertMember(
      input.conversation_id,
      input.sender_id,
    );

    const message = await this.messageRepository.create(input);
    await this.conversationRepository.updateLastMessageAt(
      input.conversation_id,
      message.created_at,
    );

    await retry(
      async () => {
        await redisPublisher.publish(
          env.REDIS_MESSAGE_CHANNEL,
          JSON.stringify(message),
        );
      },
      3,
      250,
    );

    return message;
  }

  async markMessagesAsRead(conversationId: string, userId: string) {
    await this.conversationService.assertMember(conversationId, userId);
    await this.messageRepository.markAsRead(conversationId, userId);

    // Publish read event to Redis
    await retry(
      async () => {
        await redisPublisher.publish(
          `${env.REDIS_MESSAGE_CHANNEL}:read`,
          JSON.stringify({
            conversationId,
            userId,
            timestamp: new Date().toISOString(),
          }),
        );
      },
      3,
      250,
    );
  }

  async deleteMessage(messageId: string, userId: string) {
    // Verify user owns the message
    const message = await this.messageRepository.getById(messageId);
    if (!message || message.sender_id !== userId) {
      throw new HttpError(403, "Unauthorized to delete this message");
    }

    await this.messageRepository.delete(messageId);

    // Publish delete event to Redis
    await retry(
      async () => {
        await redisPublisher.publish(
          `${env.REDIS_MESSAGE_CHANNEL}:delete`,
          JSON.stringify({
            messageId,
            conversationId: message.conversation_id,
            timestamp: new Date().toISOString(),
          }),
        );
      },
      3,
      250,
    );
  }

  async searchMessages(conversationId: string, userId: string, query: string) {
    await this.conversationService.assertMember(conversationId, userId);
    return this.messageRepository.search(conversationId, query);
  }

  async getMessageStats(conversationId: string, userId: string) {
    await this.conversationService.assertMember(conversationId, userId);
    return this.messageRepository.getStats(conversationId);
  }
}
