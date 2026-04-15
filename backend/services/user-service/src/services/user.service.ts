import { FriendshipStatus, Prisma } from "@prisma/client";
import { prisma } from "../config/db.js";
import { HttpError } from "../utils/http-error.js";

export class UserService {
  private static readonly BLOCK_ONLY_MARKER = "__blocked_only__";

  private async findFriendshipPair(userId: string, otherUserId: string) {
    return prisma.friendship.findMany({
      where: {
        OR: [
          { requesterId: userId, addresseeId: otherUserId },
          { requesterId: otherUserId, addresseeId: userId },
        ],
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  async listChatPeers(userId: string | undefined, limit = 50) {
    if (!userId) {
      throw new HttpError(401, "unauthorized");
    }

    const safeLimit =
      Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 50;

    return prisma.user.findMany({
      where: {
        id: { not: userId },
        isActive: true,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        avatarUrl: true,
        role: true,
      },
      orderBy: { createdAt: "desc" },
      take: safeLimit,
    });
  }

  async getByIdOrThrow(userId: string | undefined) {
    if (!userId) {
      throw new HttpError(401, "unauthorized");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        fullName: true,
        avatarUrl: true,
        bio: true,
        role: true,
        plan: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new HttpError(404, "user_not_found");
    }

    return user;
  }

  async updateProfile(
    userId: string | undefined,
    input: {
      fullName?: string | null;
      phone?: string | null;
      bio?: string | null;
    },
  ) {
    if (!userId) {
      throw new HttpError(401, "unauthorized");
    }

    if (input.phone) {
      const existing = await prisma.user.findUnique({
        where: { phone: input.phone },
      });
      if (existing && existing.id !== userId) {
        throw new HttpError(409, "phone_already_used");
      }
    }

    return prisma.user.update({
      where: { id: userId },
      data: {
        fullName: input.fullName ?? undefined,
        phone: input.phone ?? undefined,
        bio: input.bio ?? undefined,
      },
      select: {
        id: true,
        email: true,
        phone: true,
        fullName: true,
        avatarUrl: true,
        bio: true,
        role: true,
        plan: true,
        updatedAt: true,
      },
    });
  }

  async updateAvatar(userId: string | undefined, avatarUrl: string) {
    if (!userId) {
      throw new HttpError(401, "unauthorized");
    }

    return prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: {
        id: true,
        avatarUrl: true,
        updatedAt: true,
      },
    });
  }

  async discoverByPhone(userId: string, phone: string) {
    if (!phone) {
      return [];
    }

    return prisma.user.findMany({
      where: {
        id: { not: userId },
        phone: {
          contains: phone,
          mode: Prisma.QueryMode.insensitive,
        },
        isActive: true,
      },
      select: {
        id: true,
        fullName: true,
        phone: true,
        avatarUrl: true,
        plan: true,
      },
      take: 20,
      orderBy: { createdAt: "desc" },
    });
  }

  async sendFriendRequest(
    requesterId: string | undefined,
    phone: string,
    message?: string,
  ) {
    if (!requesterId) {
      throw new HttpError(401, "unauthorized");
    }

    const addressee = await prisma.user.findUnique({ where: { phone } });
    if (!addressee) {
      throw new HttpError(404, "target_user_not_found");
    }
    if (!addressee.isActive) {
      throw new HttpError(403, "target_user_inactive");
    }
    if (addressee.id === requesterId) {
      throw new HttpError(400, "cannot_add_yourself");
    }

    const relationships = await prisma.friendship.findMany({
      where: {
        OR: [
          { requesterId, addresseeId: addressee.id },
          { requesterId: addressee.id, addresseeId: requesterId },
        ],
      },
      orderBy: { updatedAt: "desc" },
    });

    const sameDirection = relationships.find(
      (item) =>
        item.requesterId === requesterId && item.addresseeId === addressee.id,
    );
    const oppositeDirection = relationships.find(
      (item) =>
        item.requesterId === addressee.id && item.addresseeId === requesterId,
    );

    if (
      relationships.some((item) => item.status === FriendshipStatus.ACCEPTED)
    ) {
      throw new HttpError(409, "already_friends");
    }

    if (
      relationships.some((item) => item.status === FriendshipStatus.BLOCKED)
    ) {
      throw new HttpError(403, "friendship_blocked");
    }

    if (sameDirection?.status === FriendshipStatus.PENDING) {
      throw new HttpError(409, "friend_request_already_pending");
    }

    if (oppositeDirection?.status === FriendshipStatus.PENDING) {
      return prisma.friendship.update({
        where: { id: oppositeDirection.id },
        data: {
          status: FriendshipStatus.ACCEPTED,
          respondedAt: new Date(),
        },
        include: {
          requester: {
            select: { id: true, fullName: true, phone: true, avatarUrl: true },
          },
          addressee: {
            select: { id: true, fullName: true, phone: true, avatarUrl: true },
          },
        },
      });
    }

    if (!sameDirection) {
      return prisma.friendship.create({
        data: {
          requesterId,
          addresseeId: addressee.id,
          message: message ?? null,
        },
        include: {
          addressee: {
            select: { id: true, fullName: true, phone: true, avatarUrl: true },
          },
        },
      });
    }

    return prisma.friendship.update({
      where: { id: sameDirection.id },
      data: {
        requesterId,
        addresseeId: addressee.id,
        status: FriendshipStatus.PENDING,
        message: message ?? null,
        respondedAt: null,
      },
      include: {
        addressee: {
          select: { id: true, fullName: true, phone: true, avatarUrl: true },
        },
      },
    });
  }

  async listIncomingRequests(userId: string | undefined) {
    if (!userId) {
      throw new HttpError(401, "unauthorized");
    }

    return prisma.friendship.findMany({
      where: {
        addresseeId: userId,
        status: FriendshipStatus.PENDING,
      },
      include: {
        requester: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            avatarUrl: true,
            plan: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async respondFriendRequest(
    userId: string | undefined,
    requestId: string,
    action: "accept" | "reject",
  ) {
    if (!userId) {
      throw new HttpError(401, "unauthorized");
    }

    const request = await prisma.friendship.findUnique({
      where: { id: requestId },
    });
    if (!request || request.addresseeId !== userId) {
      throw new HttpError(404, "friend_request_not_found");
    }
    if (request.status !== FriendshipStatus.PENDING) {
      throw new HttpError(409, "friend_request_already_processed");
    }

    return prisma.friendship.update({
      where: { id: requestId },
      data: {
        status:
          action === "accept"
            ? FriendshipStatus.ACCEPTED
            : FriendshipStatus.REJECTED,
        respondedAt: new Date(),
      },
      include: {
        requester: {
          select: { id: true, fullName: true, phone: true, avatarUrl: true },
        },
        addressee: {
          select: { id: true, fullName: true, phone: true, avatarUrl: true },
        },
      },
    });
  }

  async listFriends(userId: string | undefined) {
    if (!userId) {
      throw new HttpError(401, "unauthorized");
    }

    const friendships = await prisma.friendship.findMany({
      where: {
        status: FriendshipStatus.ACCEPTED,
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      include: {
        requester: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            avatarUrl: true,
            plan: true,
          },
        },
        addressee: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            avatarUrl: true,
            plan: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const friends = friendships.map((friendship) => {
      if (friendship.requester.id === userId) {
        return friendship.addressee;
      }
      return friendship.requester;
    });

    const uniqueById = new Map(friends.map((friend) => [friend.id, friend]));
    return Array.from(uniqueById.values());
  }

  async getFriendshipStatus(userId: string | undefined, otherUserId: string) {
    if (!userId) {
      throw new HttpError(401, "unauthorized");
    }

    if (userId === otherUserId) {
      throw new HttpError(400, "invalid_friendship_target");
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: otherUserId },
      select: { id: true, fullName: true, avatarUrl: true, phone: true },
    });

    if (!targetUser) {
      throw new HttpError(404, "target_user_not_found");
    }

    const relationships = await this.findFriendshipPair(userId, otherUserId);
    const active = relationships[0] ?? null;

    const status = active?.status ?? null;
    const blockedByUserId =
      active?.status === FriendshipStatus.BLOCKED ? active.requesterId : null;

    return {
      userId,
      otherUserId,
      status,
      isBlocked: status === FriendshipStatus.BLOCKED,
      blockedByUserId,
      friendshipId: active?.id ?? null,
      targetUser,
    };
  }

  async blockFriendship(userId: string | undefined, otherUserId: string) {
    if (!userId) {
      throw new HttpError(401, "unauthorized");
    }

    if (userId === otherUserId) {
      throw new HttpError(400, "cannot_block_yourself");
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: otherUserId },
      select: { id: true, isActive: true },
    });

    if (!targetUser || !targetUser.isActive) {
      throw new HttpError(404, "target_user_not_found");
    }

    const relationships = await this.findFriendshipPair(userId, otherUserId);

    const preferred =
      relationships.find(
        (item) =>
          item.requesterId === userId && item.addresseeId === otherUserId,
      ) ?? relationships[0];

    if (!preferred) {
      const created = await prisma.friendship.create({
        data: {
          requesterId: userId,
          addresseeId: otherUserId,
          status: FriendshipStatus.BLOCKED,
          respondedAt: new Date(),
          message: UserService.BLOCK_ONLY_MARKER,
        },
      });

      return {
        id: created.id,
        status: created.status,
        blockedByUserId: userId,
        requesterId: created.requesterId,
        addresseeId: created.addresseeId,
      };
    }

    const updated = await prisma.friendship.update({
      where: { id: preferred.id },
      data: {
        requesterId: userId,
        addresseeId: otherUserId,
        status: FriendshipStatus.BLOCKED,
        respondedAt: new Date(),
        message:
          preferred.message === UserService.BLOCK_ONLY_MARKER
            ? UserService.BLOCK_ONLY_MARKER
            : preferred.message,
      },
    });

    return {
      id: updated.id,
      status: updated.status,
      blockedByUserId: userId,
      requesterId: updated.requesterId,
      addresseeId: updated.addresseeId,
    };
  }

  async unblockFriendship(userId: string | undefined, otherUserId: string) {
    if (!userId) {
      throw new HttpError(401, "unauthorized");
    }

    const relationships = await this.findFriendshipPair(userId, otherUserId);
    const blocked = relationships.find(
      (item) => item.status === FriendshipStatus.BLOCKED,
    );

    if (!blocked) {
      throw new HttpError(409, "friendship_not_blocked");
    }

    if (blocked.requesterId !== userId) {
      throw new HttpError(403, "only_blocker_can_unblock");
    }

    const nextStatus =
      blocked.message === UserService.BLOCK_ONLY_MARKER
        ? FriendshipStatus.REJECTED
        : FriendshipStatus.ACCEPTED;

    const updated = await prisma.friendship.update({
      where: { id: blocked.id },
      data: {
        status: nextStatus,
        respondedAt: new Date(),
        message:
          blocked.message === UserService.BLOCK_ONLY_MARKER
            ? null
            : blocked.message,
      },
    });

    return {
      id: updated.id,
      status: updated.status,
      requesterId: updated.requesterId,
      addresseeId: updated.addresseeId,
    };
  }

  async listUsers(page: number, limit: number) {
    const safePage = Number.isFinite(page) && page > 0 ? page : 1;
    const safeLimit =
      Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 20;
    const skip = (safePage - 1) * safeLimit;

    const [items, total] = await prisma.$transaction([
      prisma.user.findMany({
        skip,
        take: safeLimit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          phone: true,
          fullName: true,
          avatarUrl: true,
          role: true,
          plan: true,
          isActive: true,
          createdAt: true,
        },
      }),
      prisma.user.count(),
    ]);

    return {
      items,
      meta: {
        page: safePage,
        limit: safeLimit,
        total,
      },
    };
  }
}
