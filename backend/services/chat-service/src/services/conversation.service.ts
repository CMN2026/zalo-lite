import { HttpError } from "../utils/http-error.js";
import {
  ConversationRepository,
  type Conversation,
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
    process.env.USER_SERVICE_BASE_URL || "http://localhost:3001",
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

      const receiverId = withoutCreator[0];
      if (!(await this.userClient.isFriend(creatorId, receiverId))) {
        throw new HttpError(403, "direct_conversation_requires_friendship");
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
        createdBy: creatorId,
      },
      uniqueMembers,
    );
  }

  async getOrCreateDirectConversation(
    userId: string,
    otherUserId: string,
  ): Promise<Conversation> {
    if (!(await this.userClient.isFriend(userId, otherUserId))) {
      throw new HttpError(403, "direct_conversation_requires_friendship");
    }

    // Get all conversations for the user
    const userConversations = await this.conversationRepository.listByUserId(
      userId,
      true,
    );

    // Find all existing direct conversations with the other user.
    const matchedDirectConversations: Conversation[] = [];
    for (const conversation of userConversations) {
      if (conversation.type !== "direct") {
        continue;
      }

      const members = await this.conversationRepository.getConversationMembers(
        conversation.id,
      );
      const hasOtherUser = members.some((m) => m.userId === otherUserId);
      if (hasOtherUser) {
        matchedDirectConversations.push(conversation);
      }
    }

    if (matchedDirectConversations.length > 0) {
      // Prefer the most recently active conversation to avoid returning stale duplicates.
      const selected = matchedDirectConversations.sort((a, b) => {
        const aTs = a.lastMessageAt ?? a.createdAt;
        const bTs = b.lastMessageAt ?? b.createdAt;
        return new Date(bTs).getTime() - new Date(aTs).getTime();
      })[0];

      await this.conversationRepository.restoreConversationForUser(
        selected.id,
        userId,
      );
      return selected;
    }

    // Create new direct conversation if it doesn't exist
    return this.createConversation(userId, {
      type: "direct",
      memberIds: [otherUserId],
    });
  }

  async getConversations(userId: string): Promise<ConversationWithMembers[]> {
    await this.ensureDirectConversationsForFriends(userId);

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
          memberIds: members.map((member) => member.userId),
        };
      }),
    );

    const directByFriendId = new Map<string, ConversationWithMembers>();
    const groups: ConversationWithMembers[] = [];

    for (const conversation of conversationsWithMembers) {
      if (conversation.type !== "direct") {
        groups.push(conversation);
        continue;
      }

      const friendId = conversation.memberIds.find((id) => id !== userId);
      if (!friendId) {
        continue;
      }

      const existing = directByFriendId.get(friendId);
      if (!existing) {
        directByFriendId.set(friendId, conversation);
        continue;
      }

      const existingTimestamp =
        existing.lastMessageAt ??
        existing.createdAt ??
        "1970-01-01T00:00:00.000Z";
      const currentTimestamp =
        conversation.lastMessageAt ??
        conversation.createdAt ??
        "1970-01-01T00:00:00.000Z";

      if (
        new Date(currentTimestamp).getTime() >
        new Date(existingTimestamp).getTime()
      ) {
        directByFriendId.set(friendId, conversation);
      }
    }

    return [...groups, ...directByFriendId.values()];
  }

  async getMessages(userId: string, conversationId: string, limit: number) {
    await this.assertMember(conversationId, userId);
    const member = await this.conversationRepository.getMember(
      conversationId,
      userId,
    );

    return this.messageRepository.listByConversationId(
      conversationId,
      limit,
      userId,
      member?.clearedAt ?? null,
    );
  }

  async hideConversationForUser(userId: string, conversationId: string) {
    await this.assertMember(conversationId, userId);

    await this.conversationRepository.hideConversationForUser(
      conversationId,
      userId,
      new Date().toISOString(),
    );
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
          const profile = await this.userClient.getUserById(member.userId);
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

    const currentMember = members.find((m) => m.userId === userId);
    const isOwner = currentMember?.role === "owner";

    await this.conversationRepository.removeMember(conversationId, userId);

    if (isOwner) {
      const remaining = members.filter((m) => m.userId !== userId);
      const nextOwner = remaining.sort(
        (a, b) =>
          new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime(),
      )[0];

      if (nextOwner) {
        await this.conversationRepository.updateMemberRole(
          conversationId,
          nextOwner.userId,
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
    const existingIds = new Set(existingMembers.map((m) => m.userId));
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
    const isMember = members.some((m) => m.userId === targetUserId);
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
    const isMember = members.some((item) => item.userId === userId);
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
    const member = members.find((m) => m.userId === userId);
    if (!member || member.role !== "owner") {
      throw new HttpError(403, "only_owner_can_perform_this_action");
    }
  }

  private async ensureDirectConversationsForFriends(userId: string) {
    let friends: Array<{ id: string }> = [];
    try {
      friends = await this.userClient.listFriends(userId);
    } catch {
      // Keep conversation listing available even when user-service is degraded.
      return;
    }

    if (friends.length === 0) {
      return;
    }

    const existingConversations =
      await this.conversationRepository.listByUserId(userId, true);
    const directConversationByFriendId = new Set<string>();

    for (const conversation of existingConversations) {
      if (conversation.type !== "direct") {
        continue;
      }

      const members = await this.conversationRepository.getConversationMembers(
        conversation.id,
      );

      const friendMember = members.find((member) => member.userId !== userId);
      if (friendMember) {
        directConversationByFriendId.add(friendMember.userId);
      }
    }

    const missingFriendIds = friends
      .map((item) => item.id)
      .filter((friendId) => !directConversationByFriendId.has(friendId));

    if (missingFriendIds.length === 0) {
      return;
    }

    await Promise.all(
      missingFriendIds.map((friendId) =>
        this.conversationRepository.createConversation(
          {
            type: "direct",
            name: null,
            createdBy: userId,
          },
          [userId, friendId],
        ),
      ),
    );
  }
}
