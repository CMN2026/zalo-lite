import { HttpError } from "../utils/http-error.js";
import { UserRepository } from "../repositories/user.repository.js";

export class UserService {
  private readonly userRepository = new UserRepository();

  async getByIdOrThrow(userId: string | undefined) {
    if (!userId) {
      throw new HttpError(401, "unauthorized");
    }

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new HttpError(404, "user_not_found");
    }

    return user;
  }

  async searchByPhone(phone: string) {
    if (!phone) {
      return [];
    }
    return this.userRepository.searchByPhone(phone);
  }
}
