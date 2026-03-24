import { HttpError } from "../utils/http-error.js";
import { env } from "../config/env.js";

type UserBasic = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone?: string;
};

export class UserClientService {
  async getUserById(userId: string): Promise<UserBasic> {
    const response = await fetch(`${env.USER_SERVICE_BASE_URL}/users/${userId}`);
    if (!response.ok) {
      throw new HttpError(404, "user_not_found");
    }
    const body = (await response.json()) as { data: UserBasic };
    return body.data;
  }

  async searchByPhone(phone: string): Promise<UserBasic[]> {
    const response = await fetch(
      `${env.USER_SERVICE_BASE_URL}/users/search?phone=${encodeURIComponent(phone)}`,
    );
    if (!response.ok) {
      throw new HttpError(502, "user_service_unavailable");
    }
    const body = (await response.json()) as { data: UserBasic[] };
    return body.data;
  }
}
