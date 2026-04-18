import { redisPublisher } from "../config/redis.js";
import { env } from "../config/env.js";
import { retry } from "../utils/retry.js";
import { MessageRepository, type Message } from "../repositories/message.repository.js";
import { ConversationRepository } from "../repositories/conversation.repository.js";
import { ConversationService } from "./conversation.service.js";

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
    await this.conversationService.assertMember(input.conversation_id, input.sender_id);

    const message = await this.messageRepository.create(input);
    await this.conversationRepository.updateLastMessageAt(
      input.conversation_id,
      message.created_at,
    );

    await retry(
      async () => {
        await redisPublisher.publish(env.REDIS_MESSAGE_CHANNEL, JSON.stringify(message));
      },
      3,
      250,
    );

    return message;
  }

  async persistIncomingMessage(message: Message): Promise<Message> {
    const savedMessage = await this.messageRepository.save(message);
    await this.conversationRepository.updateLastMessageAt(
      savedMessage.conversation_id,
      savedMessage.created_at,
    );

    return savedMessage;
  }
}
