import { redisPublisher } from "../config/redis.js";
import { HttpError } from "../utils/http-error.js";
import { FriendRepository } from "../repositories/friend.repository.js";
import { UserClientService } from "./user-client.service.js";
import { env } from "../config/env.js";

export class FriendService {
  private readonly friendRepository = new FriendRepository();
  private readonly userClient = new UserClientService(
    env.USER_SERVICE_BASE_URL,
  );

  async sendRequest(senderId: string, receiverId: string) {
    if (senderId === receiverId) {
      throw new HttpError(400, "cannot_add_self");
    }

    await this.userClient.getUserById(receiverId);

    if (await this.friendRepository.isFriend(senderId, receiverId)) {
      throw new HttpError(409, "already_friends");
    }

    if (await this.friendRepository.hasPendingRequest(senderId, receiverId)) {
      throw new HttpError(409, "friend_request_already_sent");
    }

    return this.friendRepository.createRequest(senderId, receiverId);
  }

  async acceptRequest(userId: string, requestId: string) {
    const request = await this.friendRepository.getRequestById(requestId);
    if (!request || request.status !== "pending") {
      throw new HttpError(404, "friend_request_not_found");
    }

    if (request.receiver_id !== userId) {
      throw new HttpError(403, "cannot_accept_other_request");
    }

    await this.friendRepository.markRequestAccepted(request.id);
    await this.friendRepository.createFriendship(
      request.sender_id,
      request.receiver_id,
    );
    await this.friendRepository.createFriendship(
      request.receiver_id,
      request.sender_id,
    );

    return { accepted_request_id: request.id };
  }

  async listFriends(userId: string) {
    const friendships = await this.friendRepository.getFriendsByUserId(userId);

    return Promise.all(
      friendships.map(async (item) => {
        const cacheKey = `user:basic:${item.friend_id}`;
        const cached = await redisPublisher.get(cacheKey);

        if (cached) {
          return { ...item, profile: JSON.parse(cached) };
        }

        const profile = await this.userClient.getUserById(item.friend_id);
        await redisPublisher.set(cacheKey, JSON.stringify(profile), {
          EX: 300,
        });

        return { ...item, profile };
      }),
    );
  }

  async searchByPhone(userId: string, phone: string) {
    const users = await this.userClient.searchByPhone(phone);
    const result = await Promise.all(
      users
        .filter((item) => item.id !== userId)
        .map(async (item) => {
          const isFriend = await this.friendRepository.isFriend(
            userId,
            item.id,
          );
          return {
            ...item,
            is_friend: isFriend,
          };
        }),
    );

    return result;
  }
}
