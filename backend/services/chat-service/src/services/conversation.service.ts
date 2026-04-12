import { HttpError } from "../utils/http-error.js";
import {
  ConversationRepository,
  type Conversation,
} from "../repositories/conversation.repository.js";
import { MessageRepository } from "../repositories/message.repository.js";

export type ConversationWithMembers = Conversation & {
  member_ids: string[];
};

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

  async getOrCreateDirectConversation(
    userId: string,
    otherUserId: string,
  ): Promise<Conversation> {
    // Get all conversations for the user
    const userConversations =
      await this.conversationRepository.listByUserId(userId);

    // Find existing direct conversation with the other user
    for (const conversation of userConversations) {
      if (conversation.type === "direct") {
        const members =
          await this.conversationRepository.getConversationMembers(
            conversation.id,
          );
        const hasOtherUser = members.some((m) => m.user_id === otherUserId);
        if (hasOtherUser) {
          return conversation;
        }
      }
    }

    // Create new direct conversation if it doesn't exist
    return this.createConversation(userId, {
      type: "direct",
      member_ids: [otherUserId],
    });
  }

  async getConversations(userId: string): Promise<ConversationWithMembers[]> {
    const conversations =
      await this.conversationRepository.listByUserId(userId);

    const conversationsWithMembers = await Promise.all(
      conversations.map(async (conversation) => {
        const members =
          await this.conversationRepository.getConversationMembers(
            conversation.id,
          );

        return {
          ...conversation,
          member_ids: members.map((member) => member.user_id),
        };
      }),
    );

    return conversationsWithMembers;
  }

  async getMessages(userId: string, conversationId: string, limit: number) {
    await this.assertMember(conversationId, userId);
    return this.messageRepository.listByConversationId(conversationId, limit);
  }

  async assertMember(conversationId: string, userId: string) {
    const members =
      await this.conversationRepository.getConversationMembers(conversationId);
    const isMember = members.some((item) => item.user_id === userId);
    if (!isMember) {
      throw new HttpError(403, "not_a_conversation_member");
    }
  }
}
