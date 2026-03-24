import { HttpError } from "../utils/http-error.js";
import {
  ConversationRepository,
  type Conversation,
} from "../repositories/conversation.repository.js";
import { MessageRepository } from "../repositories/message.repository.js";

export class ConversationService {
  private readonly conversationRepository = new ConversationRepository();
  private readonly messageRepository = new MessageRepository();

  async createConversation(
    creatorId: string,
    input: { type: "direct" | "group"; name?: string; member_ids: string[] },
  ) {
    const uniqueMembers = Array.from(new Set([creatorId, ...input.member_ids]));

    if (input.type === "direct") {
      const withoutCreator = uniqueMembers.filter((id) => id !== creatorId);
      if (withoutCreator.length !== 1) {
        throw new HttpError(400, "direct_conversation_requires_one_receiver");
      }
    }

    if (uniqueMembers.length < 2) {
      throw new HttpError(400, "conversation_requires_at_least_two_members");
    }

    return this.conversationRepository.createConversation(
      {
        type: input.type,
        name: input.name ?? null,
        created_by: creatorId,
      },
      uniqueMembers,
    );
  }

  async getConversations(userId: string): Promise<Conversation[]> {
    return this.conversationRepository.listByUserId(userId);
  }

  async getMessages(userId: string, conversationId: string, limit: number) {
    await this.assertMember(conversationId, userId);
    return this.messageRepository.listByConversationId(conversationId, limit);
  }

  async assertMember(conversationId: string, userId: string) {
    const members = await this.conversationRepository.getConversationMembers(conversationId);
    const isMember = members.some((item) => item.user_id === userId);
    if (!isMember) {
      throw new HttpError(403, "not_a_conversation_member");
    }
  }
}
