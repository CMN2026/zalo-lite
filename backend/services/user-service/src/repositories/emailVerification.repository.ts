import { db } from "../config/db.js";
import { v4 as uuidv4 } from "uuid";

export type EmailVerification = {
  id: string;
  account_id: string;
  token: string;
  expires_at: Date;
  used: boolean;
  created_at: Date;
};

type CreateInput = {
  account_id: string;
  token: string;
  expires_at: Date;
};

export class EmailVerificationRepository {
  async create(input: CreateInput): Promise<EmailVerification> {
    const result = await db.query<EmailVerification>(
      `
      INSERT INTO email_verifications (id, account_id, token, expires_at, used, created_at)
      VALUES ($1, $2, $3, $4, false, NOW())
      RETURNING *
      `,
      [uuidv4(), input.account_id, input.token, input.expires_at],
    );
    return result.rows[0];
  }

  async findByToken(token: string): Promise<EmailVerification | null> {
    const result = await db.query<EmailVerification>(
      `
      SELECT * FROM email_verifications WHERE token = $1 LIMIT 1
      `,
      [token],
    );
    return result.rows[0] ?? null;
  }

  async markUsed(id: string): Promise<void> {
    await db.query(
      `
      UPDATE email_verifications SET used = true WHERE id = $1
      `,
      [id],
    );
  }
}
