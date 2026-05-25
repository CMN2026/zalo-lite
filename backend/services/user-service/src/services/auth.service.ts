import { AuthProvider, UserRole, VerificationStatus } from "@prisma/client";
import { createHash, randomInt } from "node:crypto";
import { prisma } from "../config/db.js";
import { env } from "../config/env.js";
import { signAccessToken, signPasswordResetToken, verifyPasswordResetToken } from "../utils/jwt.js";
import { verifyGoogleIdToken } from "../utils/google-auth.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { HttpError } from "../utils/http-error.js";
import { EmailService } from "./email.service.js";

type GoogleAuthInput = {
  idToken: string;
  phone?: string | null;
  fullName?: string | null;
  avatarUrl?: string | null;
};

type RegisterInput = {
  email: string;
  password: string;
  fullName: string;
  phone?: string | null;
  avatarUrl?: string | null;
};

type LoginInput = {
  identifier: string;
  password: string;
};

type RegisterVerifyInput = {
  verificationSessionId: string;
  code: string;
};

type RegisterResendInput = {
  verificationSessionId: string;
};

type ForgotPasswordInput = {
  email: string;
};

type ResetPasswordInput = {
  token: string;
  newPassword: string;
};

const OTP_TTL_MINUTES = 15;
const OTP_RESEND_SECONDS = 60;
const OTP_MAX_ATTEMPTS = 3;
const PASSWORD_RESET_TTL_MINUTES = 5;

export class AuthService {
  private readonly emailService = new EmailService();

  private generateOtpCode() {
    return randomInt(100000, 1000000).toString();
  }

  private hashOtpCode(code: string) {
    return createHash("sha256").update(code).digest("hex");
  }

  private getOtpExpiryDate() {
    return new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
  }

  private getResendAvailableDate() {
    return new Date(Date.now() + OTP_RESEND_SECONDS * 1000);
  }

  private async assertRegistrationIdentityAvailable(email: string, phone: string | null) {
    if (phone) {
      const occupiedPhone = await prisma.user.findUnique({ where: { phone } });
      if (occupiedPhone) {
        throw new HttpError(409, "phone_already_used");
      }
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
      include: { localCredential: true },
    });

    if (existingUser?.localCredential) {
      throw new HttpError(409, "email_already_registered");
    }
  }

  async initiateCredentialRegistration(input: RegisterInput) {
    const email = input.email.toLowerCase().trim();
    const phone = input.phone?.trim() || null;
    await this.assertRegistrationIdentityAvailable(email, phone);

    const passwordHash = await hashPassword(input.password);
    const otpCode = this.generateOtpCode();
    const otpHash = this.hashOtpCode(otpCode);

    const session = await prisma.emailVerificationSession.create({
      data: {
        email,
        fullName: input.fullName.trim(),
        phone,
        avatarUrl: input.avatarUrl ?? null,
        passwordHash,
        otpHash,
        otpExpiresAt: this.getOtpExpiryDate(),
        resendAvailableAt: this.getResendAvailableDate(),
        status: VerificationStatus.PENDING,
      },
    });

    await this.emailService.sendVerificationCode(email, otpCode, OTP_TTL_MINUTES);

    return {
      verificationSessionId: session.id,
      email: session.email,
      expiresAt: session.otpExpiresAt.toISOString(),
      resendAfterSeconds: OTP_RESEND_SECONDS,
      maxAttempts: OTP_MAX_ATTEMPTS,
    };
  }

  async verifyCredentialRegistration(input: RegisterVerifyInput) {
    const code = input.code.trim();
    if (!/^\d{6}$/.test(code)) {
      throw new HttpError(400, "verification_code_invalid");
    }

    const session = await prisma.emailVerificationSession.findUnique({
      where: { id: input.verificationSessionId },
    });

    if (!session) {
      throw new HttpError(404, "verification_session_not_found");
    }

    if (session.status !== VerificationStatus.PENDING) {
      throw new HttpError(400, "verification_session_inactive");
    }

    if (session.attemptCount >= OTP_MAX_ATTEMPTS) {
      await prisma.emailVerificationSession.update({
        where: { id: session.id },
        data: { status: VerificationStatus.CANCELLED },
      });
      throw new HttpError(400, "verification_failed_max_attempts");
    }

    if (session.otpExpiresAt.getTime() <= Date.now()) {
      await prisma.emailVerificationSession.update({
        where: { id: session.id },
        data: { status: VerificationStatus.EXPIRED },
      });
      throw new HttpError(400, "verification_code_expired");
    }

    const isValid = this.hashOtpCode(code) === session.otpHash;
    if (!isValid) {
      const nextAttemptCount = session.attemptCount + 1;
      const shouldCancel = nextAttemptCount >= OTP_MAX_ATTEMPTS;
      await prisma.emailVerificationSession.update({
        where: { id: session.id },
        data: {
          attemptCount: nextAttemptCount,
          status: shouldCancel ? VerificationStatus.CANCELLED : VerificationStatus.PENDING,
        },
      });

      if (shouldCancel) {
        throw new HttpError(400, "verification_failed_max_attempts");
      }

      throw new HttpError(400, "verification_code_invalid");
    }

    await this.assertRegistrationIdentityAvailable(session.email, session.phone);

    const defaultRole = env.ADMIN_EMAILS.includes(session.email)
      ? UserRole.ADMIN
      : UserRole.USER;

    const user = await prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({
        where: { email: session.email },
      });

      const targetUser = existingUser
        ? await tx.user.update({
            where: { id: existingUser.id },
            data: {
              fullName: session.fullName,
              phone: session.phone,
              avatarUrl: session.avatarUrl ?? existingUser.avatarUrl,
            },
          })
        : await tx.user.create({
            data: {
              email: session.email,
              fullName: session.fullName,
              phone: session.phone,
              avatarUrl: session.avatarUrl,
              role: defaultRole,
            },
          });

      await tx.localCredential.create({
        data: {
          userId: targetUser.id,
          passwordHash: session.passwordHash,
        },
      });

      await tx.emailVerificationSession.update({
        where: { id: session.id },
        data: {
          status: VerificationStatus.VERIFIED,
          userId: targetUser.id,
        },
      });

      return targetUser;
    });

    return this.buildAuthResponse(user);
  }

  async resendCredentialVerificationCode(input: RegisterResendInput) {
    const session = await prisma.emailVerificationSession.findUnique({
      where: { id: input.verificationSessionId },
    });

    if (!session) {
      throw new HttpError(404, "verification_session_not_found");
    }

    if (session.status !== VerificationStatus.PENDING) {
      throw new HttpError(400, "verification_session_inactive");
    }

    if (session.attemptCount >= OTP_MAX_ATTEMPTS) {
      await prisma.emailVerificationSession.update({
        where: { id: session.id },
        data: { status: VerificationStatus.CANCELLED },
      });
      throw new HttpError(400, "verification_failed_max_attempts");
    }

    if (session.otpExpiresAt.getTime() <= Date.now()) {
      await prisma.emailVerificationSession.update({
        where: { id: session.id },
        data: { status: VerificationStatus.EXPIRED },
      });
      throw new HttpError(400, "verification_code_expired");
    }

    if (session.resendAvailableAt.getTime() > Date.now()) {
      throw new HttpError(429, "resend_too_soon");
    }

    await this.assertRegistrationIdentityAvailable(session.email, session.phone);

    const otpCode = this.generateOtpCode();
    const nextSession = await prisma.emailVerificationSession.update({
      where: { id: session.id },
      data: {
        otpHash: this.hashOtpCode(otpCode),
        resendAvailableAt: this.getResendAvailableDate(),
      },
    });

    await this.emailService.sendVerificationCode(
      nextSession.email,
      otpCode,
      OTP_TTL_MINUTES,
    );

    return {
      verificationSessionId: nextSession.id,
      email: nextSession.email,
      expiresAt: nextSession.otpExpiresAt.toISOString(),
      resendAfterSeconds: OTP_RESEND_SECONDS,
    };
  }

  async registerWithCredentials(input: RegisterInput) {
    const email = input.email.toLowerCase().trim();
    const phone = input.phone?.trim() || null;
    const passwordHash = await hashPassword(input.password);

    if (phone) {
      const occupied = await prisma.user.findUnique({ where: { phone } });
      if (occupied) {
        throw new HttpError(409, "phone_already_used");
      }
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
      include: { localCredential: true },
    });

    if (existingUser?.localCredential) {
      throw new HttpError(409, "email_already_registered");
    }

    const defaultRole = env.ADMIN_EMAILS.includes(email)
      ? UserRole.ADMIN
      : UserRole.USER;

    const user = await prisma.$transaction(async (tx) => {
      const targetUser = existingUser
        ? await tx.user.update({
            where: { id: existingUser.id },
            data: {
              fullName: input.fullName,
              phone,
              avatarUrl: input.avatarUrl ?? existingUser.avatarUrl,
            },
          })
        : await tx.user.create({
            data: {
              email,
              fullName: input.fullName,
              phone,
              avatarUrl: input.avatarUrl,
              role: defaultRole,
            },
          });

      await tx.localCredential.create({
        data: {
          userId: targetUser.id,
          passwordHash,
        },
      });

      return targetUser;
    });

    return this.buildAuthResponse(user);
  }

  async loginWithCredentials(input: LoginInput) {
    const identifier = input.identifier.trim().toLowerCase();

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier },
          { phone: input.identifier.trim() },
        ],
      },
      include: { localCredential: true },
    });

    if (!user || !user.localCredential) {
      throw new HttpError(401, "invalid_credentials");
    }

    if (!user.isActive) {
      throw new HttpError(403, "account_inactive");
    }

    const ok = await verifyPassword(input.password, user.localCredential.passwordHash);
    if (!ok) {
      throw new HttpError(401, "invalid_credentials");
    }

    return this.buildAuthResponse(user);
  }

  async loginWithGoogle(input: GoogleAuthInput) {
    const identity = await verifyGoogleIdToken(input.idToken);
    if (!identity.emailVerified) {
      throw new HttpError(403, "google_email_not_verified");
    }

    if (input.phone) {
      const occupied = await prisma.user.findUnique({ where: { phone: input.phone } });
      if (occupied && occupied.email !== identity.email) {
        throw new HttpError(409, "phone_already_used");
      }
    }

    const existingIdentity = await prisma.authIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: AuthProvider.GOOGLE,
          providerUserId: identity.sub,
        },
      },
      include: { user: true },
    });

    if (existingIdentity) {
      if (!existingIdentity.user.isActive) {
        throw new HttpError(403, "account_inactive");
      }

      const updatedUser = await prisma.user.update({
        where: { id: existingIdentity.user.id },
        data: {
          fullName: input.fullName ?? existingIdentity.user.fullName,
          avatarUrl: input.avatarUrl ?? existingIdentity.user.avatarUrl,
          phone: input.phone ?? existingIdentity.user.phone,
        },
      });

      await prisma.authIdentity.update({
        where: { id: existingIdentity.id },
        data: { lastLoginAt: new Date() },
      });

      return this.buildAuthResponse(updatedUser);
    }

    const defaultRole = env.ADMIN_EMAILS.includes(identity.email)
      ? UserRole.ADMIN
      : UserRole.USER;

    const user = await prisma.$transaction(async (tx) => {
      const existingUserByEmail = await tx.user.findUnique({
        where: { email: identity.email },
      });

      const targetUser = existingUserByEmail
        ? await tx.user.update({
            where: { id: existingUserByEmail.id },
            data: {
              fullName:
                input.fullName ?? identity.name ?? existingUserByEmail.fullName,
              avatarUrl:
                input.avatarUrl ??
                identity.picture ??
                existingUserByEmail.avatarUrl,
              phone: input.phone ?? existingUserByEmail.phone,
              role: existingUserByEmail.role,
            },
          })
        : await tx.user.create({
            data: {
              email: identity.email,
              fullName: input.fullName ?? identity.name ?? "New User",
              avatarUrl: input.avatarUrl ?? identity.picture,
              phone: input.phone,
              role: defaultRole,
            },
          });

      await tx.authIdentity.create({
        data: {
          userId: targetUser.id,
          provider: AuthProvider.GOOGLE,
          providerUserId: identity.sub,
          lastLoginAt: new Date(),
        },
      });

      return targetUser;
    });

    return this.buildAuthResponse(user);
  }

  async requestPasswordReset(input: ForgotPasswordInput) {
    const email = input.email.toLowerCase().trim();
    const user = await prisma.user.findUnique({
      where: { email },
      include: { localCredential: true },
    });

    if (!user || !user.localCredential) {
      throw new HttpError(404, "email_not_found");
    }

    if (!user.isActive) {
      throw new HttpError(403, "account_inactive");
    }

    const token = signPasswordResetToken({ userId: user.id });
    const resetLink = `${env.PASSWORD_RESET_URL_BASE}?token=${encodeURIComponent(token)}`;
    await this.emailService.sendPasswordResetLink(
      user.email,
      resetLink,
      PASSWORD_RESET_TTL_MINUTES,
    );

    return {
      email: user.email,
      expiresInMinutes: PASSWORD_RESET_TTL_MINUTES,
    };
  }

  async resetPassword(input: ResetPasswordInput) {
    const token = input.token.trim();
    const newPassword = input.newPassword;
    if (!token) {
      throw new HttpError(400, "reset_token_missing");
    }

    let payload: { userId: string; type: "password_reset" };
    try {
      payload = verifyPasswordResetToken(token);
    } catch {
      throw new HttpError(400, "reset_token_invalid_or_expired");
    }

    if (payload.type !== "password_reset") {
      throw new HttpError(400, "reset_token_invalid_or_expired");
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { localCredential: true },
    });

    if (!user || !user.localCredential) {
      throw new HttpError(404, "user_not_found");
    }

    const passwordHash = await hashPassword(newPassword);
    await prisma.localCredential.update({
      where: { userId: user.id },
      data: { passwordHash },
    });

    return { success: true };
  }

  private buildAuthResponse(user: {
    id: string;
    email: string;
    fullName: string;
    phone: string | null;
    avatarUrl: string | null;
    role: "USER" | "ADMIN";
    plan: "FREE" | "PREMIUM";
  }) {
    const token = signAccessToken({
      userId: user.id,
      role: user.role,
      plan: user.plan,
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        role: user.role,
        plan: user.plan,
      },
    };
  }
}
