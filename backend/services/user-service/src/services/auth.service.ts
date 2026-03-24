import { HttpError } from "../utils/http-error.js";
import { db } from "../config/db.js";
import { AccountRepository } from "../repositories/account.repository.js";
import { UserRepository } from "../repositories/user.repository.js";
import { comparePassword, hashPassword } from "../utils/password.js";
import { signAccessToken } from "../utils/jwt.js";

type RegisterInput = {
  phone: string;
  password: string;
  full_name: string;
  birth_date?: string;
  gender?: string;
  email?: string;
  account_type?: string;
};

type LoginInput = {
  phone: string;
  password: string;
};

export class AuthService {
  private readonly accountRepository = new AccountRepository();
  private readonly userRepository = new UserRepository();

  async register(input: RegisterInput) {
    const existing = await this.accountRepository.findByPhone(input.phone);
    if (existing) {
      throw new HttpError(409, "phone_already_registered");
    }

    const passwordHash = await hashPassword(input.password);
    const client = await db.connect();

    let userId = "";
    let fullName: string | null = null;
    let avatarUrl: string | null = null;
    try {
      await client.query("BEGIN");
      const account = await this.accountRepository.create(
        {
          phone: input.phone,
          password_hash: passwordHash,
          account_type: input.account_type ?? "standard",
          status: "active",
          email: input.email ?? null,
        },
        client,
      );

      const user = await this.userRepository.create(
        {
          account_id: account.id,
          full_name: input.full_name,
          birth_date: input.birth_date ?? null,
          gender: input.gender ?? null,
          avatar_url: null,
        },
        client,
      );

      await client.query("COMMIT");
      userId = user.id;
      fullName = user.full_name;
      avatarUrl = user.avatar_url;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    const token = signAccessToken({ user_id: userId });

    return {
      token,
      user: {
        id: userId,
        full_name: fullName,
        phone: input.phone,
        avatar_url: avatarUrl,
      },
    };
  }

  async login(input: LoginInput) {
    const account = await this.accountRepository.findByPhone(input.phone);
    if (!account) {
      throw new HttpError(401, "invalid_credentials");
    }

    const isValidPassword = await comparePassword(
      input.password,
      account.password_hash,
    );
    if (!isValidPassword) {
      throw new HttpError(401, "invalid_credentials");
    }

    if (account.status !== "active") {
      throw new HttpError(403, "account_inactive");
    }

    await this.accountRepository.updateLastLoginAt(account.id);
    const user = await this.userRepository.findByAccountId(account.id);
    if (!user) {
      throw new HttpError(500, "user_profile_missing");
    }

    const token = signAccessToken({ user_id: user.id });

    return {
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        phone: account.phone,
        avatar_url: user.avatar_url,
      },
    };
  }
}
