import { HttpError } from "../utils/http-error.js";
import { db } from "../config/db.js";
import { AccountRepository } from "../repositories/account.repository.js";
import { UserRepository } from "../repositories/user.repository.js";
import { EmailVerificationRepository } from "../repositories/emailVerification.repository.js";
import { EmailService } from "./email.service.js";
import { comparePassword, hashPassword } from "../utils/password.js";
import { signAccessToken } from "../utils/jwt.js";
import { v4 as uuidv4 } from "uuid";

const emailService = new EmailService();
const emailVerificationRepository = new EmailVerificationRepository();

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
  private readonly emailVerificationRepository =
    new EmailVerificationRepository();

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
    let accountId = "";
    try {
      await client.query("BEGIN");
      const initialStatus = input.email ? "pending" : "active";
      const account = await this.accountRepository.create(
        {
          phone: input.phone,
          password_hash: passwordHash,
          account_type: input.account_type ?? "standard",
          status: initialStatus,
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
      accountId = account.id;
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

    // If email present and account pending, create verification token and send email
    if (input.email) {
      try {
        const verificationToken = uuidv4();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
        await emailVerificationRepository.create({
          account_id: accountId,
          token: verificationToken,
          expires_at: expiresAt,
        });

        const backendUrl = process.env.BACKEND_URL || "http://localhost:3001";
        const link = `${backendUrl}/auth/verify?token=${verificationToken}`;
        await emailService.sendVerificationEmail(input.email, link);
      } catch (err) {
        // log but don't fail registration
        console.error("Failed to send verification email:", err);
      }
    }

    const verificationSent = Boolean(input.email);
    return {
      token,
      verification_sent: verificationSent,
      user: {
        id: userId,
        full_name: fullName,
        phone: input.phone,
        avatar_url: avatarUrl,
        email: input.email ?? null,
      },
    };
  }

  async verifyEmail(token: string) {
    const record = await this.emailVerificationRepository.findByToken(token);
    if (!record) {
      throw new HttpError(400, "invalid_or_expired_token");
    }
    if (record.used) {
      throw new HttpError(400, "token_already_used");
    }
    if (new Date(record.expires_at) < new Date()) {
      throw new HttpError(400, "invalid_or_expired_token");
    }

    await this.accountRepository.updateStatus(record.account_id, "active");
    await this.emailVerificationRepository.markUsed(record.id);
    return { success: true };
  }

  async resendVerification(email: string) {
    const account = await this.accountRepository.findByEmail(email);
    if (!account) {
      throw new HttpError(404, "account_not_found");
    }
    if (account.status === "active") {
      throw new HttpError(400, "already_verified");
    }

    const verificationToken = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await emailVerificationRepository.create({
      account_id: account.id,
      token: verificationToken,
      expires_at: expiresAt,
    });
    const backendUrl = process.env.BACKEND_URL || "http://localhost:3001";
    const link = `${backendUrl}/auth/verify?token=${verificationToken}`;
    await emailService.sendVerificationEmail(email, link);
    return { success: true };
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
