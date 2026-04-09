import { AuthProvider, UserRole } from "@prisma/client";
import { prisma } from "../config/db.js";
import { env } from "../config/env.js";
import { signAccessToken } from "../utils/jwt.js";
import { verifyGoogleIdToken } from "../utils/google-auth.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { HttpError } from "../utils/http-error.js";

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

export class AuthService {
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
