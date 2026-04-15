import { redisPublisher } from "../config/redis.js";
import { env } from "../config/env.js";
import { retry } from "../utils/retry.js";
import {
  MessageRepository,
  type MessageReactionKey,
} from "../repositories/message.repository.js";
import { ConversationRepository } from "../repositories/conversation.repository.js";
import { ConversationService } from "./conversation.service.js";
import { UserClientService } from "./user-client.service.js";
import { HttpError } from "../utils/http-error.js";

export class MessageService {
  private readonly messageRepository = new MessageRepository();
  private readonly conversationService = new ConversationService();
  private readonly conversationRepository = new ConversationRepository();
  private readonly userClient = new UserClientService(
    process.env.USER_SERVICE_BASE_URL || "http://localhost:3001",
  );

  private async assertDirectConversationNotBlocked(
    conversationId: string,
    senderId: string,
    memberIds: string[],
  ) {
    const conversation =
      await this.conversationRepository.getConversationById(conversationId);

    if (!conversation) {
      throw new HttpError(404, "conversation_not_found");
    }

    if (conversation.type !== "direct") {
      return;
    }

    const receiverId = memberIds.find((memberId) => memberId !== senderId);
    if (!receiverId) {
      throw new HttpError(400, "direct_conversation_invalid_members");
    }

    const friendship = await this.userClient.getFriendshipStatus(
      senderId,
      receiverId,
    );

    if (friendship.isBlocked) {
      if (friendship.blockedByUserId === senderId) {
        throw new HttpError(403, "you_blocked_this_user");
      }

      throw new HttpError(403, "you_are_blocked_by_user");
    }
  }

  async sendMessage(input: {
    conversation_id: string;
    sender_id: string;
    type: string;
    content: string;
    reply_to_message_id?: string;
  }) {
    const members = await this.conversationService.assertMember(
      input.conversation_id,
      input.sender_id,
    );
    await this.assertDirectConversationNotBlocked(
      input.conversation_id,
      input.sender_id,
      members.map((member) => member.userId),
    );

    if (input.reply_to_message_id) {
      const repliedMessage = await this.messageRepository.getById(
        input.reply_to_message_id,
      );

      if (!repliedMessage) {
        throw new HttpError(404, "reply_target_not_found");
      }

      if (repliedMessage.conversation_id !== input.conversation_id) {
        throw new HttpError(400, "reply_target_not_in_conversation");
      }
    }

    const message = await this.messageRepository.create(input);
    await this.conversationRepository.updateLastMessageAt(
      input.conversation_id,
      message.created_at,
    );
    await this.conversationRepository.restoreConversationForMembers(
      input.conversation_id,
    );

    try {
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
    } catch (publishError) {
      // Message is already persisted; don't fail upload/send on transient pub-sub outage.
      console.error("Failed to publish message event", publishError);
    }

    return message;
  }

  async getMessageById(messageId: string) {
    return this.messageRepository.getById(messageId);
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
    const message = await this.messageRepository.getById(messageId);
    if (!message) {
      throw new HttpError(404, "message_not_found");
    }

    await this.conversationService.assertMember(
      message.conversation_id,
      userId,
    );

    const updated = await this.messageRepository.deleteForUser(
      messageId,
      userId,
    );
    if (!updated) {
      throw new HttpError(404, "message_not_found");
    }

    await retry(
      async () => {
        await redisPublisher.publish(
          `${env.REDIS_MESSAGE_CHANNEL}:delete_for_user`,
          JSON.stringify({
            messageId,
            conversationId: message.conversation_id,
            userId,
            timestamp: new Date().toISOString(),
          }),
        );
      },
      3,
      250,
    );

    return updated;
  }

  async recallMessage(messageId: string, userId: string) {
    const message = await this.messageRepository.getById(messageId);
    if (!message) {
      throw new HttpError(404, "message_not_found");
    }

    await this.conversationService.assertMember(
      message.conversation_id,
      userId,
    );

    if (message.sender_id !== userId) {
      throw new HttpError(403, "cannot_recall_others_message");
    }

    const recalled = await this.messageRepository.recall(messageId, userId);
    if (!recalled) {
      throw new HttpError(404, "message_not_found");
    }

    await retry(
      async () => {
        await redisPublisher.publish(
          `${env.REDIS_MESSAGE_CHANNEL}:recall`,
          JSON.stringify({
            messageId,
            conversationId: recalled.conversation_id,
            recalledAt: recalled.recalled_at,
            recalledBy: recalled.recalled_by,
          }),
        );
      },
      3,
      250,
    );

    return recalled;
  }

  async reactToMessage(
    messageId: string,
    userId: string,
    reaction?: MessageReactionKey,
  ) {
    const message = await this.messageRepository.getById(messageId);
    if (!message) {
      throw new HttpError(404, "message_not_found");
    }

    await this.conversationService.assertMember(
      message.conversation_id,
      userId,
    );

    if (message.recalled_at) {
      throw new HttpError(400, "cannot_react_recalled_message");
    }

    const updated = await this.messageRepository.setReaction(
      messageId,
      userId,
      reaction,
    );

    if (!updated) {
      throw new HttpError(404, "message_not_found");
    }

    await retry(
      async () => {
        await redisPublisher.publish(
          `${env.REDIS_MESSAGE_CHANNEL}:reaction`,
          JSON.stringify({
            messageId,
            conversationId: updated.conversation_id,
            reactions: updated.reactions ?? [],
          }),
        );
      },
      3,
      250,
    );

    return updated;
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
