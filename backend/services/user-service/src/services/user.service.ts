import { FriendshipStatus, Prisma } from "@prisma/client";
import { prisma } from "../config/db.js";
import { HttpError } from "../utils/http-error.js";

export class UserService {
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
    input: { fullName?: string | null; phone?: string | null; bio?: string | null },
  ) {
    if (!userId) {
      throw new HttpError(401, "unauthorized");
    }

    if (input.phone) {
      const existing = await prisma.user.findUnique({ where: { phone: input.phone } });
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

    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId, addresseeId: addressee.id },
          { requesterId: addressee.id, addresseeId: requesterId },
        ],
      },
    });

    if (!existing) {
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

    if (existing.status === FriendshipStatus.ACCEPTED) {
      throw new HttpError(409, "already_friends");
    }
    if (existing.status === FriendshipStatus.PENDING) {
      throw new HttpError(409, "friend_request_already_pending");
    }
    if (existing.status === FriendshipStatus.BLOCKED) {
      throw new HttpError(403, "friendship_blocked");
    }

    return prisma.friendship.update({
      where: { id: existing.id },
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

    const request = await prisma.friendship.findUnique({ where: { id: requestId } });
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

    return friendships.map((friendship) => {
      if (friendship.requester.id === userId) {
        return friendship.addressee;
      }
      return friendship.requester;
    });
  }

  async listUsers(page: number, limit: number) {
    const safePage = Number.isFinite(page) && page > 0 ? page : 1;
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 20;
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
