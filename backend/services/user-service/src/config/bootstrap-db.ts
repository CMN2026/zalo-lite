import { prisma } from "./db.js";

export async function ensureEmailVerificationSchema() {
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'verification_status') THEN
        CREATE TYPE verification_status AS ENUM ('PENDING', 'VERIFIED', 'EXPIRED', 'CANCELLED');
      END IF;
    END
    $$;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS email_verification_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) NOT NULL,
      full_name VARCHAR(100) NOT NULL,
      phone VARCHAR(20),
      avatar_url TEXT,
      password_hash VARCHAR(255) NOT NULL,
      otp_hash VARCHAR(255) NOT NULL,
      otp_expires_at TIMESTAMPTZ NOT NULL,
      resend_available_at TIMESTAMPTZ NOT NULL,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      status verification_status NOT NULL DEFAULT 'PENDING',
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS idx_email_verification_sessions_email ON email_verification_sessions(email);`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS idx_email_verification_sessions_status ON email_verification_sessions(status);`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS idx_email_verification_sessions_otp_expires_at ON email_verification_sessions(otp_expires_at);`,
  );
}
