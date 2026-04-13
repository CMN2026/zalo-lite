import { HttpError } from "../utils/http-error.js";
import {
  ConversationRepository,
  type Conversation,
  type ConversationMember,
} from "../repositories/conversation.repository.js";
import { MessageRepository } from "../repositories/message.repository.js";
import { UserClientService } from "./user-client.service.js";

export type ConversationWithMembers = Conversation & {
  memberIds: string[];
};


export class ConversationService {
  private readonly conversationRepository = new ConversationRepository();
  private readonly messageRepository = new MessageRepository();
  private readonly userClient = new UserClientService(
    process.env.USER_SERVICE_URL || "http://localhost:3000",
  );

  async createConversation(
    creatorId: string,
    input: { type: "direct" | "group"; name?: string; memberIds: string[] },
  ) {
    const uniqueMembers = Array.from(new Set([creatorId, ...input.memberIds]));

    if (input.type === "direct") {
      const withoutCreator = uniqueMembers.filter((id) => id !== creatorId);
      if (withoutCreator.length !== 1) {
        throw new HttpError(400, "direct_conversation_requires_one_receiver");
      }
    }

    if (input.type === "group" && uniqueMembers.length < 3) {
      throw new HttpError(400, "group_requires_at_least_three_members");
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
      memberIds: [otherUserId],
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
          memberIds: members.map((member) => member.user_id),
        };
      }),
    );

    return conversationsWithMembers;
  }

  async getMessages(userId: string, conversationId: string, limit: number) {
    await this.assertMember(conversationId, userId);
    return this.messageRepository.listByConversationId(conversationId, limit);
  }

  async getConversationDetail(userId: string, conversationId: string) {
    await this.assertMember(conversationId, userId);

    const conversation =
      await this.conversationRepository.getConversationById(conversationId);
    if (!conversation) {
      throw new HttpError(404, "conversation_not_found");
    }

    const members =
      await this.conversationRepository.getConversationMembers(conversationId);

    const membersWithProfile = await Promise.all(
      members.map(async (member) => {
        try {
          const profile = await this.userClient.getUserById(member.user_id);
          return { ...member, profile };
        } catch {
          return { ...member, profile: null };
        }
      }),
    );

    return { ...conversation, members: membersWithProfile };
  }

  async updateGroupConversation(
    userId: string,
    conversationId: string,
    input: { name: string },
  ) {
    const conversation = await this.assertGroupConversation(conversationId);
    await this.assertOwner(conversationId, userId);

    await this.conversationRepository.updateConversationName(
      conversationId,
      input.name,
    );

    return { ...conversation, name: input.name };
  }

  async deleteGroupConversation(userId: string, conversationId: string) {
    await this.assertGroupConversation(conversationId);
    await this.assertOwner(conversationId, userId);

    await this.conversationRepository.deleteConversation(conversationId);
  }

  async leaveConversation(userId: string, conversationId: string) {
    const conversation = await this.assertGroupConversation(conversationId);
    await this.assertMember(conversationId, userId);

    const members =
      await this.conversationRepository.getConversationMembers(conversationId);

    if (members.length <= 2) {
      throw new HttpError(400, "cannot_leave_group_with_two_or_fewer_members");
    }

    const currentMember = members.find((m) => m.user_id === userId);
    const isOwner = currentMember?.role === "owner";

    await this.conversationRepository.removeMember(conversationId, userId);

    if (isOwner) {
      const remaining = members.filter((m) => m.user_id !== userId);
      const nextOwner = remaining.sort(
        (a, b) =>
          new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime(),
      )[0];

      if (nextOwner) {
        await this.conversationRepository.updateMemberRole(
          conversationId,
          nextOwner.user_id,
          "owner",
        );
      }
    }
  }

  async addMembersToGroup(
    userId: string,
    conversationId: string,
    memberIds: string[],
  ) {
    await this.assertGroupConversation(conversationId);
    await this.assertMember(conversationId, userId);

    const existingMembers =
      await this.conversationRepository.getConversationMembers(conversationId);
    const existingIds = new Set(existingMembers.map((m) => m.user_id));
    const newMemberIds = memberIds.filter((id) => !existingIds.has(id));

    if (newMemberIds.length === 0) {
      throw new HttpError(400, "all_users_already_members");
    }

    await this.conversationRepository.addMembers(conversationId, newMemberIds);

    return { added_count: newMemberIds.length };
  }

  async removeMemberFromGroup(
    userId: string,
    conversationId: string,
    targetUserId: string,
  ) {
    await this.assertGroupConversation(conversationId);
    await this.assertOwner(conversationId, userId);

    if (userId === targetUserId) {
      throw new HttpError(400, "owner_cannot_remove_self");
    }

    const members =
      await this.conversationRepository.getConversationMembers(conversationId);
    const isMember = members.some((m) => m.user_id === targetUserId);
    if (!isMember) {
      throw new HttpError(404, "target_not_a_member");
    }

    await this.conversationRepository.removeMember(
      conversationId,
      targetUserId,
    );
  }

  async assertMember(conversationId: string, userId: string) {
    const members =
      await this.conversationRepository.getConversationMembers(conversationId);
    const isMember = members.some((item) => item.user_id === userId);
    if (!isMember) {
      throw new HttpError(403, "not_a_conversation_member");
    }
    return members;
  }

  private async assertGroupConversation(conversationId: string) {
    const conversation =
      await this.conversationRepository.getConversationById(conversationId);
    if (!conversation) {
      throw new HttpError(404, "conversation_not_found");
    }
    if (conversation.type !== "group") {
      throw new HttpError(400, "operation_only_for_group_conversations");
    }
    return conversation;
  }

  private async assertOwner(conversationId: string, userId: string) {
    const members =
      await this.conversationRepository.getConversationMembers(conversationId);
    const member = members.find((m) => m.user_id === userId);
    if (!member || member.role !== "owner") {
      throw new HttpError(403, "only_owner_can_perform_this_action");
    }
  }
}
